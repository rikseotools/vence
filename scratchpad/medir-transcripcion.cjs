require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2 });

const norm = (t) => (t || '').toLowerCase()
  .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n')
  .replace(/[^a-z0-9]+/g,' ').trim();
const quitaPreambulo = (n) => n
  .replace(/^(constitucion espanola|ley organica [0-9 ]+|ley [0-9 ]+|real decreto[a-z0-9 ]{0,20})\s*/,'')
  .replace(/^(segun (el|lo dispuesto en el) )?(articulo|art) [0-9]+( bis| ter| quater)?( [0-9]+)?( de la [a-z0-9 ]{0,40})?\s*/,'')
  .trim();

(async () => {
  const minImp = parseInt(process.argv[2] || '10', 10);
  const filas = await sql`
    WITH cubo AS (
      SELECT id, explanation, primary_article_id
        FROM questions
       WHERE is_active AND explanation_data IS NULL AND explanation IS NOT NULL
         AND length(explanation) BETWEEN 80 AND 1500
         AND explanation NOT LIKE '%**A)%' AND explanation NOT LIKE '%**B)%'
         AND explanation NOT ILIKE '%INCORRECTA%'
         AND primary_article_id IS NOT NULL
    ), expos AS (
      SELECT tq.question_id, count(*)::int veces FROM test_questions tq JOIN cubo c ON c.id = tq.question_id
       WHERE tq.created_at > now() - interval '90 days' GROUP BY 1
    )
    SELECT c.id, c.explanation, e.veces impresiones, a.content art, l.short_name ley, l.is_virtual
      FROM cubo c JOIN expos e ON e.question_id = c.id
      JOIN articles a ON a.id = c.primary_article_id JOIN laws l ON l.id = a.law_id
     WHERE e.veces >= ${minImp}`;

  let lit = 0, casi = 0, impLit = 0, impCasi = 0;
  const porLey = {};
  for (const f of filas) {
    const ne = quitaPreambulo(norm(f.explanation));
    const na = norm(f.art);
    if (ne.length < 60) continue;
    let clase = null;
    if (na.includes(ne)) clase = 'literal';
    else {
      const toks = [...new Set(ne.split(' ').filter(w => w.length > 3))];
      const dentro = toks.filter(w => na.includes(w)).length;
      if (toks.length >= 10 && dentro / toks.length >= 0.92) clase = 'casi';
    }
    if (!clase) continue;
    if (clase === 'literal') { lit++; impLit += f.impresiones; } else { casi++; impCasi += f.impresiones; }
    const k = f.ley + (f.is_virtual ? ' (virtual)' : '');
    porLey[k] = (porLey[k] || 0) + 1;
  }
  console.log(`candidatas con ≥${minImp} impresiones/90d: ${filas.length}`);
  console.log(`  transcripción LITERAL: ${lit}  (${impLit} impresiones)`);
  console.log(`  casi transcripción  : ${casi}  (${impCasi} impresiones)`);
  console.log('  top leyes:', Object.entries(porLey).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>`${k}:${v}`).join(' · '));
  await sql.end();
})();
