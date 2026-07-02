#!/usr/bin/env node
/**
 * assign-seguimiento-urls.cjs
 *
 * Asigna `seguimiento_url` a las oposiciones CATALOGADAS que no la tienen, para
 * que el radar (cron hash_change / detect-*) pueda vigilarlas. Reutilizable e
 * idempotente: se puede correr tras cada tanda de "catalogar descubrimientos".
 *
 * Estrategia (en orden, la primera que casa gana):
 *   1) DONANTE por organismo — otra oposición con el MISMO `administracion` (o su
 *      forma normalizada: sin acentos, guiones→espacio, universidade→universidad)
 *      que YA tiene una `seguimiento_url` validada. Reutiliza esa URL.
 *   2) FALLBACK por CCAA — portal de empleo público oficial de la comunidad/ciudad
 *      autónoma (server-rendered), tomado de la CCAA de la señal que la descubrió.
 *
 * Las que no casan ninguna quedan reportadas para asignación manual (NO se inventa
 * una URL — mejor null explícito que un enlace que no vigila el proceso real).
 *
 * Uso:
 *   node scripts/assign-seguimiento-urls.cjs            # aplica
 *   node scripts/assign-seguimiento-urls.cjs --dry-run  # solo reporta
 *
 * Ver docs/maintenance/oeps-convocatorias-seguimiento.md §10.bis.
 */
require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')

// Portales de empleo público oficiales (server-rendered) por CCAA / ciudad autónoma.
// Fuente: donantes reales del catálogo. Ampliar aquí si aparece una CCAA nueva.
const CCAA_FALLBACK = {
  'Madrid': 'https://www.comunidad.madrid/empleo',
  'Cantabria': 'https://empleopublico.cantabria.es/funcionarios',
  'Canarias': 'https://www.gobiernodecanarias.org/administracionespublicas/funcionpublica/acceso/convocatorias-en-curso/',
  'Navarra': 'https://www.navarra.es/es/empleo-publico/convocatorias',
  'La Rioja': 'https://www.larioja.org/empleo-publico/es/oposiciones',
  'Galicia': 'https://www.xunta.gal/es/funcion-publica/procesos-selectivos/oferta-publica-de-emprego',
  'Aragón': 'https://empleopublico.aragon.es/',
  'Castilla y León': 'https://empleopublico.jcyl.es/',
  'Castilla-La Mancha': 'https://empleopublico.castillalamancha.es/',
  'Andalucía': 'https://www.juntadeandalucia.es/institutodeadministracionpublica/empleado',
  'C. Valenciana': 'https://www.gva.es/es/inicio/atencion_ciudadano/buscadores/busc_empleo_publico',
  '51': 'https://www.ceuta.es/ceuta/por-servicios/tablon',            // Ceuta
  '52': 'https://sede.melilla.es/sta/CarpetaPublic/doEvent?APP_CODE=STA&PAGE_CODE=PTS2_TABLON_DESC', // Melilla
}

function normalizeAdmin(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .toLowerCase()
    .replace(/universidade/g, 'universidad')          // gallego → castellano
    .replace(/[\-–—]/g, ' ')                          // guiones → espacio
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function main() {
  const dry = process.argv.includes('--dry-run')
  const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 15, idle_timeout: 8, max: 1, prepare: false })
  try {
    // 1) Mapa de donantes: administracion normalizada → seguimiento_url (la más frecuente)
    const donors = await sql`
      SELECT administracion, seguimiento_url, count(*)::int c
      FROM oposiciones WHERE seguimiento_url IS NOT NULL AND administracion IS NOT NULL
      GROUP BY 1,2 ORDER BY 3 DESC`
    const donorMap = {}
    for (const d of donors) {
      const k = normalizeAdmin(d.administracion)
      if (!donorMap[k]) donorMap[k] = d.seguimiento_url
    }

    // 2) Catalogadas huérfanas + la CCAA de la señal que las descubrió (más reciente)
    const targets = await sql`
      SELECT o.id, o.nombre, o.administracion,
        (SELECT COALESCE(s.raw_extraction->'pag'->>'ccaa', s.region_name)
         FROM oep_detection_signals s WHERE s.oposicion_id = o.id
         ORDER BY s.created_at DESC LIMIT 1) AS ccaa
      FROM oposiciones o
      WHERE o.coverage_level = 'catalogada' AND o.seguimiento_url IS NULL`

    let byDonor = 0, byCcaa = 0
    const unmatched = []
    for (const t of targets) {
      const donor = donorMap[normalizeAdmin(t.administracion)]
      const url = donor || CCAA_FALLBACK[t.ccaa] || null
      const src = donor ? 'donante' : (CCAA_FALLBACK[t.ccaa] ? `ccaa:${t.ccaa}` : null)
      if (!url) { unmatched.push(`${t.nombre}  [ccaa=${t.ccaa}]`); continue }
      if (donor) byDonor++; else byCcaa++
      if (!dry) {
        await sql`UPDATE oposiciones SET seguimiento_url = ${url}, seguimiento_change_status = 'ok' WHERE id = ${t.id}`
      }
      console.log(`  ${dry ? '[dry] ' : ''}✓ (${src}) ${t.nombre.slice(0, 52).padEnd(52)} → ${url.slice(0, 60)}`)
    }
    console.log(`\n${dry ? '[DRY-RUN] ' : ''}asignadas por donante: ${byDonor} | por CCAA: ${byCcaa} | sin match: ${unmatched.length}`)
    if (unmatched.length) { console.log('SIN MATCH (asignar manualmente):'); unmatched.forEach(u => console.log('   - ' + u)) }
    await sql.end()
  } catch (e) { console.error('ERR', e.message); await sql.end(); process.exit(1) }
}
main()
