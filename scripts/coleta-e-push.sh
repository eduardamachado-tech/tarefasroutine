#!/bin/bash
set -e
export TZ="America/Sao_Paulo"
REPO_DIR="/root/tarefasroutine"
DATA_HOJE=$(date +%Y-%m-%d)
echo "Iniciando coleta: $DATA_HOJE"
cd $REPO_DIR
git pull origin main --quiet
DATA_HOJE=$DATA_HOJE node scripts/coletar-linklei.js
RESULTADO=$?
if [ $RESULTADO -eq 2 ]; then
    echo "SESSAO_EXPIRADA" > "dados/linklei-raw-$DATA_HOJE.txt"
fi
git config user.email "vps@eduardamachado.adv.br"
git config user.name "VPS Routine"
git add dados/
if ! git diff --cached --quiet; then
    git commit -m "coleta: linklei $DATA_HOJE"
    git push origin main
    echo "Push concluido."
fi
