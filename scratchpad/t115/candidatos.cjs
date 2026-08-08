// Elige lote por ALCANCE VIVO medido, no por el ranking de la herramienta.
// Para cada ley candidata: sus artículos huérfanos ordenados por temas vivos, y el alcance
// combinado de los 6 mejores. Marca los que tienen borradores o nota de vigencia (no generables).
const { Client } = require('pg');
const LEYES = ['rd-14-sep-1882','codigo-penal','rdl-2-2004'];
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  for(const slug of LEYES){
    const r=await c.query(`
      SELECT a.article_number art, length(a.content) len,
        (a.vigencia_notes IS NOT NULL) nota,
        (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id) tot,
        (SELECT count(DISTINCT tp.id) FROM topic_scope ts JOIN topics tp ON tp.id=ts.topic_id
           JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
          WHERE ts.law_id=a.law_id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
            AND tp.disponible AND o.is_active) temas
      FROM articles a JOIN laws l ON l.id=a.law_id
      WHERE l.slug=$1 AND a.is_active AND length(coalesce(a.content,''))>40
        AND a.content NOT ILIKE '%derogado%'
        AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id=a.id AND q.is_active)
      ORDER BY temas DESC, length(a.content) DESC LIMIT 10`,[slug]);
    if(!r.rows.length){ console.log(`\n${slug}: sin huérfanos`); continue }
    const top = r.rows.filter(x=>!x.nota && x.tot==='0').slice(0,6);
    const u = await c.query(`
      SELECT count(*) n FROM user_profiles WHERE replace(target_oposicion,'-','_') IN (
        SELECT DISTINCT tp.position_type FROM articles a JOIN laws l ON l.id=a.law_id
        JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        JOIN topics tp ON tp.id=ts.topic_id JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
        WHERE l.slug=$1 AND a.article_number=ANY($2) AND tp.disponible AND o.is_active)`,[slug, top.map(x=>x.art)]);
    const t2 = await c.query(`
      SELECT count(DISTINCT tp.id) temas, count(DISTINCT tp.position_type) opos
      FROM articles a JOIN laws l ON l.id=a.law_id
      JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      JOIN topics tp ON tp.id=ts.topic_id JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
      WHERE l.slug=$1 AND a.article_number=ANY($2) AND tp.disponible AND o.is_active`,[slug, top.map(x=>x.art)]);
    console.log(`\n=== ${slug}  →  lote de ${top.length} arts: ${t2.rows[0].temas} temas · ${t2.rows[0].opos} oposiciones · ${u.rows[0].n} usuarios`);
    console.log('   ' + r.rows.slice(0,8).map(x=>`${x.art}(${x.temas}t,${x.len}ch${x.nota?',NOTA':''}${x.tot!=='0'?',draft '+x.tot:''})`).join(' · '));
  }
  await c.end();
})();
