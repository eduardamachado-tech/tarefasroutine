const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL_LINKLEI = 'https://app.linklei.com.br/workspace/notifications/?type=process_movement';
const COOKIES_FILE = path.join(__dirname, '..', 'config', 'linklei-cookies.json');
const DATA_HOJE = process.env.DATA_HOJE || new Date().toISOString().split('T')[0];
const ARQUIVO_SAIDA = path.join(__dirname, '..', 'dados', 'linklei-raw-' + DATA_HOJE + '.txt');

async function main() {
    console.log('Coleta do LinkLei: ' + DATA_HOJE);
    if (!fs.existsSync(COOKIES_FILE)) {
        console.error('Cookies nao encontrados: ' + COOKIES_FILE);
        process.exit(2);
    }
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    let browser;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
        const page = await browser.newPage();
        await page.setCookie(...cookies);
        await page.goto(URL_LINKLEI, { waitUntil: 'networkidle2', timeout: 30000 });
        const url = page.url();
        if (url.includes('/login') || url.includes('/auth')) {
            console.error('SESSAO_EXPIRADA');
            await browser.close();
            process.exit(2);
        }
        await new Promise(r => setTimeout(r, 4000));
        const conteudo = await page.evaluate(() => document.body.innerText.trim());
        const cookies2 = await page.cookies();
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies2, null, 2));
        await browser.close();
        const header = 'COLETA LINKLEI\nData: ' + DATA_HOJE + '\n' + '='.repeat(60) + '\n\n';
        fs.writeFileSync(ARQUIVO_SAIDA, header + (conteudo.length < 50 ? 'SEM_MOVIMENTACOES' : conteudo));
        console.log('Salvo: ' + ARQUIVO_SAIDA);
        process.exit(0);
    } catch(e) {
        console.error('Erro: ' + e.message);
        if (browser) await browser.close();
        process.exit(1);
    }
}
main();
