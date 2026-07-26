#!/usr/bin/env node
// scripts/convocatoria/audit-landing.cjs
//
// AUDITORÍA COMPLETA de UNA landing: sus datos, sus enlaces y lo que afirma. Un comando, un
// veredicto, un exit code. **No escribe nada** (salvo la traza de observabilidad).
//
//   npm run audit:landing -- <slug> [--json] [--sin-red]
//
// ## Por qué existe (T-142, 26/07/2026)
//
// La auditoría MANUAL de `policia-nacional` —con el plazo de solicitudes abierto— encontró seis
// defectos publicados desde hacía meses que ningún detector veía. El diagnóstico no fue "faltan
// detectores": fue que **había seis herramientas dispersas y ninguna respondía "audítame ESTA
// landing entera"**, así que antes de mandarle una campaña nadie las corría. Esto es ese punto
// de entrada, y `scripts/newsletters/*` lo usa como puerta antes de enviar.
//
// ## Qué hace (y qué NO reimplementa)
//
// Recorre el **inventario de superficies** (`lib/admin/landingSurfaces.ts`) — el mismo registro
// que el guardarraíl de CI y el panel de admin — y por cada una:
//   · muestra los hallazgos que el sweep YA calculó para este slug (`content_health_findings`);
//   · ejecuta los NÚCLEOS PUROS compartidos sobre los datos vivos (completitud de landing,
//     coherencia del botón oficial, salud de la fuente de seguimiento);
//   · añade lo que no cubría nadie: enlaces del HTML **servido** (internos y externos),
//     afirmaciones numéricas contra el **documento oficial clonado** y contradicciones entre
//     superficies (`lib/convocatoria/landingClaims.cjs`).
//
// Que el orquestador camine el registro de superficies es lo que impide que vuelva a haber un
// hueco sin dueño: si mañana se añade una superficie sin detector, aquí sale con su hueco.

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const postgres = require('postgres')

const RAIZ = path.join(__dirname, '..', '..')
const { checkConvocatoriaLinks } = require(path.join(RAIZ, 'lib/convocatoria/linkCoherence.cjs'))
const { classifyLandingCompleteness } = require(path.join(RAIZ, 'lib/convocatoria/landingCompleteness.cjs'))
const { CABECERAS_CRON } = require(path.join(RAIZ, 'lib/convocatoria/seguimientoVigilable.cjs'))
const {
  extraerAfirmaciones,
  verificarAfirmaciones,
  detectarContradicciones,
} = require(path.join(RAIZ, 'lib/convocatoria/landingClaims.cjs'))

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const SIN_RED = argv.includes('--sin-red')
const SLUG = argv.find((a) => !a.startsWith('--'))
const BASE = process.env.AUDIT_LANDING_BASE || 'https://www.vence.es'

if (!SLUG) {
  console.error('\n❌ falta el slug\n\n  npm run audit:landing -- <slug> [--json] [--sin-red]\n')
  process.exit(2)
}

function conectar() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurado (RDS)')
    process.exit(2)
  }
  return postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
}

/** Superficies del registro. Se lee el .ts con un parseo mínimo para no arrastrar tsx aquí. */
function leerSuperficies() {
  const src = require('fs').readFileSync(path.join(RAIZ, 'lib/admin/landingSurfaces.ts'), 'utf8')
  const bloque = src.match(/export const LANDING_SURFACES[^=]*= \{([\s\S]*?)\n\}\n/)
  if (!bloque) return []
  const out = []
  const re = /(\w+):\s*\{\s*titulo:\s*'([^']+)'[\s\S]*?kinds:\s*\[([^\]]*)\]([\s\S]*?)\n  \},/g
  let m
  while ((m = re.exec(bloque[1])) !== null) {
    const kinds = [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1])
    const hueco = /hueco:/.test(m[4]) ? (m[4].match(/hueco:\s*\n?\s*'([^']{0,80})/) || [, '(ver registro)'])[1] : null
    out.push({ id: m[1], titulo: m[2], kinds, hueco })
  }
  return out
}

/** Texto visible del HTML servido (para buscar afirmaciones donde las ve el opositor). */
function textoVisible(html) {
  return String(html || '')
    .split('<body')
    .slice(1)
    .join('<body')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
}

async function comprobarEnlaces(html) {
  const hrefs = [...new Set([...String(html).matchAll(/href="([^"]+)"/g)].map((m) => m[1]))]
  const internos = hrefs.filter((h) => h.startsWith('/') && !h.startsWith('/_next') && !/favicon|manifest|icon\./.test(h))
  const externos = hrefs.filter((h) => /^https?:\/\//.test(h) && !/vence\.es|googletagmanager|google-analytics/.test(h))
  const rotos = []
  const noComprobables = []
  // Cabeceras del cron de seguimiento (núcleo compartido, no una copia): muchas sedes oficiales
  // devuelven 403 a una petición sin `User-Agent` de navegador. Sin esto, el detector llamaba
  // "roto" a un enlace perfectamente vivo — pasó con congreso.es en la primera pasada.
  const comprobar = async (url, etiqueta) => {
    try {
      // `Accept: */*` a propósito: aquí solo se comprueba que el recurso EXISTA, no se lee. Con
      // el Accept de HTML del cron, el BORM devuelve 406 al PDF de un anuncio que está perfecto.
      const r = await fetch(url, {
        headers: { ...CABECERAS_CRON, Accept: '*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
      })
      // 403/429 = el sitio bloquea peticiones automáticas, no que el enlace esté roto. Se informa
      // aparte: marcarlo como error mandaría a alguien a "arreglar" una URL que funciona.
      if (r.status === 403 || r.status === 429 || r.status === 406) noComprobables.push({ url: etiqueta, status: r.status })
      else if (r.status >= 400) rotos.push({ url: etiqueta, status: r.status })
    } catch (e) {
      rotos.push({ url: etiqueta, status: 0, error: e.message })
    }
  }
  // En serie por lotes cortos: son ~70 peticiones a nuestro propio dominio, no hay prisa y así no
  // se abre una tormenta contra los boletines oficiales (que sí capan por ráfaga).
  for (const l of internos) await comprobar(BASE + l, l)
  for (const l of externos) await comprobar(l, l)
  return { internos: internos.length, externos: externos.length, rotos, noComprobables }
}

async function main() {
  const sql = conectar()
  const [op] = await sql`
    SELECT slug, nombre, is_active, diario_oficial, programa_url, seguimiento_url, boe_reference,
           estado_proceso, landing_estadisticas, landing_faqs, landing_description, seo_title,
           seo_description, titulo_requerido, examen_config, temas_count, plazas_libres, plazas_total
    FROM oposiciones_ssot WHERE slug = ${SLUG} LIMIT 1`
  if (!op) {
    await sql.end()
    console.error(`❌ no existe la oposición '${SLUG}'`)
    process.exit(2)
  }

  const findings = await sql`
    SELECT kind, severity, message FROM content_health_findings
    WHERE oposicion_slug = ${SLUG} ORDER BY severity DESC, kind`
  // El documento contra el que se contrastan las cifras tiene que SER la convocatoria. El hub
  // tiene el 96% clonado como `nota` (tipo por defecto): contrastar contra una nota o un temario
  // produce avisos falsos. Se prefiere `convocatoria`/`bases`; si no hay, se dice y no se opina.
  // Una landing NO habla de un solo documento: cita la OEP ("la OEP 2026 aprobó 1.100 plazas"),
  // la convocatoria y las bases. Contrastarlo todo contra UNO daba falsos "sin respaldo" en masa
  // —medido: la FAQ de administrativo-madrid cita las plazas de la OEP y el documento clonado es
  // la convocatoria—. El corpus es el CONJUNTO de documentos oficiales de la convocatoria vigente.
  const docs = await sql`
    SELECT d.extracted_text, d.titulo, d.url, d.tipo
    FROM convocatoria_documentos d
    JOIN convocatorias c ON c.id = d.convocatoria_id
    JOIN oposiciones o ON o.id = c.oposicion_id
    WHERE o.slug = ${SLUG} AND c.is_current AND d.extracted_text IS NOT NULL
      AND d.tipo IN ('convocatoria', 'bases', 'oep_decreto', 'correccion_errores')
    ORDER BY length(d.extracted_text) DESC LIMIT 6`
  const doc = docs.length
    ? {
        tipo: [...new Set(docs.map((d) => d.tipo))].join('+'),
        titulo: `${docs.length} documento(s) oficial(es)`,
        url: docs[0].url,
        extracted_text: docs.map((d) => d.extracted_text).join('\n\n'),
      }
    : null
  const errores = []
  const avisos = []
  const notas = []

  // ── 1. Lo que el sweep ya sabe de esta oposición ───────────────────────────────────────────
  // Los `error` del barrido NO bloquean todos por igual: esta auditoría es la puerta de una
  // campaña, así que bloquea lo que el opositor VE mal en la página, no la salud interna del
  // sistema. Medido en la simulación bank-wide (T-142): de las 4 landings que salían con error,
  // 3 lo eran por `seguimiento_url_stale` —la URL que VIGILAMOS es un índice del portal, algo que
  // el visitante no percibe y que el propio runbook llama "cola de revisión, puede ser legítima"
  // (T-125: ordenanza-cordoba está documentada como falso positivo)—. Bloquear una campaña por
  // eso sería enseñar a saltarse la puerta, que es como se muere un guardarraíl.
  const KINDS_NO_BLOQUEAN = new Set([
    'seguimiento_url_stale', // calidad de NUESTRA vigilancia, no de lo que lee el opositor
    'seguimiento_fuente_ciega', // ídem
    'convocatoria_docs_incompletos', // provenance interno (documentos sin clonar)
    'epigrafe_provenance_no_doc', // ídem
    'scope_sin_verificar', // deuda de verificación del temario, no defecto visible
  ])
  for (const f of findings) {
    const bloquea = f.severity === 'error' && !KINDS_NO_BLOQUEAN.has(f.kind)
    ;(bloquea ? errores : avisos).push(
      `[${f.kind}] ${f.message}${f.severity === 'error' && !bloquea ? '  (error de salud interna: no bloquea el envío)' : ''}`,
    )
  }

  // ── 2. Núcleos puros sobre los datos vivos (por si el sweep no ha corrido desde el cambio) ──
  const cl = classifyLandingCompleteness({
    isActive: op.is_active !== false,
    landingEstadisticas: op.landing_estadisticas,
    landingFaqs: op.landing_faqs,
    landingDescription: op.landing_description,
    seoTitle: op.seo_title,
    seoDescription: op.seo_description,
    tituloRequerido: op.titulo_requerido,
    examenConfig: op.examen_config,
  })
  if (!findings.some((f) => f.kind === 'landing_incompleta')) {
    if (cl.severidad === 'error') errores.push(`[landing_incompleta] falta ${cl.faltan.join(', ')}`)
    else if (cl.severidad === 'warn') avisos.push(`[landing_incompleta] mejorable — falta ${cl.faltan.join(', ')}`)
  }

  // El núcleo se re-ejecuta por si el sweep no ha corrido desde el último cambio, pero NO se
  // repite lo que el barrido ya reportó: el mismo defecto salía dos veces (con el nombre del kind
  // y con el del tipo interno) en 13 landings. Un informe que se repite se lee peor y se cree menos.
  const KIND_DE_TIPO = {
    ref_url_mismatch: 'convocatoria_link_mismatch',
    etiqueta_boletin_mismatch: 'convocatoria_etiqueta_boletin',
    enlace_no_es_boletin: 'convocatoria_enlace_no_boletin',
  }
  const kindsYaReportados = new Set(findings.map((f) => f.kind))
  for (const it of checkConvocatoriaLinks({
    diarioOficial: op.diario_oficial, programaUrl: op.programa_url,
    boeReference: op.boe_reference, estadoProceso: op.estado_proceso,
  })) {
    if (kindsYaReportados.has(KIND_DE_TIPO[it.tipo])) continue
    ;(it.severidad === 'error' ? errores : avisos).push(`[${KIND_DE_TIPO[it.tipo] || it.tipo}] ${it.detalle}`)
  }

  // ── 3. La página SERVIDA: enlaces, afirmaciones y contradicciones ──────────────────────────
  let html = ''
  let enlaces = null
  if (!SIN_RED) {
    try {
      html = await fetch(`${BASE}/${SLUG}?cb=${process.pid}${findings.length}`, {
        signal: AbortSignal.timeout(30000),
      }).then((r) => r.text())
    } catch (e) {
      errores.push(`[pagina] no se pudo descargar la landing servida: ${e.message}`)
    }
  }
  if (html) {
    enlaces = await comprobarEnlaces(html)
    for (const r of enlaces.rotos) {
      errores.push(`[landing_enlace_roto] ${r.url} → ${r.status || 'sin respuesta'}${r.error ? ` (${r.error})` : ''}`)
    }
    for (const r of enlaces.noComprobables) {
      notas.push(`enlace no comprobable automáticamente (${r.status}, el sitio bloquea bots): ${r.url}`)
    }
  }

  // Afirmaciones: se leen de la página servida (lo que ve el opositor) partida por superficies
  // aproximadas, y de los campos estructurados, que son los que rellena el mantenimiento.
  const superficies = []
  if (html) superficies.push({ superficie: 'pagina_servida', texto: textoVisible(html) })
  for (const f of Array.isArray(op.landing_faqs) ? op.landing_faqs : []) {
    superficies.push({ superficie: 'faq', texto: `${f.pregunta || ''} ${f.respuesta || ''}` })
  }
  for (const s of Array.isArray(op.landing_estadisticas) ? op.landing_estadisticas : []) {
    superficies.push({ superficie: 'tarjeta_hero', texto: `${s.numero || ''} ${s.texto || ''}` })
  }
  if (op.temas_count) superficies.push({ superficie: 'temas_count', texto: `${op.temas_count} temas` })

  const afirmaciones = extraerAfirmaciones(superficies)
  const contradicciones = detectarContradicciones(
    // La página servida repite lo que dicen las otras superficies: si se mezclara, toda
    // diferencia legítima entre secciones saldría duplicada. Se compara entre campos.
    afirmaciones.filter((a) => a.superficie !== 'pagina_servida'),
  )
  for (const c of contradicciones) errores.push(`[landing_superficies_contradictorias] ${c.detalle}`)

  let respaldo = { sinDocumento: true, sinRespaldo: [], respaldadas: [] }
  if (doc && doc.extracted_text) {
    respaldo = verificarAfirmaciones(afirmaciones.filter((a) => a.superficie !== 'pagina_servida'), doc.extracted_text)
    // El aviso es de DOBLE lectura y así se redacta: o la cifra está mal, o nos falta clonar el
    // documento que la respalda (la landing cita OEP + convocatoria + bases, y el hub tiene el 96%
    // como `nota`). Decir "no aparece en el documento oficial" a secas sonaba a acusación y hacía
    // perder el tiempo verificando cifras correctas cuyo documento simplemente no teníamos.
    const tiposCorpus = doc.tipo
    for (const a of respaldo.sinRespaldo) {
      avisos.push(
        `[landing_cifra_sin_respaldo] "${a.valor} ${a.tipo.replace('_', ' ')}" (${a.superficie}) no está en los ` +
        `${docs.length} documento(s) clonados [${tiposCorpus}] — verifica la cifra en su fuente, o clona ` +
        `el documento que la respalda si es de otro (OEP, bases, temario) — ${a.fragmento}`,
      )
    }
  } else {
    notas.push(
      'sin documento de CONVOCATORIA clonado con texto (el hub tiene el 96% como `nota`): las ' +
      'cifras no se han podido contrastar. Clonar la convocatoria con su tipo real habilita esta capa.',
    )
  }

  // ── 4. Superficies sin vigilancia (huecos declarados) ──────────────────────────────────────
  const superficiesRegistro = leerSuperficies()
  const huecos = superficiesRegistro.filter((s) => s.hueco)

  const resultado = {
    slug: op.slug,
    nombre: op.nombre,
    estado: op.estado_proceso,
    errores,
    avisos,
    notas,
    enlaces,
    afirmaciones: afirmaciones.length,
    documento: doc ? { titulo: doc.titulo, url: doc.url, chars: doc.extracted_text.length } : null,
    superficies: superficiesRegistro.length,
    huecosDeclarados: huecos.map((h) => `${h.titulo}: ${h.hueco}`),
    veredicto: errores.length ? 'ERROR' : avisos.length ? 'AVISOS' : 'OK',
  }

  // ── Traza: quién auditó qué y con qué veredicto ────────────────────────────────────────────
  // Es lo único que esta herramienta escribe. Importa porque la auditoría es la PUERTA de un
  // envío: sin traza, "la landing estaba bien cuando mandamos la campaña" es un recuerdo, no un
  // dato. Con ella se puede reconstruir el estado exacto que se dio por bueno.
  try {
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:audit-landing',
              ${errores.length ? 'warn' : 'info'}, 'landing_auditada',
              ${sql.json({
                slug: op.slug,
                veredicto: errores.length ? 'ERROR' : avisos.length ? 'AVISOS' : 'OK',
                estado_proceso: op.estado_proceso,
                n_errores: errores.length,
                n_avisos: avisos.length,
                kinds_error: errores.map((e) => (e.match(/^\[([a-z_0-9]+)\]/) || [, 'otro'])[1]),
                enlaces_comprobados: enlaces ? enlaces.internos + enlaces.externos : 0,
                enlaces_rotos: enlaces ? enlaces.rotos.length : null,
                documentos_corpus: docs.length,
              })}, NOW())`
  } catch (e) {
    // La traza NUNCA debe tumbar la auditoría (ni, por tanto, bloquear un envío por un fallo de
    // observabilidad). Se avisa y se sigue — mismo criterio que `repuntar-url.cjs`.
    console.error(`⚠️  no se pudo registrar el evento de observabilidad: ${e.message}`)
  }
  await sql.end()

  if (JSON_OUT) console.log(JSON.stringify(resultado, null, 2))
  else {
    console.log(`\n${'='.repeat(78)}`)
    console.log(`AUDITORÍA DE LANDING — ${op.slug} [${op.estado_proceso || 'sin estado'}]`)
    console.log('='.repeat(78))
    if (enlaces) console.log(`  enlaces  : ${enlaces.internos} internos + ${enlaces.externos} externos · ${enlaces.rotos.length} rotos${enlaces.noComprobables.length ? ` · ${enlaces.noComprobables.length} no comprobables (403/429)` : ''}`)
    else console.log('  enlaces  : no comprobados (--sin-red)')
    console.log(`  documento: ${doc ? `[${doc.tipo}] ${doc.titulo || doc.url} (${doc.extracted_text.length} chars)` : '— ninguno de tipo convocatoria/bases'}`)
    console.log(`  cifras   : ${afirmaciones.length} afirmaciones · ${respaldo.sinDocumento ? 'sin contrastar' : `${respaldo.sinRespaldo.length} sin respaldo`}`)
    console.log(`  superficies vigiladas: ${superficiesRegistro.length} (${huecos.length} con hueco declarado)`)
    if (errores.length) { console.log(`\n  ❌ ERRORES (${errores.length})`); errores.forEach((e) => console.log(`     · ${e}`)) }
    if (avisos.length) { console.log(`\n  🟡 AVISOS (${avisos.length})`); avisos.forEach((a) => console.log(`     · ${a}`)) }
    if (notas.length) { console.log(`\n  ℹ️  ${notas.join(' · ')}`) }
    if (huecos.length) {
      console.log(`\n  ⚠️  Superficies con hueco conocido (no las vigila nadie):`)
      huecos.forEach((h) => console.log(`     · ${h.titulo}`))
    }
    console.log(`\n  VEREDICTO: ${resultado.veredicto === 'OK' ? '✅ OK' : resultado.veredicto === 'AVISOS' ? '🟡 con avisos' : '❌ ERRORES'}\n`)
  }

  process.exit(errores.length ? 1 : 0)
}

main().catch((e) => { console.error('❌', e.message); process.exit(2) })
