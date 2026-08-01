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
//        [--aceptar-dudoso]   escape explícito para la banda `contenido_dudoso` (NUNCA para la ciega)
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
  decidirEscritura,
  veredictoHeadless,
  decidirFetcherType,
  extraerTextoRelevante,
  CABECERAS_CRON,
} = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'seguimientoVigilable.cjs'))
const { invocarHeadless } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'headlessFetch.cjs'))

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const SOLO_VERIFICAR = argv.includes('--verificar')
// Escape EXPLÍCITO y TRAZADO para la banda `contenido_dudoso` (200 con poco texto: puede ser una
// página real corta o un contenedor vacío). Hace falta porque para algunas entidades el mejor
// destino posible cae ahí: el índice de empleo de la Diputación de Zamora sirve ~1.900 chars y no
// existe página por proceso para su convocatoria. Sustituir el dominio raíz —que es CIEGO— por ese
// índice es una mejora real, y negarse por purismo dejaría la fuente ciega para siempre.
//
// Lo que este flag NO abre: la banda `error` (shell de SPA, WAF, "página en desuso", `sin_anclas`).
// Esas siguen siendo rechazo duro — si se pudieran forzar, el guardarraíl no serviría de nada.
const ACEPTAR_DUDOSO = argv.includes('--aceptar-dudoso')
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

async function traza(sql, { slug, urlVieja, urlNueva, diag, aplicado, forzadoDudoso, promocion }) {
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
                // true = se escribió pese a caer en la banda dudosa (--aceptar-dudoso). Auditable.
                forzado_dudoso: !!forzadoDudoso,
                vigilable: diag.vigilable,
                nivel: diag.nivel,
                motivo: diag.motivo,
                anclas_encontradas: diag.anclasEncontradas || [],
                // Promoción a headless (T-453): sin esto, el evento diría que se escribió una URL
                // «no vigilable» y no que se cambió el fetcher — la mitad de la historia.
                promovido_a: promocion ? promocion.destino : null,
                texto_headless_chars: promocion ? promocion.chars : null,
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
    SELECT id, slug, nombre, is_active, seguimiento_url, fetcher_type FROM oposiciones WHERE slug = ${slug}`
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
  // Única excepción, y hay que pedirla a mano: la banda `contenido_dudoso` con --aceptar-dudoso.
  const decision = decidirEscritura(r.diag, { aceptarDudoso: ACEPTAR_DUDOSO })
  const aceptado = decision.escribir
  if (decision.forzado) {
    console.log('⚠️  ACEPTADA POR --aceptar-dudoso: contenido escaso pero no es un shell ciego.')
    console.log('   Queda registrado en observable_events. Revísala si el cron no detecta cambios.\n')
  }
  // ── SEGUNDA OPORTUNIDAD: medir con NAVEGADOR antes de rendirse (T-453) ──────────────────
  // El fetch de arriba es HTTP plano, que es lo que hace el cron con `fetcher_type='http'`. Si la
  // fuente es una SPA, ahí se ve un cascarón y esta herramienta la rechazaba... aunque fuese la URL
  // BUENA. El sistema sabía degradar a `http` pero no promover a `headless`, así que esas fuentes
  // quedaban invigilables para siempre: 13 oposiciones ACTIVAS en ese estado el 01/08.
  //
  // La guarda importante es la que NO cambia: si el navegador tampoco ve nada (`ambos_ciegos`), se
  // rechaza igual. El problema entonces es la URL, y marcar `headless` solo lo enmascararía.
  let promocion = null
  if (!aceptado) {
    process.stdout.write('  … el fetch plano no la ve; probando con NAVEGADOR (headless)…\n')
    const h = await invocarHeadless(urlNueva)
    const textoH = extraerTextoRelevante(h.html || '')
    const vh = veredictoHeadless({
      statusCurl: r.diag.httpStatus, textoCurl: r.texto || '', errorCurl: r.diag.error,
      statusHeadless: h.status, textoHeadless: textoH, errorHeadless: h.error,
    })
    const df = decidirFetcherType(vh.veredicto, op.fetcher_type || 'http')
    console.log(`  headless : ${h.status}/${textoH.length}ch → ${vh.veredicto} (${vh.motivo})`)
    if (df.cambiar && df.destino === 'headless') {
      promocion = { destino: 'headless', motivo: df.motivo, chars: textoH.length }
      console.log(`  veredicto: ✅ VIGILABLE con navegador → hay que promover a \`headless\``)
    } else {
      console.log(`  veredicto: ❌ tampoco con navegador — ${df.motivo}`)
    }
  }

  if (!aceptado && !promocion) {
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
    if (promocion) {
      // La URL y el fetcher se escriben JUNTOS y en la MISMA transacción: escribir una URL que solo
      // el navegador ve dejando el fetcher en `http` es exactamente la fuente ciega que este
      // subsistema existe para evitar.
      // `headless_required` va en el MISMO UPDATE: la tabla lo exige con un CHECK
      // (`chk_fetcher_headless_consistency`) y tiene razón — un `fetcher_type='headless'` con
      // `headless_required=false` es una fuente que dice que necesita navegador y declara que no.
      await tx`
        UPDATE oposiciones
           SET fetcher_type = ${promocion.destino}, headless_required = true
         WHERE id = ${op.id}`
    }
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
    forzadoDudoso: decision.forzado, promocion,
  })
  await sql.end()

  console.log('✅ APLICADO: seguimiento_url actualizada y hash reseteado (oposiciones).')
  if (promocion) {
    console.log(`   + fetcher_type → ${promocion.destino} (${promocion.chars} chars de texto con navegador).`)
    console.log('   Lo respetan detect-oep-llm, detect-notas-convocatoria y detect-generic-sources.')
  }
  console.log('   La siguiente pasada del cron tomará línea base en silencio, sin `changed` falso.\n')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
