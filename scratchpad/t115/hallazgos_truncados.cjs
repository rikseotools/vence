const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`SELECT event_type, count(*) n, min(created_at)::date desde, max(created_at)::date hasta
    FROM observable_events WHERE event_type = 'articulos_truncados_audit' GROUP BY 1`);
  console.log('eventos del detector de truncados:'); console.table(r.rows);
  if (r.rows.length) {
    const d = await c.query(`SELECT created_at::date f, metadata FROM observable_events
      WHERE event_type='articulos_truncados_audit' ORDER BY created_at DESC LIMIT 5`);
    for (const x of d.rows) console.log(x.f.toISOString().slice(0,10), JSON.stringify(x.metadata).slice(0,220));
  }
  await c.end();
})();
