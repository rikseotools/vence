const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`SELECT id, slug, short_name, name, scope FROM laws WHERE short_name='RD 203/2021'`);
  console.log(r.rows);
  await c.end();
})();
