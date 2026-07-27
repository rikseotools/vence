#!/usr/bin/env node
// scripts/convocatoria/repuntar-enlace-convocatoria.cjs
//
// Única vía legítima para cambiar el ENLACE del botón oficial de la landing
// ("Ver convocatoria en {diario_oficial}" → `programa_url`). **Dry-run por defecto.**
//
// Por qué existe (T-134, 26/07/2026): `programa_url` NO tenía escritor propio — se editaba a mano
// desde media docena de scripts de build, sin que nadie comprobase lo único que importa: que la
// URL sea de verdad el documento de esa convocatoria, en el boletín que el botón anuncia. Así
// llegó a producción el caso raíz: `policia-nacional`, con plazo ABIERTO, prometía "Ver
// convocatoria en BOE" y llevaba a `policia.es/portalaspirantes/en/web/…` — ni BOE, ni
// convocatoria, ni español. Nadie lo vio hasta ir a mandarle una newsletter.
//
// Las cuatro trampas que cierra, todas silenciosas:
//   1. **La URL puede no ser del boletín que promete la etiqueta.** Se comprueba con el registro
//      compartido (`canonicalizeBoletinUrl.cjs`: PATTERNS por documento, BOLETIN_HOSTS por
//      dominio). Si no casa, o se cambia la etiqueta a la vez (`--etiqueta`) o se rechaza.
//   2. **Puede ser el documento equivocado** (la convocatoria del año pasado, el temario, la OEP).
//      `--anclas` exige que el texto del documento mencione el proceso (denominación, plazas,
//      referencia). Los PDF se leen con `pdftotext`, así que el BOCM/BORM también se verifican.
//   3. **Escribir en un solo sitio no arregla la landing.** La landing lee `oposiciones_ssot`,
//      donde manda la convocatoria vigente: hay que escribir en las DOS (dual-write) o el cambio
//      no se ve. El guardarraíl final vuelve a leer la SSOT y confirma que el hallazgo se apagó.
//   4. **`programa_url` sirve a DOS contratos.** Es el enlace del botón Y la fuente del temario que
//      hashea el Sistema 2 de literalidad de epígrafe (`programa_last_hash`). Si la URL actual es
//      un temario, repuntarla pierde esa fuente: hay que pedirlo explícitamente
//      (`--acepto-perder-temario`) y queda en la traza. Además se resetea el hash, para que el
//      siguiente chequeo tome línea base en vez de cantar un cambio falso.
//
// Uso:
//   node scripts/convocatoria/repuntar-enlace-convocatoria.cjs <slug> <url-nueva> \
//        [--anclas "a|b|c"] [--etiqueta BOE] [--acepto-perder-temario] [--apply]
//   node scripts/convocatoria/repuntar-enlace-convocatoria.cjs --verificar <url> [--anclas "…"]
//
// Ejemplo real (el caso raíz):
//   node scripts/convocatoria/repuntar-enlace-convocatoria.cjs policia-nacional \
//     https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-15055 \
//     --anclas "Escala Básica|2.704 plazas" --apply
//
// Deja traza en `observable_events` (`convocatoria_enlace_repuntado`), tanto el éxito como el
// rechazo. Hermano de `scripts/seguimiento/repuntar-url.cjs` (mismas convenciones).

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const postgres = require('postgres')
const { boletinDeUrl, canonicalizeBoletinUrl } = require(
  path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'canonicalizeBoletinUrl.cjs'),
)
const { checkConvocatoriaLinks, señalesDeUrl, normalizarEtiquetaBoletin } = require(
  path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'linkCoherence.cjs'),
)

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const SOLO_VERIFICAR = argv.includes('--verificar')
const ACEPTO_PERDER_TEMARIO = argv.includes('--acepto-perder-temario')
const valorDe = (flag) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}
const ANCLAS = (valorDe('--anclas') || '').split('|').map((s) => s.trim()).filter(Boolean)
const ETIQUETA_NUEVA = valorDe('--etiqueta')
const posicionales = argv.filter((a, i) => {
  if (a.startsWith('--')) return false
  const previo = argv[i - 1]
  return previo !== '--anclas' && previo !== '--etiqueta'
})

// Descargar el documento, leerlo (HTML o PDF) y comprobar que habla de ESTE proceso vive en
// el núcleo compartido: lo usan también el clonador al hub de provenance
// (`clonar-documento.cjs`) y quien venga después. Un solo umbral, un solo `pdftotext`, una
// sola definición de "el documento menciona el proceso".
const { verificar, dictaminar } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'documentoFuente.cjs'))

function uso(msg) {
  console.error(`\n❌ ${msg}\n`)
  console.error('Uso:  node scripts/convocatoria/repuntar-enlace-convocatoria.cjs <slug> <url-nueva> \\')
  console.error('        [--anclas "a|b"] [--etiqueta BOE] [--acepto-perder-temario] [--apply]')
  console.error('      node scripts/convocatoria/repuntar-enlace-convocatoria.cjs --verificar <url> [--anclas "a|b"]\n')
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

async function traza(sql, datos) {
  try {
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:repuntar-enlace-convocatoria',
              ${datos.aplicado ? 'info' : 'warn'}, 'convocatoria_enlace_repuntado',
              ${sql.json(datos)}, NOW())`
  } catch (e) {
    console.error(`⚠️  no se pudo registrar el evento de observabilidad: ${e.message}`)
  }
}

async function main() {
  if (SOLO_VERIFICAR) {
    const url = posicionales[0]
    if (!url) uso('falta la URL a verificar')
    const v = await verificar(url, ANCLAS)
    const { boletin, nivel } = boletinDeUrl(url)
    console.log(`\n  URL      : ${url}`)
    console.log(`  boletín  : ${boletin ? `${boletin} (por ${nivel})` : '— no es de ningún boletín conocido'}`)
    console.log(`  HTTP     : ${v.status} · ${v.chars} chars de texto`)
    if (ANCLAS.length) console.log(`  anclas   : ${v.anclasEncontradas.length ? `✅ ${v.anclasEncontradas.join(' · ')}` : '❌ ninguna'}${v.anclasFaltan.length ? ` — faltan: ${v.anclasFaltan.join(' · ')}` : ''}`)
    console.log(`  veredicto: ${v.ok ? '✅ SIRVE' : `❌ ${v.motivo}`}\n`)
    process.exit(v.ok ? 0 : 1)
  }

  const [slug, urlNueva] = posicionales
  if (!slug || !urlNueva) uso('faltan argumentos: <slug> <url-nueva>')
  if (!/^https?:\/\//i.test(urlNueva)) uso('la URL debe empezar por http:// o https://')

  const sql = conectar()
  const [op] = await sql`
    SELECT slug, nombre, is_active, diario_oficial, programa_url, estado_proceso, boe_reference
    FROM oposiciones_ssot WHERE slug = ${slug} LIMIT 1`
  if (!op) {
    await sql.end()
    uso(`no existe la oposición '${slug}'`)
  }

  const etiquetaFinal = ETIQUETA_NUEVA || op.diario_oficial
  console.log(`\n${'='.repeat(78)}`)
  console.log(`REPUNTE del enlace de convocatoria — ${op.slug}${op.is_active ? ' [ACTIVA]' : ' [catálogo]'}`)
  console.log('='.repeat(78))
  console.log(`  botón   : "Ver convocatoria en ${op.diario_oficial || '—'}"${ETIQUETA_NUEVA ? ` → pasará a "${ETIQUETA_NUEVA}"` : ''}`)
  console.log(`  estado  : ${op.estado_proceso || '—'}`)
  console.log(`  actual  : ${op.programa_url || '(ninguna)'}`)

  // ── 1. ¿La URL nueva es del boletín que promete la etiqueta? ────────────────────────────
  const { boletin, nivel } = boletinDeUrl(urlNueva)
  const etiquetaNorm = normalizarEtiquetaBoletin(etiquetaFinal)
  console.log(`  nueva   : ${urlNueva}`)
  console.log(`  boletín : ${boletin ? `${boletin} (reconocido por ${nivel})` : '— no es de ningún boletín conocido'}`)

  const problemas = []
  if (etiquetaNorm && boletin && boletin !== etiquetaNorm) {
    problemas.push(
      `la etiqueta dice "${etiquetaNorm}" y el enlace es del ${boletin} — usa --etiqueta ${boletin} si manda el documento`,
    )
  }
  if (etiquetaNorm && !boletin) {
    const s = señalesDeUrl(urlNueva)
    if (s.portadaOSeccion) problemas.push('el enlace no es un documento (portada/sección de portal)')
    if (s.idiomaExtranjero) problemas.push('el enlace apunta a la versión en otro idioma')
    if (s.pareceTemario) problemas.push('el enlace parece un TEMARIO, no la convocatoria')
  }

  // ── 2. ¿El documento existe, se lee y habla de ESTE proceso? ────────────────────────────
  //
  // Se intenta por fetch plano. Si la fuente contesta con un muro (el DOGC devuelve 4.188
  // caracteres de aviso de cookies, `sede.madrid.es` un 403), la verificación NO se salta: se
  // hace contra el **documento ya clonado y curado en el hub** para esa misma URL, que es la
  // misma prueba con el papel que ya tenemos. Sin esto quedaba un callejón absurdo —el documento
  // correcto clonado y verificado con 4 anclas, y el botón sin poder repuntarse (T-188, 27/07).
  let v = await verificar(urlNueva, ANCLAS)
  if (!v.ok && /muro de cookies|HTTP 403|chars de texto|no responde/.test(v.motivo)) {
    const [clonado] = await sql`
      SELECT d.extracted_text AS texto, d.tipo, d.curado
        FROM convocatoria_documentos d
        JOIN convocatorias c ON c.id = d.convocatoria_id
        JOIN oposiciones o ON o.id = c.oposicion_id
       WHERE o.slug = ${slug}
         AND (d.url = ${urlNueva} OR d.doc_key = ${canonicalizeBoletinUrl(urlNueva).docKey || urlNueva})
         AND d.extracted_text IS NOT NULL
       ORDER BY length(d.extracted_text) DESC LIMIT 1`
    if (clonado?.texto) {
      const d = dictaminar(clonado.texto, ANCLAS)
      console.log(`  🗄️  la fuente no deja leerlo (${v.motivo}) → se verifica contra el documento YA CLONADO en el hub`)
      console.log(`      (${clonado.tipo}${clonado.curado ? ', curado' : ''}, ${clonado.texto.length} chars)`)
      v = { ...d, status: 200, texto: clonado.texto }
    }
  }
  console.log(`  HTTP    : ${v.status} · ${v.chars} chars de texto`)
  if (ANCLAS.length) {
    console.log(`  anclas  : ${v.anclasEncontradas.length ? `✅ ${v.anclasEncontradas.join(' · ')}` : '❌ ninguna'}${v.anclasFaltan.length ? ` — faltan: ${v.anclasFaltan.join(' · ')}` : ''}`)
  } else {
    console.log('  anclas  : ⚠️  ninguna exigida — se recomienda --anclas para confirmar el documento')
  }
  if (!v.ok) problemas.push(v.motivo)

  // ── 3. El OTRO contrato de programa_url: la fuente del temario (Sistema 2) ──────────────
  const perdiaTemario = señalesDeUrl(op.programa_url).pareceTemario && !señalesDeUrl(urlNueva).pareceTemario
  if (perdiaTemario && !ACEPTO_PERDER_TEMARIO) {
    problemas.push(
      'la URL ACTUAL es el TEMARIO oficial: repuntarla pierde la fuente del programa que usa la ' +
      'verificación de literalidad de epígrafe (Sistema 2). Si aun así procede, pásalo con ' +
      '--acepto-perder-temario y anota dónde queda el temario',
    )
  }

  // ── 4. Simulación del estado FINAL con el núcleo puro (lo que verá el sweep) ────────────
  const issuesFinal = checkConvocatoriaLinks({
    diarioOficial: etiquetaFinal,
    programaUrl: urlNueva,
    boeReference: op.boe_reference,
    estadoProceso: op.estado_proceso,
  })
  if (issuesFinal.length) {
    for (const i of issuesFinal) console.log(`  ⚠️  tras el cambio quedaría: [${i.severidad}] ${i.tipo} — ${i.detalle}`)
    if (issuesFinal.some((i) => i.severidad === 'error')) problemas.push('el cambio NO apaga el hallazgo (seguiría en error)')
  } else {
    console.log('  ✅ tras el cambio la tarjeta oficial queda coherente (0 hallazgos)')
  }

  if (problemas.length) {
    console.log('')
    for (const p of problemas) console.error(`  ❌ ${p}`)
    await traza(sql, {
      slug: op.slug, url_vieja: op.programa_url, url_nueva: urlNueva, aplicado: false,
      etiqueta: etiquetaFinal, boletin_detectado: boletin, motivos: problemas,
      anclas_encontradas: v.anclasEncontradas,
    })
    await sql.end()
    console.error('\n❌ RECHAZADO: no se escribe un enlace sin confirmar que es el documento de esta convocatoria.\n')
    process.exit(1)
  }

  if (!APPLY) {
    await sql.end()
    console.log('\n🔍 DRY-RUN: no se ha escrito nada. Añade --apply para aplicarlo.\n')
    return
  }

  // ── 5. Dual-write: la landing lee la SSOT, donde manda la convocatoria vigente ──────────
  const [{ id: oposicionId }] = await sql`SELECT id FROM oposiciones WHERE slug = ${slug}`
  await sql.begin(async (tx) => {
    await tx`UPDATE oposiciones SET programa_url = ${urlNueva} WHERE id = ${oposicionId}`
    if (ETIQUETA_NUEVA) await tx`UPDATE oposiciones SET diario_oficial = ${ETIQUETA_NUEVA} WHERE id = ${oposicionId}`
    // Reset del hash del programa: el documento es OTRO, así que el hash anterior no compara nada.
    // Sin esto, la verificación de literalidad de epígrafe cantaría un `outdated_convocatoria` falso.
    await tx`
      UPDATE convocatorias
         SET programa_url = ${urlNueva}, programa_last_hash = NULL, programa_last_checked = NULL
       WHERE oposicion_id = ${oposicionId} AND is_current AND archived_at IS NULL`
  })

  // ── 6. Verificación de que el cambio se VE donde lo lee la landing ─────────────────────
  const [tras] = await sql`
    SELECT programa_url, diario_oficial, estado_proceso, boe_reference
    FROM oposiciones_ssot WHERE slug = ${slug} LIMIT 1`
  const issuesTras = checkConvocatoriaLinks({
    diarioOficial: tras.diario_oficial, programaUrl: tras.programa_url,
    boeReference: tras.boe_reference, estadoProceso: tras.estado_proceso,
  })
  const okSsot = tras.programa_url === urlNueva && !issuesTras.some((i) => i.severidad === 'error')
  await traza(sql, {
    slug: op.slug, url_vieja: op.programa_url, url_nueva: urlNueva, aplicado: true,
    etiqueta: etiquetaFinal, boletin_detectado: boletin, nivel_deteccion: nivel,
    anclas_encontradas: v.anclasEncontradas, perdia_temario: perdiaTemario,
    ssot_coherente: okSsot,
  })
  await sql.end()

  console.log(`\n✅ APLICADO (dual-write oposiciones + convocatoria vigente).`)
  console.log(`   SSOT: ${tras.programa_url}`)
  console.log(`   ${okSsot ? '✅ la tarjeta oficial queda coherente en la vista que lee la landing' : '⚠️  la SSOT NO refleja el cambio — revisa la convocatoria vigente'}`)
  console.log('   Falta purgar la caché de la landing (es PER-INSTANCIA: repite el POST y verifica el TEXTO servido).\n')
  if (!okSsot) process.exit(1)
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
