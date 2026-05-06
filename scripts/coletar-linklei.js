#!/usr/bin/env node
// ================================================================
// coletar-linklei.js
// Acessa o LinkLei usando cookies de sessão salvos e extrai
// o conteúdo das movimentações processuais
//
// Códigos de saída:
//   0 = sucesso
//   1 = erro genérico
//   2 = sessão expirada (cookies inválidos ou login necessário)
// ================================================================

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL_LINKLEI = 'https://app.linklei.com.br/workspace/notifications/?type=process_movement';
const COOKIES_FILE = path.join(__dirname, '..', 'config', 'linklei-cookies.json');
const DATA_HOJE = process.env.DATA_HOJE || new Date().toISOString().split('T')[0];
const REPO_DIR = path.join(__dirname, '..');
const ARQUIVO_SAIDA = path.join(REPO_DIR, 'dados', `linklei-raw-${DATA_HOJE}.txt`);

async function main() {
    console.log(`Coleta do LinkLei — ${DATA_HOJE}`);

    if (!fs.existsSync(COOKIES_FILE)) {
        console.error('Arquivo de cookies não encontrado:', COOKIES_FILE);
        console.error('Execute: node scripts/salvar-sessao.js');
        process.exit(2);
    }

    let cookies;
    try {
        cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    } catch (e) {
        console.error('Erro ao ler cookies:', e.message);
        process.exit(2);
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setCookie(...cookies);

        console.log('Acessando LinkLei...');
        const response = await page.goto(URL_LINKLEI, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Verifica sessão expirada por URL
        const urlAtual = page.url();
        if (
            urlAtual.includes('/login') ||
            urlAtual.includes('/auth') ||
            urlAtual.includes('/signin') ||
            urlAtual.includes('/entrar')
        ) {
            console.error('SESSÃO EXPIRADA — redirecionou para login:', urlAtual);
            await browser.close();
            process.exit(2);
        }

        // Verifica sessão expirada por elemento de login na página
        const campoSenha = await page.$('input[type="password"]');
        if (campoSenha) {
            console.error('SESSÃO EXPIRADA — formulário de login detectado na página');
            await browser.close();
            process.exit(2);
        }

        // Aguarda carregamento completo das notificações
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Extrai conteúdo visível da área de movimentações
        const conteudo = await page.evaluate(() => {
            const remover = document.querySelectorAll('script, style, noscript, header, footer, nav');
            remover.forEach(el => el.remove());

            const seletores = [
                '[data-testid="notifications-list"]',
                '[data-testid="notification-item"]',
                '.notifications-container',
                '.notification-list',
                '.movimentacoes',
                '.process-list',
                'main',
                '[role="main"]',
                '#app main',
                '.content'
            ];

            for (const sel of seletores) {
                const el = document.querySelector(sel);
                if (el && el.innerText && el.innerText.trim().length > 100) {
                    return el.innerText.trim();
                }
            }

            return document.body.innerText.trim();
        });

        // Atualiza cookies (pode ter sido renovado)
        const cookiesAtualizados = await page.cookies();
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookiesAtualizados, null, 2));

        await browser.close();

        // Monta o arquivo de saída
        const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const header = [
            `COLETA LINKLEI`,
            `Data: ${DATA_HOJE}`,
            `Horário: ${horario}`,
            `URL: ${URL_LINKLEI}`,
            `=`.repeat(60),
            ''
        ].join('\n');

        if (!conteudo || conteudo.length < 50) {
            fs.writeFileSync(ARQUIVO_SAIDA,
                header + 'SEM_MOVIMENTACOES\nNenhum conteúdo de movimentação detectado na página.'
            );
            console.log('Página carregada mas sem movimentações detectadas.');
        } else {
            fs.writeFileSync(ARQUIVO_SAIDA, header + conteudo);
            console.log(`Salvo: ${ARQUIVO_SAIDA} (${conteudo.length} chars)`);
        }

        process.exit(0);

    } catch (error) {
        console.error('Erro na coleta:', error.message);
        if (browser) await browser.close();
        process.exit(1);
    }
}

main();
