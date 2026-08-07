#!/usr/bin/env node
/**
 * scripts/convocatoria/audit-corpus-ajeno.cjs — runner BAJO DEMANDA de `corpusSaleDeSuSitio`:
 * ¿los documentos que respaldan una convocatoria salen del MISMO sitio que su fuente oficial?
 *
 * Uso:
 *   npm run audit:corpus-ajeno                 # las activas
 *   npm run audit:corpus-ajeno -- --slug X     # una
 *   npm run audit:corpus-ajeno -- --todo       # también las no activas
 *   npm run audit:corpus-ajeno -- --json       # salida para tratar
 *
 * SOLO LEE. No escribe, no pinga badge. El arreglo —despegar los documentos ajenos y clonar los
 * del proceso bueno— lo decide una persona con el portal delante, igual que en los detectores
 * hermanos `audit:vinculo-vecino` e `audit:instrumento-derivado`, que viven bajo demanda por la
 * misma razón: ~50 % de precisión es útil para quien lee y ruido en un badge.
 *
 * Por qué existe, qué se descartó y las mediciones: cabecera de `lib/convocatoria/corpusAjeno.cjs`.
 * Runbook: `docs/runbooks/provenance-convocatorias.md`.
 */
const path = require('path')
const REPO = path.resolve(__dirname, '..', '..')
require(path.join(REPO, 'node_modules', 'dotenv')).config({ path: path.join(REPO, '.env.local') })
const pgMod = require(path.join(REPO, 'node_modules', 'postgres'))
const postgres = pgMod.default || pgMod
const { corpusSaleDeSuSitio } = require(path.join(REPO, 'lib', 'convocatoria', 'corpusAjeno.cjs'))

const arg = (n) => {
  const i = process.argv.indexOf(n)
  return i > -1 ? process.argv[i + 1] : null
}
const JSON_OUT = process.argv.includes('--json')
const TODO = process.argv.includes('--todo')
const SLUG = arg('--slug')

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } })

  // Se lee de `convocatorias`, NO de `oposiciones_ssot`: el `programa_url` que importa es el del
  // CICLO al que están colgados los documentos. La vista resuelve el vigente con fallback, y un
  // fallback compararía los documentos de este año contra el enlace de otro.
  const filas = await sql`
    SELECT o.slug, o.nombre, o.is_active, c.id AS convocatoria_id, c.programa_url, c."año" AS anio
    FROM convocatorias c
    JOIN oposiciones o ON o.id = c.oposicion_id
    WHERE c.programa_url IS NOT NULL AND c.programa_url <> ''
      ${SLUG ? sql`AND o.slug = ${SLUG}` : TODO ? sql`` : sql`AND o.is_active`}
    ORDER BY o.slug`

  const resultados = []
  for (const f of filas) {
    const docs = await sql`
      SELECT url, titulo, tipo FROM convocatoria_documentos WHERE convocatoria_id = ${f.convocatoria_id}`
    const r = corpusSaleDeSuSitio({ programaUrl: f.programa_url, documentos: docs })
    resultados.push({ slug: f.slug, nombre: f.nombre, anio: f.anio, documentos: docs.length, programaUrl: f.programa_url, ...r })
  }
  await sql.end()

  const ajenos = resultados.filter((r) => r.veredicto === 'ajeno')
  const coherentes = resultados.filter((r) => r.veredicto === 'coherente')
  const mudos = resultados.filter((r) => r.veredicto === 'no_juzgable')

  if (JSON_OUT) {
    console.log(JSON.stringify({ resumen: { total: resultados.length, ajenos: ajenos.length, coherentes: coherentes.length, no_juzgables: mudos.length }, ajenos }, null, 2))
    process.exit(ajenos.length ? 1 : 0)
  }

  console.log(`\n🔎 Corpus ajeno — ${resultados.length} convocatoria(s) con fuente oficial\n`)
  if (ajenos.length) {
    console.log(`── 🔴 el corpus NO sale del sitio de su fuente oficial (${ajenos.length}) ──\n`)
    for (const r of ajenos) {
      console.log(`  ${r.slug}${r.anio ? ` (${r.anio})` : ''}  — ${r.documentosJuzgados} documento(s)`)
      console.log(`    oficial:    «${r.carpetaOficial}»  ${r.programaUrl}`)
      console.log(`    documentos: «${r.carpetasDocumentos.join('», «')}»`)
      console.log('')
    }
  } else {
    console.log('── 🟢 ninguna convocatoria juzgable tiene el corpus fuera de su sitio ──\n')
  }

  // El recuento de NO JUZGABLES es parte del resultado, no una nota al pie: sobre esas el detector
  // no opina, y darlas por buenas es justo el verde falso que este runner no quiere producir.
  console.log(`── alcance ──`)
  console.log(`   ${String(coherentes.length).padStart(4)}  coherentes (algún documento sale de la carpeta de su fuente)`)
  console.log(`   ${String(mudos.length).padStart(4)}  no juzgables (carpetas genéricas del portal, o sin documentos con URL)`)
  console.log(
    '\nCada línea es una SOSPECHA, no un veredicto: hay portales que sirven un mismo proceso desde\n' +
      'secciones distintas. Abre el portal, comprueba de qué proceso son los documentos y, si son de\n' +
      'otro, despégalos y clona los del bueno. NUNCA repuntar la fuente oficial para que «cuadre».\n',
  )
  process.exit(ajenos.length ? 1 : 0)
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(2)
})
