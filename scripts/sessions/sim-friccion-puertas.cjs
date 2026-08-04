#!/usr/bin/env node
/**
 * sim-friccion-puertas.cjs — el roce LLEGA al bus, de extremo a extremo. (T-542)
 *
 *   npm run sim:friccion-puertas
 *
 * ## Por qué esta capa, además de los tests
 *
 * Los unitarios prueban que la puerta LLAMA al emisor, y el guardarraíl impide que la próxima
 * nazca muda. Ninguno de los dos vería el fallo que de verdad se parece al original: que la
 * llamada se haga y **el evento no aparezca**. Entre `emitirFriccion` y la fila de
 * `observable_events` hay un `spawn` detached, un argv, un catálogo cerrado que puede descartar
 * en silencio y un INSERT — cuatro sitios donde romperse sin que nadie se entere. Y esta ficha
 * entera nace de algo que se rompió exactamente así.
 *
 * Es una simulación contra la BD REAL, como `sim-huerfanos` o `sim-cola-reserva`: emite con una
 * marca propia, comprueba que la fila está con la forma correcta, y **se limpia sola**.
 */
const path = require('path')
const REPO = path.resolve(__dirname, '..', '..')

const { emitirFriccion } = require(path.join(REPO, 'lib/sessions/friccion.cjs'))
const { EVENT_TYPE, severidad } = require(path.join(REPO, 'lib/observability/friccionSesiones.cjs'))
const { pgConfig } = require(path.join(REPO, 'lib/db/pgSsl.cjs'))
const { Client } = require('pg')

/** Marca única de esta corrida: permite encontrar la fila y borrarla sin tocar nada real. */
const MARCA = `SIM-T542-${process.pid}-${process.hrtime.bigint()}`
const ESPERA_MAX_MS = 15000

const ok = (m) => console.log(`  ✅ ${m}`)
const mal = (m) => { console.log(`  ❌ ${m}`); process.exitCode = 1 }

async function esperarFila(c, marca) {
  const hasta = Date.now() + ESPERA_MAX_MS
  while (Date.now() < hasta) {
    // GOTCHA que esta simulación descubrió al escribirse: `--detalle` NO va a `metadata`, va a la
    // columna `error_message`. Buscarlo en el jsonb da cero filas y se lee como «el bus está roto».
    const r = await c.query(
      `SELECT severity, error_message, metadata FROM observable_events
        WHERE event_type = $1 AND error_message LIKE $2 LIMIT 1`,
      [EVENT_TYPE, `%${marca}%`],
    )
    if (r.rowCount) return r.rows[0]
    await new Promise((r2) => setTimeout(r2, 400))
  }
  return null
}

;(async () => {
  console.log('\n🔬 SIMULACIÓN — el roce de una puerta llega al bus de fricción\n')
  require('dotenv').config({ path: path.join(REPO, '.env.local') })

  if (!process.env.DATABASE_URL) {
    console.log('  ⏭️  sin DATABASE_URL: la simulación necesita la BD real. No es un fallo.')
    return
  }

  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  try {
    // ── 1. La ruta feliz: un escape de la puerta de temario ────────────────────────────────
    const lanzado = emitirFriccion({ clase: 'guard_escape', guard: 'temario', detalle: `${MARCA} escape de prueba` })
    lanzado ? ok('emitirFriccion lanza el emisor') : mal('emitirFriccion no llegó a lanzar')

    const fila = await esperarFila(c, MARCA)
    if (!fila) {
      mal(`el evento NO aparece en observable_events tras ${ESPERA_MAX_MS / 1000}s — el bus está roto`)
      return
    }
    ok('el evento aparece en observable_events')

    // ── 2. Con la forma que la serie sabe agregar ──────────────────────────────────────────
    fila.metadata.clase === 'guard_escape' ? ok('clase = guard_escape') : mal(`clase inesperada: ${fila.metadata.clase}`)
    fila.metadata.guard === 'temario'
      ? ok("guard = 'temario' (antes NINGÚN roce de esta puerta llegaba aquí)")
      : mal(`guard inesperado: ${fila.metadata.guard}`)
    fila.metadata.sid ? ok(`lleva el sid de la sesión (${fila.metadata.sid})`) : mal('sin sid: no se sabe quién rodeó la puerta')
    String(fila.error_message || '').includes('escape de prueba')
      ? ok('el MOTIVO declarado se conserva (en error_message, no en metadata)')
      : mal('se ha perdido el motivo del escape, que es lo único que explica el rodeo')
    fila.severity === severidad('guard_escape')
      ? ok(`severidad la fija el núcleo (${fila.severity}), no el emisor`)
      : mal(`severidad ${fila.severity}, esperada ${severidad('guard_escape')}`)

    // ── 3. Y una clase inventada NO ensucia la serie ───────────────────────────────────────
    const MARCA2 = `${MARCA}-inventada`
    const lanzado2 = emitirFriccion({ clase: 'guard_que_no_existe', guard: 'temario', detalle: MARCA2 })
    if (lanzado2) mal('una clase fuera del catálogo llegó a lanzar el emisor')
    else ok('una clase fuera del catálogo se descarta antes de gastar un proceso')

    // ── 4. Y el roce es VISIBLE por la misma agrupación que lee `npm run sesiones:friccion` ──
    // Ojo con leer de más: aquí «temario» aparece por la fila de ESTA simulación, que se borra al
    // salir. Lo que se comprueba es la fontanería —que un roce de esta puerta llega a la vista que
    // se consulta para decidir—, NO que haya tráfico real. Eso solo lo dirán los escapes de verdad.
    const agg = await c.query(
      `SELECT metadata->>'guard' g, count(*) n FROM observable_events
        WHERE event_type = $1 AND created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC`,
      [EVENT_TYPE],
    )
    const guards = agg.rows.map((r) => r.g)
    console.log(`\n  guardarraíles visibles en la agrupación (30d): ${guards.filter(Boolean).join(', ')}`)
    guards.includes('temario')
      ? ok('un roce de «temario» es visible en esa agrupación (antes NINGUNO podía serlo)')
      : mal('«temario» no aparece ni con su propia fila recién insertada')
  } finally {
    // Limpieza: la simulación no deja rastro en una serie que se lee para decidir.
    const del = await c.query(
      `DELETE FROM observable_events WHERE event_type = $1 AND error_message LIKE $2`,
      [EVENT_TYPE, `%${MARCA}%`],
    )
    console.log(`\n  🧹 limpieza: ${del.rowCount} fila(s) de prueba borradas`)
    await c.end()
    console.log(process.exitCode ? '\n❌ SIMULACIÓN EN ROJO\n' : '\n✅ SIMULACIÓN EN VERDE\n')
  }
})().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
