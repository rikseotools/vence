require('dotenv').config({ path: '.env.local' });
const fs = require('fs'), path = require('path');
const { Client } = require('pg');

const PT = 'ayudante_instituciones_penitenciarias';
const DIR = 'preguntas-para-subir/instituciones-penitenciarias/convocatorias-anteriores';
const APPLY = process.argv.includes('--apply');

const BLOQUE_BASE = {
  'I. Organización del Estado. Derecho Administrativo General. Gestión de Personal y Gestión Financiera': { base: 0, b: 1, dif: 'medium' },
  'II. Derecho Penal': { base: 100, b: 2, dif: 'hard' },
  'III. Derecho Penitenciario': { base: 200, b: 3, dif: 'hard' },
  'IV. Conducta humana': { base: 300, b: 4, dif: 'medium' },
};
const LAW = {
  RP_190_1996: '49f8bf3f-42c4-4b73-811f-dba9a2048bd1', CODIGO_PENAL: '3b2c702d-25c4-4fd9-86cb-12157f6799a2',
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941', LOGP: '7bc4187c-24cc-4a74-b76b-1a2db5f3e7e9',
  LECRIM: '8ea21d39-5f6c-4d4c-801b-ffdf7ca366e5', LOPJ: 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',
  TREBEP: 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0', L39_2015: '218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40_2015: '95680d57-feb1-41c0-bb27-236024815feb', L19_2013: 'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',
  LCSP: '4f605392-8137-4962-9e66-ca5f275e93ee', L45_2015: '95b11c4b-1f34-428f-83ae-3fe894326e40',
  L23_2014: '9613f909-57a3-4579-b83c-a667b4350e8d', RD782_2001: '5aef5552-a4ec-4302-b8dc-77c86aa5a40e',
  RD840_2011: 'aaf20539-a975-4032-8945-ac8cd9fd8ecd', LO6_1984: '2e7fb717-4d5b-4b00-b2ba-47497b527842',
  RD122_2015: 'c5d15786-2c35-434e-9188-63f0e5b10d89', TFUE: 'eba370d3-73d9-44a9-9865-48d2effabaf4',
  TUE: 'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',
};
function canonLaw(ley) {
  let l = ley.trim().split(/\s*\+\s*|,/)[0].trim();
  const map = [
    [/^RP\s*1996$|^RP\s*96$|^RP$|^RP de 1996$/i, 'RP_190_1996'], [/^CP\b/i, 'CODIGO_PENAL'], [/^CE\b/i, 'CE'],
    [/^LOGP/i, 'LOGP'], [/^LECR?IM/i, 'LECRIM'], [/^LOPJ/i, 'LOPJ'], [/^TREBEP/i, 'TREBEP'],
    [/^Ley 39\/2015/i, 'L39_2015'], [/^Ley 40\/2015/i, 'L40_2015'], [/^Ley 19\/2013/i, 'L19_2013'],
    [/^Ley 9\/2017/i, 'LCSP'], [/^Ley 45\/2015/i, 'L45_2015'], [/^Ley 23\/2014/i, 'L23_2014'],
    [/^RD 782\/2001/i, 'RD782_2001'], [/^RD 840\/2011/i, 'RD840_2011'], [/^LO 6\/1984/i, 'LO6_1984'],
    [/^RD 122\/2015/i, 'RD122_2015'], [/^TFUE/i, 'TFUE'], [/^TUE/i, 'TUE'],
  ];
  for (const [re, k] of map) if (re.test(l)) return k;
  return null;
}
function normalize(t) {
  return (t || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function cleanQ(t) {
  return (t || '').replace(/\s+/g,' ').trim();
}
const STRUCT = [/qu[ée]\s+t[íi]tulo\s+.+(dedicado|trata|regula)/i, /seg[úu]n\s+el\s+t[íi]tulo\s+[ivx]+/i,
  /dispuesto\s+en\s+el\s+(t[íi]tulo|cap[íi]tulo)\s+[ivx0-9]+/i, /cu[áa]nt(os|as)\s+(cap[íi]tulos|secciones|art[íi]culos)/i];
function isStructural(t) { return STRUCT.some(re => re.test(t || '')); }

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // topics: topic_number → topic_id
  const tps = await c.query('SELECT id, topic_number FROM topics WHERE position_type=$1', [PT]);
  const topicId = new Map(); tps.rows.forEach(r => topicId.set(r.topic_number, r.id));

  // artículos: law_id → Map(article_number → article_id)
  const artMap = new Map();
  for (const id of new Set(Object.values(LAW))) {
    const r = await c.query('SELECT id, article_number FROM articles WHERE law_id=$1', [id]);
    const m = new Map(); r.rows.forEach(x => m.set(String(x.article_number), x.id));
    artMap.set(id, m);
  }

  // dedup: cargar question_text normalizados activos
  console.error('Cargando preguntas BD para dedup...');
  const dbNorm = new Set();
  let off = 0;
  while (true) {
    const r = await c.query('SELECT question_text FROM questions WHERE is_active=true LIMIT 5000 OFFSET $1', [off]);
    if (!r.rows.length) break;
    r.rows.forEach(x => dbNorm.add(normalize(x.question_text)));
    off += r.rows.length;
    if (r.rows.length < 5000) break;
  }
  console.error('  BD activas cargadas:', dbNorm.size);

  const stats = { total: 0, annulled: 0, repealed: 0, noTitle: 0, noLaw: 0, noArt: 0, noTopic: 0, dup: 0, struct: 0, ready: 0 };
  const toInsert = [];
  const seenBatch = new Set();

  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f)));
    const yearM = (d.metadata?.title || f).match(/(\d{4})/);
    const examDate = yearM ? `${yearM[1]}-01-01` : null;
    for (const q of d.questions) {
      stats.total++;
      if (q.isAnnulled) { stats.annulled++; continue; }
      if (q.isRepealed) { stats.repealed++; continue; }
      const cont = q.contents?.[0];
      const bb = cont && BLOQUE_BASE[cont.name];
      if (!bb || !cont.child) { stats.noTopic++; continue; }
      const tm = cont.child.match(/^Tema (\d+)/); if (!tm) { stats.noTopic++; continue; }
      const topicNum = bb.base + Number(tm[1]);
      if (!topicId.has(topicNum)) { stats.noTopic++; continue; }

      const title = (q.explanationTitle || '').trim();
      const am = title.match(/^\*?\s*Art\.?(?:[íi]culo)?\s*(\d+)(?:\s*(bis|ter|quater))?(?:\.\d+)?\s+(.+)$/i);
      if (!am) { stats.noTitle++; continue; }
      const lk = canonLaw(am[3]);
      if (!lk || !LAW[lk]) { stats.noLaw++; continue; }
      const lawId = LAW[lk];
      const m = artMap.get(lawId);

      const qtext = cleanQ(q.question);
      // artículo: estructural → Art 0; si no, art parseado
      let artId = null;
      if (isStructural(qtext) && m.has('0')) { artId = m.get('0'); stats.struct++; }
      else {
        const artN = am[1] + (am[2] ? ' ' + am[2] : '');
        artId = m.get(artN) || m.get(am[1]) || null;
      }
      if (!artId) { stats.noArt++; continue; }

      // dedup
      const nk = normalize(qtext);
      if (dbNorm.has(nk) || seenBatch.has(nk)) { stats.dup++; continue; }
      seenBatch.add(nk);

      // opciones
      const opts = q.options.slice(0, 4);
      if (opts.length < 4 || opts.some(o => !o.text || o.text.length < 1)) { stats.noArt++; continue; }
      const correctIdx = ['A','B','C','D'].indexOf(q.correctAnswer);
      if (correctIdx < 0) { stats.noArt++; continue; }

      toInsert.push({
        question_text: qtext,
        option_a: opts[0].text, option_b: opts[1].text, option_c: opts[2].text, option_d: opts[3].text,
        correct_option: correctIdx,
        explanation: (q.explanation || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim() || 'Pendiente de explicación didáctica.',
        primary_article_id: artId,
        difficulty: bb.dif,
        is_official_exam: true,
        exam_date: examDate,
        exam_source: 'Examen oficial Ayudantes II.PP. ' + (d.metadata?.title || ''),
        deactivation_reason: 'Pendiente de revisión post-importación',
        topic_review_status: 'pending',
        tags: [PT, 'T' + topicNum, 'B' + bb.b, 'opositatest-oficial'],
      });
      stats.ready++;
    }
  }

  console.log('=== STATS IMPORT IIPP ===');
  console.log(JSON.stringify(stats, null, 2));
  console.log('Listas para insertar (desactivadas):', toInsert.length);

  if (!APPLY) { console.log('\n(dry-run; usa --apply para insertar)'); await c.end(); return; }

  let ins = 0, dupHash = 0, err = 0;
  for (const r of toInsert) {
    try {
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, difficulty, is_official_exam, exam_date, exam_source, deactivation_reason, topic_review_status, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [r.question_text, r.option_a, r.option_b, r.option_c, r.option_d, r.correct_option, r.explanation, r.primary_article_id, r.difficulty, r.is_official_exam, r.exam_date, r.exam_source, r.deactivation_reason, r.topic_review_status, r.tags]
      );
      ins++;
    } catch (e) {
      if (/content_hash|duplicate/i.test(e.message)) dupHash++;
      else { err++; if (err <= 5) console.error('  ERR:', e.message.slice(0, 90)); }
    }
  }
  console.log(`✅ insertadas: ${ins} | dup por hash (DB): ${dupHash} | errores: ${err}`);
  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
