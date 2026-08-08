#!/usr/bin/env bash
# Invalida la caché de la landing tras quitar el programa_url de Correos (T-186).
set -euo pipefail
cd "$(dirname "$0")/.."
SECRET="$(grep -E '^CRON_SECRET=' .env.local | cut -d= -f2-)"
for TAG in landing oposiciones-catalog; do
  printf '%s → ' "$TAG"
  curl -s -X POST https://www.vence.es/api/admin/revalidate \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: ${SECRET}" \
    -d "{\"tag\":\"${TAG}\"}"
  echo
done
