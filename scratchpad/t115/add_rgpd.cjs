const fs=require('fs'); const {Client}=require('pg');
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r=await c.query(`SELECT l.short_name, l.name, a.article_number, a.title, a.content
    FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.name ILIKE '%2016/679%' AND a.article_number = ANY($1) AND a.is_active
    ORDER BY a.article_number::int`, [['56','60','65']]);
  console.log('encontrados en el RGPD:', r.rows.map(x=>x.article_number+' ('+String(x.title).slice(0,45)+', '+x.content.length+' ch)').join(' · ') || 'NINGUNO');
  if (!r.rows.length) { await c.end(); return }
  const d=JSON.parse(fs.readFileSync('scratchpad/t115/paso9_input.json','utf8'));
  for (const x of r.rows) {
    if (d.articulos_referenciados.some(a=>a.ley===x.short_name && a.articulo===x.article_number)) continue;
    d.articulos_referenciados.push({ley:x.short_name,articulo:x.article_number,titulo:x.title,texto:x.content});
  }
  fs.writeFileSync('scratchpad/t115/paso9_input.json',JSON.stringify(d,null,1));
  console.log('adjuntos finales:', d.articulos_referenciados.map(a=>a.ley+' '+a.articulo).join(' · '));
  await c.end();
})();
