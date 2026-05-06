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
    console.log('=== RENOVACAO DE SESSAO LINKLEI ===');
    console.log('Um navegador sera aberto. Faca login normalmente.');
    console.log('Apos ver as movimentacoes, volte aqui e pressione ENTER.');
    await aguardar('Pressione ENTER para abrir o navegador...');
    let browser;
    try {
        browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--start-maximized'] });
        const page = await browser.newPage();
        await page.goto(URL_LOGIN, { waitUntil: 'networkidle2' });
        await aguardar('Apos fazer login e ver as movimentacoes, pressione ENTER...');
        await page.goto(URL_ALVO, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));
        const url = page.url();
        if (url.includes('/login') || url.includes('/auth')) {
            console.error('Ainda na pagina de login. Tente novamente.');
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
        console.log('Sessao salva: ' + COOKIES_FILE);
        console.log('Total de cookies: ' + cookies.length);
    } catch(e) {
        console.error('Erro: ' + e.message);
        if (browser) await browser.close();
        rl.close();
        process.exit(1);
    }
}
main();
