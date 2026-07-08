// Extractor de DRAFTS de estudio IIPP para verificación draft->approved.
// TAG=T<n> (tema) extrae los draft de ese tema; o ALL=1 por orden de tema.
// Produce ledger + blind compatibles con agentes Sonnet. SIZE limita la ola.
const fs = require('fs');
const B = '/home/manuel/Documentos/github/vence/node_modules/';
require(B + 'dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const sql = require(B + 'postgres')(process.env.DATABASE_URL, { ssl: 'require', max: 4 });
const PT = 'ayudante_instituciones_penitenciarias';
const W = process.env.WAVE, TAG = process.env.TAG, TAGS = process.env.TAGS, SIZE = +(process.env.SIZE || 160), PER = 20;
if (!W) { console.error('falta WAVE'); process.exit(1); }
// TAGS=T218,T202,... = lista priorizada (ese orden manda en la extracción). TAG=T1 = un solo tema.
const tagList = TAGS ? TAGS.split(',').map(s => s.trim()) : null;

(async () => {
  const tagFilter = tagList ? sql`AND q.tags && ${tagList}`
    : TAG ? sql`AND q.tags @> ARRAY[${TAG}]::text[]` : sql``;
  const orderBy = tagList
    ? sql`ORDER BY array_position(${tagList}::text[], (SELECT t FROM unnest(q.tags) t WHERE t LIKE 'T%')), l.short_name, q.id`
    : sql`ORDER BY (SELECT t FROM unnest(q.tags) t WHERE t LIKE 'T%'), l.short_name, q.id`;
  const rows = await sql`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
           q.correct_option, q.explanation old_explanation,
           a.article_number, a.title art_title, a.content art_content,
           l.id law_id, l.short_name law, l.name law_name,
           (SELECT t FROM unnest(q.tags) t WHERE t LIKE 'T%') tema
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.lifecycle_state='draft' AND q.tags @> ARRAY[${PT},'opositatest-estudio']::text[]
      ${tagFilter}
    ${orderBy}
    LIMIT ${SIZE}`;
  if (!rows.length) { console.log('Pool vacío (TAG=' + (TAG||'todos') + ')'); await sql.end(); return; }
  fs.writeFileSync(`/tmp/iwave${W}_ledger.json`, JSON.stringify(rows, null, 2));
  const blind = rows.map((q, i) => ({
    n: i + 1, id: q.id, tema: q.tema, question_text: q.question_text,
    option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
    marked_correct_letter: ['A','B','C','D'][q.correct_option],
    law_short_name: q.law, linked_article_number: q.article_number,
    linked_article_title: q.art_title, linked_article_content: q.art_content,
  }));
  let nf = 0; for (let i = 0; i < blind.length; i += PER) { nf++; fs.writeFileSync(`/tmp/iwave${W}_blind_${nf}.json`, JSON.stringify(blind.slice(i, i + PER), null, 2)); }
  for (let k = nf + 1; k <= 20; k++) { try { fs.unlinkSync(`/tmp/iwave${W}_blind_${k}.json`); } catch (_) {} }
  const tc = {}; blind.forEach(q => tc[q.tema] = (tc[q.tema] || 0) + 1);
  console.log(`Ola ${W}: ${rows.length} drafts extraídos, ${nf} ficheros | ${Object.entries(tc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+' '+k).join(' | ')}`);
  await sql.end();
})().catch(async e => { console.error('ERROR', e.message); try { await sql.end(); } catch (_) {} process.exit(1); });
