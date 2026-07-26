#!/usr/bin/env node
// scripts/convocatoria/sim-enlace-boletin.cjs
//
// SIMULACIÓN bank-wide del botón oficial de la landing ("Ver convocatoria en {diario_oficial}").
// **No escribe NADA** — ni BD, ni findings, ni badge. Corre el núcleo puro
// `lib/convocatoria/linkCoherence.cjs` sobre `oposiciones_ssot` (lo que VE el opositor) y enseña
// exactamente qué marcaría cada banda y por qué.
//
// Por qué existe: el detector de enlaces nació DEFENSIVO (solo veía "el enlace es OTRO boletín")
// y por eso 56 de las 123 landings activas estaban en zona ciega — entre ellas la que disparó
// T-134: `policia-nacional`, con plazo abierto, prometía el BOE y llevaba al portal de aspirantes
// en INGLÉS. Ampliar la vista de un detector es justo el momento de MEDIR antes de encender:
// las bandejas ruidosas que hubo que retirar (T-047/T-050, Capa 3 del radar) nacieron de no
// hacerlo. Aquí se ve el volumen y la precisión caso por caso antes de cablear nada.
//
// Uso:
//   node scripts/convocatoria/sim-enlace-boletin.cjs            # resumen + errores + warns
//   node scripts/convocatoria/sim-enlace-boletin.cjs --limpias  # incluye las que pasan
//   node scripts/convocatoria/sim-enlace-boletin.cjs --json     # salida para tuberías
//
// Relacionado: runbook `docs/runbooks/salud-contenido.md` (frase "revisa los enlaces de
// convocatoria"), kinds `convocatoria_etiqueta_boletin` / `convocatoria_enlace_no_boletin`,
// tarea T-134.

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const postgres = require('postgres')
const { checkConvocatoriaLinks } = require(
  path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'linkCoherence.cjs'),
)
const { boletinDeUrl } = require(
  path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'canonicalizeBoletinUrl.cjs'),
)

const args = process.argv.slice(2)
const LIMPIAS = args.includes('--limpias')
const JSON_OUT = args.includes('--json')

function conectar() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('❌ DATABASE_URL no configurado (RDS). Ver db/client.ts')
    process.exit(2)
  }
  return postgres(url, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
}

async function main() {
  const sql = conectar()
  // Se lee de la SSOT y no de la fila legacy a propósito: la landing compone la tarjeta oficial
  // con `diario_oficial` (etiqueta) + `programa_url` (enlace) + `boe_reference` (referencia)
  // resueltos por la vista. Auditar `oposiciones` sería auditar una copia que nadie mira.
  const filas = await sql`
    SELECT slug, diario_oficial, programa_url, boe_reference, estado_proceso
    FROM oposiciones_ssot
    WHERE is_active
    ORDER BY slug
  `
  await sql.end()

  const res = { errores: [], warns: [], limpias: [], sinEnlace: [], noComparables: [] }
  for (const f of filas) {
    if (!f.programa_url) { res.sinEnlace.push({ slug: f.slug }); continue }
    const issues = checkConvocatoriaLinks({
      diarioOficial: f.diario_oficial,
      programaUrl: f.programa_url,
      boeReference: f.boe_reference,
      estadoProceso: f.estado_proceso,
    })
    const { boletin, nivel } = boletinDeUrl(f.programa_url)
    const caso = {
      slug: f.slug,
      etiqueta: f.diario_oficial,
      estado: f.estado_proceso,
      url: f.programa_url,
      boletinDetectado: boletin,
      nivelDeteccion: nivel,
      issues,
    }
    if (issues.some((i) => i.severidad === 'error')) res.errores.push(caso)
    else if (issues.length) res.warns.push(caso)
    else if (boletin) res.limpias.push(caso)
    else res.noComparables.push(caso) // etiqueta compuesta ("BOP Córdoba") o documento en sede
  }

  if (JSON_OUT) { console.log(JSON.stringify(res, null, 2)); return }

  const pinta = (titulo, lista) => {
    if (!lista.length) return
    console.log(`\n── ${titulo} (${lista.length}) ──`)
    for (const c of lista) {
      console.log(`  ${c.slug} [${c.estado || 'sin estado'}] etiqueta=${c.etiqueta || '—'}`)
      for (const i of c.issues) console.log(`      ${i.severidad === 'error' ? '❌' : '🟡'} ${i.tipo}: ${i.detalle}`)
      console.log(`      ${c.url}`)
    }
  }

  console.log(`SIMULACIÓN enlace del botón oficial — ${filas.length} landings activas`)
  console.log(
    `  ❌ error ${res.errores.length} · 🟡 warn ${res.warns.length} · ` +
    `✅ enlace del boletín correcto ${res.limpias.length} · ` +
    `· no comparable/documento en sede ${res.noComparables.length} · sin enlace ${res.sinEnlace.length}`,
  )
  pinta('ERROR — convocatoria publicada y el botón no lleva a su boletín', res.errores)
  pinta('WARN — cola de revisión (normalmente lo que falla es la ETIQUETA)', res.warns)
  if (LIMPIAS) {
    pinta('LIMPIAS — el enlace es del boletín que anuncia la etiqueta', res.limpias)
    pinta('NO COMPARABLES — etiqueta compuesta o documento en sede institucional', res.noComparables)
  }
  console.log('\nNada de esto se ha escrito. Para adjudicar: docs/runbooks/salud-contenido.md')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
