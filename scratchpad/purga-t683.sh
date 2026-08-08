#!/usr/bin/env bash
# Purga los tags de caché tras el re-anclaje de T-683. Repetir: la caché es POR INSTANCIA.
cd /home/manuel/vence-sessions/movil3 || exit 1
set -a; . ./.env.local; set +a
for i in $(seq 1 "${VUELTAS:-18}"); do
  for T in temario test-counts teoria questions; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST https://www.vence.es/api/admin/revalidate \
      -H 'Content-Type: application/json' -H "x-cron-secret: ${CRON_SECRET}" -d "{\"tag\":\"${T}\"}")
    echo "vuelta $i · $T · HTTP $code"
  done
done
