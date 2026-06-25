require('dotenv').config({ path: '.env.local' });
const fs = require('fs'), path = require('path');
const { Client } = require('pg');

const DIR = 'preguntas-para-subir/instituciones-penitenciarias/convocatorias-anteriores';
const OPOSICION = 'ayudante-instituciones-penitenciarias';
const APPLY = process.argv.includes('--apply');

function normalize(t) {
  return (t || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Map normalize(question_text) -> question_id (TODAS las preguntas, activas o no)
  console.error('Cargando preguntas BD...');
  const byNorm = new Map();
  let lastId = '00000000-0000-0000-0000-000000000000';
  let loaded = 0;
  while (true) {
    const r = await c.query('SELECT id, question_text FROM questions WHERE id > $1 ORDER BY id LIMIT 10000', [lastId]);
    if (!r.rows.length) break;
    for (const q of r.rows) { const k = normalize(q.question_text); if (!byNorm.has(k)) byNorm.set(k, q.id); loaded++; }
    lastId = r.rows[r.rows.length - 1].id;
    if (r.rows.length < 10000) break;
  }
  console.error('  filas cargadas:', loaded, '| normalizados distintos:', byNorm.size);

  const stats = { total: 0, matched: 0, no_match: 0, annulled: 0 };
  const rows = [];
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f)));
    const title = d.metadata?.title || f;
    const yearM = title.match(/(\d{4})/);
    const examDate = yearM ? `${yearM[1]}-01-01` : '2020-01-01';
    const examSource = `Examen Ayudantes II.PP. - ${title} - Primera parte`;
    for (const q of d.questions) {
      stats.total++;
      const qid = byNorm.get(normalize(q.question));
      if (!qid) { stats.no_match++; continue; }
      stats.matched++;
      if (q.isAnnulled) stats.annulled++;
      rows.push({
        question_id: qid, exam_date: examDate, exam_source: examSource,
        exam_part: 'primera', question_number: q.position || null,
        oposicion_type: OPOSICION, is_reserve: false, is_annulled: !!q.isAnnulled,
      });
    }
  }
  console.log('=== FASE 7: question_official_exams IIPP ===');
  console.log(JSON.stringify(stats, null, 2));
  console.log('Filas a insertar (con su pregunta en BD):', rows.length);
  console.log('  → estas incluyen las DUPLICADAS, ahora registradas como oficiales de IIPP');

  if (!APPLY) { console.log('\n(dry-run; usa --apply)'); await c.end(); return; }

  let ins = 0, skip = 0;
  for (const r of rows) {
    const res = await c.query(
      `INSERT INTO question_official_exams (question_id, exam_date, exam_source, exam_part, question_number, oposicion_type, is_reserve, is_annulled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (question_id, exam_date, exam_source) WHERE question_id IS NOT NULL DO NOTHING`,
      [r.question_id, r.exam_date, r.exam_source, r.exam_part, r.question_number, r.oposicion_type, r.is_reserve, r.is_annulled]
    );
    if (res.rowCount > 0) ins++; else skip++;
  }
  console.log(`✅ insertadas: ${ins} | ya existían: ${skip}`);
  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
