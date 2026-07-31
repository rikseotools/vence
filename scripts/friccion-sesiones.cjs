#!/usr/bin/env node
/**
 * friccion-sesiones.cjs — ¿cuánto cuesta trabajar en paralelo, y qué guardarraíl está muriendo?
 * (T-423)
 *
 * Uso:  npm run sesiones:friccion [-- --dias 7] [--json]
 *
 * Lo que se busca aquí NO es el número de bloqueos: eso solo dice que los guardarraíles trabajan.
 * Lo que se busca es **cuántos de esos bloqueos acabaron rodeados con el escape**, porque ese
 * ratio es un indicador ADELANTADO: se ve subir antes de que el guardarraíl deje de servir.
 *
 * El 31/07 murieron tres guardarraíles exactamente así —el aviso que gritaba en falso hasta que
 * se ignoró, el bloqueo imposible de satisfacer, y el escape que se volvió rutina— y los tres se
 * descubrieron por casualidad. Este informe es para no depender de la casualidad.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')
const JSON_OUT = process.argv.includes('--json')
const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }
const DIAS = Number(arg('--dias') || 7)

const { EVENT_TYPE, CLASES, ratioEscape, diagnostico, esperaDeploy } =
  require(path.join(REPO, 'lib', 'observability', 'friccionSesiones.cjs'))

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
}

async function main() {
  const s = require('postgres')(url(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 15 })
  let filas
  try {
    filas = await s`
      SELECT metadata, created_at FROM public.observable_events
       WHERE event_type = ${EVENT_TYPE}
         AND created_at > now() - (${DIAS} || ' days')::interval
       ORDER BY created_at DESC`
  } finally { try { await s.end({ timeout: 5 }) } catch {} }

  const eventos = filas.map((f) => ({ ...(f.metadata || {}), created_at: f.created_at }))
  const guards = ratioEscape(eventos)
  const espera = esperaDeploy(eventos)
  const porClase = {}
  for (const e of eventos) porClase[e.clase] = (porClase[e.clase] || 0) + 1
  const sesiones = new Set(eventos.map((e) => e.sid).filter(Boolean)).size

  if (JSON_OUT) { console.log(JSON.stringify({ dias: DIAS, eventos: eventos.length, guards, espera, porClase }, null, 1)); return }

  console.log(`\nFRICCIÓN ENTRE SESIONES — últimos ${DIAS} día(s)\n${'='.repeat(52)}`)
  if (!eventos.length) {
    // Un cero recién estrenado NO es una buena noticia todavía: hay que poder distinguir
    // «no hay fricción» de «los emisores aún no han corrido».
    console.log('\nSin eventos registrados. Ojo: si la instrumentación es reciente, esto significa')
    console.log('«todavía no ha corrido», no «no hay fricción». Vuelve a mirarlo en unos días.\n')
    return
  }
  console.log(`\n${eventos.length} roce(s) en ${sesiones} sesión(es) distintas:\n`)
  for (const [c, n] of Object.entries(porClase).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(4)}  ${c.padEnd(20)} ${CLASES[c] || ''}`)
  }

  if (guards.length) {
    console.log(`\nGUARDARRAÍLES — ¿cuántas veces se rodean?  (es lo que dice si están vivos)\n`)
    for (const g of guards) console.log('   ' + diagnostico(g))
    const muertos = guards.filter((g) => g.veredicto === 'muerto')
    if (muertos.length) {
      console.log(`\n   ⚠️  ${muertos.length} guardarraíl(es) ya no protegen: se rodean más de lo que paran.`)
      console.log('       Dejarlos así es lo peor de los dos mundos — dan la lata Y no cubren el hueco.')
    }
  }

  if (espera.veces) {
    console.log(`\nDEPLOY: ${espera.veces} espera(s) al lock, ${espera.minutos} min de sesión perdidos.`)
  }
  console.log('')
}

main().catch((e) => { console.error('❌', String(e.message || e).slice(0, 200)); process.exit(1) })
