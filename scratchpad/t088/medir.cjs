const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q = async (l, s) => { const { rows } = await c.query(s); console.log(`\n### ${l}`); console.table(rows) }
  await q('columnas', `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='scope_over_inclusion_adjudications' ORDER BY ordinal_position`)
  await q('reparto verdict x verificado', `SELECT verdict, verificado, count(*) FROM scope_over_inclusion_adjudications GROUP BY 1,2 ORDER BY 1,2`)
  await c.end()
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })
