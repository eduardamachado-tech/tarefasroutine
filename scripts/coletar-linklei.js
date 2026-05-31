const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL_NOTIFICACOES = 'https://app.linklei.com.br/workspace/notifications/?type=process_movement';
const COOKIES_FILE = path.join(__dirname, '..', 'config', 'linklei-cookies.json');
const PROCESSOS_FILE = path.join(__dirname, '..', 'config', 'links-processos.json');
const DATA_HOJE = process.env.DATA_HOJE || new Date().toISOString().split('T')[0];
const ARQUIVO_SAIDA = path.join(__dirname, '..', 'dados', 'linklei-raw-' + DATA_HOJE + '.txt');

// Extrai nomes de clientes do texto bruto das notificações
// Procura padrões como "Do cliente\nNOME DO CLIENTE"
function extrairClientesDasNotificacoes(texto) {
    const clientes = new Set();
    const linhas = texto.split('\n');
    for (let i = 0; i < linhas.length; i++) {
        if (linhas[i].trim() === 'Do cliente' && i + 1 < linhas.length) {
            const nome = linhas[i + 1].trim();
            if (nome && nome.length > 3 && nome !== 'Movimentação processual') {
                clientes.add(nome.toUpperCase());
            }
        }
    }
    return [...clientes];
}

// Extrai títulos de processo/partes do texto bruto das notificações
function extrairTitulosProcessosDasNotificacoes(texto) {
    const titulos = [];
    const linhas = texto.split('\n');
    for (let i = 0; i < linhas.length; i++) {
        if (linhas[i].trim() === 'No processo' && i + 1 < linhas.length) {
            const titulo = linhas[i + 1].trim();
            if (titulo && titulo.length > 3) {
                titulos.push(titulo.toUpperCase());
            }
        }
    }
    return [...new Set(titulos)];
}

// Testa se um processo deve ser visitado com base nos clientes/títulos notificados
function processoFoiNotificado(proc, clientesNotificados, titulosNotificados) {
    const clienteProc = proc.cliente.toUpperCase();
    const numProc = (proc.numeroProcesso || '').toUpperCase();

    // Match direto pelo nome do cliente
    for (const c of clientesNotificados) {
        if (clienteProc.includes(c) || c.includes(clienteProc)) return true;
        // Match por palavra significativa do nome
        const palavras = c.split(' ').filter(p => p.length > 4);
        if (palavras.some(p => clienteProc.includes(p))) return true;
    }

    // Match pelo título do processo (partes)
    for (const titulo of titulosNotificados) {
        const palavras = titulo.split(/[\s;x]+/).filter(p => p.length > 4 && !/^\d+$/.test(p));
        if (palavras.some(p => clienteProc.includes(p) || numProc.includes(p))) return true;
    }

    return false;
}

async function visitarProcesso(page, link, cliente, numeroProcesso) {
    try {
        await page.goto(link, { waitUntil: 'networkidle2', timeout: 25000 });
        await new Promise(r => setTimeout(r, 3500));

        const conteudo = await page.evaluate(() => {
            // Tenta extrair apenas a seção de movimentações, se existir
            const seletores = [
                '[class*="movement"]',
                '[class*="moviment"]',
                '[class*="timeline"]',
                '[class*="history"]',
                '[class*="event"]',
                '[class*="activity"]',
            ];
            for (const sel of seletores) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    const textos = Array.from(els)
                        .map(el => el.innerText?.trim())
                        .filter(t => t && t.length > 30);
                    if (textos.length > 0) {
                        return textos.slice(0, 20).join('\n---\n').substring(0, 6000);
                    }
                }
            }
            // Fallback: texto completo da página
            return document.body.innerText.trim().substring(0, 6000);
        });

        return { ok: true, conteudo };
    } catch (e) {
        return { ok: false, conteudo: `[ERRO AO VISITAR PAGINA: ${e.message}]` };
    }
}

async function main() {
    console.log('Coleta do LinkLei: ' + DATA_HOJE);

    if (!fs.existsSync(COOKIES_FILE)) {
        console.error('Cookies nao encontrados: ' + COOKIES_FILE);
        process.exit(2);
    }

    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    const processosConfig = fs.existsSync(PROCESSOS_FILE)
        ? JSON.parse(fs.readFileSync(PROCESSOS_FILE, 'utf8'))
        : [];

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        const page = await browser.newPage();
        await page.setCookie(...cookies);

        // Etapa 1: Painel de notificações
        await page.goto(URL_NOTIFICACOES, { waitUntil: 'networkidle2', timeout: 30000 });
        const urlAtual = page.url();
        if (urlAtual.includes('/login') || urlAtual.includes('/auth')) {
            console.error('SESSAO_EXPIRADA');
            await browser.close();
            process.exit(2);
        }
        await new Promise(r => setTimeout(r, 4000));

        const textoNotificacoes = await page.evaluate(() => document.body.innerText.trim());

        // Salva cookies atualizados
        const cookies2 = await page.cookies();
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies2, null, 2));

        if (textoNotificacoes.length < 50) {
            const header = `COLETA LINKLEI\nData: ${DATA_HOJE}\n${'='.repeat(60)}\n\nSEM_MOVIMENTACOES`;
            fs.writeFileSync(ARQUIVO_SAIDA, header);
            console.log('Sem movimentacoes hoje.');
            await browser.close();
            process.exit(0);
        }

        // Etapa 2: Identifica processos notificados
        const clientesNotificados = extrairClientesDasNotificacoes(textoNotificacoes);
        const titulosNotificados = extrairTitulosProcessosDasNotificacoes(textoNotificacoes);

        console.log(`Clientes notificados: ${clientesNotificados.join(', ') || 'nenhum identificado'}`);
        console.log(`Titulos de processo: ${titulosNotificados.length} encontrados`);

        // Filtra processos com link que foram notificados
        const processosParaVisitar = processosConfig.filter(p =>
            p.link && p.link.startsWith('https://app.linklei.com.br') &&
            processoFoiNotificado(p, clientesNotificados, titulosNotificados)
        );

        console.log(`Processos para visitar: ${processosParaVisitar.length}`);

        // Etapa 3: Monta saída
        const header = `COLETA LINKLEI\nData: ${DATA_HOJE}\n${'='.repeat(60)}\n\n`;
        let saida = header;
        saida += `RESUMO DAS NOTIFICAÇÕES\n${'─'.repeat(60)}\n`;
        saida += textoNotificacoes + '\n';

        if (processosParaVisitar.length > 0) {
            saida += `\n${'='.repeat(60)}\nCONTEÚDO DETALHADO DOS PROCESSOS NOTIFICADOS\n${'='.repeat(60)}\n`;

            for (const proc of processosParaVisitar) {
                console.log(`  Visitando: ${proc.cliente} — ${proc.numeroProcesso}`);
                const resultado = await visitarProcesso(page, proc.link, proc.cliente, proc.numeroProcesso);

                saida += `\n${'─'.repeat(60)}\n`;
                saida += `PROCESSO: ${proc.numeroProcesso}\n`;
                saida += `CLIENTE: ${proc.cliente}\n`;
                saida += `${'─'.repeat(60)}\n`;
                saida += resultado.conteudo + '\n';
            }
        } else {
            saida += `\n[AVISO: Nenhum processo com link cadastrado em links-processos.json foi identificado nas notificações de hoje. Os rascunhos serão gerados com marcadores [INSERIR] baseados nos títulos das notificações.]\n`;
        }

        await browser.close();
        fs.writeFileSync(ARQUIVO_SAIDA, saida);
        console.log('Salvo: ' + ARQUIVO_SAIDA);
        process.exit(0);

    } catch (e) {
        console.error('Erro: ' + e.message);
        if (browser) await browser.close();
        process.exit(1);
    }
}

main();
