#!/usr/bin/env node
// =============================================================
// coletar-quinzenal.js
// Acessa cada processo do LinkLei pelo link direto e coleta
// as movimentações dos últimos 15 dias
// Salva: dados/quinzenal-AAAA-MM-DD.json
// =============================================================

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, '..', 'config', 'linklei-cookies.json');
const DATA_HOJE = process.env.DATA_HOJE || new Date().toISOString().split('T')[0];
const ARQUIVO_SAIDA = path.join(__dirname, '..', 'dados', `quinzenal-${DATA_HOJE}.json`);

// Links da planilha — atualize esta lista a cada ciclo
// Formato: { cliente, processo, link, whatsapp }
// O script principal lê isso do arquivo links-processos.json
const LINKS_FILE = path.join(__dirname, '..', 'config', 'links-processos.json');

function calcularData15DiasAtras() {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d;
}

function parsearData(textoData) {
    // Formatos: "30/04/2026", "2026-04-30"
    if (!textoData) return null;
    const match = textoData.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}`);
    const match2 = textoData.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match2) return new Date(textoData);
    return null;
}

async function coletarProcesso(page, processo) {
    const { cliente, numeroProcesso, link, whatsapp } = processo;

    // Linha sem link — retorna mensagem padrão
    if (!link || link.trim() === '') {
        return {
            cliente,
            numeroProcesso,
            whatsapp,
            link: '',
            status: 'SEM_LINK',
            movimentacoes: [],
            mensagemPadrao: 'Processo em elaboração ou extrajudicial — sem movimentação no sistema.'
        };
    }

    try {
        console.log(`Coletando: ${cliente} — ${numeroProcesso}`);
        await page.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });

        // Verifica sessão expirada
        const url = page.url();
        if (url.includes('/login') || url.includes('/auth')) {
            return { cliente, numeroProcesso, whatsapp, link, status: 'SESSAO_EXPIRADA', movimentacoes: [] };
        }

        await new Promise(r => setTimeout(r, 3000));

        // Extrai movimentações
        const movimentacoes = await page.evaluate(() => {
            const itens = [];
            
            // Busca os itens de movimentação
            const seletores = [
                '.movement-item',
                '[class*="movement"]',
                '[class*="movimentacao"]',
                '.notification-item',
                '[class*="timeline"]',
                'li[class*="item"]'
            ];

            let elementos = [];
            for (const sel of seletores) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    elementos = Array.from(els);
                    break;
                }
            }

            // Se não encontrou por seletor, tenta extrair texto estruturado
            if (elementos.length === 0) {
                // Pega toda a área de movimentações
                const areaMovimentacoes = document.querySelector('main') || document.body;
                const texto = areaMovimentacoes.innerText;
                return [{ descricao: texto, data: '', bruto: true }];
            }

            elementos.forEach(el => {
                const texto = el.innerText || el.textContent || '';
                if (texto.trim().length < 10) return;

                // Tenta extrair a data
                const matchData = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
                const data = matchData ? matchData[1] : '';

                itens.push({
                    descricao: texto.trim(),
                    data: data
                });
            });

            return itens;
        });

        // Filtra movimentações dos últimos 15 dias
        const limite = calcularData15DiasAtras();
        const movimentacoesRecentes = movimentacoes.filter(m => {
            if (!m.data) return true; // Inclui se não tem data (será analisado pela Routine)
            if (m.bruto) return true;
            const dataMovimentacao = parsearData(m.data);
            return dataMovimentacao && dataMovimentacao >= limite;
        });

        return {
            cliente,
            numeroProcesso,
            whatsapp,
            link,
            status: 'OK',
            movimentacoes: movimentacoesRecentes,
            totalMovimentacoes: movimentacoes.length,
            dataColeta: DATA_HOJE
        };

    } catch (error) {
        console.error(`Erro em ${cliente}: ${error.message}`);
        return {
            cliente,
            numeroProcesso,
            whatsapp,
            link,
            status: 'ERRO',
            erro: error.message,
            movimentacoes: []
        };
    }
}

async function main() {
    console.log(`Coleta quinzenal iniciada: ${DATA_HOJE}`);

    if (!fs.existsSync(COOKIES_FILE)) {
        console.error('Cookies não encontrados. Execute: node scripts/salvar-sessao.js');
        process.exit(2);
    }

    if (!fs.existsSync(LINKS_FILE)) {
        console.error(`Arquivo de links não encontrado: ${LINKS_FILE}`);
        console.error('Execute: node scripts/exportar-links-planilha.js');
        process.exit(1);
    }

    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    const processos = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));

    console.log(`Total de processos: ${processos.length}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        await page.setCookie(...cookies);

        // Verifica sessão antes de começar
        await page.goto('https://app.linklei.com.br/workspace/legal-process/list', {
            waitUntil: 'networkidle2', timeout: 30000
        });

        if (page.url().includes('/login')) {
            console.error('SESSAO_EXPIRADA');
            await browser.close();
            process.exit(2);
        }

        const resultados = [];

        for (const processo of processos) {
            const resultado = await coletarProcesso(page, processo);
            resultados.push(resultado);

            // Pausa entre processos para não sobrecarregar
            await new Promise(r => setTimeout(r, 2000));
        }

        // Atualiza cookies
        const cookiesAtualizados = await page.cookies();
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookiesAtualizados, null, 2));

        await browser.close();

        // Salva resultado
        const saida = {
            dataColeta: DATA_HOJE,
            totalProcessos: processos.length,
            resultados
        };

        fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(saida, null, 2));
        console.log(`Salvo: ${ARQUIVO_SAIDA}`);
        console.log(`Processos coletados: ${resultados.filter(r => r.status === 'OK').length}`);
        console.log(`Sem link: ${resultados.filter(r => r.status === 'SEM_LINK').length}`);
        console.log(`Erros: ${resultados.filter(r => r.status === 'ERRO').length}`);

        process.exit(0);

    } catch (error) {
        console.error('Erro geral:', error.message);
        if (browser) await browser.close();
        process.exit(1);
    }
}

main();
