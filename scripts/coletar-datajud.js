/**
 * coletar-datajud.js
 * Escritório Eduarda Machado Advocacia Estratégica
 *
 * Consulta a API Pública do Datajud/CNJ para cada processo ativo da planilha.
 * Salva o resultado em dados/datajud-raw-AAAA-MM-DD.json
 * para o Claude ler na rotina diária.
 *
 * Rodar: node scripts/coletar-datajud.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────

const API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const ENDPOINTS = {
  tjsp: 'api-publica.datajud.cnj.jus.br',
  trt2: 'api-publica.datajud.cnj.jus.br',
  trf3: 'api-publica.datajud.cnj.jus.br',
  tjma: 'api-publica.datajud.cnj.jus.br',
  stj:  'api-publica.datajud.cnj.jus.br',
};

const PATHS = {
  tjsp: '/api_publica_tjsp/_search',
  trt2: '/api_publica_trt2/_search',
  trf3: '/api_publica_trf3/_search',
  tjma: '/api_publica_tjma/_search',
  stj:  '/api_publica_stj/_search',
};

// Lista de processos ativos do escritório
// Formato: { cnj: 'número sem pontos/traços', tribunal: 'tjsp|trt2|trf3|tjma|stj', cliente: 'Nome' }
// Atualize esta lista sempre que adicionar ou encerrar processos

const PROCESSOS = [
  { cnj: '10224628120248260554', tribunal: 'tjsp', cliente: 'AFONSO DELGADO HACHA' },
  { cnj: '10354588420258260002', tribunal: 'tjsp', cliente: 'ALESSANDRO MARTINS / QUELI MEIRI' },
  { cnj: '10338013720248260554', tribunal: 'tjsp', cliente: 'ANA GABRIELA FERREIRA ARRUDA' },
  { cnj: '40249534320268260100', tribunal: 'tjsp', cliente: 'ANA PAULA ALMEIDA NASCIMENTO' },
  { cnj: '40385741020268260100', tribunal: 'tjsp', cliente: 'ANDERSON BATISTA' },
  { cnj: '10325756420258260100', tribunal: 'tjsp', cliente: 'ANDRE PCD (SANDRA MOSCOU)' },
  { cnj: '10174326520248260554', tribunal: 'tjsp', cliente: 'BRISA FRANCISCO DE ANDRADE' },
  { cnj: '10150984420248260009', tribunal: 'tjsp', cliente: 'BARBARA ARAUJO CORREA DIAS' },
  { cnj: '40036879420258260565', tribunal: 'tjsp', cliente: 'CATIA CRISTINA FERREIRA VOLPATO' },
  { cnj: '10037073920258260565', tribunal: 'tjsp', cliente: 'SANDRO GRANSOTI (Cooperativa)' },
  { cnj: '10025942420258260606', tribunal: 'tjsp', cliente: 'ELAINE SILVA LIMA' },
  { cnj: '10030266920258260565', tribunal: 'tjsp', cliente: 'ELIZABETE MARIA ARAUJO DA COSTA' },
  { cnj: '00008154520238260372', tribunal: 'tjsp', cliente: 'ELOI RASTOFER' },
  { cnj: '10039008720258260554', tribunal: 'tjsp', cliente: 'FABIANO BENDER MACHADO' },
  { cnj: '10045535620258260565', tribunal: 'tjsp', cliente: 'GABRIEL DA COSTA PEREIRA MACHADO' },
  { cnj: '00031844020238260007', tribunal: 'tjsp', cliente: 'GABRIELA KATHERINE TRAD BIFFE' },
  { cnj: '40032237020258260565', tribunal: 'tjsp', cliente: 'GILCEA GOUVEA DE OLIVEIRA' },
  { cnj: '50041676520244036126', tribunal: 'trf3', cliente: 'GLICEA GOUVEA DE OLIVEIRA (TRF3)' },
  { cnj: '10114195020248260554', tribunal: 'tjsp', cliente: 'GRACIA PARRADO' },
  { cnj: '40102097620258260068', tribunal: 'tjsp', cliente: 'GUSTAVO RASTOFER' },
  { cnj: '10104581320238260565', tribunal: 'tjsp', cliente: 'LARISSA MARIA ARAUJO BATISSACO' },
  { cnj: '40046766120268260405', tribunal: 'tjsp', cliente: 'JULIA GRETHEL MARQUES DE ABREU' },
  { cnj: '10009818320258260565', tribunal: 'tjsp', cliente: 'LARISSA MARIA ARAUJO BATISSACO' },
  { cnj: '10010988320258260565', tribunal: 'tjsp', cliente: 'LARISSA MARIA ARAUJO BATISSACO' },
  { cnj: '10124335520248260009', tribunal: 'tjsp', cliente: 'LUANA DE SOUSA PITEL' },
  { cnj: '40081648220258260009', tribunal: 'tjsp', cliente: 'LUANA DE SOUSA PITEL' },
  { cnj: '10792471420248260053', tribunal: 'tjsp', cliente: 'LUANA DE SOUSA PITEL / UPA' },
  { cnj: '10025084920248260554', tribunal: 'tjsp', cliente: 'LUANA PARRADO DIAN' },
  { cnj: '10174031520248260554', tribunal: 'tjsp', cliente: 'LUANA PARRADO DIAN' },
  { cnj: '10000164972026502047', tribunal: 'trt2', cliente: 'LUCIENE FERREIRA TORRES' },
  { cnj: '10001658220265020472', tribunal: 'trt2', cliente: 'LUCIENE FERREIRA TORRES' },
  { cnj: '00148983420258260554', tribunal: 'tjsp', cliente: 'LUIZ CESAR PEREIRA' },
  { cnj: '10299811020248260554', tribunal: 'tjsp', cliente: 'LUIZ CESAR PEREIRA' },
  { cnj: '10049717920168260477', tribunal: 'tjsp', cliente: 'MAITE VASCONCELLOS MARCONDES' },
  { cnj: '40098217320258260554', tribunal: 'tjsp', cliente: 'MARIA APARECIDA ZAPPAROLLI' },
  { cnj: '10331950920248260554', tribunal: 'tjsp', cliente: 'MARIA DE LA CRUZ PARRADO' },
  { cnj: '40002807720258260275', tribunal: 'tjsp', cliente: 'MIRIAM DEBORA MENEZES BALTAZAR' },
  { cnj: '40074468520258260009', tribunal: 'tjsp', cliente: 'NATALYA AMIGO' },
  { cnj: '40667465920268260100', tribunal: 'tjsp', cliente: 'NATALYA AMIGO (Facebook)' },
  { cnj: '00143146420258260554', tribunal: 'tjsp', cliente: 'NERY RODRIGUES LAURIANO PEREIRA' },
  { cnj: '10299802520248260554', tribunal: 'tjsp', cliente: 'NERY RODRIGUES LAURIANO PEREIRA' },
  { cnj: '10041894520268260405', tribunal: 'tjsp', cliente: 'PAULO MATTOS DA SILVA GOMES' },
  { cnj: '40066928520268260405', tribunal: 'tjsp', cliente: 'PAULO MATTOS DA SILVA GOMES' },
  { cnj: '40111014120258260405', tribunal: 'tjsp', cliente: 'PAULO MATTOS DA SILVA GOMES' },
  { cnj: '40755207820268260100', tribunal: 'tjsp', cliente: 'PAULO ANDRE SILVA' },
  { cnj: '10198187220248260003', tribunal: 'tjsp', cliente: 'PEDRO RIBEIRO CAMPOS GATICA' },
  { cnj: '00098435220198260477', tribunal: 'tjsp', cliente: 'ROSANA VASCONCELLOS' },
  { cnj: '40375911120268260100', tribunal: 'tjsp', cliente: 'ROZENILDO FEITOZA' },
  { cnj: '10048471120258260565', tribunal: 'tjsp', cliente: 'SANDRO GRANSOTI' },
  { cnj: '10033272020238260554', tribunal: 'tjsp', cliente: 'VINICIUS MASINI SOARES (Goldpet)' },
  { cnj: '00004185120258260554', tribunal: 'tjsp', cliente: 'VINICIUS MASINI SOARES (Goldpet)' },
  { cnj: '40618584720268260100', tribunal: 'tjsp', cliente: 'WHAGNER DUARTE NUNES' },
  { cnj: '08258162120258100001', tribunal: 'tjma', cliente: 'SILVIA TERESA VIEIRA DE PAIVA' },
  { cnj: '40598032620268260100', tribunal: 'tjsp', cliente: 'FERNANDO MENDES SANTOS' },
  { cnj: '40060495420268260009', tribunal: 'tjsp', cliente: 'ANA CAROLINA SILVA CRUZ' },
  { cnj: '40753821420268260100', tribunal: 'tjsp', cliente: 'ISMAELA CONFECCOES E CALCADOS' },
  { cnj: '10000444242025502001', tribunal: 'trt2', cliente: 'DANILO MARTINS ARRUDA' },
];

// ─── FUNÇÕES AUXILIARES ───────────────────────────────────────────────────────

function hoje() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function ontem() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function consultarProcesso(processo) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      query: {
        match: {
          numeroProcesso: processo.cnj
        }
      },
      size: 1
    });

    const options = {
      hostname: ENDPOINTS[processo.tribunal],
      path: PATHS[processo.tribunal],
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const hit = json.hits?.hits?.[0]?._source;
          if (!hit) {
            resolve({ cnj: processo.cnj, cliente: processo.cliente, tribunal: processo.tribunal, status: 'SEM_DADOS', movimentos: [] });
            return;
          }

          // Filtra movimentos das últimas 48h para garantir captura
          const limite = new Date();
          limite.setDate(limite.getDate() - 2);

          const movimentosRecentes = (hit.movimentos || []).filter(m => {
            const data = new Date(m.dataHora);
            return data >= limite;
          });

          resolve({
            cnj: processo.cnj,
            cliente: processo.cliente,
            tribunal: hit.tribunal || processo.tribunal.toUpperCase(),
            grau: hit.grau || '',
            vara: hit.orgaoJulgador?.nome || '',
            classe: hit.classe?.nome || '',
            partes: (hit.partes || []).map(p => ({ nome: p.nome, polo: p.polo })),
            movimentos: movimentosRecentes.map(m => ({
              dataHora: m.dataHora,
              nome: m.nome,
              complemento: m.complementosTabelados?.map(c => c.descricao).join('; ') || ''
            })),
            totalMovimentos: (hit.movimentos || []).length,
            dataAjuizamento: hit.dataAjuizamento || '',
            status: 'OK'
          });
        } catch (e) {
          resolve({ cnj: processo.cnj, cliente: processo.cliente, tribunal: processo.tribunal, status: 'ERRO_PARSE', movimentos: [] });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ cnj: processo.cnj, cliente: processo.cliente, tribunal: processo.tribunal, status: `ERRO: ${e.message}`, movimentos: [] });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ cnj: processo.cnj, cliente: processo.cliente, tribunal: processo.tribunal, status: 'TIMEOUT', movimentos: [] });
    });

    req.write(body);
    req.end();
  });
}

// ─── EXECUÇÃO PRINCIPAL ───────────────────────────────────────────────────────

async function main() {
  console.log(`[Datajud] Iniciando coleta — ${hoje()}`);
  console.log(`[Datajud] Total de processos: ${PROCESSOS.length}`);

  const resultados = [];
  let ok = 0, erros = 0, semDados = 0;

  // Consulta em lotes de 5 para não sobrecarregar a API
  for (let i = 0; i < PROCESSOS.length; i += 5) {
    const lote = PROCESSOS.slice(i, i + 5);
    const respostas = await Promise.all(lote.map(consultarProcesso));
    resultados.push(...respostas);

    respostas.forEach(r => {
      if (r.status === 'OK') ok++;
      else if (r.status === 'SEM_DADOS') semDados++;
      else erros++;
      console.log(`  [${r.status}] ${r.cliente} — ${r.cnj}`);
    });

    // Pausa entre lotes para respeitar rate limit
    if (i + 5 < PROCESSOS.length) {
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  const saida = {
    geradoEm: new Date().toISOString(),
    data: hoje(),
    ontem: ontem(),
    resumo: {
      total: PROCESSOS.length,
      comRetorno: ok,
      semDados: semDados,
      erros: erros,
      comMovimentacaoRecente: resultados.filter(r => r.movimentos?.length > 0).length
    },
    processos: resultados
  };

  // Garante que a pasta dados/ existe
  const pastasDados = path.join(__dirname, '..', 'dados');
  if (!fs.existsSync(pastasDados)) {
    fs.mkdirSync(pastasDados, { recursive: true });
  }

  const nomeArquivo = path.join(pastasDados, `datajud-raw-${hoje()}.json`);
  fs.writeFileSync(nomeArquivo, JSON.stringify(saida, null, 2), 'utf8');

  console.log(`\n[Datajud] Coleta concluída.`);
  console.log(`  OK: ${ok} | Sem dados: ${semDados} | Erros: ${erros}`);
  console.log(`  Com movimentação recente: ${saida.resumo.comMovimentacaoRecente}`);
  console.log(`  Arquivo salvo: ${nomeArquivo}`);
}

main().catch(err => {
  console.error('[Datajud] Erro fatal:', err);
  process.exit(1);
});
