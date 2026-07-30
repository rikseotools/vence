const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') });
const postgres = require(path.join(ROOT, 'node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 });
const norm = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const STOP = new Set(['sobre','entre','desde','hasta','entre','entre','cuando','donde','todos','todas','puede','pueden','estas','estos','siguiente','siguientes','mediante','durante','aquellos','cualquier','tambien','porque','segun','forma','parte','otros','otras','misma','mismo','tiene','tienen','hacer','ninguna','ninguno','opcion','opciones']);
(async () => {
  const rows = await sql`
    SELECT DISTINCT ON (q.id) q.id, q.explanation_data ed, q.question_text, q.correct_option,
           q.option_a,q.option_b,q.option_c,q.option_d, a.content, l.short_name ley, a.article_number num,
           (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) exp
      FROM questions q
      JOIN ai_verification_results v ON v.question_id=q.id AND v.ai_provider LIKE 'claude_code_t291%'
      LEFT JOIN articles a ON a.id=q.primary_article_id LEFT JOIN laws l ON l.id=a.law_id
     WHERE q.explanation_data IS NOT NULL`;
  const sin = rows.filter(r => !(r.ed && r.ed.cita && (r.ed.cita.texto || r.ed.cita.bloque)));
  const out = [];
  for (const r of sin) {
    const clave = r['option_' + 'abcd'[r.correct_option]] || '';
    const art = norm(r.content);
    const toks = [...new Set(norm(clave).replace(/[^a-z0-9ñ ]/g,' ').split(/\s+/).filter(t=>t.length>=5 && !STOP.has(t)))];
    const presentes = toks.filter(t => art.includes(t));
    const ratio = toks.length ? presentes.length / toks.length : null;
    out.push({ id:r.id, ley:r.ley, num:r.num, exp:r.exp, ratio, toks:toks.length,
      ausentes: toks.filter(t=>!art.includes(t)).slice(0,6), clave: clave.slice(0,70), q:r.question_text.slice(0,70) });
  }
  const band = (x) => x===null ? 'sin-tokens' : x>=0.8 ? 'A · el artículo SÍ trae los términos' : x>=0.4 ? 'B · parcial' : 'C · el artículo NO los trae';
  const g = new Map();
  for (const o of out) { const b=band(o.ratio); if(!g.has(b)) g.set(b,[]); g.get(b).push(o); }
  for (const b of ['A · el artículo SÍ trae los términos','B · parcial','C · el artículo NO los trae','sin-tokens']) {
    const l = g.get(b)||[];
    if (!l.length) continue;
    console.log(`\n### ${b} — ${l.length} preguntas · ${l.reduce((s,x)=>s+x.exp,0)} exposiciones`);
    for (const o of l.sort((a,b2)=>b2.exp-a.exp).slice(0,10))
      console.log(`  ${o.id.slice(0,8)} ${String(o.exp).padStart(4)}exp ${o.ley} art.${o.num} · ${(o.ratio===null?'—':(o.ratio*100).toFixed(0)+'%')} · falta: ${o.ausentes.join(', ')||'—'} · «${o.q.replace(/\s+/g,' ')}»`);
  }
  require('fs').writeFileSync(path.join(__dirname,'triaje-sin-cita.json'), JSON.stringify(out,null,2));
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
