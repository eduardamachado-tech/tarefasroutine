#!/usr/bin/env node
// =============================================================
// exportar-links-planilha.js
// Lê a planilha do Google Sheets e exporta os dados dos
// processos (cliente, número, link LinkLei, whatsapp) para
// o arquivo config/links-processos.json que o VPS usa
//
// Execute no seu computador Windows:
// node scripts/exportar-links-planilha.js
//
// Requer: npm install googleapis
// =============================================================

// Como não temos acesso direto à API do Sheets no VPS,
// este script usa os dados que você cola manualmente.
// A Routine da Anthropic faz a leitura automática via conector Google Sheets.

// Para uso manual: cole os dados da planilha abaixo no formato JSON
// e execute o script para gerar o arquivo de configuração.

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const OUTPUT_FILE = path.join(CONFIG_DIR, 'links-processos.json');

// ================================================================
// COLE AQUI OS DADOS DA PLANILHA
// Formato: { cliente, numeroProcesso, link, whatsapp }
// Apenas processos com link no LinkLei
// Processos sem link receberão mensagem padrão automaticamente
// ================================================================

const processos = [
    { cliente: "AFONSO DELGADO HACHA", numeroProcesso: "2289961-94.2024.8.26.0000", link: "https://app.linklei.com.br/workspace/legal-process/aaf0d4f034e47dd207494549e9507167", whatsapp: "11984839513" },
    { cliente: "AFONSO DELGADO HACHA", numeroProcesso: "1022462-81.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/6fa26a54fef51beeacfdb0e9c856d665", whatsapp: "11984839513" },
    { cliente: "ANA GABRIELA FERREIRA ARRUDA", numeroProcesso: "1033801-37.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/5de417723256906f7f5537d0095bb55c", whatsapp: "11958755347" },
    { cliente: "ANA GABRIELA FERREIRA ARRUDA", numeroProcesso: "Processo Administrativo INSS", link: "", whatsapp: "11958755347" },
    { cliente: "ANA PAULA - PISCINAS", numeroProcesso: "em elaboração", link: "", whatsapp: "" },
    { cliente: "ANA PAULA ALMEIDA NASCIMENTO", numeroProcesso: "4024953-43.2026.8.26.0100", link: "", whatsapp: "" },
    { cliente: "ANDERSON BATISTA", numeroProcesso: "4038574-10.2026.8.26.0100", link: "", whatsapp: "" },
    { cliente: "ANDRÉ PCD (SANDRA MARINEZ MOSCOU)", numeroProcesso: "1032575-64.2025.8.26.0100", link: "https://app.linklei.com.br/workspace/legal-process/ace2784ec3adf706a50d7cebb2d53196", whatsapp: "" },
    { cliente: "BÁRBARA ARAUJO CORRÊA DIAS", numeroProcesso: "1015098-44.2024.8.26.0009", link: "https://app.linklei.com.br/workspace/legal-process/d6b5a4ad5fa468ee660c9304546c4c7e", whatsapp: "11958755347" },
    { cliente: "BRISA FRANCISCO DE ANDRADE", numeroProcesso: "1017432-65.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/e52ae0a37f39e47ebeaffee2878c03f7", whatsapp: "11958755347" },
    { cliente: "CATIA CRISTINA FERREIRA VOLPATO", numeroProcesso: "4003687-94.2025.8.26.0565", link: "https://app.linklei.com.br/workspace/legal-process/6963cde4b6c8633a1fee8ba021684563", whatsapp: "11982772894" },
    { cliente: "ELAINE SILVA LIMA", numeroProcesso: "1002594-24.2025.8.26.0606", link: "https://app.linklei.com.br/workspace/legal-process/b9d49e3db24ab25007bc3a20ecb0f680", whatsapp: "11956581594" },
    { cliente: "ELIZABETE MARIA ARAÚJO DA COSTA", numeroProcesso: "1003026-69.2025.8.26.0565", link: "https://app.linklei.com.br/workspace/legal-process/700e77a330f58920a82c7fe366d1bddf", whatsapp: "" },
    { cliente: "ELOI RASTOFER", numeroProcesso: "0000815-45.2023.8.26.0372", link: "https://app.linklei.com.br/workspace/legal-process/a0c1235ad4eb7d2f62e7098ae946357a", whatsapp: "" },
    { cliente: "FABIANO BENDER MACHADO", numeroProcesso: "1003900-87.2025.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/1d0cf3448be100f0bc789a748b20246b", whatsapp: "11932188181" },
    { cliente: "GABRIEL DA COSTA PEREIRA MACHADO", numeroProcesso: "1004553-56.2025.8.26.0565", link: "https://app.linklei.com.br/workspace/legal-process/39b6e72897a700bbf3e48b2086adb4cd", whatsapp: "11984901224" },
    { cliente: "GABRIELA KATHERINE TRAD BIFFE", numeroProcesso: "0003184-40.2023.8.26.0007", link: "https://app.linklei.com.br/workspace/legal-process/fb0a9c872ee3ca1c30cf4612d3317717", whatsapp: "11982909177" },
    { cliente: "GLICEA GOUVEA DE OLIVEIRA", numeroProcesso: "5004167-65.2024.4.03.6126", link: "https://app.linklei.com.br/workspace/legal-process/16e15e78c395a1a7285ce398542a4429", whatsapp: "11995720733" },
    { cliente: "GRACIA PARRADO", numeroProcesso: "1011419-50.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/f80ec87345efabe87fe14e613c5d9c69", whatsapp: "" },
    { cliente: "GUSTAVO RASTOFER", numeroProcesso: "4010209-76.2025.8.26.0068", link: "", whatsapp: "11998185677" },
    { cliente: "LARISSA MARIA ARAUJO BATISSACO", numeroProcesso: "1000981-83.2025.8.26.0565", link: "", whatsapp: "" },
    { cliente: "LUANA DE SOUSA PITEL", numeroProcesso: "1012433-55.2024.8.26.0009", link: "https://app.linklei.com.br/workspace/legal-process/65a4b317ea180c1e8a28da96c8dbde51", whatsapp: "11994588600" },
    { cliente: "LUANA PARRADO DIAN", numeroProcesso: "0017113-85.2022.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/000c9be0d76eaa8998a9893b5c30841c", whatsapp: "11956367491" },
    { cliente: "LUANA PARRADO DIAN", numeroProcesso: "1019648-67.2022.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/3b969a12e4dfd0579cab485596fc1473", whatsapp: "11956367491" },
    { cliente: "LUANA PARRADO DIAN", numeroProcesso: "1002508-49.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/c21b291aedd9d48fe0c4f408ee817e13", whatsapp: "11956367491" },
    { cliente: "LUANA PARRADO DIAN", numeroProcesso: "1017403-15.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/d458f3e372fe4a27e9b50c5805dfeb6d", whatsapp: "11956367491" },
    { cliente: "LUIZ CESAR PEREIRA", numeroProcesso: "1029981-10.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/d897cb1834bffcdfd494bb8a265311d5", whatsapp: "11987269043" },
    { cliente: "MARIA APARECIDA ZAPPAROLLI", numeroProcesso: "4009821-73.2025.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/0c2c7dc94470e1b8b19fe18b6c89f55d", whatsapp: "11988479949" },
    { cliente: "MARIA DE LA CRUZ PARRADO", numeroProcesso: "1033195-09.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/605683e3c6ccc7d93041c04ac7764ac7", whatsapp: "11995022622" },
    { cliente: "MIRIAM DEBORA MENEZES BALTAZAR", numeroProcesso: "4000280-77.2025.8.26.0275", link: "https://app.linklei.com.br/workspace/legal-process/8ba415836d39d5fc40de05328d409472", whatsapp: "11982132234" },
    { cliente: "NATALYA AMIGO", numeroProcesso: "4007446-85.2025.8.26.0009", link: "https://app.linklei.com.br/workspace/legal-process/0861a3cf5dad293c7ffd9c6daed36cdf", whatsapp: "11948877502" },
    { cliente: "NERY RODRIGUES LAURIANO PEREIRA", numeroProcesso: "1029980-25.2024.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/8f302a6f348dc7057311884302f6096f", whatsapp: "11958195667" },
    { cliente: "PEDRO RIBEIRO CAMPOS GATICA", numeroProcesso: "1019818-72.2024.8.26.0003", link: "https://app.linklei.com.br/workspace/legal-process/1db72b93957a6c27d10fad7ee0f666bd", whatsapp: "11975475708" },
    { cliente: "ROSANA VASCONCELLOS", numeroProcesso: "0009843-52.2019.8.26.0477", link: "https://app.linklei.com.br/workspace/legal-process/b673adb76975bb4c558fc13e6c5794e6", whatsapp: "11947552468" },
    { cliente: "SANDRO GRANSOTI", numeroProcesso: "1004847-11.2025.8.26.0565", link: "https://app.linklei.com.br/workspace/legal-process/e49a39395160b1ae86c9ffaab2bee39e", whatsapp: "11997944025" },
    { cliente: "SILVIA TERESA VIEIRA DE PAIVA", numeroProcesso: "0825816-21.2025.8.10.0001", link: "https://app.linklei.com.br/workspace/legal-process/eb77c10ab059d9ea0b77f37e1e2b4b87", whatsapp: "" },
    { cliente: "VINICIUS MASINI SOARES - GOLD PET", numeroProcesso: "1003327-20.2023.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/472f2da6017143f8ad821536a42efeed", whatsapp: "11982909177" },
    { cliente: "VINICIUS MASINI SOARES - GOLD PET", numeroProcesso: "0000418-51.2025.8.26.0554", link: "https://app.linklei.com.br/workspace/legal-process/2a88fe4ed9fbc75b5ce803de11acf52f", whatsapp: "11982909177" }
];

fs.mkdirSync(CONFIG_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processos, null, 2));
console.log(`Arquivo gerado: ${OUTPUT_FILE}`);
console.log(`Total de processos: ${processos.length}`);
console.log(`Com link: ${processos.filter(p => p.link).length}`);
console.log(`Sem link: ${processos.filter(p => !p.link).length}`);
