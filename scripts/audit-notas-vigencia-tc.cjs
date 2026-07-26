#!/usr/bin/env node
/**
 * Audita las NOTAS DE VIGENCIA del Tribunal Constitucional que el BOE consolidado cuelga
 * de cada artículo, y las cruza con lo que NOSOTROS servimos.
 *
 * Uso:  node scripts/audit-notas-vigencia-tc.cjs <short_name de la ley> [--todos] [--json]
 *       node scripts/audit-notas-vigencia-tc.cjs "Ley 9/2017"
 *       exit 0 sin hallazgos · 1 con hallazgos · 2 error de uso
 *
 * POR QUÉ NO BASTA CON `audit-annulled-provisions.cjs` (T-132, 26/07/2026). Aquel lee el
 * **análisis** del BOE (`referencias.posteriores`) y solo caza la fórmula de NULIDAD. Deja
 * fuera los pronunciamientos COMPETENCIALES ("no es conforme con el orden constitucional
 * de competencias"), que ni contienen "inconstitucional" ni —y esto es lo decisivo— vienen
 * enumerados por artículo en el análisis: para la LCSP el análisis dice literalmente "y no
 * conforme con el orden constitucional de competencias LO INDICADO", sin decir qué.
 *
 * El dato por-artículo SOLO está en la nota del texto consolidado. De ahí que este script
 * vaya bloque a bloque en vez de leer el resumen: es más caro, pero es donde está el dato.
 *
 * Por defecto audita solo los artículos que ALGÚN topic_scope activo sirve (que son los
 * que pueden acabar en una pregunta). Con `--todos`, la ley entera.
 */
require('dotenv').config({ path: '.env.local' })
const path = require('path')
const { Client } = require('pg')
const { bloqueVigente, mapaBloquesPorArticulo } = require(path.join(__dirname, '..', 'lib', 'laws', 'boeBloqueVigente'))
const {
  clasificarNotaVigencia,
  contentReflejaCompetencial,
} = require(path.join(__dirname, '..', 'lib', 'laws', 'notaVigenciaTc'))
const { articleCarriesVigenciaNote } = (() => {
  // annulledProvisions es TS; se replica aquí el único check que hace falta para la clase
  // `nulidad`, con la MISMA semántica (ver lib/laws/annulledProvisions.ts).
  return {
    articleCarriesVigenciaNote: (content) => {
      const t = content || ''
      if (/nota\s+de\s+vigencia/i.test(t)) return true
      return /declarad[oa]s?\b[\s\S]{0,60}\b(?:inconstitucional|nul)[\s\S]{0,80}\b(?:STC|Sentencia)\s+\d+\/\d{4}/i.test(t)
    },
  }
})()

const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id'
const LEY = process.argv[2]
const TODOS = process.argv.includes('--todos')
const AS_JSON = process.argv.includes('--json')
if (!LEY) {
  console.error('uso: node scripts/audit-notas-vigencia-tc.cjs "<short_name>" [--todos] [--json]')
  process.exit(2)
}

const fetchTexto = async (url) => {
  const r = await fetch(url, { headers: { Accept: 'application/xml' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`)
  return r.text()
}

;(async () => {
  const c = new Client({
    connectionString: (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const ley = (await c.query('SELECT id, short_name, name, boe_url FROM laws WHERE short_name = $1', [LEY])).rows[0]
  if (!ley) {
    console.error(`ley no encontrada: ${LEY}`)
    process.exit(2)
  }
  const boeId = (ley.boe_url || '').match(/\b(BOE-[A-Z]-\d{4}-\d+)\b/)?.[1]
  if (!boeId) {
    console.error(`la ley ${LEY} no tiene un BOE-ID reconocible en boe_url (${ley.boe_url})`)
    process.exit(2)
  }

  // Artículos a auditar: los que se SIRVEN (algún topic_scope activo), salvo --todos.
  const arts = (
    await c.query(
      TODOS
        ? `SELECT a.article_number n, a.content, a.vigencia_notes FROM articles a WHERE a.law_id=$1 AND a.is_active ORDER BY a.article_number`
        : `SELECT DISTINCT a.article_number n, a.content, a.vigencia_notes
           FROM articles a
           JOIN topic_scope ts ON ts.law_id = a.law_id
                               AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
           JOIN topics t ON t.id = ts.topic_id AND t.is_active
           WHERE a.law_id=$1 AND a.is_active
           ORDER BY a.article_number`,
      [ley.id],
    )
  ).rows
  await c.end()

  // `--json` tiene que salir LIMPIO: es la entrada de otros scripts. Sin esto, el
  // encabezado se cuela delante del JSON y `require()`/`jq` revientan.
  if (!AS_JSON) console.log(`\n━━━ ${ley.short_name} (${boeId}) — ${arts.length} artículo(s) ${TODOS ? 'de la ley' : 'servidos'}`)

  const indice = await fetchTexto(`${API}/${boeId}/texto/indice`)
  const mapa = mapaBloquesPorArticulo(indice)

  const hallazgos = []
  let conNota = 0
  let sinBloque = 0
  for (const a of arts) {
    const bid = mapa[a.n]
    if (!bid) { sinBloque++; continue }
    let b
    try {
      b = bloqueVigente(await fetchTexto(`${API}/${boeId}/texto/bloque/${bid}`))
    } catch { sinBloque++; continue }
    if (!b || !b.notaVigencia) continue
    conNota++
    const cl = clasificarNotaVigencia(b.notaVigencia)
    if (cl.clase !== 'nulidad' && cl.clase !== 'competencial') continue

    // "Ya marcado" hay que mirarlo en los DOS sitios: el sistema canónico de T-048
    // persiste las notas en `articles.vigencia_notes` (JSONB), y algunos artículos las
    // llevan embebidas en el propio `content`. Mirar solo uno haría que la remediación
    // por la vía buena no apagase el hallazgo — el detector seguiría gritando.
    const notasBd = JSON.stringify(a.vigencia_notes || '')
    const yaEnNotas = cl.refBoe ? notasBd.includes(cl.refBoe) : false
    const yaMarcado =
      yaEnNotas ||
      (cl.clase === 'competencial' ? contentReflejaCompetencial(a.content) : articleCarriesVigenciaNote(a.content))
    if (yaMarcado) continue

    hallazgos.push({
      articulo: a.n,
      clase: cl.clase,
      sentencia: cl.sentencia,
      refBoe: cl.refBoe,
      apartados: cl.apartados,
      nota: cl.nota,
    })
  }

  // ── CAPA ANTI-FALSO-VERDE ──────────────────────────────────────────────────────
  // Un artículo cuyo bloque no se localiza en el índice del BOE NO se ha comprobado.
  // Si son muchos, decir "0 hallazgos" es mentir por omisión: fue justo lo que pasó el
  // 26/07 con la LOPJ (665 de 665 sin bloque, informe "limpio"). Por encima del umbral el
  // resultado se declara NO CONCLUYENTE y el exit code lo refleja.
  const ratioCiego = arts.length ? sinBloque / arts.length : 0
  const noConcluyente = ratioCiego > 0.2

  if (AS_JSON) {
    console.log(JSON.stringify({ ley: ley.short_name, boeId, auditados: arts.length, conNota, sinBloque, ratioCiego: Number(ratioCiego.toFixed(3)), noConcluyente, hallazgos }, null, 2))
  } else {
    console.log(`    con nota de vigencia: ${conNota} · sin bloque en el BOE: ${sinBloque}`)
    if (!hallazgos.length) console.log('  ✅ ningún artículo servido sin reflejar su pronunciamiento del TC')
    for (const h of hallazgos) {
      const icono = h.clase === 'nulidad' ? '🔴' : '🟠'
      console.log(`  ${icono} art. ${h.articulo} [${h.clase}] ${h.sentencia || ''} ${h.refBoe || ''}`)
      console.log(`      ${h.nota}`)
      console.log(
        h.clase === 'nulidad'
          ? '      → el inciso NO existe: revisar la clave de las preguntas de ese artículo.'
          : '      → NO es nulo: es inaplicable como básico / en CCAA con competencia propia. Procede NOTA DE VIGENCIA, no jubilar preguntas.',
      )
    }
    console.log(`\n=== ${hallazgos.filter((h) => h.clase === 'nulidad').length} 🔴 nulidad / ${hallazgos.filter((h) => h.clase === 'competencial').length} 🟠 competencial ===`)
    if (noConcluyente) {
      console.log(
        `\n⚠️  RESULTADO NO CONCLUYENTE: ${sinBloque} de ${arts.length} artículos (${(ratioCiego * 100).toFixed(0)}%) no se pudieron localizar en el índice del BOE.\n` +
          '    Esos artículos NO se han comprobado — no interpretar la ausencia de hallazgos como "limpio".\n' +
          '    Causa habitual: numeración que el índice escribe de otra forma. Revisar mapaBloquesPorArticulo.',
      )
    }
  }
  // exit 1 también si el barrido no es concluyente: un gate no puede pasar en verde
  // sobre una comprobación que no se ha hecho.
  process.exit(hallazgos.length || noConcluyente ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
