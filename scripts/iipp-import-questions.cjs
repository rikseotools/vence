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
  // recuperación: leyes ya en BD que faltaban en el resolutor
  LGP: 'effe3259-8168-43a0-9730-9923452205c4', LEY_GOBIERNO: '1ed89e01-ace0-4894-8bd4-fa00db74d34a',
  LO3_1981: '0425df52-bf4f-4220-a27d-63a9cbaac1c4', LO3_2007: '6e59eacd-9298-4164-9d78-9e9343d9a900',
  LO1_2004: 'f5c17b23-2547-43d2-800c-39f5ea925c2f', INCOMPAT: 'f6f4da4d-845f-45d0-b69f-3554524e23e7',
  DEPENDENCIA: '02a0a8db-af96-45d0-8fd4-4d24b825cb13', LOTC: '2bc32b1a-9b5f-4e11-ba0b-3b014293882c',
  EOMF: '8f8cb31f-c8ca-4967-9fa6-6fc94d77a932', LEC: '14b4b825-2078-44cb-bff8-53d332c4f473',
  CC: '899e61d1-e168-482b-9e86-4e7787eab6fc', LBRL: '06784434-f549-4ea2-894f-e2e400881545',
  RD364_1995: 'f96071d8-a2bb-403b-b695-576067210590',
};
// limpia caracteres invisibles que rompían el parseo del título
function cleanTitle(t) { return (t || '').replace(/[​-‏‪-‮⁠﻿­]/g, '').trim(); }
// resuelve la ley buscando su firma EN CUALQUIER PARTE del título (multi-artículo, "+art", etc.)
function canonLaw(rest) {
  const map = [
    [/RP\s*1996|RP\s*96|RD\s*190\/1996|Reglamento Penitenciario/i, 'RP_190_1996'],
    [/LECR?IM|Enjuiciamiento Criminal/i, 'LECRIM'], // antes que LEC y CP
    [/\bLEC\b|Enjuiciamiento Civil|Ley 1\/2000/i, 'LEC'],
    [/LOTC|LO\s*2\/1979|Tribunal Constitucional/i, 'LOTC'],
    [/LOGP|LO\s*1\/1979/i, 'LOGP'], [/LOPJ|LO\s*6\/1985/i, 'LOPJ'],
    [/\bCP\b|Código Penal|LO\s*10\/1995/i, 'CODIGO_PENAL'],
    [/\bCC\b|Código Civil/i, 'CC'], [/\bCE\b|Constitución/i, 'CE'],
    [/TREBEP|RDL?\s*5\/2015/i, 'TREBEP'],
    [/Ley 39\/2015/i, 'L39_2015'], [/Ley 40\/2015/i, 'L40_2015'], [/Ley 19\/2013/i, 'L19_2013'],
    [/Ley 9\/2017|LCSP/i, 'LCSP'], [/Ley 45\/2015|Voluntariado/i, 'L45_2015'], [/Ley 23\/2014/i, 'L23_2014'],
    [/RD\s*782\/2001/i, 'RD782_2001'], [/RD\s*840\/2011/i, 'RD840_2011'],
    [/LO\s*6\/1984|Habeas/i, 'LO6_1984'], [/RD\s*122\/2015/i, 'RD122_2015'],
    [/TFUE/i, 'TFUE'], [/\bTUE\b/i, 'TUE'],
    [/Ley 47\/2003|\bLGP\b|General Presupuestaria/i, 'LGP'],
    [/Ley 50\/1997|Ley del Gobierno/i, 'LEY_GOBIERNO'],
    [/LO\s*3\/1981|Defensor del Pueblo/i, 'LO3_1981'],
    [/LO\s*3\/2007|igualdad efectiva/i, 'LO3_2007'],
    [/LO\s*1\/2004|Violencia de Género/i, 'LO1_2004'],
    [/Ley 53\/1984|incompatibilidad/i, 'INCOMPAT'],
    [/Ley 39\/2006|dependencia/i, 'DEPENDENCIA'],
    [/EOMF|50\/1981|Estatuto.*Ministerio Fiscal/i, 'EOMF'],
    [/LBRL|Ley 7\/1985|Bases.*Régimen Local/i, 'LBRL'],
    [/RD\s*364\/1995/i, 'RD364_1995'],
  ];
  for (const [re, k] of map) if (re.test(rest)) return k;
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

      const title = cleanTitle(q.explanationTitle);
      // primer artículo: tolera ordinales (4º), decimales múltiples (149.1.6), bis/ter
      const am = title.match(/^\*?\s*Art[íi]?\.?(?:culo)?\s*(\d+)\s*(bis|ter|quater|quinquies)?/i);
      if (!am) { stats.noTitle++; continue; }
      const lk = canonLaw(title); // busca la ley en TODO el título (multi-artículo, +art)
      if (!lk || !LAW[lk]) { stats.noLaw++; continue; }
      const lawId = LAW[lk];
      const m = artMap.get(lawId);

      const qtext = cleanQ(q.question);
      // artículo: estructural → Art 0; si no, art parseado
      let artId = null;
      if (isStructural(qtext) && m.has('0')) { artId = m.get('0'); stats.struct++; }
      else {
        const artN = am[1] + (am[2] ? ' ' + am[2].toLowerCase() : '');
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
