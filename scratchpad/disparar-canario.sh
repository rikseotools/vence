#!/usr/bin/env bash
# Dispara a mano el canary del gate anti-scraping (normalmente lo lanza el workflow post-deploy).
# Sirve para verificar el levantado de la marca sin esperar a otro deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
SECRET="$(grep -E '^CRON_SECRET=' .env.local | cut -d= -f2-)"
curl -s -o /tmp/canario.json -w "HTTP %{http_code}\n" \
  -X POST https://api.vence.es/api/v2/canary/run-questions-gate \
  -H "Authorization: Bearer ${SECRET}"
cat /tmp/canario.json
echo
