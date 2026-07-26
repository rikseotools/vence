#!/usr/bin/env node
// scripts/seguimiento/ajustar-fetcher-type.cjs
//
// Ajusta `oposiciones.fetcher_type` **con medición previa**. Dry-run por defecto.
//
// ## Por qué existe (T-125, 26/07/2026)
//
// `docs/runbooks/salud-radar.md` avisa desde el 16/07: *"marcar `headless` no es un arreglo: hay
// que COMPROBAR que la Lambda devuelve contenido, no que responde"*. Aun así había **67 fuentes**
// marcadas `headless` puestas a mano, sin medir. Al medirlas (`sim-headless-aporta.cjs`):
//
//   · 12 aportan   · 47 no aportan   · 7 ciegas por ambas vías   · 0 rechazan el bot
//
// O sea, **55 de 67 invocan una Lambda en cada pasada del sensor sin ganar un solo carácter**
// (el sensor LLM corre L-V y el de notas a diario). Esta herramienta revierte eso, pero **solo
// tras medirlo en el momento**: no se fía de una medición vieja ni de una lista pegada a mano.
//
// ## Guardarraíles
//
//   1. **Mide antes de escribir.** Para cada fuente descarga por HTTP plano (cabeceras del cron) y
//      por la Lambda, y compara TEXTO ÚTIL con `veredictoHeadless` — el mismo núcleo que usa la
//      sonda, no una copia con otro criterio.
//   2. **Solo automatiza el caso inequívoco** (`no_aporta` estando en `headless`). NO toca los
//      `ambos_ciegos` (el problema es la URL, y cambiar el fetcher lo enmascara) ni los
//      `rechaza_bot` (exigen criterio humano). Esa política vive en `decidirFetcherType`, testeada.
//   3. **Dry-run por defecto**; hay que pedir `--apply` a mano.
//   4. **Traza** en `observable_events` (`fetcher_type_ajustado`), incluida la medición que lo
//      justificó, para poder auditar después por qué se cambió cada fila.
//
// Uso:
//   node scripts/seguimiento/ajustar-fetcher-type.cjs                  # dry-run, todas
//   node scripts/seguimiento/ajustar-fetcher-type.cjs --limite 5
//   node scripts/seguimiento/ajustar-fetcher-type.cjs --slug <slug>
//   node scripts/seguimiento/ajustar-fetcher-type.cjs --solo catalogo --apply   # tanda 1
//   node scripts/seguimiento/ajustar-fetcher-type.cjs --solo activas  --apply   # tanda 2
//   node scripts/seguimiento/ajustar-fetcher-type.cjs --apply

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')
const {
  veredictoHeadless,
  decidirFetcherType,
  extraerTextoRelevante,
  CABECERAS_CRON,
} = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'seguimientoVigilable.cjs'))

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const arg = (n) => {
  const i = argv.indexOf(n)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null
}
const LIMITE = arg('--limite') ? Number(arg('--limite')) : null
const SLUG = arg('--slug')
// Permite aplicar por TANDAS: primero el catálogo (sin usuarios detrás), comprobar que ningún
// sensor se resiente, y solo entonces las activas. Escribir 55 filas de golpe sobre una columna
// que gobierna cómo se descarga cada fuente no se hace en un solo movimiento.
const SOLO = arg('--solo') // 'activas' | 'catalogo'
if (SOLO && !['activas', 'catalogo'].includes(SOLO)) {
  console.error("❌ --solo admite 'activas' o 'catalogo'")
  process.exit(2)
}
const CONCURRENCIA = 4

function conectar() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurado (RDS)')
    process.exit(2)
  }
  return postgres(process.env.DATABASE_URL, {
    prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {},
  })
}

async function fetchPlano(url) {
  const c = new AbortController()
  const to = setTimeout(() => c.abort(), 30000)
  try {
    const r = await fetch(url, { headers: CABECERAS_CRON, signal: c.signal, redirect: 'follow' })
    return { status: r.status, texto: extraerTextoRelevante(await r.text()) }
  } catch (e) {
    return { status: 0, texto: '', error: e.message }
  } finally {
    clearTimeout(to)
  }
}

function fetchHeadless(url) {
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({ url, timeout_ms: 30000 })).toString('base64')
    const out = `/tmp/ft-${process.pid}-${Math.random().toString(36).slice(2)}.json`
    execFile(
      'aws',
      ['--profile', 'vence', '--region', 'eu-west-2', 'lambda', 'invoke',
       '--function-name', 'vence-backend-headless-fetcher', '--payload', payload, out],
      { timeout: 90000 },
      (err) => {
        if (err) return resolve({ status: 0, texto: '', error: String(err.message).slice(0, 80) })
        try {
          const p = JSON.parse(fs.readFileSync(out, 'utf8'))
          resolve({ status: p.status, texto: extraerTextoRelevante(p.html || ''), error: p.error })
        } catch (e) {
          resolve({ status: 0, texto: '', error: e.message.slice(0, 80) })
        } finally {
          try { fs.unlinkSync(out) } catch { /* noop */ }
        }
      },
    )
  })
}

async function medir(f) {
  const [plano, hl] = await Promise.all([fetchPlano(f.seguimiento_url), fetchHeadless(f.seguimiento_url)])
  const v = veredictoHeadless({
    statusCurl: plano.status, textoCurl: plano.texto, errorCurl: plano.error,
    statusHeadless: hl.status, textoHeadless: hl.texto, errorHeadless: hl.error,
  })
  return { ...f, plano, hl, ...v, decision: decidirFetcherType(v.veredicto, f.fetcher_type) }
}

async function enLotes(items, n, fn) {
  const out = []
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(fn))))
    process.stderr.write(`  … medidas ${Math.min(i + n, items.length)}/${items.length}\r`)
  }
  return out
}

async function traza(sql, r, aplicado) {
  try {
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:ajustar-fetcher-type', 'info', 'fetcher_type_ajustado',
              ${sql.json({
                slug: r.slug, url: r.seguimiento_url, aplicado,
                de: r.fetcher_type, a: r.decision.destino,
                veredicto: r.veredicto, ganancia_chars: r.ganancia,
                curl_chars: r.plano.texto.length, headless_chars: r.hl.texto.length,
                motivo: r.motivo,
              })}, NOW())`
  } catch (e) {
    console.error(`⚠️  no se pudo registrar la traza de ${r.slug}: ${e.message}`)
  }
}

async function main() {
  const sql = conectar()
  let filas = await sql`
    SELECT slug, seguimiento_url, fetcher_type, is_active FROM oposiciones
    WHERE fetcher_type = 'headless' AND seguimiento_url IS NOT NULL
      ${SLUG ? sql`AND slug = ${SLUG}` : sql``}
      ${SOLO === 'activas' ? sql`AND is_active` : SOLO === 'catalogo' ? sql`AND NOT is_active` : sql``}
    ORDER BY is_active DESC, slug`
  if (LIMITE) filas = filas.slice(0, LIMITE)

  console.log(`\nAJUSTE de fetcher_type — ${filas.length} fuentes marcadas headless`)
  console.log(`${APPLY ? '⚠️  MODO APPLY' : '🔍 DRY-RUN (añade --apply para escribir)'}\n${'='.repeat(78)}`)

  const res = await enLotes(filas, CONCURRENCIA, medir)
  console.log('\n')

  const cambiar = res.filter((r) => r.decision.cambiar)
  const dejar = res.filter((r) => !r.decision.cambiar)

  for (const r of cambiar) {
    console.log(
      `  ${APPLY ? '✅' : '[dry]'} ${r.is_active ? '[ACTIVA]  ' : '[catálogo]'} ${r.slug}\n` +
        `        headless → ${r.decision.destino}   (curl ${r.plano.texto.length}ch vs headless ${r.hl.texto.length}ch)`,
    )
    if (APPLY) {
      await sql`UPDATE oposiciones SET fetcher_type = ${r.decision.destino} WHERE slug = ${r.slug}`
    }
    await traza(sql, r, APPLY)
  }

  console.log(`\n── NO se tocan (${dejar.length}):`)
  const porVeredicto = {}
  for (const r of dejar) (porVeredicto[r.veredicto] ||= []).push(r)
  for (const [v, l] of Object.entries(porVeredicto)) {
    console.log(`   ${v} (${l.length}): ${l.slice(0, 6).map((r) => r.slug).join(', ')}${l.length > 6 ? '…' : ''}`)
    console.log(`      → ${l[0].decision.motivo}`)
  }

  console.log(`\n${'='.repeat(78)}`)
  console.log(
    `${APPLY ? 'APLICADO' : 'DRY-RUN'}: ${cambiar.length} fuentes a http, ${dejar.length} intactas. ` +
      `Ahorro estimado: ${cambiar.length} invocaciones de Lambda por pasada de cada sensor.`,
  )
  if (!APPLY && cambiar.length) console.log('No se ha escrito nada. Añade --apply para aplicarlo.\n')
  await sql.end()
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
