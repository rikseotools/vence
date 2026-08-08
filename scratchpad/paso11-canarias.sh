#!/usr/bin/env bash
# Paso 11 del manual de generación — las TRES capas, para el lote de Canarias T7.
cd /home/manuel/vence-sessions/movil3 || exit 1
set -a; . ./.env.local; set +a

echo "── 1/3 · materialized views (contra RDS, la BD viva)"
node -e "require('dotenv').config({path:'.env.local'});
  const pg = require('./backend/node_modules/postgres');
  const s = pg(process.env.DATABASE_URL, {ssl:{rejectUnauthorized:false}, max:1});
  s\`SELECT public.refresh_topic_question_summary()\`.then(() => { console.log('   MV refresh OK'); return s.end() })"

echo "── 2/3 · Redis (topic_data del tema 7)"
node -e "require('dotenv').config({path:'.env.local'});
  (async () => {
    const {invalidateMany} = await import('./lib/cache/redis.ts');
    const keys = [];
    for (const num of [7]) for (const u of ['anon'])
      keys.push('topic_data:auxiliar-administrativo-canarias:' + num + ':' + u);
    await invalidateMany(keys);
    console.log('   Redis invalidado:', keys.length, 'clave(s)');
  })()" 2>/dev/null || echo "   (Redis: no alcanzable desde fuera de la VPC — se cubre con los tags)"

echo "── 3/3 · tags Next.js + rutas ISR"
for tag in test-counts laws questions temario landing; do
  printf '   tag %-12s → ' "$tag"
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST "https://www.vence.es/api/admin/revalidate" \
    -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" -d "{\"tag\": \"$tag\"}"
done
for path in \
  "/auxiliar-administrativo-canarias" \
  "/auxiliar-administrativo-canarias/test" \
  "/auxiliar-administrativo-canarias/temario" \
  "/auxiliar-administrativo-canarias/test/tema/7"; do
  printf '   %-52s → ' "$path"
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST "https://www.vence.es/api/purge-cache" \
    -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" -d "{\"path\": \"$path\"}"
done
