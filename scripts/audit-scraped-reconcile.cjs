#!/usr/bin/env node
/**
 * GUARDARRAÍL DE RECONCILIACIÓN de preguntas scrapeadas.
 *
 * Invariante: toda pregunta de los ficheros scrapeados debe estar CONTABILIZADA
 * en exactamente un cubo:
 *   - official       → su texto existe en BD Y está registrada en question_official_exams
 *                       para esta oposición (caso normal de examen oficial importado).
 *   - excluded       → su texto NO existe en BD, con motivo documentado
 *                       (derogada / anulada / ley-no-en-BD / editorial-sin-artículo).
 *   - 🔴 SILENT_DROP → su texto SÍ existe en BD pero NO está registrada como oficial
 *                       de esta oposición. Esto es el fallo que queremos cazar:
 *                       una pregunta conocida que se quedó fuera en silencio.
 *
 * exit 1 si hay algún SILENT_DROP. Reutilizable: cualquier oposición con ficheros
 * scrapeados + question_official_exams.
 *
 * Uso: node scripts/audit-scraped-reconcile.cjs <oposicion-slug> <dir-scrapeado>
 *   ej: node scripts/audit-scraped-reconcile.cjs ayudante-instituciones-penitenciarias \
 *         preguntas-para-subir/instituciones-penitenciarias/convocatorias-anteriores
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs'), path = require('path');
const { Client } = require('pg');

const SLUG = process.argv[2];
const DIR = process.argv[3];
if (!SLUG || !DIR) { console.error('Uso: audit-scraped-reconcile.cjs <slug> <dir>'); process.exit(2); }

function normalize(t) {
  return (t || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function cleanTitle(t) { return (t || '').replace(/[​-‏‪-‮⁠﻿­]/g, '').trim(); }
// motivo de exclusión (para las que NO están en BD) — documentación, no fallo
function exclusionReason(q, lawsInDb) {
  if (q.isAnnulled) return 'anulada';
  if (q.isRepealed) return 'derogada';
  const title = cleanTitle(q.explanationTitle);
  if (/pregunta derogada/i.test(title)) return 'derogada';
  const am = title.match(/^\*?\s*Art[íi]?\.?(?:culo)?\s*(\d+)/i);
  if (!am) return 'editorial_sin_articulo';
  // ¿cita alguna ley que tengamos en BD? (heurístico por número de norma)
  const refs = title.match(/\b(?:LO|RD|RDL|Ley|Reglamento)\s*\d+\/\d{4}|\b\d+\/\d{4}|\bCP\b|\bCE\b|LOGP|LECR?IM|LOPJ|TREBEP|TFUE|TUE|LOTC|LGP|LBRL|EOMF/gi) || [];
  const citaLeyConocida = refs.some(r => lawsInDb.has(r.toLowerCase().replace(/\s+/g, '')));
  return citaLeyConocida ? 'ley_en_bd_sin_articulo' : 'ley_no_en_bd';
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 1) Map normalize(text) -> question_id (keyset pagination ESTABLE; nunca OFFSET sin ORDER BY)
  const byNorm = new Map();
  let lastId = '00000000-0000-0000-0000-000000000000';
  while (true) {
    const r = await c.query('SELECT id, question_text FROM questions WHERE id > $1 ORDER BY id LIMIT 10000', [lastId]);
    if (!r.rows.length) break;
    for (const q of r.rows) { const k = normalize(q.question_text); if (!byNorm.has(k)) byNorm.set(k, q.id); }
    lastId = r.rows[r.rows.length - 1].id;
    if (r.rows.length < 10000) break;
  }
  // 2) question_ids registrados como oficiales de ESTA oposición
  const off = await c.query('SELECT DISTINCT question_id FROM question_official_exams WHERE oposicion_type=$1 AND question_id IS NOT NULL', [SLUG]);
  const officialIds = new Set(off.rows.map(r => r.question_id));
  // 3) firmas de leyes en BD (para clasificar exclusiones; ligero)
  const lw = await c.query("SELECT short_name FROM laws WHERE is_active=true");
  const lawsInDb = new Set();
  for (const r of lw.rows) { const s = (r.short_name||'').toLowerCase().replace(/\s+/g,''); if (s) lawsInDb.add(s); const m=(r.short_name||'').match(/\d+\/\d{4}/); if(m) lawsInDb.add(m[0]); }

  const buckets = { official: 0, silent_drop: 0, excl_derogada: 0, excl_anulada: 0, excl_editorial: 0, excl_ley_no_bd: 0, excl_ley_bd_sin_art: 0 };
  const silentDrops = [];
  let total = 0;
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f)));
    for (const q of d.questions) {
      total++;
      const qid = byNorm.get(normalize(q.question));
      if (qid) {
        if (officialIds.has(qid)) buckets.official++;
        else { buckets.silent_drop++; silentDrops.push({ qid, text: (q.question||'').slice(0, 70), file: f }); }
      } else {
        const r = exclusionReason(q, lawsInDb);
        if (r === 'anulada') buckets.excl_anulada++;
        else if (r === 'derogada') buckets.excl_derogada++;
        else if (r === 'editorial_sin_articulo') buckets.excl_editorial++;
        else if (r === 'ley_en_bd_sin_articulo') buckets.excl_ley_bd_sin_art++;
        else buckets.excl_ley_no_bd++;
      }
    }
  }

  console.log(`━━━ Reconciliación scrapeado ↔ BD: ${SLUG} (${total} preguntas) ━━━`);
  console.log('  ✅ official (en BD + question_official_exams):', buckets.official);
  console.log('  📝 excluida derogada:', buckets.excl_derogada, '| anulada:', buckets.excl_anulada,
              '| editorial:', buckets.excl_editorial, '| ley NO en BD:', buckets.excl_ley_no_bd,
              '| ley en BD sin art:', buckets.excl_ley_bd_sin_art);
  console.log('  🔴 SILENT_DROP (en BD pero NO registrada como oficial):', buckets.silent_drop);
  const contabilizadas = total - buckets.silent_drop;
  console.log(`  Contabilizadas: ${contabilizadas}/${total}`);
  if (buckets.excl_ley_bd_sin_art > 0) {
    console.log('  ⚠️ ' + buckets.excl_ley_bd_sin_art + ' citan una ley que SÍ está en BD pero no se vincularon a artículo → revisar (recuperables).');
  }
  if (buckets.silent_drop > 0) {
    console.log('\n🔴 DROPS SILENCIOSOS (registrar como oficial o documentar exclusión):');
    silentDrops.slice(0, 20).forEach(s => console.log('   ', s.qid, '|', s.text, '|', s.file));
    if (silentDrops.length > 20) console.log('    ... y', silentDrops.length - 20, 'más');
    await c.end();
    process.exit(1);
  }
  console.log('\n✅ Reconciliación OK: ninguna pregunta conocida quedó fuera en silencio.');
  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
