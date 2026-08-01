// Espera a que el @Cron nocturno escriba una pasada NUEVA (posterior a la última conocida) y
// vuelca lo que dice de los dos kinds de sobre-inclusión. No escribe nada.
const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const BASE = '2026-07-31T14:29:30Z'
const dormir = (ms) => new Promise(r => setTimeout(r, ms))
;(async () => {
  for (let i = 0; i < 60; i++) {           // hasta ~30 min
    const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
    const { rows: [u] } = await c.query(
      `SELECT max(computed_at) AS ultima FROM content_health_findings WHERE computed_at > $1`, [BASE])
    if (u && u.ultima) {
      console.log('✅ pasada NUEVA:', u.ultima.toISOString())
      const { rows: k } = await c.query(`
        SELECT kind, severity, left(message,150) AS mensaje, detail->>'count' AS n
          FROM content_health_findings
         WHERE computed_at > $1 AND kind LIKE 'scope_over_inclusion%'`, [BASE])
      console.log('kinds de sobre-inclusión emitidos:', k.length)
      for (const r of k) console.log(`  · ${r.kind} [${r.severity}] n=${r.n}\n    ${r.mensaje}`)
      const { rows: tot } = await c.query(
        `SELECT count(*) n, count(DISTINCT kind) kinds FROM content_health_findings WHERE computed_at > $1`, [BASE])
      console.log('total de la pasada:', tot[0].n, 'hallazgos ·', tot[0].kinds, 'kinds')
      await c.end(); process.exit(0)
    }
    await c.end()
    await dormir(30000)
  }
  console.log('⌛ 30 min sin pasada nueva: el barrido NO ha corrido')
  process.exit(1)
})().catch(e => { console.error('ERROR', e.message); process.exit(2) })
