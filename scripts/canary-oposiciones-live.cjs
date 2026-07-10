#!/usr/bin/env node
/**
 * canary-oposiciones-live.cjs — CAPA 1 de detección (smoke cross-oposición en prod).
 *
 * POR QUÉ EXISTE: los gates de build validan la BD, pero NO comprueban que cada
 * oposición PUBLICADA (is_active) se sirva de verdad en producción con contenido.
 * El bug de Granada (topics.disponible=false → landing publicada pero TODO "en
 * elaboración") pasó todos los gates deterministas y solo lo cazó una auditoría
 * manual. Este canary recorre TODAS las is_active y lo habría cazado.
 *
 * Por cada oposición is_active, comprueba:
 *   HTTP (prod):
 *     ❌ landing `/<slug>` no responde 200
 *     ❌ `/<slug>/temario` no responde 200
 *     ❌ `/<slug>/test` no responde 200
 *   BD (comportamiento real, lo que el HTTP 200 no revela):
 *     ❌ 0 topics con disponible=true (se publicaría TODO "en elaboración")
 *     ❌ algún topic disponible=true que NO sirve ninguna pregunta activa (tema vacío)
 *     🟡 topics disponibles con cobertura fina (<6 preguntas)
 *
 * Uso:
 *   node scripts/canary-oposiciones-live.cjs                  # todas las is_active
 *   node scripts/canary-oposiciones-live.cjs <slug> [<slug>…] # concretas
 *   BASE_URL=https://staging... node scripts/canary-oposiciones-live.cjs
 *
 * Env: DATABASE_URL (RDS). BASE_URL (default https://www.vence.es).
 * Exit code 1 si hay algún ❌ → apto como canary post-deploy + cron nightly.
 */
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado (agnóstico: RDS/Neon; NO Supabase).'); process.exit(2); }
const BASE = (process.env.BASE_URL || 'https://www.vence.es').replace(/\/$/, '');
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} });

async function httpStatusOnce(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'vence-canary/1.0' } });
    clearTimeout(t);
    return r.status;
  } catch (e) { return `ERR(${e.name || 'fetch'})`; }
}
// Retry-once anti-flaky: un blip transitorio (500/timeout puntual) no debe disparar la
// alerta. Solo reintenta si el primer intento NO es 200; si el fallo persiste, es real.
async function httpStatus(url) {
  const first = await httpStatusOnce(url);
  if (first === 200) return first;
  await new Promise(r => setTimeout(r, 1200));
  return await httpStatusOnce(url);
}

// nº de preguntas servidas por cada topic, LEÍDO DE LA MISMA FUENTE QUE LA APP:
// la matview `topic_law_question_summary` (la que refresca refresh_topic_question_summary()).
// NO reimplementamos el join topic_scope→primary_article_id: las oposiciones clínicas
// (enfermería, TCAE) enlazan preguntas por un camino que ese join NO captura y daría
// falsos "tema vacío". La MV es la verdad de producción para ambos modelos.
async function servedByTopic(pt) {
  return await sql`
    SELECT tp.topic_number, tp.title, tp.disponible, COALESCE(SUM(s.total_questions), 0)::int AS n
    FROM topics tp
    LEFT JOIN topic_law_question_summary s ON s.topic_id = tp.id
    WHERE tp.position_type = ${pt}
    GROUP BY tp.topic_number, tp.title, tp.disponible
    ORDER BY tp.topic_number`;
}

async function main() {
  const argSlugs = process.argv.slice(2);
  const opos = argSlugs.length
    ? await sql`SELECT slug FROM oposiciones WHERE slug = ANY(${argSlugs}::text[]) ORDER BY slug`
    : await sql`SELECT slug FROM oposiciones WHERE is_active = true ORDER BY slug`;

  if (!opos.length) { console.log('No hay oposiciones que auditar.'); await sql.end(); process.exit(0); }

  console.log(`\n━━━ Canary live de oposiciones — ${opos.length} activa/s @ ${BASE} ━━━\n`);
  let fails = 0, warns = 0;

  for (const o of opos) {
    const pt = o.slug.replace(/-/g, '_');
    const local = [];
    const bad = (m) => { local.push('  ❌ ' + m); fails++; };
    const warn = (m) => { local.push('  🟡 ' + m); warns++; };

    // HTTP
    const [land, tema, test] = await Promise.all([
      httpStatus(`${BASE}/${o.slug}`),
      httpStatus(`${BASE}/${o.slug}/temario`),
      httpStatus(`${BASE}/${o.slug}/test`),
    ]);
    if (land !== 200) bad(`landing /${o.slug} → ${land} (esperado 200)`);
    if (tema !== 200) bad(`/${o.slug}/temario → ${tema} (esperado 200)`);
    if (test !== 200) bad(`/${o.slug}/test → ${test} (esperado 200)`);

    // BD: comportamiento real
    const topics = await servedByTopic(pt);
    const disp = topics.filter(t => t.disponible);
    if (topics.length && disp.length === 0)
      bad(`0 topics disponibles de ${topics.length} → se publicaría TODO "en elaboración" (bug disponible=false)`);
    const vacios = disp.filter(t => t.n === 0);
    if (vacios.length)
      bad(`${vacios.length} tema(s) disponible(s) SIN preguntas: ${vacios.slice(0, 6).map(t => 'T' + t.topic_number).join(', ')}${vacios.length > 6 ? '…' : ''}`);
    const finos = disp.filter(t => t.n > 0 && t.n < 6);
    if (finos.length)
      warn(`${finos.length} tema(s) con cobertura fina (<6q): ${finos.slice(0, 6).map(t => 'T' + t.topic_number + '(' + t.n + ')').join(', ')}${finos.length > 6 ? '…' : ''}`);

    if (local.length) { console.log(`${o.slug}  [land=${land} tema=${tema} test=${test}]`); local.forEach(l => console.log(l)); console.log(''); }
    else console.log(`✅ ${o.slug}  [200/200/200, ${disp.length} temas, todos con preguntas]`);
  }

  console.log(`\n━━━ ${fails} ❌  /  ${warns} 🟡 ━━━`);
  await sql.end();
  process.exit(fails > 0 ? 1 : 0);
}

main().catch(e => { console.error(e?.message || e); process.exit(2); });
