#!/usr/bin/env node
/**
 * ADJUDICADOR de clusters `scope_titulo_huerfano` (paso previo a tocar scope).
 *
 * Para un cluster (ley + título + rango), recorre las oposiciones donde ese título sale
 * huérfano y busca la MATERIA del título en los epígrafes de **TODOS** sus temas activos
 * — no solo los que ya escopan esa ley. Ese matiz importa: el tema que pide la materia
 * puede estar escopando otra norma (caso Ley 7/1985 Tít.V, cuyo único candidato pedía
 * órganos colegiados de la Ley 40/2015 y era falso positivo).
 *
 * NO escribe nada. Imprime los candidatos con su epígrafe para que un humano/Claude
 * confirme uno a uno contra el programa antes de ampliar el scope. Doctrina: añadir solo
 * lo que el epígrafe pida; ante duda, no tocar.
 *
 * Uso: node scripts/scope/adjudica-cluster-huerfano.cjs <huerfanos.json> [clusterKey…]
 *   clusterKey = "<ley>|<rango>"  (p.ej. "CE|56-65"). Sin argumentos: lista los clusters.
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const fs = require('fs')

const IN = process.argv[2]
const KEYS = process.argv.slice(3)
if (!IN) { console.error('Uso: adjudica-cluster-huerfano.cjs <huerfanos.json> [ley|rango …]'); process.exit(2) }

// Patrones que delatan que un epígrafe pide la materia de ese título.
// Deliberadamente ESPECÍFICOS: palabras genéricas ("entidades locales", "administración")
// disparan falsos positivos desde temas ajenos (medido 20/07).
const MATERIA = {
  'CE|56-65': ['%corona%', '%del rey%', '%sucesion%', '%sucesión%', '%regencia%', '%refrendo%'],
  'CE|66-96': ['%cortes generales%', '%congreso de los diputados%', '%senado%', '%poder legislativo%', '%elaboracion de las leyes%', '%elaboración de las leyes%', '%procedimiento legislativo%'],
  'CE|97-107': ['%del gobierno y de la administracion%', '%del gobierno y de la administración%', '%poder ejecutivo%', '%consejo de ministros%', '%presidente del gobierno%'],
  'CE|117-127': ['%poder judicial%', '%consejo general del poder judicial%', '%ministerio fiscal%', '%organizacion judicial%', '%organización judicial%'],
  'CE|128-136': ['%economia y hacienda%', '%economía y hacienda%', '%tribunal de cuentas%', '%presupuestos generales del estado%'],
  'CE|137-158': ['%organizacion territorial%', '%organización territorial%', '%comunidades autonomas%', '%comunidades autónomas%', '%estatutos de autonomia%', '%estatutos de autonomía%'],
  'CE|159-165': ['%tribunal constitucional%'],
  'CE|10-55': ['%derechos y deberes fundamentales%', '%derechos fundamentales%'],
  'Ley 40/2015|54-80': ['%administracion general del estado%', '%administración general del estado%', '%organizacion administrativa%', '%organización administrativa%', '%administracion periferica%', '%administración periférica%', '%delegados del gobierno%'],
  'Ley 40/2015|81-139': ['%sector publico institucional%', '%sector público institucional%', '%organismos autonomos%', '%organismos autónomos%', '%entidades publicas empresariales%', '%entidades públicas empresariales%'],
  'RDL 5/2015|55-68': ['%adquisicion y perdida%', '%adquisición y pérdida%', '%acceso al empleo publico%', '%acceso al empleo público%', '%seleccion de personal%', '%selección de personal%', '%condicion de funcionario%', '%condición de funcionario%'],
  'RDL 5/2015|69-84': ['%ordenacion de la actividad profesional%', '%ordenación de la actividad profesional%', '%planificacion de recursos humanos%', '%planificación de recursos humanos%', '%relaciones de puestos%', '%oferta de empleo%'],
  'RDL 5/2015|85-92': ['%provision de puestos%', '%provisión de puestos%', '%movilidad%', '%situaciones administrativas%'],
  'RDL 5/2015|14-54': ['%derechos y deberes%', '%codigo de conducta%', '%código de conducta%'],
  'Ley 39/2015|34-52': ['%actos administrativos%', '%acto administrativo%'],
  'Ley 39/2015|53-105': ['%procedimiento administrativo comun%', '%procedimiento administrativo común%', '%fases del procedimiento%', '%iniciacion%', '%instruccion%', '%instrucción%'],
  'Ley 39/2015|3-12': ['%interesados en el procedimiento%', '%los interesados%', '%capacidad de obrar%'],
  'LO 3/2018|19-27': ['%tratamientos concretos%', '%videovigilancia%', '%sistemas de informacion crediticia%'],
  'LO 3/2018|50-62': ['%autoridades de proteccion de datos%', '%autoridades de protección de datos%', '%agencia espanola de proteccion%', '%agencia española de protección%'],
  'LO 3/2007|14-35': ['%politicas publicas para la igualdad%', '%políticas públicas para la igualdad%', '%planes de igualdad%'],
  'LO 3/2007|36-41': ['%medios de comunicacion%', '%medios de comunicación%'],
  'Ley 7/1985|31-41': ['%la provincia%', '%diputacion%', '%diputación%'],
  'Ley 7/1985|78-88': ['%bienes de las entidades locales%', '%patrimonio de las entidades%'],
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const { gaps } = JSON.parse(fs.readFileSync(IN, 'utf8'))
  const byKey = new Map()
  for (const g of gaps) {
    const k = `${g.ley}|${g.rango}`
    let e = byKey.get(k)
    if (!e) byKey.set(k, e = { k, ley: g.ley, rango: g.rango, sec_title: g.sec_title, preguntas: g.preguntas, pts: [] })
    e.pts.push({ pt: g.pt, users: g.users })
  }

  if (!KEYS.length) {
    console.log('Clusters disponibles (ordenados por preguntas × oposiciones):\n')
    ;[...byKey.values()].sort((a, b) => b.preguntas * b.pts.length - a.preguntas * a.pts.length)
      .forEach(e => console.log(`  "${e.k}"`.padEnd(28) + `${String(e.preguntas).padStart(5)} preg × ${String(e.pts.length).padStart(2)} opos  ${e.sec_title || ''}`))
    return
  }

  const c = newClient()
  await c.connect()
  try {
    for (const key of KEYS) {
      const e = byKey.get(key)
      if (!e) { console.log(`\n⚠️  cluster "${key}" no encontrado`); continue }
      const pats = MATERIA[key]
      console.log(`\n\n${'='.repeat(78)}\n### ${key} — "${e.sec_title}"\n    ${e.preguntas} preguntas huérfanas · ${e.pts.length} oposiciones`)
      if (!pats) { console.log('    ⚠️ sin patrones de materia definidos — añádelos a MATERIA'); continue }

      const pts = e.pts.map(p => p.pt)
      const users = Object.fromEntries(e.pts.map(p => [p.pt, p.users]))
      const cond = pats.map((_, i) => `t.epigrafe ILIKE $${i + 2}`).join(' OR ')
      const r = (await c.query(
        `SELECT t.position_type pt, t.topic_number tn, left(t.epigrafe, 210) epi,
                (SELECT string_agg(DISTINCT l2.short_name, ', ') FROM topic_scope ts2
                 JOIN laws l2 ON l2.id = ts2.law_id WHERE ts2.topic_id = t.id) leyes
         FROM topics t
         WHERE t.is_active AND t.position_type = ANY($1) AND (${cond})
         ORDER BY t.position_type, t.topic_number`, [pts, ...pats])).rows

      console.log(`\n    → ${r.length} candidato(s) de ${e.pts.length} oposiciones (el resto: el programa NO lo pide)\n`)
      const seen = new Set()
      for (const x of r) {
        const tag = users[x.pt] ? `${users[x.pt]} usr` : '0 usr'
        console.log(`  ${x.pt} T${x.tn} (${tag}) [escopa: ${x.leyes || '-'}]`)
        console.log(`     ${(x.epi || '').replace(/\s+/g, ' ')}`)
        seen.add(x.pt)
      }
      const sin = e.pts.filter(p => !seen.has(p.pt))
      if (sin.length) console.log(`\n    Sin candidato (no tocar): ${sin.map(p => p.pt).join(', ')}`)
    }
  } finally { await c.end() }
}
main().catch(e => { console.error('❌', e.message); process.exitCode = 1 })
