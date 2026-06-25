require('dotenv').config({ path: '.env.local' });
const fs = require('fs'), path = require('path');
const { Client } = require('pg');

const PT = 'ayudante_instituciones_penitenciarias';
const DIR = 'preguntas-para-subir/instituciones-penitenciarias/convocatorias-anteriores';
const APPLY = process.argv.includes('--apply');

// bloque (name) → base de topic_number
const BLOQUE_BASE = {
  'I. Organización del Estado. Derecho Administrativo General. Gestión de Personal y Gestión Financiera': 0,
  'II. Derecho Penal': 100,
  'III. Derecho Penitenciario': 200,
  'IV. Conducta humana': 300,
};

// canon de ley → law_id (resolver)
const LAW = {
  RP_190_1996: '49f8bf3f-42c4-4b73-811f-dba9a2048bd1', CODIGO_PENAL: '3b2c702d-25c4-4fd9-86cb-12157f6799a2',
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941', LOGP: '7bc4187c-24cc-4a74-b76b-1a2db5f3e7e9',
  LECRIM: '8ea21d39-5f6c-4d4c-801b-ffdf7ca366e5', LOPJ: 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',
  TREBEP: 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0', L39_2015: '218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40_2015: '95680d57-feb1-41c0-bb27-236024815feb', L19_2013: 'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',
  LCSP: '4f605392-8137-4962-9e66-ca5f275e93ee', L45_2015: '95b11c4b-1f34-428f-83ae-3fe894326e40',
  L23_2014: '9613f909-57a3-4579-b83c-a667b4350e8d',
  RD782_2001: '5aef5552-a4ec-4302-b8dc-77c86aa5a40e', RD840_2011: 'aaf20539-a975-4032-8945-ac8cd9fd8ecd',
  LO6_1984: '2e7fb717-4d5b-4b00-b2ba-47497b527842', RD122_2015: 'c5d15786-2c35-434e-9188-63f0e5b10d89',
  TFUE: 'eba370d3-73d9-44a9-9865-48d2effabaf4', TUE: 'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',
  LGP: 'effe3259-8168-43a0-9730-9923452205c4', LEY_GOBIERNO: '1ed89e01-ace0-4894-8bd4-fa00db74d34a',
  LO3_1981: '0425df52-bf4f-4220-a27d-63a9cbaac1c4', LO3_2007: '6e59eacd-9298-4164-9d78-9e9343d9a900',
  LO1_2004: 'f5c17b23-2547-43d2-800c-39f5ea925c2f', INCOMPAT: 'f6f4da4d-845f-45d0-b69f-3554524e23e7',
  DEPENDENCIA: '02a0a8db-af96-45d0-8fd4-4d24b825cb13', LOTC: '2bc32b1a-9b5f-4e11-ba0b-3b014293882c',
  EOMF: '8f8cb31f-c8ca-4967-9fa6-6fc94d77a932', LEC: '14b4b825-2078-44cb-bff8-53d332c4f473',
  CC: '899e61d1-e168-482b-9e86-4e7787eab6fc', LBRL: '06784434-f549-4ea2-894f-e2e400881545',
  RD364_1995: 'f96071d8-a2bb-403b-b695-576067210590',
};
function canonLaw(rest) {
  const map = [
    [/RP\s*1996|RP\s*96|RD\s*190\/1996|Reglamento Penitenciario/i, 'RP_190_1996'],
    [/LECR?IM|Enjuiciamiento Criminal/i, 'LECRIM'],
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
function cleanTitle(t) { return (t || '').replace(/[​-‏‪-‮⁠﻿­]/g, '').trim(); }

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 1) topics: topic_number → topic_id
  const tps = await c.query('SELECT id, topic_number, title FROM topics WHERE position_type=$1', [PT]);
  const topicId = new Map(); tps.rows.forEach(r => topicId.set(r.topic_number, r.id));

  // 2) artículos existentes por ley (para validar): law_id → Set(article_number)
  const lawArts = new Map();
  for (const id of new Set(Object.values(LAW))) {
    const r = await c.query('SELECT article_number FROM articles WHERE law_id=$1', [id]);
    lawArts.set(id, new Set(r.rows.map(x => String(x.article_number))));
  }

  // 3) parsear preguntas → agregación topic_number → law_id → Set(art)
  const agg = new Map(); // topic_number -> Map(law_id -> Set)
  let matched = 0, noLaw = 0, noArtInDb = 0, noTopic = 0, total = 0;
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f)));
    for (const q of d.questions) {
      const cont = q.contents?.[0];
      if (!cont || BLOQUE_BASE[cont.name] === undefined || !cont.child) continue;
      const tm = cont.child.match(/^Tema (\d+)/); if (!tm) continue;
      const topicNum = BLOQUE_BASE[cont.name] + Number(tm[1]);
      if (!topicId.has(topicNum)) { noTopic++; continue; }
      const t = cleanTitle(q.explanationTitle);
      const am = t.match(/^\*?\s*Art[íi]?\.?(?:culo)?\s*(\d+)\s*(bis|ter|quater|quinquies)?/i);
      if (!am) continue;
      total++;
      const art = am[1] + (am[2] ? ' ' + am[2].toLowerCase() : '');
      const lk = canonLaw(t);
      if (!lk || !LAW[lk]) { noLaw++; continue; }
      const lawId = LAW[lk];
      // validar artículo existe en BD (probar "272" y "272 bis")
      const set = lawArts.get(lawId);
      let artNum = null;
      if (set.has(art)) artNum = art;
      else if (set.has(am[1])) artNum = am[1];
      if (!artNum) { noArtInDb++; continue; }
      matched++;
      if (!agg.has(topicNum)) agg.set(topicNum, new Map());
      const m = agg.get(topicNum);
      if (!m.has(lawId)) m.set(lawId, new Set());
      m.get(lawId).add(artNum);
    }
  }

  console.log(`Parsed con art: ${total} | scope-able: ${matched} | sin ley mapeada: ${noLaw} | art no en BD: ${noArtInDb} | sin topic: ${noTopic}`);

  // 4) construir filas topic_scope
  const rows = [];
  for (const [topicNum, m] of agg) {
    for (const [lawId, arts] of m) {
      rows.push({ topic_id: topicId.get(topicNum), law_id: lawId, article_numbers: [...arts].sort((a,b)=>parseInt(a)-parseInt(b)) });
    }
  }
  console.log(`Filas topic_scope a crear: ${rows.length} (topics con scope: ${agg.size}/50)`);

  if (!APPLY) {
    // resumen por topic
    const byTopic = [...agg.entries()].sort((a,b)=>a[0]-b[0]);
    for (const [tn, m] of byTopic.slice(0, 8)) {
      const t = tps.rows.find(r=>r.topic_number===tn);
      console.log(`  T${tn} ${t.title.slice(0,35)} → ${[...m.values()].reduce((s,x)=>s+x.size,0)} arts en ${m.size} leyes`);
    }
    console.log('  ... (dry-run; usa --apply para insertar)');
    await c.end(); return;
  }

  // 5) insertar (limpiar scope previo de estos topics)
  const topicIds = [...agg.keys()].map(tn => topicId.get(tn));
  await c.query('DELETE FROM topic_scope WHERE topic_id = ANY($1)', [topicIds]);
  for (const r of rows) {
    await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES ($1,$2,$3)', [r.topic_id, r.law_id, r.article_numbers]);
  }
  console.log(`✅ ${rows.length} filas topic_scope insertadas`);
  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
