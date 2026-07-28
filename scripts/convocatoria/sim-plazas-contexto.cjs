#!/usr/bin/env node
'use strict'
/**
 * SIMULADOR de la regla «con contexto» para `plazas_afirmadas_sin_documento` — [T-202].
 *
 * ## El problema que mide
 *
 * El detector vivo pregunta *«¿aparece la cifra en el texto?»* (`cifraEnTexto`). Para cifras
 * grandes eso vale; para las pequeñas **no prueba nada**, porque un número corto sale por azar en
 * cualquier boletín (fechas, artículos, apartados). Medido el 27/07 sobre 60 corpus reales con
 * cifras ARBITRARIAS: 1 dígito → 100 % «probadas», 2 dígitos → 83,5 %, 3 → 30,1 %, 4 → 9,2 %.
 * O sea: el badge en verde no dice «las cifras están respaldadas», dice «no puedo ver las pequeñas».
 *
 * ## Por qué NO trae una regla nueva
 *
 * La regla con contexto **ya existe y está calibrada**: `lib/convocatoria/landingClaims.cjs` (T-142)
 * contrasta las afirmaciones de una landing contra el documento oficial exigiendo que la cifra
 * aparezca *presentada como ese concepto* («2.704 plazas»), no suelta por el documento. Trae además
 * las cicatrices que este problema produce y que aquí habría que volver a aprender:
 *   · normaliza los numerales en LETRA con `lib/laws/spanishNumber.js` (los boletines escriben
 *     «dos mil setecientas cuatro plazas»), y
 *   · descarta el respaldo por suma de números sueltos de la ventana — «63 + 90 = 153» llegó a
 *     respaldar una cifra inventada, y un falso respaldo es peor que un aviso de más.
 * Escribir aquí una tercera regla del mismo hecho habría sido justo el silo que no queremos: dos
 * detectores discrepando sobre si una cifra está probada.
 *
 * ## Qué hace y qué NO hace
 *
 * Corre las DOS reglas sobre las MISMAS filas que ve el detector vivo (misma query) y las compara,
 * fila a fila y con el fragmento real del documento para poder juzgar. **No escribe nada, no toca
 * el badge y no enciende ninguna regla**: la ficha pide primero saber qué proporción de los
 * hallazgos nuevos es real (documento no clonado) y cuál es formato que el regex no casa.
 *
 *   node scripts/convocatoria/sim-plazas-contexto.cjs [--json salida.json] [--slug <slug>] [--muestra N]
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const { cifraEnTexto, enLetra } = require('../../lib/convocatoria/cifraEnTexto.cjs')
const {
  CONCEPTOS,
  numerosDelConcepto,
  normalizarNumerosDelTexto,
  derivarRespaldo,
} = require('../../lib/convocatoria/landingClaims.cjs')

const RE_PLAZAS = CONCEPTOS.find((c) => c.tipo === 'plazas').re

// El corpus de una convocatoria puede pesar varios MB (boletines enteros). Normalizar los
// numerales en letra sobre todo el documento es O(n) pero con un regex de hasta 6 palabras, así
// que se acota a las VENTANAS donde se habla de plazas: es donde la regla mira, y de paso hace
// viable correr las 118 en una pasada. La ventana es generosa a propósito — «Se convocan dos mil
// setecientas cuatro plazas» necesita sitio a la izquierda.
const VENTANA = 400

function ventanasDePlazas(corpus) {
  const t = String(corpus || '')
  if (!t) return ''
  const re = /plazas?|vacantes?/gi
  const trozos = []
  let m
  while ((m = re.exec(t)) !== null) {
    trozos.push(t.slice(Math.max(0, m.index - VENTANA), m.index + VENTANA))
    if (trozos.length >= 400) break // tope defensivo: 400 menciones bastan para decidir
  }
  return trozos.join(' … ')
}

/** Fragmentos donde la cifra aparece, para poder juzgar si es azar o una mención real. */
function fragmentosDe(corpus, valor) {
  const t = String(corpus || '').replace(/\s+/g, ' ')
  const formas = [String(valor), String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.')]
  const out = []
  for (const f of formas) {
    let desde = 0
    for (;;) {
      const i = t.indexOf(f, desde)
      if (i === -1) break
      // Solo si es un número suelto, no parte de otro más largo ni de un código.
      const antes = t[i - 1] || ' '
      const despues = t[i + f.length] || ' '
      if (!/[\d.]/.test(antes) && !/\d/.test(despues)) {
        out.push(t.slice(Math.max(0, i - 60), i + f.length + 60).trim())
      }
      desde = i + f.length
      if (out.length >= 4) return out
    }
  }
  return out
}

function digitos(n) {
  return String(Math.abs(n)).length
}

/**
 * La regla viva, pero exigiendo que la cifra sea un NÚMERO ENTERO del texto y no una subcadena de
 * otro número. `cifraEnTexto` compara con `includes`, así que hoy «216» se da por probada dentro
 * del código `C1.1000197163216`, y «278» dentro de «2781853». Se simula aquí antes de tocar el
 * núcleo compartido: es un cambio a la regla VIVA, no a una regla candidata.
 */
function cifraConFrontera(n, texto) {
  if (n == null) return true
  if (!Number.isInteger(n) || n < 0) return false
  if (!texto) return false
  const t = ' ' + String(texto).replace(/\s+/g, ' ') + ' '
  // El numeral en LETRA se busca igual que hoy (los boletines escriben «treinta y seis plazas»):
  // quitarlo aquí habría inventado hallazgos donde el documento es perfectamente explícito. Lo
  // detectó la propia simulación — `administrativa-universidad-de-murcia` salía «sin frontera»
  // mientras su documento la presentaba como plazas.
  const letra = n <= 9999 ? enLetra(n) : null
  if (letra && t.toLowerCase().includes(letra.toLowerCase())) return true
  const formas = [String(n), String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')]
  // Frontera: ni dígito ni punto/coma decimal pegados a los lados (el punto de millar del propio
  // número ya va dentro de `formas`).
  return formas.some((f) => new RegExp(`(?<![\\d.,])${f.replace(/\./g, '\\.')}(?![\\d.,]?\\d)`).test(t))
}

async function main() {
  const args = process.argv.slice(2)
  const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null
  const soloSlug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null
  const muestra = args.includes('--muestra') ? parseInt(args[args.indexOf('--muestra') + 1], 10) : null

  const env = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8')
  const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim()
    .replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[a-z-]+/, '')
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 })
  await db.connect()

  // MISMA query que el detector vivo (`scripts/health-sweep.cjs`, kind plazas_afirmadas_sin_documento),
  // sin su `.filter(esPlazaHuerfana)`: aquí interesan TODAS, también las que hoy pasan.
  const { rows } = await db.query(`
    SELECT o.slug, cv.plazas_libres, cv.boe_reference, cv."año",
           (SELECT count(*)::int FROM convocatoria_documentos d WHERE d.convocatoria_id = cv.id) docs,
           (SELECT string_agg(d.extracted_text, ' ') FROM convocatoria_documentos d
             WHERE d.convocatoria_id = cv.id) corpus,
           (SELECT (v.state = 'verified_correct' AND v.findings ? 'cifra_derivada')
              FROM convocatoria_verification v WHERE v.convocatoria_id = cv.id) derivada_declarada
      FROM convocatorias cv JOIN oposiciones o ON o.id = cv.oposicion_id
     WHERE cv.is_current AND o.is_active
       AND cv.plazas_libres IS NOT NULL
       AND NOT cv.plazas_prevision
     ORDER BY cv.plazas_libres DESC NULLS LAST`)
  await db.end()

  let filas = soloSlug ? rows.filter((r) => r.slug === soloSlug) : rows
  if (muestra) filas = filas.slice(0, muestra)

  const resultados = filas.map((r) => {
    const valor = r.plazas_libres
    const hoy = cifraEnTexto(valor, r.corpus)          // regla VIVA: ¿aparece la cifra?
    const conFrontera = cifraConFrontera(valor, r.corpus) // ¿y como número entero, no dentro de otro?
    const ventanas = ventanasDePlazas(r.corpus)
    const norm = normalizarNumerosDelTexto(ventanas)   // «dos mil setecientas» → 2704
    const presentadas = numerosDelConcepto(norm, RE_PLAZAS)  // cifras que el doc LLAMA plazas
    const conContexto = presentadas.includes(valor)
    const derivacion = conContexto
      ? null
      : derivarRespaldo({ valor, tipo: 'plazas' }, RE_PLAZAS, norm)

    let veredicto
    if (!r.docs || !r.corpus) veredicto = 'sin_documento'
    else if (conContexto) veredicto = 'respaldada'
    else if (derivacion) veredicto = 'derivable'
    else veredicto = 'SIN_RESPALDO'

    return {
      slug: r.slug,
      valor,
      digitos: digitos(valor),
      docs: r.docs,
      corpus_chars: (r.corpus || '').length,
      regla_viva: hoy,
      regla_frontera: conFrontera,
      veredicto,
      derivacion: derivacion ? `${derivacion.como}: ${derivacion.detalle}` : null,
      presentadas_como_plazas: presentadas.slice(0, 12),
      fragmentos: fragmentosDe(r.corpus, valor),
      derivada_declarada: r.derivada_declarada === true,
    }
  })

  // ── Informe ────────────────────────────────────────────────────────────────────────────────
  const n = resultados.length
  const cuenta = (p) => resultados.filter(p).length
  console.log(`\n=== Simulación regla CON CONTEXTO vs regla viva — ${n} convocatorias vivas con plazas_libres ===\n`)
  console.log(`Regla VIVA (¿aparece la cifra?):     ${cuenta((x) => x.regla_viva)} probadas · ${cuenta((x) => !x.regla_viva)} hallazgo(s)`)
  console.log(`Regla CON CONTEXTO (¿la llama plazas?):`)
  for (const v of ['respaldada', 'derivable', 'SIN_RESPALDO', 'sin_documento']) {
    console.log(`   ${v.padEnd(14)} ${cuenta((x) => x.veredicto === v)}`)
  }

  // ── La regla viva + FRONTERA de número (el defecto barato, independiente del contexto) ──────
  const fronteraPierde = resultados.filter((x) => x.regla_viva && !x.regla_frontera)
  console.log(`\n🎯 Hoy «probadas» SOLO porque la cifra casa DENTRO de otro número: ${fronteraPierde.length}`)
  for (const x of fronteraPierde) {
    console.log(`   · ${x.slug} = ${x.valor} (${x.digitos} díg) — el doc presenta como plazas: ${x.presentadas_como_plazas.slice(0, 6).join(', ') || '(ninguna)'}`)
  }

  const nuevos = resultados.filter((x) => x.regla_viva && x.veredicto === 'SIN_RESPALDO')
  console.log(`\n⚠️  Hallazgos NUEVOS que traería encenderla: ${nuevos.length}`)
  console.log('   (hoy en verde porque la cifra aparece suelta; el documento NO la llama plazas)\n')
  const porDig = {}
  for (const x of nuevos) porDig[x.digitos] = (porDig[x.digitos] || 0) + 1
  console.log('   por nº de dígitos: ' + Object.keys(porDig).sort().map((d) => `${d}→${porDig[d]}`).join(' · '))

  const sinDocs = nuevos.filter((x) => !x.docs).length
  console.log(`   sin ningún documento clonado: ${sinDocs} · con documento: ${nuevos.length - sinDocs}`)

  console.log('\n── Los 20 primeros, para triar ──')
  for (const x of nuevos.slice(0, 20)) {
    console.log(`\n · ${x.slug} — plazas_libres=${x.valor} (${x.digitos} díg, ${x.docs} doc, ${x.corpus_chars} ch)`)
    console.log(`   el doc presenta como plazas: ${x.presentadas_como_plazas.length ? x.presentadas_como_plazas.join(', ') : '(ninguna)'}`)
    for (const f of x.fragmentos.slice(0, 2)) console.log(`   «…${f}…»`)
  }

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(resultados, null, 1))
    console.log(`\n📄 detalle completo → ${jsonOut}`)
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
