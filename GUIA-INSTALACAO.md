# Guia Completo: Routine LinkLei com GitHub + Claude Code
## Escritório Eduarda Machado Advocacia Estratégica

---

## Visão geral

A arquitetura tem duas partes que trabalham juntas:

**VPS Hostinger** → coleta o LinkLei às 09:30 → faz push no GitHub
**Claude Code Routine** → detecta o push → lê o arquivo → analisa → salva no Drive e Agenda

O Claude Code Routine roda na infraestrutura da Anthropic, incluído no seu plano Pro.
Não há custo adicional.

---

## PARTE 1 — Preparar o repositório GitHub

### 1.1 Criar ou usar o repositório existente

Você já tem: https://github.com/eduardamachado-tech/tarefasroutine

Se quiser começar do zero:
1. Acesse github.com
2. Clique em New repository
3. Nome: `tarefasroutine`
4. Deixe público ou privado (ambos funcionam)
5. Marque "Add a README file"
6. Clique em Create repository

### 1.2 Estrutura de pastas que o repo precisa ter

Após clonar e adicionar os arquivos deste projeto, a estrutura deve ser:

```
tarefasroutine/
├── CLAUDE.md               ← instrução da Routine (o mais importante)
├── package.json
├── .gitignore
├── dados/
│   └── README.txt          ← placeholder para o git rastrear a pasta
├── config/
│   └── README.txt          ← explica o que vai aqui (cookies não sobem)
├── scripts/
│   ├── coletar-linklei.js  ← roda no VPS
│   ├── coleta-e-push.sh    ← roda no VPS via cron
│   └── salvar-sessao.js    ← roda no SEU computador para renovar login
└── logs/                   ← criado automaticamente pelo VPS
```

### 1.3 Fazer o primeiro push

No seu computador:

```bash
git clone https://github.com/eduardamachado-tech/tarefasroutine.git
cd tarefasroutine
# Copie todos os arquivos deste projeto para a pasta clonada
git add .
git commit -m "setup: estrutura inicial da routine linklei"
git push origin main
```

### 1.4 Criar um Personal Access Token no GitHub

A Routine da Anthropic precisa de acesso ao seu repositório. Você precisa instalar
o Claude GitHub App (feito na Parte 3), mas o VPS precisa de um token para fazer push.

Para o VPS fazer push:
1. Acesse github.com → clique no seu avatar → Settings
2. No menu esquerdo, role até Developer settings (último item)
3. Personal access tokens → Tokens (classic)
4. Generate new token (classic)
5. Note: `VPS Routine Push`
6. Expiration: 1 year (ou No expiration)
7. Marque apenas: `repo` (acesso completo ao repositório)
8. Clique em Generate token
9. COPIE o token agora — você não vai conseguir ver de novo

Guarde esse token. Você vai precisar dele na Parte 2.

---

## PARTE 2 — Configurar o VPS Hostinger

Conecte no VPS via SSH e execute os passos abaixo.

### 2.1 Verificar e instalar Node.js

```bash
node --version
# Se não estiver instalado ou for menor que 18:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version  # confirmar instalação
```

### 2.2 Instalar dependências do Chrome headless

```bash
apt-get update
apt-get install -y \
    chromium-browser \
    ca-certificates \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    wget \
    xdg-utils
```

### 2.3 Configurar git com o token do GitHub

```bash
# Configure identidade do git
git config --global user.email "vps@eduardamachado.adv.br"
git config --global user.name "VPS Routine"

# Configure o token para push sem senha
# Substitua SEU_TOKEN_AQUI pelo token gerado no passo 1.4
git config --global credential.helper store
echo "https://eduardamachado-tech:SEU_TOKEN_AQUI@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials
```

### 2.4 Clonar o repositório no VPS

```bash
git clone https://github.com/eduardamachado-tech/tarefasroutine.git /root/tarefasroutine
cd /root/tarefasroutine
```

### 2.5 Instalar dependências Node.js

```bash
cd /root/tarefasroutine
npm install
```

### 2.6 Dar permissão de execução ao script principal

```bash
chmod +x /root/tarefasroutine/scripts/coleta-e-push.sh
```

### 2.7 Configurar variável de ambiente para e-mail de aviso

```bash
# Edite o arquivo de ambiente do sistema
echo 'export EMAIL_AVISO="duda@eduardamachado.adv.br"' >> ~/.bashrc
source ~/.bashrc
```

### 2.8 Configurar o Cron

```bash
# Verificar fuso horário do VPS
timedatectl
```

Se o fuso estiver errado (não for America/Sao_Paulo):
```bash
timedatectl set-timezone America/Sao_Paulo
timedatectl  # confirmar
```

Abrir o crontab:
```bash
crontab -e
# Escolha o editor (1 = nano)
```

Adicione esta linha no final do arquivo:
```
# Routine LinkLei — toda segunda a sexta às 09:30 (horário SP)
30 9 * * 1-5 /root/tarefasroutine/scripts/coleta-e-push.sh >> /root/tarefasroutine/logs/cron.log 2>&1
```

Salve e saia (Ctrl+X, Y, Enter no nano).

Confirme que foi salvo:
```bash
crontab -l
```

### 2.9 Salvar a sessão do LinkLei (no seu computador, não no VPS)

Execute no seu computador (que tem interface gráfica):
```bash
cd tarefasroutine
node scripts/salvar-sessao.js
```

Após o script criar o arquivo `config/linklei-cookies.json`, envie para o VPS:
```bash
scp config/linklei-cookies.json root@IP_DO_SEU_VPS:/root/tarefasroutine/config/
```

### 2.10 Testar a coleta manualmente

```bash
cd /root/tarefasroutine
bash scripts/coleta-e-push.sh
```

Verifique se aparece uma mensagem de sucesso e se o arquivo foi criado:
```bash
ls dados/
cat dados/linklei-raw-$(date +%Y-%m-%d).txt | head -20
```

---

## PARTE 3 — Configurar a Claude Code Routine

### 3.1 Instalar o Claude GitHub App

Este passo permite que a Routine detecte o push no seu repositório.

1. Acesse: https://claude.ai/code
2. No menu esquerdo, clique em Settings ou na engrenagem
3. Procure "GitHub" e clique em "Connect GitHub"
4. Autorize o acesso e instale o Claude GitHub App
5. Selecione o repositório `tarefasroutine` (pode ser só este)
6. Confirme

### 3.2 Criar a Routine

1. Acesse: https://claude.ai/code/routines
2. Clique em "New routine"

Preencha os campos:

**Nome:** `Relatório Diário LinkLei — Eduarda Machado`

**Prompt:**
```
Execute o fluxo completo de relatório jurídico conforme instruído no CLAUDE.md.
Leia o arquivo de coleta mais recente na pasta dados/, analise juridicamente as
movimentações do LinkLei, produza o relatório no formato definido, salve no
Google Drive na pasta "Relatórios LinkLei" e crie o evento no Google Agenda.
```

**Repositório:** selecione `eduardamachado-tech/tarefasroutine`

**Ambiente:** Default (ou crie um personalizado se precisar)

**Variáveis de ambiente no ambiente** (passo 3.3 abaixo):
- Nenhuma obrigatória por enquanto (os conectores MCP cuidam do Drive e Agenda)

### 3.3 Configurar o gatilho (trigger)

Na seção "Select a trigger":
1. Clique em "GitHub event"
2. Selecione o repositório `tarefasroutine`
3. Evento: **Push**
4. Branch: `main`
5. (Opcional) Filtro de caminho: `dados/linklei-raw-*`

Isso garante que a Routine só dispara quando um arquivo de coleta novo chega,
não em qualquer push.

### 3.4 Configurar os conectores

Na seção "Connectors":
- Confirme que **Google Drive** está listado e ativo
- Confirme que **Google Calendar** (Agenda) está listado e ativo
- Remova qualquer outro conector que a Routine não precisa

Se Google Drive ou Google Calendar não aparecerem:
1. Volte para claude.ai
2. Clique em Settings → Integrations (ou Connectors)
3. Conecte o Google Drive e o Google Calendar com a conta do escritório
4. Volte para a criação da Routine

### 3.5 Salvar e testar

1. Clique em "Create routine"
2. Na tela seguinte, clique em "Run now" para testar imediatamente
3. Acompanhe o log da execução em tempo real
4. Verifique se o arquivo foi salvo no Google Drive
5. Verifique se o evento foi criado no Google Agenda

---

## PARTE 4 — Verificação final

### Checklist antes de considerar pronto:

- [ ] Repositório no GitHub com CLAUDE.md na raiz
- [ ] Claude GitHub App instalado no repositório
- [ ] Routine criada em claude.ai/code/routines com trigger de push
- [ ] Conectores Google Drive e Google Agenda ativos na Routine
- [ ] VPS com Node.js 18+, Chrome headless e dependências instaladas
- [ ] Cron configurado para 09:30 segunda a sexta
- [ ] Arquivo linklei-cookies.json no VPS em config/
- [ ] Teste manual: `bash scripts/coleta-e-push.sh` funcionou
- [ ] Teste da Routine: "Run now" gerou relatório no Drive e evento na Agenda

---

## PARTE 5 — Manutenção recorrente

### Quando a sessão do LinkLei expirar

Sintoma: arquivo `linklei-raw-DATA.txt` começa com `SESSAO_EXPIRADA`

O que fazer:
1. No seu computador: `node scripts/salvar-sessao.js`
2. Faça login no LinkLei quando o Chrome abrir
3. Pressione ENTER
4. Envie os cookies para o VPS:
   ```
   scp config/linklei-cookies.json root@IP:/root/tarefasroutine/config/
   ```
5. O cron retoma normalmente no próximo dia

Frequência esperada de expiração: a cada 30 a 90 dias, dependendo da configuração do LinkLei.

### Verificar logs do VPS

```bash
# Log do cron geral
cat /root/tarefasroutine/logs/cron.log

# Log do dia de hoje
cat /root/tarefasroutine/logs/vps-$(date +%Y-%m-%d).log
```

### Verificar logs da Routine

Acesse https://claude.ai/code/routines, clique na sua Routine e veja o histórico
de execuções com os logs completos de cada run.

---

## PARTE 6 — Variáveis de ambiente (resumo)

### No VPS (.bashrc):

| Variável | Valor | Para que serve |
|---|---|---|
| `EMAIL_AVISO` | seu e-mail | Receber aviso quando sessão expirar |
| `TZ` | `America/Sao_Paulo` | Configurado automaticamente pelo script |

### Na Routine (claude.ai/code/routines → Environments):

Nenhuma variável obrigatória neste momento.
O acesso ao Drive e à Agenda é feito pelos conectores MCP, não por variáveis.

Se precisar adicionar no futuro (ex: ID de calendário específico):
1. Acesse a Routine em claude.ai/code/routines
2. Clique em Edit
3. Vá em Environment → Environment variables
4. Adicione no formato NOME=valor

---

## Segurança

**Nunca suba para o GitHub:**
- `config/linklei-cookies.json` (sessão do LinkLei)
- Qualquer arquivo com senhas ou tokens

**O .gitignore já protege esses arquivos.** Confirme com:
```bash
cat /root/tarefasroutine/.gitignore
```

**O token do GitHub** (gerado no passo 1.4) fica armazenado em `~/.git-credentials`
no VPS. Esse arquivo tem permissão 600 (apenas o root lê). Renove-o anualmente.
