require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const cols = (await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='backlog_tasks' ORDER BY ordinal_position`)).rows.map(r => r.column_name);
  console.log('cols:', cols.join(', '));

  const hoy = await c.query(`
    SELECT
      count(*) FILTER (WHERE closed_at::date = current_date)::int cerradas_hoy,
      count(*) FILTER (WHERE created_at::date = current_date)::int creadas_hoy,
      count(*) FILTER (WHERE status <> 'done')::int abiertas_ahora,
      count(*) FILTER (WHERE status = 'done')::int cerradas_total
    FROM backlog_tasks`);
  console.log('\nHOY:', JSON.stringify(hoy.rows[0]));

  console.log('\n=== ritmo por día (14 días) ===');
  const r = await c.query(`
    WITH dias AS (SELECT generate_series(current_date - 13, current_date, '1 day')::date d)
    SELECT d,
      (SELECT count(*)::int FROM backlog_tasks t WHERE t.created_at::date = d) creadas,
      (SELECT count(*)::int FROM backlog_tasks t WHERE t.closed_at::date = d) cerradas
    FROM dias ORDER BY d`);
  let tc = 0, tk = 0;
  r.rows.forEach(x => { tc += x.creadas; tk += x.cerradas; console.log(`  ${x.d.toISOString().slice(5,10)}  creadas ${String(x.creadas).padStart(3)}   cerradas ${String(x.cerradas).padStart(3)}   neto ${String(x.cerradas - x.creadas).padStart(4)}`); });
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  14 días: creadas ${tc} · cerradas ${tk} · neto ${tk - tc}`);
  console.log(`  media/día: creadas ${(tc/14).toFixed(1)} · cerradas ${(tk/14).toFixed(1)} · neto ${((tk-tc)/14).toFixed(1)}`);

  console.log('\n=== abiertas por prioridad ===');
  const p = await c.query(`SELECT coalesce(priority,'?') p, count(*)::int n FROM backlog_tasks WHERE status <> 'done' GROUP BY 1 ORDER BY 2 DESC`);
  p.rows.forEach(x => console.log(`  ${x.p.padEnd(8)} ${x.n}`));

  console.log('\n=== abiertas por effort declarado ===');
  const e = await c.query(`SELECT coalesce(effort,'sin declarar') e, count(*)::int n FROM backlog_tasks WHERE status <> 'done' GROUP BY 1 ORDER BY 2 DESC`);
  e.rows.forEach(x => console.log(`  ${x.e.padEnd(14)} ${x.n}`));
  await c.end();
})();
