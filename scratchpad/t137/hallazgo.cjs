const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const { rows } = await c.query(`
    SELECT kind, category, severity, computed_at, message, detail
      FROM content_health_findings
     WHERE computed_at > '2026-08-01T07:00:00Z' AND kind LIKE 'scope_over_inclusion%'`)
  for (const r of rows) {
    console.log('kind      :', r.kind, '·', r.severity, '·', r.category)
    console.log('computed  :', r.computed_at.toISOString())
    console.log('mensaje   :', r.message)
    const d = r.detail || {}
    console.log('count     :', d.count, '· oposiciones:', d.oposiciones)
    console.log('muestra   :', (d.sample||[]).slice(0,5).map(x=>`${x.pt} T${x.tn} ${x.ley} [${x.band}]`).join('\n            '))
  }
  const { rows: s } = await c.query(`SELECT count(*) n FROM content_health_findings
     WHERE computed_at > '2026-08-01T07:00:00Z' AND kind='scope_over_inclusion_suspect'`)
  console.log('\nscope_over_inclusion_suspect en esta pasada:', s[0].n, '(esperado 0: no hay HIGH sin adjudicar)')
  await c.end() })().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
