#!/bin/bash
# ================================================================
# coleta-e-push.sh
# Roda todo dia às 09:30 via cron no VPS da Hostinger
# Função: coletar LinkLei e fazer push no GitHub para disparar
#         a Routine da Anthropic automaticamente
# ================================================================

set -e
export TZ="America/Sao_Paulo"

# ---------------------------------------------------------------
# CONFIGURAÇÕES — edite estas variáveis antes de usar
# ---------------------------------------------------------------
REPO_DIR="/root/tarefasroutine"          # caminho do repo clonado no VPS
DADOS_DIR="$REPO_DIR/dados"              # pasta onde ficam os arquivos de coleta
SCRIPTS_DIR="$REPO_DIR/scripts"         # pasta dos scripts Node.js
LOG_DIR="$REPO_DIR/logs"                # pasta de logs locais
# ---------------------------------------------------------------

DATA_HOJE=$(date +%Y-%m-%d)
ARQUIVO_SAIDA="$DADOS_DIR/linklei-raw-$DATA_HOJE.txt"
LOG_FILE="$LOG_DIR/vps-$DATA_HOJE.log"

mkdir -p "$DADOS_DIR" "$LOG_DIR"

echo "===================================" | tee -a "$LOG_FILE"
echo "Início: $(date)" | tee -a "$LOG_FILE"
echo "Data: $DATA_HOJE" | tee -a "$LOG_FILE"
echo "===================================" | tee -a "$LOG_FILE"

# Entra no diretório do repositório
cd "$REPO_DIR"

# Puxa atualizações antes de escrever
git pull origin main --quiet

# Roda o script de coleta Node.js
echo "Iniciando coleta do LinkLei..." | tee -a "$LOG_FILE"
DATA_HOJE="$DATA_HOJE" node "$SCRIPTS_DIR/coletar-linklei.js" 2>&1 | tee -a "$LOG_FILE"
RESULTADO_COLETA=${PIPESTATUS[0]}

# Verifica resultado da coleta
if [ $RESULTADO_COLETA -eq 2 ]; then
    # Código 2 = sessão expirada
    echo "SESSAO_EXPIRADA" > "$ARQUIVO_SAIDA"
    echo "Data: $DATA_HOJE" >> "$ARQUIVO_SAIDA"
    echo "Sessão do LinkLei expirou. Renovar cookies manualmente." >> "$ARQUIVO_SAIDA"

    # Envia e-mail de aviso (requer sendmail ou mailutils instalado)
    if command -v mail &> /dev/null; then
        echo "Sessão do LinkLei expirou em $DATA_HOJE. Acesse o escritório e renove o login." \
            | mail -s "[ATENÇÃO] Sessão LinkLei expirada" "$EMAIL_AVISO"
    fi

    echo "Sessão expirada. Arquivo de aviso criado." | tee -a "$LOG_FILE"

elif [ $RESULTADO_COLETA -ne 0 ]; then
    echo "Erro inesperado na coleta (código $RESULTADO_COLETA)." | tee -a "$LOG_FILE"
    echo "ERRO_COLETA\nData: $DATA_HOJE\nCódigo: $RESULTADO_COLETA" > "$ARQUIVO_SAIDA"
else
    echo "Coleta concluída com sucesso." | tee -a "$LOG_FILE"
fi

# Configura identidade do git (necessário para commits)
git config user.email "vps-routine@eduardamachado.adv.br"
git config user.name "VPS Routine"

# Adiciona o arquivo de coleta e faz commit + push
git add "$DADOS_DIR/linklei-raw-$DATA_HOJE.txt"

# Verifica se há algo para commitar
if git diff --cached --quiet; then
    echo "Nenhuma alteração nova para commitar." | tee -a "$LOG_FILE"
else
    git commit -m "coleta: linklei $DATA_HOJE"
    git push origin main
    echo "Push realizado. Routine da Anthropic será disparada." | tee -a "$LOG_FILE"
fi

echo "Finalizado: $(date)" | tee -a "$LOG_FILE"
echo "===================================" | tee -a "$LOG_FILE"
