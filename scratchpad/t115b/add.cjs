const fs=require('fs'); const {Client}=require('pg');
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r=await c.query(`SELECT l.short_name, a.article_number, a.title, a.content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='ley-9-2017' AND a.article_number = ANY($1)`, [['75','145']]);
  const d=JSON.parse(fs.readFileSync('scratchpad/t115b/paso9v3_input.json','utf8'));
  for (const x of r.rows) if(!d.articulos_referenciados.some(a=>a.articulo===x.article_number))
    d.articulos_referenciados.push({ley:x.short_name,articulo:x.article_number,titulo:x.title,texto:x.content});
  fs.writeFileSync('scratchpad/t115b/paso9v3_input.json',JSON.stringify(d,null,1));
  console.log('adjuntos finales:', d.articulos_referenciados.map(a=>a.articulo).join(','));
  await c.end();
})();
