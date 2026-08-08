require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  // to_char en SQL: un DATE devuelto a JS se pinta un día antes con toISOString (memoria
  // reference-pg-date-a-js-corre-un-dia). Se formatea en la BD y viaja como texto.
  const r = await c.query(`
    WITH dias AS (SELECT generate_series(current_date - 13, current_date, '1 day')::date d)
    SELECT to_char(d,'DD/MM') dia,
      (SELECT count(*)::int FROM backlog_tasks t WHERE t.created_at::date = d) creadas,
      (SELECT count(*)::int FROM backlog_tasks t WHERE t.closed_at::date = d) cerradas
    FROM dias ORDER BY d`);
  let tc = 0, tk = 0, tcSinHoy = 0, tkSinHoy = 0;
  r.rows.forEach((x, i) => {
    tc += x.creadas; tk += x.cerradas;
    if (i < r.rows.length - 1) { tcSinHoy += x.creadas; tkSinHoy += x.cerradas; }
    console.log(`  ${x.dia}  creadas ${String(x.creadas).padStart(3)}   cerradas ${String(x.cerradas).padStart(3)}   pila ${String(x.creadas - x.cerradas).padStart(4)}`);
  });
  console.log(`\n  14 días CON hoy:  creadas ${tc} · cerradas ${tk} · la pila ${tc - tk >= 0 ? 'CRECE' : 'baja'} ${Math.abs(tc - tk)}`);
  console.log(`  13 días SIN hoy:  creadas ${tcSinHoy} · cerradas ${tkSinHoy} · media/día: +${(tcSinHoy/13).toFixed(1)} creadas / ${(tkSinHoy/13).toFixed(1)} cerradas → la pila crece ${((tcSinHoy-tkSinHoy)/13).toFixed(1)}/día`);

  const ab = (await c.query(`SELECT count(*)::int n FROM backlog_tasks WHERE status <> 'done'`)).rows[0].n;
  console.log(`\n  abiertas ahora: ${ab}`);

  console.log('\n=== las 95 de hoy: ¿quién y cómo? ===');
  const q = await c.query(`SELECT coalesce(last_claimed_by,'(sin claim)') quien, count(*)::int n
    FROM backlog_tasks WHERE closed_at::date = current_date GROUP BY 1 ORDER BY 2 DESC LIMIT 8`);
  q.rows.forEach(x => console.log(`  ${String(x.n).padStart(3)}  ${x.quien}`));

  const arch = await c.query(`SELECT count(*) FILTER (WHERE archived_at IS NOT NULL)::int archivadas,
      count(*) FILTER (WHERE outcome IS NULL OR length(outcome) < 30)::int sin_outcome_real,
      count(*)::int total
    FROM backlog_tasks WHERE closed_at::date = current_date`);
  console.log('\n  de las de hoy: ' + JSON.stringify(arch.rows[0]));
  await c.end();
})();
