#!/usr/bin/env node
// scripts/seguimiento/sim-headless-aporta.cjs
//
// SIMULACIÓN: ¿qué aporta de verdad el headless frente a `curl`, fuente por fuente?
// **No escribe NADA** — ni BD, ni findings, ni badge.
//
// ## Por qué existe (T-125, 26/07/2026)
//
// `docs/runbooks/salud-radar.md` lo lleva avisando desde el 16/07: *"marcar `headless` no es un
// arreglo: hay que COMPROBAR que la Lambda devuelve contenido, no que responde"*, y llevaba la
// cuenta en **cero de tres** veces que aportó algo. Aun así hay **67 fuentes** marcadas `headless`
// y nadie había medido si en esas la Lambda entrega más texto útil que un `curl` pelado.
//
// El riesgo es el falso negativo silencioso de siempre, una capa más abajo: una fuente marcada
// `headless` que devuelve un armazón (o una pantalla de "navegador no soportado") **se cuenta como
// cubierta** en el panel y no vigila nada. Una fuente que el fetcher no sabe leer no es una fuente:
// es un hueco con nombre.
//
// ## Qué mide
//
// Para cada fuente: texto ÚTIL (el mismo `extraerTextoRelevante` que hashea el cron) por `curl` vs
// por la Lambda, y si el cuerpo cae en alguno de los patrones de "esto no es la página"
// (`clasificarVigilancia`). Veredicto por fuente:
//   · `aporta`        — la Lambda entrega bastante más texto que el fetch plano: el marcado es útil
//   · `no_aporta`     — entrega lo mismo o menos: el `headless` no está comprando nada
//   · `ambos_ciegos`  — ninguna de las dos vías sirve contenido: la fuente es un hueco con nombre
//   · `rechaza_bot`   — la página responde pero dice explícitamente que no soporta el navegador
//
// Uso:
//   node scripts/seguimiento/sim-headless-aporta.cjs            # todas las marcadas headless
//   node scripts/seguimiento/sim-headless-aporta.cjs --limite 10
//   node scripts/seguimiento/sim-headless-aporta.cjs --json

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const path = require('path')
const { execFile } = require('child_process')
const {
  clasificarVigilancia,
  veredictoHeadless,
  extraerTextoRelevante,
  CABECERAS_CRON,
} = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'seguimientoVigilable.cjs'))

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const LIMITE = (() => {
  const i = argv.indexOf('--limite')
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : null
})()
const CONCURRENCIA = 4 // la Lambda tarda 1-45 s; con 4 en paralelo el barrido de 67 baja a minutos

function invocarLambda(url) {
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({ url, timeout_ms: 30000 })).toString('base64')
    const out = `/tmp/hl-${process.pid}-${Math.abs(hash(url))}.json`
    execFile(
      'aws',
      ['--profile', 'vence', '--region', 'eu-west-2', 'lambda', 'invoke',
       '--function-name', 'vence-backend-headless-fetcher', '--payload', payload, out],
      { timeout: 90000 },
      (err) => {
        if (err) return resolve({ status: 0, html: '', error: String(err.message).slice(0, 80) })
        try {
          resolve(JSON.parse(require('fs').readFileSync(out, 'utf8')))
        } catch (e) {
          resolve({ status: 0, html: '', error: e.message.slice(0, 80) })
        } finally {
          try { require('fs').unlinkSync(out) } catch { /* noop */ }
        }
      },
    )
  })
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

async function fetchPlano(url) {
  const c = new AbortController()
  const to = setTimeout(() => c.abort(), 30000)
  try {
    const r = await fetch(url, { headers: CABECERAS_CRON, signal: c.signal, redirect: 'follow' })
    return { status: r.status, html: await r.text() }
  } catch (e) {
    return { status: 0, html: '', error: e.message }
  } finally {
    clearTimeout(to)
  }
}

async function evaluar(f) {
  const [plano, lam] = await Promise.all([fetchPlano(f.seguimiento_url), invocarLambda(f.seguimiento_url)])
  const tp = extraerTextoRelevante(plano.html)
  const tl = extraerTextoRelevante(lam.html || '')
  const dp = clasificarVigilancia({ httpStatus: plano.status, error: plano.error, texto: tp })
  const dl = clasificarVigilancia({ httpStatus: lam.status, error: lam.error, texto: tl })

  // Veredicto por el núcleo COMPARTIDO con `ajustar-fetcher-type.cjs`: si cada uno tuviera su
  // criterio, la sonda podría decir "no aporta" y la herramienta revertir por otra regla.
  const { veredicto } = veredictoHeadless({
    statusCurl: plano.status, textoCurl: tp, errorCurl: plano.error,
    statusHeadless: lam.status, textoHeadless: tl, errorHeadless: lam.error,
  })

  return {
    slug: f.slug, url: f.seguimiento_url, activa: !!f.is_active,
    curl: { status: plano.status, chars: tp.length, nivel: dp.nivel },
    headless: { status: lam.status, chars: tl.length, nivel: dl.nivel },
    veredicto,
    muestra: tl.slice(0, 90).replace(/\s+/g, ' '),
  }
}

async function enLotes(items, n, fn) {
  const out = []
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(fn))))
    if (!JSON_OUT) process.stderr.write(`  … ${Math.min(i + n, items.length)}/${items.length}\r`)
  }
  return out
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, {
    prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {},
  })
  let filas = await sql`
    SELECT slug, seguimiento_url, is_active FROM oposiciones
    WHERE fetcher_type = 'headless' AND seguimiento_url IS NOT NULL
    ORDER BY is_active DESC, slug`
  await sql.end()
  if (LIMITE) filas = filas.slice(0, LIMITE)

  if (!JSON_OUT) console.log(`\nSIMULACIÓN — ¿qué aporta el headless? (${filas.length} fuentes marcadas)\n${'='.repeat(78)}`)
  const res = await enLotes(filas, CONCURRENCIA, evaluar)

  if (JSON_OUT) return console.log(JSON.stringify(res, null, 2))

  const por = (v) => res.filter((r) => r.veredicto === v)
  console.log('\n')
  console.log(`  ✅ aporta        : ${por('aporta').length}`)
  console.log(`  ➖ no_aporta     : ${por('no_aporta').length}   (el marcado headless no compra nada)`)
  console.log(`  🤖 rechaza_bot   : ${por('rechaza_bot').length}   (la web dice que no soporta el navegador)`)
  console.log(`  ❌ ambos_ciegos  : ${por('ambos_ciegos').length}   (hueco con nombre: ni curl ni headless sirven)`)

  for (const v of ['ambos_ciegos', 'rechaza_bot', 'no_aporta', 'aporta']) {
    const l = por(v)
    if (!l.length) continue
    console.log(`\n── ${v} (${l.length})`)
    for (const r of l.sort((a, b) => Number(b.activa) - Number(a.activa))) {
      console.log(
        `  ${r.activa ? '[ACTIVA]  ' : '[catálogo]'} ${r.slug}\n` +
          `     curl ${r.curl.status}/${r.curl.chars}ch (${r.curl.nivel})  ·  headless ${r.headless.status}/${r.headless.chars}ch (${r.headless.nivel})\n` +
          `     ${r.url.slice(0, 96)}`,
      )
    }
  }
  console.log(`\n${'='.repeat(78)}\nNada escrito — esto es una simulación.\n`)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
