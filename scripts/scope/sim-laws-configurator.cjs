#!/usr/bin/env node
/**
 * sim-laws-configurator.cjs — SIMULACIÓN de paridad del fix del configurador de
 * leyes (24/07 David/Galicia). Compara, por oposición, la NUEVA query (CTE que materializa el set de artículos escopados una vez,
 * count(DISTINCT) EXACTO) contra la query VIVA que timeouteaba (EXISTS correlado). Verifica que NO hay regresión: mismo
 * conjunto de leyes y conteos dentro de tolerancia, y mide tiempos.
 *
 * Uso: node scripts/scope/sim-laws-configurator.cjs [--tol 0.1] [pt1 pt2 ...]
 */
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });

const args = process.argv.slice(2);
const tol = parseFloat((args.find((a) => a.startsWith('--tol')) ? args[args.indexOf('--tol') + 1] : '') || '0.12');
const ptsArg = args.filter((a) => !a.startsWith('--') && a !== String(tol));

// NUEVA fuente = el CTE que usa el fix (materializa el set de artículos escopados
// una vez, mantiene count(DISTINCT) → conteos EXACTOS). Se descartó la summary
// pre-agregada porque su SUM entre temas sobre-contaba 2-3x (lo cazó esta sim).
async function nueva(pt) {
  const t = Date.now();
  const rows = await sql`
    WITH scoped AS (
      SELECT DISTINCT a.id, a.law_id FROM articles a
      JOIN topic_scope ts ON ts.law_id = a.law_id
      JOIN topics t ON t.id = ts.topic_id
      WHERE t.position_type = ${pt} AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers)))
    SELECT laws.short_name sn, count(DISTINCT q.id)::int tot
    FROM questions q JOIN scoped s ON s.id = q.primary_article_id JOIN laws ON s.law_id = laws.id
    WHERE q.is_active AND laws.is_active AND laws.short_name IS NOT NULL
    GROUP BY laws.short_name`;
  return { rows, ms: Date.now() - t };
}
async function viva(pt) {
  const t = Date.now();
  const rows = await sql`SELECT laws.short_name sn, count(DISTINCT questions.id)::int tot
    FROM questions INNER JOIN articles ON questions.primary_article_id = articles.id
    INNER JOIN laws ON articles.law_id = laws.id
    WHERE questions.is_active AND laws.is_active AND laws.short_name IS NOT NULL
      AND EXISTS (SELECT 1 FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
        WHERE t.position_type = ${pt} AND ts.law_id = articles.law_id
          AND (ts.article_numbers IS NULL OR articles.article_number = ANY(ts.article_numbers)))
    GROUP BY laws.short_name`;
  return { rows, ms: Date.now() - t };
}

(async () => {
  let pts = ptsArg;
  if (!pts.length) {
    pts = (await sql`SELECT DISTINCT position_type FROM topics WHERE is_active=true
      AND position_type IN (SELECT position_type FROM topics GROUP BY position_type ORDER BY count(*) DESC LIMIT 12)`).map((r) => r.position_type);
  }
  console.log(`Paridad CTE-nueva vs viva · tolerancia ${(tol * 100).toFixed(0)}% · ${pts.length} oposiciones\n`);
  let fails = 0, sumMsA = 0, sumMsB = 0;
  for (const pt of pts) {
    const [a, b] = await Promise.all([nueva(pt), viva(pt)]);
    sumMsA += a.ms; sumMsB += b.ms;
    const mA = new Map(a.rows.map((r) => [r.sn, r.tot]));
    const mB = new Map(b.rows.map((r) => [r.sn, r.tot]));
    const onlyA = [...mA.keys()].filter((k) => !mB.has(k));
    const onlyB = [...mB.keys()].filter((k) => !mA.has(k));
    const drift = [...mB.entries()].filter(([k, v]) => mA.has(k) && Math.abs(mA.get(k) - v) / Math.max(v, 1) > tol);
    const ok = onlyA.length === 0 && onlyB.length === 0 && drift.length === 0;
    if (!ok) fails++;
    console.log(`  ${ok ? '✅' : '❌'} ${pt.padEnd(42)} leyes ${mA.size}/${mB.size} · CTE ${a.ms}ms · viva ${b.ms}ms`);
    if (!ok) {
      if (onlyB.length) console.log(`       falta(n) en nueva: ${onlyB.slice(0, 5).join(', ')}`);
      if (onlyA.length) console.log(`       sobra(n) en nueva: ${onlyA.slice(0, 5).join(', ')}`);
      if (drift.length) console.log(`       drift > ${(tol * 100).toFixed(0)}%: ${drift.slice(0, 5).map(([k, v]) => `${k} viva=${v} nueva=${mA.get(k)}`).join('; ')}`);
    }
  }
  console.log(`\n${fails ? '❌' : '✅'} ${pts.length - fails}/${pts.length} sin regresión · tiempo medio CTE ${Math.round(sumMsA / pts.length)}ms vs viva ${Math.round(sumMsB / pts.length)}ms`);
  await sql.end();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
