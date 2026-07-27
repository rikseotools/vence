#!/usr/bin/env node
// scripts/oep/pilot-hash-gate.cjs
//
// PILOTO del embudo de `detect-oep-llm` (T-166). **No escribe nada.**
//
//   node scripts/oep/pilot-hash-gate.cjs --n 80 [--espera 120]
//
// ## Qué mide y por qué
//
// El embudo propuesto se salta la llamada al LLM cuando el texto que le llegaría
// al modelo es idéntico al de la vez anterior. Eso solo ahorra si el hash es
// ESTABLE: si una página cambia de hash sola, cada día pagará su llamada igual.
//
// T-047 ya retiró un sensor por hash sobre estas mismas páginas con un 4% de
// acierto. Así que aquí no se supone nada: se descarga **la misma URL dos veces**
// y se mira si el hash se mueve sin que nadie haya tocado la página. Todo lo que
// se mueva en dos minutos es ruido puro, y marca el suelo del ahorro.
//
// Compara además los dos hashes para cuantificar el desalineo del actual:
//   · legacy (100.000 chars) — lo que hashea hoy computeContentHash()
//   · llmInput (20.000 chars) — lo que el modelo ve de verdad
// Un cambio más allá del carácter 20.000 mueve el legacy pero NO puede alterar la
// respuesta del modelo: es una llamada que el gate correcto se ahorra y el actual no.
require('dotenv').config({ path: '.env.local' })

const path = require('path')
const postgres = require('postgres')
const {
  llmInputHash,
  legacyContentHash,
  cleanHtml,
  LLM_MAX_CHARS,
  contieneFecha,
} = require(path.join(__dirname, '..', '..', 'lib', 'oep', 'llmInputHash.cjs'))

const argv = process.argv.slice(2)
const val = (f, d) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const N = parseInt(val('--n', '80'), 10)
const ESPERA_S = parseInt(val('--espera', '120'), 10)
// Guarda/compara la línea base de hashes para medir el ruido DIARIO sin esperar
// a que alguien esté delante mañana: --baseline escribe, --comparar lee.
const BASELINE = val('--baseline', null)
const COMPARAR = val('--comparar', null)



// Mismas cabeceras que usa el cron: si descargamos distinto, medimos otra cosa.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
}

async function bajar(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  try {
    const r = await fetch(url, { headers: HEADERS, signal: ctrl.signal, redirect: 'follow' })
    if (!r.ok) return { error: `HTTP ${r.status}` }
    return { html: await r.text() }
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : String(e.message || e).slice(0, 60) }
  } finally {
    clearTimeout(t)
  }
}

const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : '0.0')

async function main() {
  const dbUrl =
    process.env.DATABASE_URL ||
    require('fs').readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
  const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 20 })

  // Muestra estratificada: activas + catalogadas, que es la mezcla que ve el cron.
  const filas = await sql`
    SELECT slug, seguimiento_url AS url, is_active
    FROM oposiciones
    WHERE seguimiento_url IS NOT NULL
    ORDER BY is_active DESC, md5(slug)
    LIMIT ${N}
  `
  await sql.end({ timeout: 5 })

  console.log(`\n=== PILOTO embudo detect-oep-llm — ${filas.length} páginas, 2 descargas separadas ${ESPERA_S}s ===`)
  console.log('(no escribe nada; mide si el hash se mueve solo)\n')

  console.log('→ pasada 1…')
  const p1 = new Map()
  for (const f of filas) {
    const r = await bajar(f.url)
    p1.set(f.slug, r.html ? { html: r.html } : { error: r.error })
  }
  const okP1 = [...p1.values()].filter((x) => x.html).length
  console.log(`   ${okP1}/${filas.length} descargadas`)

  // ── Ruido DIARIO, medido hoy ────────────────────────────────────────────
  // El doble fetch de abajo solo ve el ruido de segundos. El que de verdad
  // arruina el ahorro es el diario, y no hace falta esperar a mañana: basta
  // ver qué páginas imprimen la fecha de hoy DENTRO de la ventana del modelo.
  let conFechaHoy = 0
  const conFecha = []
  for (const f of filas) {
    const a = p1.get(f.slug)
    if (!a || !a.html) continue
    if (contieneFecha(cleanHtml(a.html, LLM_MAX_CHARS))) {
      conFechaHoy++
      conFecha.push(f.slug)
    }
  }
  console.log(`   con la FECHA DE HOY en la ventana del modelo: ${conFechaHoy}/${okP1} (${pct(conFechaHoy, okP1)}%) → cambiarán mañana seguro`)

  // Línea base para cerrar la medición mañana en un solo comando.
  if (BASELINE) {
    const base = {}
    for (const f of filas) {
      const a = p1.get(f.slug)
      if (a && a.html) base[f.slug] = llmInputHash(a.html)
    }
    require('fs').writeFileSync(BASELINE, JSON.stringify({ fecha: new Date().toISOString(), hashes: base }, null, 1))
    console.log(`   línea base guardada en ${BASELINE} (${Object.keys(base).length} hashes)`)
  }

  // Cierre de la medición: comparar contra una línea base de otro día.
  if (COMPARAR) {
    const prev = JSON.parse(require('fs').readFileSync(COMPARAR, 'utf8'))
    let comunes = 0
    let cambiaron = 0
    for (const f of filas) {
      const a = p1.get(f.slug)
      if (!a || !a.html || !prev.hashes[f.slug]) continue
      comunes++
      if (llmInputHash(a.html) !== prev.hashes[f.slug]) cambiaron++
    }
    console.log(`\n── RUIDO DIARIO REAL vs ${prev.fecha} ──`)
    console.log(`   cambiaron: ${cambiaron}/${comunes} (${pct(cambiaron, comunes)}%) → esas pagarían llamada`)
    console.log(`   estables : ${comunes - cambiaron} (${pct(comunes - cambiaron, comunes)}%) → ahorro REAL del gate`)
  }

  console.log(`→ esperando ${ESPERA_S}s (nadie edita una convocatoria en ese rato)…`)
  await new Promise((r) => setTimeout(r, ESPERA_S * 1000))

  console.log('→ pasada 2…')
  let comparables = 0
  let mueveLegacy = 0
  let mueveLlm = 0
  let truncadas = 0
  const inestables = []

  for (const f of filas) {
    const a = p1.get(f.slug)
    if (!a || !a.html) continue
    const r = await bajar(f.url)
    if (!r.html) continue
    comparables++

    const legacyIgual = legacyContentHash(a.html) === legacyContentHash(r.html)
    const llmIgual = llmInputHash(a.html) === llmInputHash(r.html)
    if (!legacyIgual) mueveLegacy++
    if (!llmIgual) mueveLlm++
    if (!llmIgual) inestables.push(f.slug)
    // ¿La página excede la ventana del modelo? Si sí, todo lo de más allá de
    // 20k puede mover el hash legacy sin tocar lo que el modelo ve.
    if (cleanHtml(a.html, 10 ** 9).length > LLM_MAX_CHARS) truncadas++
  }

  console.log(`\n────────────── RESULTADO (${comparables} páginas comparables) ──────────────`)
  console.log(`Hash LEGACY (100k, el de hoy) se mueve solo en:   ${mueveLegacy} (${pct(mueveLegacy, comparables)}%)`)
  console.log(`Hash LLM-INPUT (20k, el propuesto) se mueve en:   ${mueveLlm} (${pct(mueveLlm, comparables)}%)`)
  console.log(`Páginas que EXCEDEN la ventana de 20k del modelo: ${truncadas} (${pct(truncadas, comparables)}%)`)
  console.log(`\nEstables con el gate propuesto (ahorro alcanzable): ${comparables - mueveLlm} (${pct(comparables - mueveLlm, comparables)}%)`)
  if (inestables.length) {
    console.log(`\nRuidosas (cambian solas en ${ESPERA_S}s) — el gate NUNCA las ahorrará:`)
    console.log('  ' + inestables.slice(0, 25).join(', ') + (inestables.length > 25 ? ` … +${inestables.length - 25}` : ''))
    console.log('  → diagnosticar con: node scripts/diag-seguimiento-ruido.cjs <url>')
  }
  console.log('\nLectura: el % estable es el TECHO del ahorro por hash. Lo que se mueva solo')
  console.log('seguirá pagando llamada cada día — y es el fallo que hundió al sensor de T-047.')
}

main().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e)
  process.exit(1)
})
