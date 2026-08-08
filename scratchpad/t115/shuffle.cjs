const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`SELECT shuffle_safety, count(*) FROM questions WHERE 'gen_lopdgdd_t115_2026-07-31'=ANY(tags) GROUP BY 1`);
  console.log('shuffle_safety:', r.rows);
  const d = await c.query(`SELECT count(*) FILTER (WHERE explanation_data IS NOT NULL) con_estructura, count(*) total FROM questions WHERE 'gen_lopdgdd_t115_2026-07-31'=ANY(tags)`);
  console.log('explanation_data:', d.rows[0]);
  await c.end();
})();
