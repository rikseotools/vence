const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`SELECT id, slug, short_name, name, boe_url, scope FROM laws WHERE slug='lo-3-2018' OR short_name ILIKE '%3/2018%'`);
  console.log(r.rows);
  await c.end();
})();
