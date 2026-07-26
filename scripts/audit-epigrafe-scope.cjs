#!/usr/bin/env node
/**
 * audit-epigrafe-scope.cjs
 *
 * FASE AUTOMÁTICA de detección de incoherencias epígrafe ↔ topic_scope.
 * Nace de la auditoría manual `docs/maintenance/verificar-epigrafe-topic-scope.md`,
 * que cazaba estos fallos pero dependía de disciplina humana. Esto lo hace
 * mecánico y repetible (no chapuzas, robusto por construcción).
 *
 * Detecta:
 *   🔴 UNDER          — ley citada (con número) en el epígrafe pero ausente del scope
 *                       o presente a 0 artículos.
 *   🔴 WRONG_SUBJECT  — una ley del scope aporta >=80% de las preguntas servidas pero
 *                       su número NO aparece en el epígrafe (materia equivocada,
 *                       p.ej. Subvenciones sirviendo un tema de Presupuesto).
 *   🟡 EMPTY_ROW      — fila de topic_scope con article_numbers vacío (ruido / descuido).
 *   🟡 OVER           — ley del scope (con arts) cuyo número no está en el epígrafe
 *                       (señal débil; puede ser proxy legítimo de la estatal equivalente).
 *
 * Uso:
 *   node scripts/audit-epigrafe-scope.cjs                 # todas las oposiciones
 *   node scripts/audit-epigrafe-scope.cjs auxiliar_administrativo_clm auxiliar_administrativo_sms
 *
 * Exit code 1 si hay algún hallazgo 🔴 (apto como gate de CI).
 */
const postgres = require('postgres');
const path = require('path');
const { analizarMateria } = require(path.join(__dirname, '..', 'lib', 'laws', 'epigrafeMateria.js'));
require('dotenv').config({ path: '.env.local' });

// Agnóstico a la BD: postgres-js sobre DATABASE_URL (RDS/Neon/…), la MISMA capa
// que la app (db/client.ts). NO usa el cliente Supabase.
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado (agnóstico: RDS/Neon; NO Supabase). Ver db/client.ts'); process.exit(2); }
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} });

// Matcher ley↔epígrafe: NÚCLEO COMPARTIDO en lib/laws/lawNameMatch.cjs (T-129).
// Antes vivía aquí, pero este script abre BD al cargarse, así que `lib/` y los tests no
// podían reutilizarlo — era un silo. Una sola implementación, sin copias que divergir.
const { extractLawRefs, norm, nameReferenced } = require('../lib/laws/lawNameMatch.cjs');

async function auditPositionType(pt) {
  const topics = await sql`
    SELECT id, topic_number, title, epigrafe
    FROM topics WHERE position_type = ${pt} ORDER BY topic_number`;
  if (!topics || !topics.length) return null;

  const findings = [];
  for (const t of topics) {
    if (!t.epigrafe) continue;
    const epiRefs = extractLawRefs(t.epigrafe);
    const scope = await sql`
      SELECT law_id, article_numbers, include_full_title
      FROM topic_scope WHERE topic_id = ${t.id}`;

    const rows = [];
    let topicTotal = 0;
    for (const r of scope || []) {
      const l = (await sql`SELECT short_name, name, slug FROM laws WHERE id = ${r.law_id}`)[0];
      // Semántica de scope IDÉNTICA al fetcher de producción (lib/api/topic-data/queries.ts:230):
      //   article_numbers = null  → ley virtual: TODA la ley está en scope.
      //   article_numbers = []    → fila inerte: no aporta nada (EMPTY_ROW real).
      //   article_numbers = [vals]→ solo esos artículos.
      // include_full_title=true es la forma explícita equivalente a null.
      // Tratar null como "toda la ley" evita UNDER/EMPTY_ROW EN FALSO sobre temas que en
      // producción sí sirven preguntas (footgun null+include_full_title=false del manual).
      const fullTitle = r.include_full_title === true || r.article_numbers === null;
      const arts = r.article_numbers || [];
      let q = 0;
      let artCount = arts.length;
      let articleIds = [];
      if (fullTitle) {
        const as = await sql`SELECT id FROM articles WHERE law_id = ${r.law_id}`;
        articleIds = as.map(x => x.id);
        artCount = articleIds.length;
      } else if (arts.length) {
        const as = await sql`SELECT id FROM articles WHERE law_id = ${r.law_id} AND article_number = ANY(${arts}::text[])`;
        articleIds = as.map(x => x.id);
      }
      if (articleIds.length) {
        // RDS acepta el array como parámetro (sin el límite de URL del PostgREST) → una sola query.
        const cr = await sql`SELECT COUNT(*)::int AS c FROM questions WHERE is_active = true AND primary_article_id = ANY(${articleIds}::uuid[])`;
        q += cr[0]?.c || 0;
      }
      // refs por número (short_name + name) + reconocimiento descriptivo por nombre
      const refs = new Set([...extractLawRefs(l ? l.short_name : ''), ...extractLawRefs(l ? l.name : '')]);
      const named = nameReferenced(l ? l.name : '', l ? l.short_name : '', t.epigrafe);
      rows.push({ name: l ? l.short_name : '?', arts: artCount, q, refs, named, articleIds });
      topicTotal += q;
    }

    const flags = [];
    const scopeRefs = new Set();
    rows.forEach(r => { if (r.arts > 0) r.refs.forEach(x => scopeRefs.add(x)); });

    // UNDER: ref del epígrafe sin cobertura en scope (por número)
    for (const ref of epiRefs) {
      if (!scopeRefs.has(ref)) flags.push(`🔴 UNDER: epígrafe cita ${ref} pero no está en scope (o a 0 arts)`);
    }
    // EMPTY_ROW
    rows.filter(r => r.arts === 0).forEach(r => flags.push(`🟡 EMPTY_ROW: ${r.name} a 0 arts`));
    // WRONG_SUBJECT + OVER — una ley está "referenciada" si su número está en el epígrafe O su nombre lo está
    for (const r of rows) {
      if (r.arts === 0 || r.q === 0) continue;
      const referenced = [...r.refs].some(x => epiRefs.has(x)) || r.named;
      if (referenced) continue;
      // El nombre de la ley no aparece en el epígrafe. Antes de acusar, mirar si el epígrafe
      // habla de la MATERIA que regulan los artículos escopados: los temarios describen la
      // materia sin citar la norma ("Órganos de gobierno provinciales" ↔ Ley 7/1985), y sin
      // este filtro el 82% de estos avisos son falsos positivos (medido 26/07, T-117).
      let materia = { banda: 'indeterminado' };
      if (r.articleIds && r.articleIds.length) {
        const cont = await sql`SELECT left(string_agg(content, ' '), 200000) AS k FROM articles WHERE id = ANY(${r.articleIds}::uuid[])`;
        materia = analizarMateria(t.epigrafe, cont[0]?.k || '');
      }
      if (materia.banda === 'encaja') continue;               // la materia encaja: no hay hallazgo
      const pct = (materia.ratio * 100).toFixed(0);
      if (materia.banda === 'indeterminado') {
        flags.push(`⚪ NO_JUZGABLE: ${r.name} (${r.q}q) no se nombra en el epígrafe y no se puede juzgar por materia — ${materia.motivo}`);
        continue;
      }
      const share = topicTotal ? r.q / topicTotal : 0;
      if (materia.banda === 'dudoso') {
        flags.push(`🟡 MATERIA_PARCIAL: ${r.name} (${r.q}q) no se nombra en el epígrafe y la materia encaja solo a medias (${pct}% del epígrafe aparece en lo escopado) — revisar`);
      } else if (share >= 0.8) {
        flags.push(`🔴 WRONG_SUBJECT: ${r.name} aporta ${(share*100).toFixed(0)}% (${r.q}q), no se nombra en el epígrafe y su materia NO aparece en lo escopado (${pct}%)`);
      } else {
        flags.push(`🟡 OVER: ${r.name} (${r.q}q) en scope, no referenciada en epígrafe y sin encaje de materia (${pct}%)`);
      }
    }
    // LOW_COVERAGE: tema con muy pocas preguntas servidas
    if (topicTotal > 0 && topicTotal < 10) flags.push(`🟡 LOW_COVERAGE: solo ${topicTotal}q servidas`);

    if (flags.length) findings.push({ t: t.topic_number, title: t.title, total: topicTotal, flags, rows });
  }
  return findings;
}

(async () => {
  let targets = process.argv.slice(2);
  if (!targets.length) {
    // RDS no tiene el cap de 1000 filas del PostgREST → DISTINCT directo.
    const data = await sql`SELECT DISTINCT position_type FROM topics WHERE is_active = true AND position_type IS NOT NULL`;
    targets = data.map(x => x.position_type).filter(Boolean);
  }
  let red = 0, yellow = 0;
  for (const pt of targets.sort()) {
    const findings = await auditPositionType(pt);
    if (findings === null) continue;
    if (!findings.length) { console.log(`✅ ${pt}: sin incidencias`); continue; }
    console.log(`\n━━━ ${pt} ━━━`);
    for (const f of findings) {
      console.log(`  T${f.t} (${f.total}q) — ${f.title.slice(0, 60)}`);
      f.flags.forEach(fl => { console.log('      ' + fl); fl.startsWith('🔴') ? red++ : yellow++; });
    }
  }
  console.log(`\n=== ${red} 🔴  /  ${yellow} 🟡 ===`);
  process.exit(red > 0 ? 1 : 0);
})();
