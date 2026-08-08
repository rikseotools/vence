#!/usr/bin/env bash
# Paso 11 — las tres capas. El lote del RGC toca VARIAS oposiciones (el banco es compartido),
# así que se purgan las dos que sirven temas disponibles: Mecánico-Conductor y Policía Nacional.
cd /home/manuel/vence-sessions/movil3 || exit 1
set -a; . ./.env.local; set +a

echo "── 1/3 · materialized views"
node -e "require('dotenv').config({path:'.env.local'});
  const pg = require('./backend/node_modules/postgres');
  const s = pg(process.env.DATABASE_URL, {ssl:{rejectUnauthorized:false}, max:1});
  s\`SELECT public.refresh_topic_question_summary()\`.then(() => { console.log('   MV refresh OK'); return s.end() })"

echo "── 2/3 · Redis — interno a la VPC, caduca solo en 5 min"

echo "── 3/3 · tags + rutas ISR"
for tag in test-counts laws questions temario landing; do
  printf '   tag %-12s → ' "$tag"
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST "https://www.vence.es/api/admin/revalidate" \
    -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" -d "{\"tag\": \"$tag\"}"
done
for path in \
  "/mecanico-conductor-estado" "/mecanico-conductor-estado/test" \
  "/mecanico-conductor-estado/temario" "/mecanico-conductor-estado/test/tema/10" \
  "/policia-nacional/test/tema/43"; do
  printf '   %-46s → ' "$path"
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST "https://www.vence.es/api/purge-cache" \
    -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" -d "{\"path\": \"$path\"}"
done
