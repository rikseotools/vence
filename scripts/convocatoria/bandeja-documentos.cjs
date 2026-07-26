#!/usr/bin/env node
// scripts/convocatoria/bandeja-documentos.cjs
//
// BANDEJA de documentos oficiales nuevos o cambiados, para que una sesión de Claude los lea
// enteros y actualice la BD con criterio. Sustituye al pre-masticado con LLM del cron.
//
//   npm run docs:bandeja                      # qué hay pendiente (lo más reciente primero)
//   npm run docs:bandeja -- --ver <id>        # el documento entero + lo que hoy dice la BD
//   npm run docs:bandeja -- --revisado <id> --nota "qué se hizo"
//   npm run docs:bandeja -- --slug policia-nacional
//
// ## Por qué existe (26/07/2026)
//
// El cron generaba con Haiku un JSON de seis campos por cada documento… y **nadie lo miraba
// nunca**: 6.886 extracciones, **0 triadas**, ~17 USD gastados. El paso no sobraba por malo, sino
// por redundante — el documento se clona igual en el hub con su texto, y quien decide qué se
// publica es una sesión leyendo la FUENTE, no un resumen de seis campos.
//
// Y el volumen era el problema real: el cron recorría el catálogo entero, así que el **96% de los
// documentos clonados eran de oposiciones que no preparamos** (750/día). Filtrando a las nuestras
// quedan ~25/día: una bandeja que sí se puede atender de verdad.
//
// ## Qué NO hace
//
// No decide nada ni escribe en la convocatoria. Enseña el documento y el estado actual de la BD
// para que la decisión —y el dual-write— los haga quien tiene criterio y la fuente delante.
// Marcar como revisado es solo dejar constancia de que ya se miró.

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')

const argv = process.argv.slice(2)
const val = (f) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}
const VER = val('--ver')
const REVISADO = val('--revisado')
const NOTA = val('--nota')
const SLUG = val('--slug')
const DIAS = parseInt(val('--dias') || '14', 10)
const LIMITE = parseInt(val('--limite') || '25', 10)

function conectar() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurado (RDS)')
    process.exit(2)
  }
  return postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
}

/** Marca de revisión: se deja como evento, no como columna nueva (la tabla es del hub). */
const EVENTO_REVISADO = 'documento_revisado'

async function main() {
  const sql = conectar()

  if (REVISADO) {
    const [doc] = await sql`SELECT id, titulo, url FROM convocatoria_documentos WHERE id::text = ${REVISADO} OR left(id::text, 8) = ${REVISADO} LIMIT 1`
    if (!doc) {
      await sql.end()
      console.error('❌ no existe ese documento')
      process.exit(1)
    }
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:bandeja-documentos', 'info', ${EVENTO_REVISADO},
              ${sql.json({ documentoId: doc.id, titulo: doc.titulo, url: doc.url, nota: NOTA || null })}, NOW())`
    await sql.end()
    console.log(`✅ marcado como revisado: ${doc.titulo || doc.url}`)
    return
  }

  if (VER) {
    const [d] = await sql`
      SELECT d.id, d.titulo, d.url, d.tipo, d.fecha_publicacion, d.extracted_text, o.slug,
             c.estado_proceso, c.plazas_libres, c.boe_reference,
             to_char(c.inscription_start,'YYYY-MM-DD') ini, to_char(c.inscription_deadline,'YYYY-MM-DD') fin,
             to_char(c.exam_date,'YYYY-MM-DD') examen, c.examen_config
      FROM convocatoria_documentos d
      JOIN convocatorias c ON c.id = d.convocatoria_id
      JOIN oposiciones o ON o.id = c.oposicion_id
      WHERE d.id::text = ${VER} OR left(d.id::text, 8) = ${VER} LIMIT 1`
    await sql.end()
    if (!d) {
      console.error('❌ no existe ese documento')
      process.exit(1)
    }
    console.log(`\n${'='.repeat(78)}\n${d.titulo || '(sin título)'}\n${'='.repeat(78)}`)
    console.log(`oposición: ${d.slug} · tipo: ${d.tipo} · publicado: ${d.fecha_publicacion || '—'}`)
    console.log(`url: ${d.url}`)
    console.log(`\n── LO QUE HOY DICE LA BD (para comparar, no para creerlo) ──`)
    console.log(`  estado: ${d.estado_proceso || '—'} · plazas: ${d.plazas_libres ?? '—'}`)
    console.log(`  inscripción: ${d.ini || '—'} → ${d.fin || '—'} · examen: ${d.examen || '—'}`)
    console.log(`  examen_config: ${d.examen_config ? 'sí' : 'NO'} · referencia: ${String(d.boe_reference || '—').slice(0, 110)}`)
    console.log(`\n── TEXTO DEL DOCUMENTO (${(d.extracted_text || '').length} chars) ──\n`)
    console.log(d.extracted_text || '(sin texto extraído)')
    return
  }

  // Bandeja: documentos de NUESTRAS oposiciones, de su convocatoria vigente, aún sin revisar.
  const filas = await sql`
    SELECT left(d.id::text, 8) id, d.titulo, d.tipo, d.url, o.slug, c.estado_proceso,
           to_char(d.created_at, 'DD/MM HH24:MI') visto,
           length(d.extracted_text) chars
    FROM convocatoria_documentos d
    JOIN convocatorias c ON c.id = d.convocatoria_id
    JOIN oposiciones o ON o.id = c.oposicion_id
    WHERE o.is_active AND c.is_current AND c.archived_at IS NULL
      AND d.created_at > now() - (${DIAS} || ' days')::interval
      AND d.extracted_text IS NOT NULL
      ${SLUG ? sql`AND o.slug = ${SLUG}` : sql``}
      AND NOT EXISTS (
        SELECT 1 FROM observable_events e
        WHERE e.event_type = ${EVENTO_REVISADO} AND e.metadata->>'documentoId' = d.id::text)
    ORDER BY (c.estado_proceso IN ('inscripcion_abierta','convocatoria_publicada','convocada')) DESC,
             d.created_at DESC
    LIMIT ${LIMITE}`
  const [tot] = await sql`
    SELECT count(*)::int n FROM convocatoria_documentos d
    JOIN convocatorias c ON c.id = d.convocatoria_id
    JOIN oposiciones o ON o.id = c.oposicion_id
    WHERE o.is_active AND c.is_current AND d.created_at > now() - (${DIAS} || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM observable_events e
        WHERE e.event_type = ${EVENTO_REVISADO} AND e.metadata->>'documentoId' = d.id::text)`
  await sql.end()

  console.log(`\nBANDEJA de documentos oficiales — últimos ${DIAS} días · ${tot.n} sin revisar`)
  console.log('(oposiciones que preparamos, convocatoria vigente. Primero las de plazo abierto)\n')
  if (!filas.length) {
    console.log('  ✅ nada pendiente\n')
    return
  }
  for (const f of filas) {
    console.log(`  ${f.id} · ${f.visto} · ${String(f.slug).padEnd(38)} [${f.estado_proceso || '—'}]`)
    console.log(`           ${String(f.titulo || f.url).slice(0, 96)} · ${f.tipo} · ${f.chars} chars`)
  }
  console.log(`\n  Ver uno:      npm run docs:bandeja -- --ver <id>`)
  console.log(`  Marcarlo:     npm run docs:bandeja -- --revisado <id> --nota "qué se hizo"\n`)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
