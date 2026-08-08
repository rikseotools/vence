const { Client } = require('pg');
const CAND = [
  ['losu',        ['80','81','82','83','84','85']],
  ['ley-9-2017',  ['134','137','138','140','141','142']],
  ['lotc',        ['13','28','30','36','37','39','40']],
];
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  for (const [slug, arts] of CAND) {
    const r = await c.query(`
      SELECT count(DISTINCT tp.id) temas, count(DISTINCT tp.position_type) oposiciones
      FROM articles a JOIN laws l ON l.id=a.law_id
      JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      JOIN topics tp ON tp.id=ts.topic_id
      JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
      WHERE l.slug=$1 AND a.article_number = ANY($2) AND tp.disponible AND o.is_active`, [slug, arts]);
    const u = await c.query(`
      SELECT count(*) n FROM user_profiles up
      WHERE replace(up.target_oposicion,'-','_') IN (
        SELECT DISTINCT tp.position_type
        FROM articles a JOIN laws l ON l.id=a.law_id
        JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        JOIN topics tp ON tp.id=ts.topic_id JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
        WHERE l.slug=$1 AND a.article_number = ANY($2) AND tp.disponible AND o.is_active)`, [slug, arts]);
    const est = await c.query(`
      SELECT a.article_number, length(a.content) len, a.is_active,
        (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id) tot,
        (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id AND q.lifecycle_state='draft') dr
      FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.slug=$1 AND a.article_number=ANY($2) ORDER BY a.article_number::int`, [slug, arts]);
    console.log(`\n=== ${slug} arts ${arts.join(',')}`);
    console.log(`   alcance VIVO: ${r.rows[0].temas} temas · ${r.rows[0].oposiciones} oposiciones · ${u.rows[0].n} usuarios`);
    console.log('   ' + est.rows.map(x=>`art${x.article_number}(${x.len}ch,tot ${x.tot}${x.dr>0?', DRAFT '+x.dr:''}${x.is_active?'':', INACTIVO'})`).join(' · '));
  }
  await c.end();
})();
