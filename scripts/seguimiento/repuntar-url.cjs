#!/usr/bin/env node
// scripts/seguimiento/repuntar-url.cjs
//
// Única vía legítima para cambiar una `seguimiento_url`. **Dry-run por defecto.**
//
// Por qué existe (T-114 → T-125, 26/07/2026): repuntar a mano tiene tres trampas que ya se
// pisaron todas en una sola sesión, y ninguna avisa —fallan en silencio y dejan la fuente ciega
// meses:
//
//   1. **La URL "buena" puede no ser vigilable.** El cron hashea el HTML servido SIN ejecutar JS:
//      una SPA responde 200 con un shell inmutable → hash congelado, panel verde, cero vigilancia.
//      Aquí se comprueba ANTES de escribir, con las cabeceras exactas del cron, y si no pasa se
//      REHÚSA el cambio.
//   2. **Puede ser la página equivocada.** Con `--anclas` se exige que el contenido mencione el
//      proceso (denominación, nº de plazas, referencia de boletín). El primer candidato del PAG
//      para IIPP resultó ser la convocatoria de 2023.
//   3. **El hash hay que resetearlo, y en la tabla correcta.** `seguimiento_last_hash` existe en
//      `oposiciones` Y en `convocatorias`, y el cron solo usa la de `oposiciones`. Resetear la
//      otra no hace nada y la siguiente pasada da un `changed` falso.
//
// Uso:
//   node scripts/seguimiento/repuntar-url.cjs <slug> <url-nueva> [--anclas "a|b|c"] [--apply]
//   node scripts/seguimiento/repuntar-url.cjs --verificar <url> [--anclas "…"]   # solo comprueba
//
// Ejemplos:
//   node scripts/seguimiento/repuntar-url.cjs administrativo-madrid \
//     https://www.comunidad.madrid/empleo/administrativos-c1-2026 \
//     --anclas "Administrativos|107 plazas" --apply
//
// Deja traza en `observable_events` (event_type `seguimiento_url_repuntada`), tanto el éxito como
// el rechazo, para poder auditar después quién cambió qué y por qué.

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const path = require('path')
const {
  verificarUrlCandidata,
  extraerTextoRelevante,
  CABECERAS_CRON,
} = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'seguimientoVigilable.cjs'))

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const SOLO_VERIFICAR = argv.includes('--verificar')
const idxAnclas = argv.indexOf('--anclas')
const ANCLAS =
  idxAnclas >= 0 && argv[idxAnclas + 1]
    ? argv[idxAnclas + 1].split('|').map((s) => s.trim()).filter(Boolean)
    : []
const posicionales = argv.filter((a, i) => {
  if (a.startsWith('--')) return false
  if (idxAnclas >= 0 && i === idxAnclas + 1) return false
  return true
})

function uso(msg) {
  console.error(`\n❌ ${msg}\n`)
  console.error('Uso:  node scripts/seguimiento/repuntar-url.cjs <slug> <url-nueva> [--anclas "a|b"] [--apply]')
  console.error('      node scripts/seguimiento/repuntar-url.cjs --verificar <url> [--anclas "a|b"]\n')
  process.exit(2)
}

function conectar() {
  if (!process.env.DATABASE_URL) uso('DATABASE_URL no configurado (RDS)')
  return postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 2,
    ssl: { rejectUnauthorized: false },
    onnotice: () => {},
  })
}

/** Descarga la URL tal y como lo haría el cron y devuelve el diagnóstico de vigilabilidad. */
async function comprobar(url, anclas) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 30000)
  let httpStatus = 0
  let html = ''
  let error = null
  try {
    const res = await fetch(url, { headers: CABECERAS_CRON, signal: ctrl.signal, redirect: 'follow' })
    httpStatus = res.status
    html = await res.text()
  } catch (e) {
    error = e.message
  } finally {
    clearTimeout(to)
  }
  const texto = extraerTextoRelevante(html)
  return {
    httpStatus,
    error,
    texto,
    htmlLen: html.length,
    diag: verificarUrlCandidata({ httpStatus, error, texto, anclas }),
  }
}

function pinta(url, r) {
  const { diag } = r
  console.log(`\n  URL      : ${url}`)
  console.log(`  HTTP     : ${r.httpStatus}${r.error ? ` (${r.error})` : ''}`)
  console.log(`  contenido: ${r.texto.length} chars de texto sobre ${r.htmlLen} de HTML`)
  if (diag.anclasEncontradas && diag.anclasEncontradas.length) {
    console.log(`  anclas   : ✅ ${diag.anclasEncontradas.join(' · ')}`)
  } else if (ANCLAS.length) {
    console.log(`  anclas   : ❌ ninguna de [${ANCLAS.join(' · ')}]`)
  }
  console.log(`  veredicto: ${diag.vigilable ? '✅ VIGILABLE' : `❌ NO vigilable (${diag.nivel})`}`)
  console.log(`  motivo   : ${diag.motivo}\n`)
}

async function traza(sql, { slug, urlVieja, urlNueva, diag, aplicado }) {
  try {
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:repuntar-url',
              ${aplicado ? 'info' : 'warn'}, 'seguimiento_url_repuntada',
              ${sql.json({
                slug,
                url_vieja: urlVieja,
                url_nueva: urlNueva,
                aplicado,
                vigilable: diag.vigilable,
                nivel: diag.nivel,
                motivo: diag.motivo,
                anclas_encontradas: diag.anclasEncontradas || [],
              })}, NOW())`
  } catch (e) {
    // La traza NUNCA debe tumbar el repunte: si falla, se avisa y se sigue.
    console.error(`⚠️  no se pudo registrar el evento de observabilidad: ${e.message}`)
  }
}

async function main() {
  if (SOLO_VERIFICAR) {
    const url = posicionales[0]
    if (!url) uso('falta la URL a verificar')
    const r = await comprobar(url, ANCLAS)
    pinta(url, r)
    process.exit(r.diag.vigilable ? 0 : 1)
  }

  const [slug, urlNueva] = posicionales
  if (!slug || !urlNueva) uso('faltan argumentos: <slug> <url-nueva>')
  if (!/^https?:\/\//i.test(urlNueva)) uso('la URL debe empezar por http:// o https://')

  const sql = conectar()
  const [op] = await sql`
    SELECT id, slug, nombre, is_active, seguimiento_url FROM oposiciones WHERE slug = ${slug}`
  if (!op) {
    await sql.end()
    uso(`no existe la oposición '${slug}'`)
  }

  console.log(`\n${'='.repeat(78)}`)
  console.log(`REPUNTE de seguimiento_url — ${op.slug}${op.is_active ? ' [ACTIVA]' : ' [catálogo]'}`)
  console.log('='.repeat(78))
  console.log(`  actual: ${op.seguimiento_url || '(ninguna)'}`)

  const r = await comprobar(urlNueva, ANCLAS)
  pinta(urlNueva, r)

  // ── GUARDARRAÍL: no se escribe una URL que el cron no pueda vigilar ──────────────────────
  if (!r.diag.vigilable) {
    await traza(sql, {
      slug: op.slug, urlVieja: op.seguimiento_url, urlNueva, diag: r.diag, aplicado: false,
    })
    await sql.end()
    console.error('❌ RECHAZADO: no se escribe una URL que el cron no puede vigilar.')
    console.error('   Busca una alternativa servida en HTML (página propia del proceso, ficha del')
    console.error('   PAG `detalleEmpleo.htm?idConvocatoria=N`, o índice del cuerpo en INAP).')
    console.error('   Si no existe ninguna, déjala como está y anótala en T-125 (headless-fetcher).\n')
    process.exit(1)
  }

  if (!APPLY) {
    await sql.end()
    console.log('🔍 DRY-RUN: no se ha escrito nada. Añade --apply para aplicarlo.\n')
    return
  }

  await sql.begin(async (tx) => {
    await tx`UPDATE oposiciones SET seguimiento_url = ${urlNueva} WHERE id = ${op.id}`
    // Reset del hash EN `oposiciones` — la tabla que usa el cron. Sin esto, la siguiente pasada
    // compara el hash de la página ANTIGUA con la nueva y da un `changed` falso garantizado.
    await tx`
      UPDATE oposiciones
         SET seguimiento_last_hash = NULL, seguimiento_last_checked = NULL,
             seguimiento_change_status = 'ok', seguimiento_change_detected_at = NULL
       WHERE id = ${op.id}`
  })
  await traza(sql, {
    slug: op.slug, urlVieja: op.seguimiento_url, urlNueva, diag: r.diag, aplicado: true,
  })
  await sql.end()

  console.log('✅ APLICADO: seguimiento_url actualizada y hash reseteado (oposiciones).')
  console.log('   La siguiente pasada del cron tomará línea base en silencio, sin `changed` falso.\n')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
