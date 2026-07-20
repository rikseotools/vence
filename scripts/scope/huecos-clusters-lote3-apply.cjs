#!/usr/bin/env node
/**
 * Drenaje de títulos huérfanos — LOTE 3 (cierra los clusters restantes del backlog).
 *
 * Adjudicado con `adjudica-cluster-huerfano.cjs` + lectura humana del epígrafe.
 * Se añade SOLO el rango que el epígrafe pide; se reusa banco ya en BD.
 *
 * APLICA (4):
 *  · auxiliar_administrativo_ayuntamiento_granada T3 — INSERT CE Tít.VIII (137-158).
 *    El tema solo escopaba el Estatuto andaluz (LO 2/2007) pese a pedir "Las Comunidades
 *    Autónomas: constitución y competencias […] organización territorial y régimen local".
 *  · administrativo_la_rioja T8 — +Ley 7/1985 Tít.III (31-41, La provincia). Su epígrafe
 *    pide "La Administración Local: la Provincia y el Municipio" y solo tenía los arts 1-13.
 *  · auxiliar_administrativo_diputacion_segovia T19 — +EBEP 69-71 (planificación, oferta de
 *    empleo público, registros): "los instrumentos reguladores del empleo público: la oferta
 *    de empleo público y los planes de empleo".
 *  · auxiliar_administrativo_diputacion_segovia T18 — +EBEP 72-77 (estructuración, RPT,
 *    cuerpos y escalas, grupos): "Los empleados públicos: clases […] Plantillas y relaciones
 *    de puestos de trabajo". Se reparte el Tít.V entre T18 y T19 según lo que pide cada uno,
 *    en vez de volcar 69-84 en ambos.
 *
 * RECHAZADOS en este lote (documentado para que no se re-intenten):
 *  · CE Tít.VII Economía y Hacienda (62 opos) → 0: el patrón "Tribunal de Cuentas" pescó 5
 *    temas del Tribunal de Cuentas EUROPEO (instituciones de la UE) y 2 de control del gasto
 *    servidos por su ley de hacienda autonómica.
 *  · Ley 39/2015 Tít.IV (tcae_aragon T8) → 0: casó el NOMBRE de la norma ("Ley del
 *    Procedimiento Administrativo Común"). Su scope (1-14, 29-33, 106-126) casa con
 *    precisión su epígrafe: ámbito, interesados, plazos, revisión y recursos.
 *  · Ley 40/2015 Tít.II (17 opos) → 0: mismo patrón, la ley cántabra 5/2018 lleva "Sector
 *    Público Institucional" en su propio título.
 *  · EBEP Tít.VI, EBEP Tít.III, Ley 39/2015 Tít.I y III, LO 3/2007 Tít.II y III,
 *    LO 3/2018 Tít.IV y VII, CE Tít.I y Tít.IX → 0 candidatos o servidos por su ley propia.
 *
 * Uso: node scripts/scope/huecos-clusters-lote3-apply.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const R = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i))

const GRANADA_T3 = 'ea2cd387-014a-4995-a4e3-ecff7dcb741d'
const LAW_CE = '6ad91a6c-41ec-431f-9c80-5f5566834941'

const UPDATES = [
  { ts: '037d5568-5df2-489b-b784-7fef63ac04a5', add: R(31, 41),
    label: 'administrativo_la_rioja T8 · Ley 7/1985 Tít.III (La provincia)',
    why: 'epígrafe: "La Administración Local: la Provincia y el Municipio"; solo tenía arts 1-13' },
  { ts: 'd291df85-108e-466d-930d-b80922bd125b', add: R(69, 71),
    label: 'auxiliar_administrativo_diputacion_segovia T19 · EBEP 69-71',
    why: 'epígrafe: "la oferta de empleo público y los planes de empleo"' },
  { ts: 'b4d3f753-c47d-4034-a693-d62eead9ee52', add: R(72, 77),
    label: 'auxiliar_administrativo_diputacion_segovia T18 · EBEP 72-77',
    why: 'epígrafe: "Los empleados públicos: clases […] Plantillas y relaciones de puestos de trabajo"' },
]

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')

    // INSERT: granada T3 no tenía ninguna fila de CE
    const ex = await c.query('SELECT id FROM topic_scope WHERE topic_id=$1 AND law_id=$2', [GRANADA_T3, LAW_CE])
    if (ex.rows.length) {
      console.log('· granada T3 · CE ya escopada (idempotente)')
    } else {
      console.log('· auxiliar_administrativo_ayuntamiento_granada T3 · INSERT CE Tít.VIII (137-158)')
      console.log('    epígrafe: "Las Comunidades Autónomas: constitución y competencias […] organización territorial y régimen local"')
      await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES ($1,$2,$3,1.0)',
        [GRANADA_T3, LAW_CE, R(137, 158)])
    }

    for (const t of UPDATES) {
      const r = await c.query('SELECT article_numbers FROM topic_scope WHERE id=$1', [t.ts])
      if (!r.rows.length) { console.log(`⚠️  ${t.label}: fila no encontrada — saltada`); continue }
      const cur = r.rows[0].article_numbers || []
      const merged = Array.from(new Set([...cur, ...t.add])).sort((a, b) => (+a) - (+b))
      if (merged.length === cur.length) { console.log(`· ${t.label}: ya lo tenía (idempotente)`); continue }
      console.log(`· ${t.label}`)
      console.log(`    ${cur.length} → ${merged.length} arts · ${t.why}`)
      await c.query('UPDATE topic_scope SET article_numbers=$1 WHERE id=$2', [merged, t.ts])
    }

    if (DRY) { await c.query('ROLLBACK'); console.log('\n--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('\n✅ COMMIT — lote 3 aplicado') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main()
