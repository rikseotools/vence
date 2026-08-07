#!/usr/bin/env node
'use strict'
/**
 * sim-capitulo-bankwide.cjs — medición BANK-WIDE del nivel CAPÍTULO anidado (T-467, 07/08/2026).
 *
 * Complementa `scripts/scope/sim-title-boundary.ts`, que ya prueba capítulo POR ORDEN
 * (`npx tsx … <position_type> [topic]`) desde que este mismo cambio lo wireó. Este script
 * recorre TODO el banco en UN SOLO proceso Node (caches de BOE compartidas entre oposiciones
 * que citan la misma ley — la clave de por qué el runner por posición sería carísimo a escala)
 * y reporta trocedo por TAMAÑO, siguiendo el mismo criterio que T-121 fijó para el nivel
 * externo: 1-2 artículos = frontera real que merece adjudicarse; 3+ = más probablemente
 * sobre-inclusión de otro tipo (otra frase-gatillo, no ésta).
 *
 * Mide SOLO el nivel capítulo-anidado-en-título — no repite título/sección/subsección, que ya
 * midió T-121/T-333. El número que importa aquí es CUÁNTO AÑADE el nivel capítulo que los
 * demás niveles no veían.
 *
 * Uso:  node scripts/scope/sim-capitulo-bankwide.cjs [--json]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { parseBoeSectionsMultinivel } = require('../../lib/laws/parseBoeSections.js')
const { classifyByRubricaOnly, resumenBarrida } = require('../../lib/laws/scopeTitleBoundary.js')

const JSON_OUT = process.argv.includes('--json')
const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const boeId = (u) => (String(u || '').match(/BOE-A-\d{4}-\d+/) || [])[0]

const bloquesCache = new Map()
async function bloquesBoe(bid) {
  if (bloquesCache.has(bid)) return bloquesCache.get(bid)
  const idx = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/indice`, { headers: { Accept: 'application/xml' } })).text()
  const bl = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)].map((m) => ({ id: m[1].trim(), label: clean(m[2]) }))
  bloquesCache.set(bid, bl)
  return bl
}

/**
 * Capítulos ANIDADOS, agrupados por su TÍTULO padre (por rango: el capítulo cae DENTRO del
 * título). NUNCA se prueban todos los capítulos de la ley en un solo `classifyTitleBoundary`:
 * los números de capítulo son ROMANOS, igual que los de título, y se REINICIAN en cada título
 * ("Título V, Capítulo I" y "Título III, Capítulo I" son el MISMO num='I'). Medido en directo:
 * pasar todos los capítulos juntos hace que un "Título III" mencionado por NÚMERO en el
 * epígrafe (para OTRA materia) case por casualidad con "Capítulo III" de un título totalmente
 * distinto — allowedTitles mezcla dos espacios de numeración que no tienen nada que ver.
 * Aislar por título padre es lo único que evita la colisión.
 *
 * @returns {Array<{tituloNum:string, capitulos:Seccion[]}>}
 */
const capituloAnidadoCache = new Map()
async function gruposCapituloPorTitulo(bid) {
  if (capituloAnidadoCache.has(bid)) return capituloAnidadoCache.get(bid)
  const bl = await bloquesBoe(bid)
  const { niveles } = parseBoeSectionsMultinivel(bl)
  const titulo = niveles.find((n) => n.tipo === 'titulo')
  const capitulo = niveles.find((n) => n.tipo === 'capitulo')
  const grupos = []
  if (titulo && capitulo) {
    for (const t of titulo.secciones) {
      const propios = capitulo.secciones.filter((c) => c.from >= t.from && c.to <= t.to)
      if (propios.length) grupos.push({ tituloNum: t.num, capitulos: propios })
    }
  }
  capituloAnidadoCache.set(bid, grupos)
  return grupos
}

const rubricaCache = new Map()
async function rubricaBoe(bid, blockId) {
  const key = `${bid}#${blockId}`
  if (rubricaCache.has(key)) return rubricaCache.get(key)
  let r = ''
  try {
    const xml = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/bloque/${blockId}`, { headers: { Accept: 'application/xml' } })).text()
    const { rubricaVigente } = require('../../lib/laws/parseBoeSections.js')
    r = rubricaVigente(xml)?.rubrica || ''
  } catch { r = '' }
  rubricaCache.set(key, r)
  return r
}

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  const posiciones = (await c.query(
    `SELECT DISTINCT position_type FROM topics WHERE is_active ORDER BY 1`)).rows.map((r) => r.position_type)

  let temasTotal = 0, evaluados = 0, sinBoeId = 0, sinArts = 0, fetchFail = 0, sinCapituloAnidado = 0
  const hallazgos = [] // { pt, topic_number, title, law, overflow: [{article, titulo}] }

  for (const pt of posiciones) {
    const temas = (await c.query(
      `SELECT id, topic_number, title, epigrafe FROM topics WHERE position_type=$1 AND is_active ORDER BY topic_number`,
      [pt])).rows
    temasTotal += temas.length
    for (const t of temas) {
      const scopes = (await c.query(
        `SELECT l.id AS law_id, l.short_name, l.name AS law_name, l.boe_url, ts.article_numbers,
                ts.article_numbers IS NULL AS es_null
           FROM topic_scope ts JOIN laws l ON l.id = ts.law_id WHERE ts.topic_id = $1`,
        [t.id])).rows
      for (const s of scopes) {
        const bid = boeId(s.boe_url)
        if (!bid) { sinBoeId++; continue }
        let arts
        if (s.es_null) {
          arts = (await c.query(
            `SELECT article_number FROM articles WHERE law_id=$1 AND is_active`, [s.law_id]
          )).rows.map((a) => String(a.article_number))
        } else arts = s.article_numbers || []
        if (!arts.length) { sinArts++; continue }

        let grupos
        try { grupos = await gruposCapituloPorTitulo(bid) } catch { fetchFail++; continue }
        if (!grupos.length) { sinCapituloAnidado++; continue }
        evaluados++

        const overflowTotal = []
        for (const g of grupos) {
          // AISLADO por título padre Y por RÚBRICA únicamente (classifyByRubricaOnly, no
          // classifyTitleBoundary): los números romanos de capítulo y título comparten alfabeto,
          // así que comparar por NÚMERO produce falsos positivos/exenciones por casualidad —
          // medido en directo, ver el comentario de cabecera de classifyByRubricaOnly.
          const enriched = []
          for (const s2 of g.capitulos) enriched.push({ ...s2, rubrica: s2.blockId ? await rubricaBoe(bid, s2.blockId) : '' })
          const r = classifyByRubricaOnly(t.epigrafe, enriched, arts)
          if (r.applicable && r.overflow.length) overflowTotal.push(...r.overflow)
        }
        if (overflowTotal.length) {
          hallazgos.push({ pt, topic_number: t.topic_number, title: t.title, law: s.short_name, overflow: overflowTotal })
        }
      }
    }
  }
  await c.end()

  const flagged = hallazgos.length
  const veredicto = resumenBarrida({ temas: temasTotal, evaluados, fetchFail, flagged })

  const pequenos = hallazgos.filter((h) => h.overflow.length <= 2) // T-121: frontera real
  const grandes = hallazgos.filter((h) => h.overflow.length >= 3)  // T-121: más bien sobre-inclusión

  if (JSON_OUT) {
    console.log(JSON.stringify({ temasTotal, evaluados, sinBoeId, sinArts, fetchFail, sinCapituloAnidado, flagged, pequenos, grandes, veredicto }, null, 2))
  } else {
    console.log(`\n📊 ${temasTotal} tema(s) en ${posiciones.length} oposición(es) · ${evaluados} scope(s) con capítulo ANIDADO evaluado(s)`)
    console.log(`   omitidos: ${sinBoeId} sin id BOE, ${sinArts} sin artículos, ${fetchFail} sin índice, ${sinCapituloAnidado} sin capítulo anidado (título único o capítulo=nivel externo)`)
    console.log(`\n   ${flagged} hallazgo(s) con overflow a nivel capítulo:`)
    console.log(`     · 1-2 artículos (frontera real, T-121): ${pequenos.length}`)
    for (const h of pequenos) console.log(`        - ${h.pt} T${h.topic_number} (${h.title}) · ${h.law}: ${h.overflow.map((o) => `art.${o.article}→Cap.${o.titulo}`).join(', ')}`)
    console.log(`     · 3+ artículos (más bien sobre-inclusión, otra frase-gatillo): ${grandes.length}`)
    for (const h of grandes.slice(0, 10)) console.log(`        - ${h.pt} T${h.topic_number} (${h.title}) · ${h.law}: ${h.overflow.length} arts`)
    if (grandes.length > 10) console.log(`        …y ${grandes.length - 10} más`)
    console.log(`\n   veredicto: ${veredicto.veredicto} (concluyente: ${veredicto.concluyente})`)
  }
  process.exit(veredicto.exitCode || 0)
})().catch((e) => { console.error(e); process.exit(1) })
