// ¿Cuánto miente hoy el panel sobre la edad de la cola de revisión?
//
// `app/api/admin/system-health/route.ts` trae las entregas con `review_requested_at IS NOT NULL
// AND status <> 'done'` y NO filtra `reviewed_at IS NULL`, así que cuenta como «pendiente» lo que
// ya tiene veredicto. Con el umbral nuevo de [T-689] (ESPERA_AMBAR_H=2) eso pinta ámbar por una
// entrega que hace horas que está revisada.
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { saludFlota } = require('../lib/flota/salud.cjs')
const { trabajadoresEsperados } = require('../lib/flota/maquinas.cjs')

const horas = (t) => (Date.now() - new Date(t).getTime()) / 36e5

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()

  const comun = `FROM backlog_tasks WHERE review_requested_at IS NOT NULL AND status <> 'done'`
  const { rows: hoy } = await c.query(
    `SELECT id, review_requested_at, reviewed_at, review_verdict ${comun}`)
  const reales = hoy.filter((r) => r.reviewed_at === null)

  const max = (xs) => (xs.length ? Math.max(...xs.map((r) => horas(r.review_requested_at))) : 0)
  console.log(`consulta de HOY  : ${hoy.length} filas · esperaMax ${max(hoy).toFixed(1)} h`)
  console.log(`de verdad pendientes: ${reales.length} filas · esperaMax ${max(reales).toFixed(1)} h`)
  const contaminadas = hoy.filter((r) => r.reviewed_at !== null)
  console.log(`contaminadas (ya revisadas): ${contaminadas.length}`)
  for (const r of contaminadas) console.log(`   · ${r.id} verdicto=${r.review_verdict}`)

  // Y lo que de verdad importa: qué pinta el semáforo con cada juego de datos.
  const base = {
    sesiones: (await c.query(`SELECT slug, last_signal_at FROM worktree_sessions WHERE rol = 'trabajador'`)).rows,
    esperados: trabajadoresEsperados().length,
    borradores: 0,
    turnosMuertos: 0,
  }
  const conBasura = saludFlota({ ...base, entregas: hoy })
  const limpio = saludFlota({ ...base, entregas: reales })
  console.log(`\nsemáforo con la consulta de hoy : ${conBasura.estado}`)
  console.log(`semáforo con la cola real       : ${limpio.estado}`)
  console.log(conBasura.estado !== limpio.estado
    ? '❌ el panel MIENTE ahora mismo por las filas ya revisadas'
    : 'ℹ️  hoy coinciden (la contaminación no cambia el color EN ESTE INSTANTE)')
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
