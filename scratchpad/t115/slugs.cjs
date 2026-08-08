const { Client } = require('pg');
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r=await c.query(`SELECT slug, short_name, name FROM laws WHERE short_name IN ('LECrim','CP','RDL 2/2004','LOTC','Ley 1/2000')`);
  for(const x of r.rows) console.log(x.short_name,'→ slug:',x.slug,'|',String(x.name).slice(0,70));
  await c.end();
})();
