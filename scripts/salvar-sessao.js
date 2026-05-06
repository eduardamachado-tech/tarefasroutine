#!/usr/bin/env node
// ================================================================
// salvar-sessao.js
// Execute este script NO SEU COMPUTADOR (não no VPS)
// quando precisar renovar a sessão do LinkLei
//
// O que ele faz:
// 1. Abre o Chrome real (com janela visível)
// 2. Você faz login normalmente
// 3. Ele salva os cookies no arquivo config/linklei-cookies.json
// 4. Você envia o arquivo para o VPS via scp ou pelo GitHub
//
// Como executar:
//   node scripts/salvar-sessao.js
// ================================================================

const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, '..', 'config', 'linklei-cookies.json');
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const URL_LOGIN = 'https://app.linklei.com.br/login';
const URL_ALVO = 'https://app.linklei.com.br/workspace/notifications/?type=process_movement';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const aguardar = (txt) => new Promise(res => rl.question(txt, res));

async function main() {
    console.log('');
    console.log('=== RENOVAÇÃO DE SESSÃO — LINKLEI ===');
    console.log('');
    console.log('Um navegador será aberto. Faça login normalmente.');
    console.log('Após ver as movimentações, volte aqui e pressione ENTER.');
    console.log('');
    await aguardar('Pressione ENTER para abrir o navegador...');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
        });

        const page = await browser.newPage();
        await page.goto(URL_LOGIN, { waitUntil: 'networkidle2' });

        console.log('');
        console.log('Faça login no LinkLei no navegador que abriu.');
        await aguardar('Após estar logado e ver as movimentações, pressione ENTER aqui...');

        // Navega para a página de movimentações para confirmar acesso
        await page.goto(URL_ALVO, { waitUntil: 'networkidle2' });
        await new Promise(res => setTimeout(res, 2000));

        const urlAtual = page.url();
        if (urlAtual.includes('/login') || urlAtual.includes('/auth')) {
            console.error('');
            console.error('ERRO: Ainda na página de login. Tente novamente.');
            await browser.close();
            rl.close();
            process.exit(1);
        }

        const cookies = await page.cookies();
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));

        await browser.close();
        rl.close();

        console.log('');
        console.log(`Sessão salva com sucesso: ${COOKIES_FILE}`);
        console.log(`Total de cookies: ${cookies.length}`);
        console.log('');
        console.log('Próximo passo: envie o arquivo para o VPS.');
        console.log('Comando:');
        console.log(`  scp ${COOKIES_FILE} root@SEU_IP_VPS:/root/tarefasroutine/config/linklei-cookies.json`);
        console.log('');
        console.log('Ou adicione ao .gitignore e envie via GitHub (não recomendado por segurança).');

    } catch (error) {
        console.error('Erro:', error.message);
        if (browser) await browser.close();
        rl.close();
        process.exit(1);
    }
}

main();
