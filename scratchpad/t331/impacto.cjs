const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`
    SELECT tp.position_type, tp.topic_number, tp.disponible, o.is_active,
           a.article_number
    FROM articles a
    JOIN laws l ON l.id=a.law_id
    JOIN topic_scope ts ON ts.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN topics tp ON tp.id=ts.topic_id
    LEFT JOIN oposiciones o ON replace(o.slug,'-','_')=tp.position_type
    WHERE l.short_name='RD 203/2021' AND a.article_number IN ('50','52')
    ORDER BY tp.position_type, tp.topic_number, a.article_number`);
  const vivos = r.rows.filter(x=>x.disponible && x.is_active);
  const m = {};
  for (const x of vivos) { const k=x.position_type+' T'+x.topic_number; (m[k]=m[k]||[]).push(x.article_number); }
  console.log('— servidos en oposición ACTIVA y tema DISPONIBLE:');
  for (const [k,v] of Object.entries(m)) console.log('  ', k, 'arts', v.join('+'));
  console.log('total ubicaciones vivas:', Object.keys(m).length, '| filas totales (incl. no disponibles):', r.rows.length);
  await c.end();
})();
