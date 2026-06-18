// Generic extractor. WAVE=N. Auto-avanza: el pool vivo ya excluye procesadas
// (re-selladas=flag descartado; needs_human=inactivas). Excluye además calib 50.
const fs = require('fs');
const base = '/home/manuel/Documentos/github/vence/';
require(base + 'node_modules/dotenv').config({ path: base + '.env.local' });
const postgres = require(base + 'node_modules/postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 4 });
const W = process.env.WAVE;
const SIZE = 200, PER = 25;
if (!W) { console.error('falta WAVE'); process.exit(1); }

(async () => {
  const calib = ['00000000-0000-0000-0000-000000000000']; // incluir calib en las olas finales
  const lawRx = process.env.LAWRX || null;
  const LF = lawRx ? (lawRx[0]==='!' ? sql`AND l.short_name !~* ${lawRx.slice(1)}` : sql`AND l.short_name ~* ${lawRx}`) : sql``;
  // Tamaño actual del pool legal
  const [{ n: poolN }] = await sql`
    SELECT count(DISTINCT q.id)::int n FROM questions q
    JOIN ai_verification_results av ON av.question_id=q.id
    JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.is_active=true AND av.answer_ok=false AND COALESCE(av.discarded,false)=false
      AND (av.ai_model ILIKE '%sonnet%' OR av.ai_model ILIKE '%opus%') AND l.is_virtual IS TRUE
      ${LF} AND q.id <> ALL(${calib})`;
  console.log(`Pool legal restante: ${poolN}`);

  const rows = await sql`
    WITH lawfreq AS (
      SELECT a.law_id, count(DISTINCT q.id) freq FROM questions q
      JOIN ai_verification_results av ON av.question_id=q.id
      JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
      WHERE q.is_active=true AND av.answer_ok=false AND COALESCE(av.discarded,false)=false
        AND (av.ai_model ILIKE '%sonnet%' OR av.ai_model ILIKE '%opus%') AND l.is_virtual IS TRUE
        ${LF}
      GROUP BY 1),
    cand AS (
      SELECT DISTINCT ON (q.id) q.id, q.question_text, q.option_a,q.option_b,q.option_c,q.option_d,q.option_e,
        q.correct_option, q.is_official_exam, a.article_number, a.title art_title, a.content art_content, a.law_id,
        l.short_name law, l.is_virtual, av.verified_at
      FROM questions q JOIN ai_verification_results av ON av.question_id=q.id
      JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
      WHERE q.is_active=true AND av.answer_ok=false AND COALESCE(av.discarded,false)=false
        AND (av.ai_model ILIKE '%sonnet%' OR av.ai_model ILIKE '%opus%') AND l.is_virtual IS TRUE
        ${LF} AND q.id <> ALL(${calib})
      ORDER BY q.id, av.verified_at DESC)
    SELECT c.* FROM cand c JOIN lawfreq f ON f.law_id=c.law_id
    ORDER BY f.freq DESC, c.law, c.id LIMIT ${SIZE}`;

  fs.writeFileSync(`/tmp/wave${W}_ledger.json`, JSON.stringify(rows,null,2));
  const blind = rows.map((q,i)=>({n:i+1,id:q.id,question_text:q.question_text,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,option_e:q.option_e,correct_option_letter:['A','B','C','D','E'][q.correct_option],is_official_exam:q.is_official_exam,law_short_name:q.law,is_virtual:q.is_virtual,linked_article_number:q.article_number,linked_article_title:q.art_title,linked_article_content:q.art_content}));
  let nf=0; for(let i=0;i<blind.length;i+=PER){nf++;fs.writeFileSync(`/tmp/wave${W}_blind_${nf}.json`,JSON.stringify(blind.slice(i,i+PER),null,2));}
  for(let k=1;k<=20;k++){try{fs.unlinkSync(`/tmp/wave${W}_deep_${k}.json`);}catch(_){}}
  const lc={}; for(const q of blind) lc[q.law_short_name]=(lc[q.law_short_name]||0)+1;
  console.log(`Ola ${W}: ${rows.length} extraídas, ${nf} ficheros | top: ${Object.entries(lc).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>v+' '+k).join(' | ')}`);
  await sql.end();
})().catch(async e=>{console.error('ERROR',e.message);try{await sql.end();}catch(_){}process.exit(1);});
