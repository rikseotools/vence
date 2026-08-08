const fs=require('fs'); const {Client}=require('pg');
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r=await c.query(`SELECT a.article_number, a.title, a.content FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name='RD 203/2021' AND a.article_number='41'`);
  const d=JSON.parse(fs.readFileSync('scratchpad/t331/paso9_input.json','utf8'));
  if(!d.articulos_referenciados.some(a=>a.articulo==='41'))
    d.articulos_referenciados.push({ley:'RD 203/2021',articulo:'41',titulo:r.rows[0].title,texto:r.rows[0].content});
  fs.writeFileSync('scratchpad/t331/paso9_input.json',JSON.stringify(d,null,1));
  console.log('adjuntos:',d.articulos_referenciados.map(a=>a.articulo).join(','));
  await c.end();
})();
