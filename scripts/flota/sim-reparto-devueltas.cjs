#!/usr/bin/env node
/**
 * sim-reparto-devueltas.cjs — ¿puede el reparto de la flota ALCANZAR una entrega devuelta con
 * `problemas`? [T-700, 08/08/2026]
 *
 * ## Por qué esto es una simulación y no un test unitario
 *
 * El defecto que motiva esta herramienta **era invisible para cualquier unit**: el criterio puro
 * (`devueltaConProblemas`) estaba bien y tenía sus tests en verde; lo que fallaba era que las tres
 * consultas SQL del repartidor, cada una correcta por su lado, dejaban un hueco ENTRE ellas. Un
 * test que construye la fila a mano nunca lo ve, porque la fila que el código real produce es
 * justo la que no encajaba (misma lección que `sim:espera-revision`, T-486).
 *
 * Así que esto pregunta lo único que importa, contra los datos de verdad:
 *   para cada tarea que el criterio llama «devolución pendiente», ¿la ve el reparto?
 *
 * ## Y comprueba que la pregunta NO es trivial
 *
 * Una simulación que pasa porque no ejercita nada es peor que no tenerla (pasó con la primera
 * versión de `sim:espera-revision`, que daba verde con el claim ya suelto). Por eso mide TAMBIÉN
 * lo que alcanzaba el reparto ANTES del arreglo: si ese número no es menor, esta simulación no
 * está demostrando nada y lo dice.
 *
 * Solo lectura. No manda encargos ni escribe nada.
 *
 * Uso:  npm run sim:reparto-devueltas
 */
const path = require('path')
const REPO = path.resolve(__dirname, '..', '..')
require(path.join(REPO, 'node_modules', 'dotenv')).config({ path: path.join(REPO, '.env.local') })
const { Client } = require(path.join(REPO, 'node_modules', 'pg'))
const { pgConfig } = require(path.join(REPO, 'lib', 'db', 'pgSsl.cjs'))
const ENC = require(path.join(REPO, 'lib', 'flota', 'encargo.cjs'))
const REV = require(path.join(REPO, 'lib', 'backlog', 'revision.cjs'))

const COLUMNAS = `id, title, status, claimed_by, closed_at,
                  review_requested_at, reviewed_at, reviewed_by, review_verdict, review_findings`

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()

  // (1) LA VERDAD: qué considera una devolución el criterio compartido, sobre TODO el backlog.
  const todas = (await c.query(
    `SELECT ${COLUMNAS} FROM public.backlog_tasks WHERE closed_at IS NULL`)).rows
  const devoluciones = todas.filter((t) => REV.devueltaConProblemas(t))
  const pendientes = devoluciones.filter((t) => ENC.esCorreccionPendiente(t))

  // (2) LO QUE EL REPARTO ALCANZA HOY — la MISMA consulta que `flota.cjs repartir`.
  const alcanzaAhora = (await c.query(
    `SELECT ${COLUMNAS} FROM public.backlog_tasks
      WHERE review_verdict = 'problemas' AND claimed_by IS NULL AND closed_at IS NULL
      ORDER BY reviewed_at`)).rows.filter((t) => ENC.esCorreccionPendiente(t))

  // (3) LO QUE ALCANZABA ANTES — las tres ramas de antes del arreglo, tal cual estaban.
  const antesCandidatas = (await c.query(
    `SELECT id FROM public.backlog_tasks
      WHERE status = 'open' AND claimed_by IS NULL
        AND (snooze_until IS NULL OR snooze_until <= now())
        AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL`)).rows
  const antesPorRevisar = (await c.query(
    `SELECT id FROM public.backlog_tasks
      WHERE review_requested_at IS NOT NULL AND reviewed_at IS NULL`)).rows
  const antesRetomadas = (await c.query(
    `SELECT id FROM public.backlog_tasks
      WHERE status = 'in_progress' AND claimed_by IS NOT NULL`)).rows
  const antes = new Set([...antesCandidatas, ...antesPorRevisar, ...antesRetomadas].map((r) => r.id))

  await c.end()

  const alcanzables = new Set(alcanzaAhora.map((t) => t.id))
  const invisibles = pendientes.filter((t) => !alcanzables.has(t.id))
  const invisiblesAntes = pendientes.filter((t) => !antes.has(t.id))

  console.log('')
  console.log('🔁 ¿Llega el reparto a las entregas devueltas con problemas?')
  console.log('')
  console.log(`   devoluciones vivas ................. ${devoluciones.length}`)
  console.log(`   de ellas, sin dueño (repartibles) .. ${pendientes.length}`)
  console.log(`   que el reparto alcanza HOY ......... ${pendientes.length - invisibles.length}`)
  console.log(`   que alcanzaba ANTES del arreglo .... ${pendientes.length - invisiblesAntes.length}`)
  console.log('')

  if (pendientes.length) {
    const horas = (t) => ((Date.now() - new Date(t.reviewed_at).getTime()) / 3600000)
    const vieja = pendientes.slice().sort((a, b) => horas(b) - horas(a))[0]
    console.log(`   la más antigua: ${vieja.id} — ${horas(vieja).toFixed(1)} h desde el veredicto`)
    console.log('')
  }

  let salida = 0

  if (invisibles.length) {
    console.log('❌ HAY DEVOLUCIONES QUE NO SE LE PUEDEN DAR A NADIE:')
    for (const t of invisibles) console.log(`   · ${t.id} (${t.status}) — ${String(t.title).slice(0, 60)}`)
    console.log('')
    console.log('   Es el defecto de [T-700] otra vez: el criterio y la consulta del reparto han')
    console.log('   divergido. Mira `scripts/flota/flota.cjs` → la rama `devuelta` de `repartir`.')
    salida = 1
  } else {
    console.log('✅ todas las devoluciones repartibles están al alcance del reparto.')
  }

  // ── ¿ESTÁ ESTA SIMULACIÓN EJERCITANDO ALGO? ────────────────────────────────────────────────
  if (!pendientes.length) {
    console.log('')
    console.log('⚠️  NO CONCLUYENTE: ahora mismo no hay ninguna devolución pendiente, así que este')
    console.log('    verde no demuestra nada. Vuelve a correrlo cuando la flota devuelva alguna.')
  } else if (invisiblesAntes.length === 0) {
    console.log('')
    console.log('⚠️  NO CONCLUYENTE: el reparto ANTERIOR ya las alcanzaba todas, o sea que esta')
    console.log('    pasada no distingue el arreglo de su ausencia. Revisa la reconstrucción (3).')
  } else {
    console.log('')
    console.log(`   (concluyente: ${invisiblesAntes.length} de estas ${pendientes.length} eran inalcanzables antes del arreglo)`)
  }
  console.log('')
  process.exit(salida)
})().catch((e) => { console.error('❌', e.message); process.exit(2) })
