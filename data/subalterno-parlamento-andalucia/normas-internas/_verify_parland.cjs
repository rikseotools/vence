require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare:false, max:1, ssl:{rejectUnauthorized:false} });
const norm = s => s.replace(/\s+/g,' ').trim();
(async () => {
  const qs = await sql`SELECT q.id,q.question_text,q.correct_option,q.explanation,q.lifecycle_state,q.is_active,a.article_number,a.content,l.short_name
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE 'gen_normas_internas_parl_and_2026-07-20'=ANY(q.tags)`;
  console.log('total preguntas:', qs.length, '| draft:', qs.filter(q=>q.lifecycle_state==='draft').length, '| activas:', qs.filter(q=>q.is_active).length);
  let bad=0;
  for (const q of qs) {
    const cita = norm(q.explanation.split('\n')[0].replace(/^>\s*/,''));
    const body = norm(q.content);
    // trocear por [...] para citas con elipsis
    const parts = cita.split('[...]').map(norm).filter(Boolean);
    const ok = parts.every(p => body.includes(p));
    if (!ok) { bad++; console.log('MISMATCH art', q.article_number, q.short_name, '\n  cita:', cita.slice(0,160)); }
  }
  console.log(bad===0 ? 'OK: todas las citas son verbatim del articulado importado' : `FALLO: ${bad} citas no coinciden`);
  for (const slug of ['reglamento-distinciones-honores-luto-parlamento-andalucia','estatuto-gobierno-regimen-interior-parlamento-andalucia']) {
    const l = (await sql`SELECT id,name,boe_url,last_verification_summary,verification_status FROM laws WHERE slug=${slug}`)[0];
    const arts = (await sql`SELECT count(*)::int c FROM articles WHERE law_id=${l.id}`)[0].c;
    const ts = await sql`SELECT t.topic_number,t.title FROM topic_scope s JOIN topics t ON t.id=s.topic_id WHERE s.law_id=${l.id}`;
    console.log(`\n${l.name}\n  law_id=${l.id} arts=${arts} verification_status=${l.verification_status}\n  boe_url=${(l.boe_url||'').slice(0,80)}...\n  temas=${ts.map(x=>x.topic_number+' '+x.title).join(' | ')}\n  summary.is_ok=${l.last_verification_summary?.is_ok} deliberate_subset=${l.last_verification_summary?.deliberate_subset}`);
  }
  await sql.end();
})();
