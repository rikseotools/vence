const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q = async (l,s)=>{const{rows}=await c.query(s);console.log(`\n### ${l}`);console.table(rows)}
  await q('TODO el backlog por estado', `
    SELECT status, count(*) FROM backlog_tasks GROUP BY 1 ORDER BY 2 DESC`)
  await q('las VIVAS, por situación real', `
    SELECT CASE
      WHEN claimed_by IS NOT NULL AND lease_until > now() THEN '1. cogida por otra sesion (lease vivo)'
      WHEN snooze_until > now() OR wake_on_deploy_sha IS NOT NULL THEN '2. en espera (reloj o deploy)'
      ELSE '3. LIBRE ahora mismo' END AS situacion,
      count(*)
    FROM backlog_tasks WHERE status IN ('open','in_progress','blocked')
    GROUP BY 1 ORDER BY 1`)
  await q('LIBRES por prioridad', `
    SELECT priority, count(*) FROM backlog_tasks
     WHERE status IN ('open','in_progress','blocked')
       AND NOT (claimed_by IS NOT NULL AND lease_until > now())
       AND snooze_until IS NULL AND wake_on_deploy_sha IS NULL
     GROUP BY 1 ORDER BY CASE priority WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 WHEN 'baja' THEN 4 ELSE 5 END`)
  await q('LIBRES por esfuerzo declarado', `
    SELECT COALESCE(effort,'(sin declarar)') AS esfuerzo, count(*) FROM backlog_tasks
     WHERE status IN ('open','in_progress','blocked')
       AND NOT (claimed_by IS NOT NULL AND lease_until > now())
       AND snooze_until IS NULL AND wake_on_deploy_sha IS NULL
     GROUP BY 1 ORDER BY 2 DESC`)
  await c.end()
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
