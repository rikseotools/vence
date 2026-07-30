const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') });
const postgres = require(path.join(ROOT, 'node_modules/postgres'));
const { citaNoLiteral } = require(path.join(ROOT, 'scripts/impugnaciones/validar-explicacion.cjs'));
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 });

(async () => {
  const rows = await sql`
    SELECT DISTINCT ON (q.id) q.id, q.explanation_data ed, a.content acontent,
           l.short_name ley, l.is_virtual, l.boe_url,
           (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) exp
      FROM questions q
      JOIN ai_verification_results v ON v.question_id=q.id AND v.ai_provider LIKE 'claude_code_t291%'
      LEFT JOIN articles a ON a.id=q.primary_article_id
      LEFT JOIN laws l ON l.id=a.law_id
     WHERE q.explanation_data IS NOT NULL`;

  const stat = { total: 0, sinCita: 0, literal: 0, noLiteral: 0 };
  const porLey = new Map();
  const fallos = [];
  for (const r of rows) {
    stat.total++;
    const key = (r.ley || '(sin ley)') + (r.is_virtual ? ' [virtual]' : r.boe_url ? ' [real]' : '');
    if (!porLey.has(key)) porLey.set(key, { n: 0, sin: 0, lit: 0, no: 0, exp: 0 });
    const g = porLey.get(key); g.n++; g.exp += r.exp;
    const texto = r.ed && r.ed.cita && r.ed.cita.texto ? String(r.ed.cita.texto) : '';
    const bloque = r.ed && r.ed.cita && r.ed.cita.bloque ? String(r.ed.cita.bloque) : '';
    const quote = (bloque || texto).trim();
    if (!quote) { stat.sinCita++; g.sin++; continue; }
    const res = citaNoLiteral(quote, r.acontent || '');
    if (res === null) { stat.literal++; g.lit++; }
    else { stat.noLiteral++; g.no++; fallos.push({ id: r.id, ley: key, exp: r.exp, quote: quote.slice(0,110), fallo: String(res.fallo).slice(0,110) }); }
  }

  const pct = (x) => `${((x / stat.total) * 100).toFixed(1)}%`;
  console.log(`### Literalidad de la cita frente al artículo vinculado — ${stat.total} preguntas de la campaña\n`);
  console.log(`  cita LITERAL en el artículo   : ${String(stat.literal).padStart(4)}  ${pct(stat.literal)}`);
  console.log(`  cita NO literal               : ${String(stat.noLiteral).padStart(4)}  ${pct(stat.noLiteral)}`);
  console.log(`  SIN cita (no se pudo anclar)  : ${String(stat.sinCita).padStart(4)}  ${pct(stat.sinCita)}`);

  console.log('\n### por contenedor/ley (ordenado por nº de preguntas)');
  for (const [k, g] of [...porLey.entries()].sort((a,b)=>b[1].n-a[1].n).slice(0, 18)) {
    console.log(`  ${String(g.n).padStart(4)}q ${String(g.exp).padStart(7)}exp · literal ${String(g.lit).padStart(4)} · NO-lit ${String(g.no).padStart(3)} · sin cita ${String(g.sin).padStart(3)} · ${k}`);
  }
  require('fs').writeFileSync(path.join(__dirname, 'literalidad-fallos.json'), JSON.stringify(fallos, null, 2));
  console.log(`\n### ejemplos de cita NO literal (${fallos.length} en total, volcados a literalidad-fallos.json)`);
  for (const f of fallos.sort((a,b)=>b.exp-a.exp).slice(0, 8)) {
    console.log(`  ${f.id.slice(0,8)} · ${String(f.exp).padStart(5)} exp · ${f.ley}`);
    console.log(`     cita : ${f.quote.replace(/\s+/g,' ')}`);
    console.log(`     falla: ${f.fallo.replace(/\s+/g,' ')}`);
  }
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
