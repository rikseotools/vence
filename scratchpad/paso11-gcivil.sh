#!/usr/bin/env bash
# Paso 11 del manual de generación — las TRES capas, para el lote de Guardia Civil T17.
cd /home/manuel/vence-sessions/movil3 || exit 1
set -a; . ./.env.local; set +a

echo "── 1/3 · materialized views (contra RDS, la BD viva)"
node -e "require('dotenv').config({path:'.env.local'});
  const pg = require('./backend/node_modules/postgres');
  const s = pg(process.env.DATABASE_URL, {ssl:{rejectUnauthorized:false}, max:1});
  s\`SELECT public.refresh_topic_question_summary()\`.then(() => { console.log('   MV refresh OK'); return s.end() })"

echo "── 2/3 · Redis (topic_data del tema 17) — no alcanzable fuera de la VPC, caduca sola en 5 min"

echo "── 3/3 · tags Next.js + rutas ISR"
for tag in test-counts laws questions temario landing; do
  printf '   tag %-12s → ' "$tag"
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST "https://www.vence.es/api/admin/revalidate" \
    -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" -d "{\"tag\": \"$tag\"}"
done
for path in \
  "/guardia-civil" \
  "/guardia-civil/test" \
  "/guardia-civil/temario" \
  "/guardia-civil/test/tema/17"; do
  printf '   %-40s → ' "$path"
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST "https://www.vence.es/api/purge-cache" \
    -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" -d "{\"path\": \"$path\"}"
done
