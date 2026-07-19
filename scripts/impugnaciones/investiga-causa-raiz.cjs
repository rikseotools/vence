#!/usr/bin/env node
// INVESTIGACIÓN (read-only) de la tarea "citas ajenas — 27 decisiones + causa raíz".
// No muta nada. Tres bloques:
//   A) reconciliar las 27 decisiones del doc vs su lifecycle_state REAL en RDS (el doc está stale).
//   B) universo de la campaña en RDS por proveedor de AVR + estado actual.
//   C) dimensionar la SUPERFICIE ESTRUCTURAL de la causa raíz: preguntas activas cuyo artículo
//      vinculado tiene un nº que COLISIONA con el mismo nº en otra ley (universo de riesgo del
//      linker que emparejó por nº sin cruzar law_id), y qué fracción es cheaply-flaggable.
const fs = require('fs');
const path = require('path');
const pg = (() => { try { return require('postgres'); } catch { return require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres')); } })();
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

// Las 27 del doc (§44-69), por cubo. Prefijos de 8 chars.
const CUBOS = {
  'clave_dudosa':  ['514c0c65'],
  'huerfanos':     ['89449dbd','df5aeb28','4b59d812','07ab258c','36c79015','6bf9caae'],
  'adjudicar':     ['48cb3ed0','da8231b5','b72000de','80a7a71e','3ce5c259','e105ee19','e47141d1'],
  'sin_norma':     ['b580147c','83124c1f','e9416316','86a225d8','e5aac807','dc94fdbb','5027abde','ad90385d'],
  'reparacion':    ['03b01d9e','42a032bc','379248ad','ffc5ed3b','0a7bd51e'],
};

(async () => {
  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 3, connect_timeout: 30 });
  try {
    // ---- A) Reconciliar las 27 ----
    console.log('===== A) LAS 27 DECISIONES vs ESTADO REAL EN RDS =====');
    const allPrefixes = Object.values(CUBOS).flat();
    const rows = await sql`
      SELECT id::text id, lifecycle_state, is_active
      FROM questions
      WHERE ${sql.unsafe(allPrefixes.map(p => `id::text LIKE '${p}%'`).join(' OR '))}`;
    const byId = new Map(rows.map(r => [r.id.slice(0,8), r]));
    let stillNH = 0, resolved = 0, notFound = 0;
    for (const [cubo, ids] of Object.entries(CUBOS)) {
      console.log(`\n  [${cubo}] (${ids.length})`);
      for (const p of ids) {
        const r = byId.get(p);
        if (!r) { console.log(`    ${p}  ⚠️ NO ENCONTRADA`); notFound++; continue; }
        const nh = r.lifecycle_state === 'needs_human';
        if (nh) stillNH++; else resolved++;
        console.log(`    ${p}  ${nh ? '⏳ needs_human' : '✅ '+r.lifecycle_state}${r.is_active ? ' (visible)' : ''}`);
      }
    }
    console.log(`\n  RESUMEN 27: siguen needs_human=${stillNH} · ya resueltas=${resolved} · no encontradas=${notFound}`);

    // ---- B) Universo de la campaña ----
    console.log('\n===== B) UNIVERSO DE LA CAMPAÑA EN RDS (por proveedor AVR × estado) =====');
    const prov = await sql`
      SELECT v.ai_provider, q.lifecycle_state, count(DISTINCT q.id)::int n
      FROM ai_verification_results v
      JOIN questions q ON q.id = v.question_id
      WHERE v.ai_provider IN ('claude_code_citas_2026_07','claude_code_mislink_ley_2026_07')
      GROUP BY 1,2 ORDER BY 1,2`;
    for (const r of prov) console.log(`  ${r.ai_provider.padEnd(34)} ${String(r.lifecycle_state).padEnd(16)} ${r.n}`);

    // ---- C) Superficie estructural de la causa raíz ----
    console.log('\n===== C) SUPERFICIE ESTRUCTURAL DEL BUG (linker por nº sin law_id) =====');
    const [{ total }] = await sql`SELECT count(*)::int total FROM questions WHERE is_active`;
    // artículos cuyo (article_number) existe en ≥2 leyes distintas = superficie de colisión
    const [{ colniv }] = await sql`
      SELECT count(*)::int colniv FROM (
        SELECT article_number FROM articles WHERE is_active AND article_number IS NOT NULL
        GROUP BY article_number HAVING count(DISTINCT law_id) >= 2
      ) x`;
    // preguntas activas vinculadas a un artículo con nº colisionante (universo de RIESGO)
    const [{ atrisk }] = await sql`
      SELECT count(DISTINCT q.id)::int atrisk
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      WHERE q.is_active AND a.article_number IN (
        SELECT article_number FROM articles WHERE is_active AND article_number IS NOT NULL
        GROUP BY article_number HAVING count(DISTINCT law_id) >= 2
      )`;
    console.log(`  preguntas activas totales:                         ${total}`);
    console.log(`  nº de artículo que existe en ≥2 leyes (colisión):  ${colniv}`);
    console.log(`  preguntas activas colgadas de un art nº-colisión:  ${atrisk}  ← universo de RIESGO`);
    console.log(`  (no todas son mislink; es la superficie donde el linker PUDO equivocarse)`);
    console.log(`\n  Nota: el subset cheaply-flaggable (explicación nombra otra ley) ya lo mide`);
    console.log(`  barrido-mislink-ley.cjs. El resto (sin señal) no es detectable por texto.`);
  } finally {
    await sql.end();
  }
})();
