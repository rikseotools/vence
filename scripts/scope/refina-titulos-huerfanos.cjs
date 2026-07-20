#!/usr/bin/env node
/**
 * REFINAMIENTO del prefiltro `scope_titulo_huerfano` — separa hueco REAL de artefacto.
 *
 * Problema detectado al analizar el backlog (20/07): el criterio de "flanqueado a ambos
 * lados" del sweep usa solo min/max de los artículos escopados. Un ÚNICO artículo suelto
 * lejos del bloque principal basta para que TODOS los títulos intermedios parezcan
 * "hueco interno".
 *
 *   Caso real: auxiliar_administrativo_madrid escopa CE 0-55 (Tít. Preliminar + Tít. I,
 *   que es lo que su epígrafe pide: "Derechos y deberes fundamentales. Su garantía y
 *   suspensión") MÁS el art. 116 (estados de alarma/excepción/sitio, citado por la
 *   "suspensión"). Ese 116 pertenece al Título V → smax=116 → los Títulos II (Corona),
 *   III (Cortes) y IV (Gobierno) quedan "flanqueados" y saltan como huérfanos, cuando en
 *   realidad el programa de Madrid NO los incluye. 3 falsos positivos de un solo artículo.
 *
 * Métrica añadida: FUERZA DEL FLANCO = cuántos artículos escopados hay a cada lado del
 * título. Si un lado se sostiene sobre 1-2 artículos sueltos, el "hueco interno" es un
 * artefacto de la cola, no evidencia de que el programa cubra la ley de forma continua.
 *
 *   flanco_debil  (min(izq,der) <= 2) → probable FALSO POSITIVO, revisar al final
 *   flanco_fuerte (min(izq,der) >= 3) → el programa SÍ cubre la ley a ambos lados,
 *                                       el hueco es sospechoso de verdad → priorizar
 *
 * Señal independiente: ¿algún epígrafe de esa oposición NOMBRA la materia del título?
 * (match de palabras clave del título de sección contra topics.epigrafe). Si el epígrafe
 * lo nombra y no está escopado → hueco REAL casi seguro (es el caso raíz de Córdoba).
 *
 * Uso: node scripts/scope/refina-titulos-huerfanos.cjs <huerfanos.json> [--json <out>]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const fs = require('fs')

const IN = process.argv[2]
const jsonIdx = process.argv.indexOf('--json')
const JSON_OUT = jsonIdx > -1 ? process.argv[jsonIdx + 1] : null
if (!IN) { console.error('Uso: refina-titulos-huerfanos.cjs <huerfanos.json> [--json <out>]'); process.exit(2) }

// palabras vacías que no discriminan al buscar la materia del título en el epígrafe
const STOP = new Set(['titulo', 'title', 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'a', 'al', 'en',
  'por', 'para', 'con', 'su', 'sus', 'un', 'una', 'unos', 'unas', 'o', 'u', 'que', 'se', 'lo', 'otras', 'otros',
  'disposiciones', 'comunes', 'generales', 'general', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'])

const norm = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

function keywords(secTitle) {
  return norm(secTitle).split(' ').filter(w => w.length > 3 && !STOP.has(w))
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const { gaps } = JSON.parse(fs.readFileSync(IN, 'utf8'))
  const c = newClient()
  await c.connect()
  try {
    console.log('→ recalculando flancos y cruzando con epígrafes…')

    // scope por (pt, law) — set de artículos
    const scopeAll = (await c.query(`
      SELECT t.position_type pt, ts.law_id, ts.article_numbers
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
      WHERE ts.article_numbers IS NOT NULL AND t.is_active`)).rows
    const scopedByPtLaw = new Map()
    for (const r of scopeAll) {
      const k = r.pt + '|' + r.law_id
      let set = scopedByPtLaw.get(k); if (!set) scopedByPtLaw.set(k, set = new Set())
      for (const a of (r.article_numbers || [])) { const n = parseInt(a); if (!isNaN(n) && n > 0) set.add(n) }
    }

    // Epígrafes ATADOS a la ley: solo los de los temas que ESCOPAN esa ley.
    // (Agregar todos los epígrafes de la oposición en un blob da falsos positivos
    // masivos —validado 20/07—: "administración"+"estado" casan desde temas ajenos,
    // "El Gobierno de Canarias" casa con CE Tít.IV "Del Gobierno", "adquisición" de
    // patrimonio casa con EBEP "Adquisición de la relación de servicio". El vínculo
    // tema↔ley es lo que le da sentido al match.)
    const epiByPtLaw = new Map()
    for (const r of (await c.query(
      `SELECT t.position_type pt, ts.law_id,
              string_agg(coalesce(t.epigrafe,'') || ' ' || coalesce(t.title,''), ' ') epi
       FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
       WHERE t.is_active GROUP BY t.position_type, ts.law_id`)).rows) {
      epiByPtLaw.set(r.pt + '|' + r.law_id, norm(r.epi))
    }

    // nombre COMPLETO de la ley (para descontar sus palabras del match)
    const lawName = new Map()
    for (const r of (await c.query(`SELECT id, name, short_name FROM laws`)).rows) {
      lawName.set(r.id, `${r.name || ''} ${r.short_name || ''}`)
    }

    // Temas ya ADJUDICADOS por el pipeline verify:scope (verified_correct): si un
    // humano/pipeline ya dijo que el scope de ese tema casa con su epígrafe, un
    // "hueco" ahí es un recorte DELIBERADO, no un olvido. Validado 20/07 con
    // tramitacion_procesal T10 (protección de datos acotada a propósito el 19/07).
    const adjudicado = new Map()
    for (const r of (await c.query(`
      SELECT t.position_type pt, ts.law_id, bool_or(v.state='verified_correct') ok
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
      JOIN topic_scope_verification v ON v.topic_id = t.id
      WHERE t.is_active GROUP BY t.position_type, ts.law_id`)).rows) {
      adjudicado.set(r.pt + '|' + r.law_id, r.ok)
    }

    for (const g of gaps) {
      g.ley_nombre = lawName.get(g.law_id) || g.ley
      g.adjudicado = adjudicado.get(g.pt + '|' + g.law_id) === true
      const scoped = scopedByPtLaw.get(g.pt + '|' + g.law_id) || new Set()
      const [lo, hi] = g.rango.split('-').map(Number)
      let izq = 0, der = 0
      for (const a of scoped) { if (a < lo) izq++; else if (a > hi) der++ }
      g.flanco_izq = izq; g.flanco_der = der
      g.flanco = Math.min(izq, der)
      g.flanco_clase = g.flanco <= 2 ? 'debil' : 'fuerte'

      // El epígrafe se compara SIN el nombre de la propia ley: si no, "Ley 40/2015 de
      // Régimen Jurídico del SECTOR PÚBLICO" casa con el título "Sector público
      // institucional" sin que el programa lo pida (falso positivo real, Extremadura).
      let epi = epiByPtLaw.get(g.pt + '|' + g.law_id) || ''
      const lawWords = new Set(keywords(g.ley_nombre || ''))
      const kws = keywords(g.sec_title).filter(w => !lawWords.has(w))
      const hits = kws.filter(w => epi.includes(w))
      g.epigrafe_kw = kws
      g.epigrafe_hits = hits

      // SEÑAL FUERTE: la FRASE del título aparece casi literal en el epígrafe.
      // Validado 20/07: es lo que distingue el hueco real (admin_seguridad_social, cuyo
      // T7 dice literalmente "Relaciones entre el Gobierno y las Cortes Generales" con el
      // Tít.V sin escopar) del ruido de bolsa-de-palabras (Cádiz casaba "entidades
      // locales" desde "bienes de las entidades locales", de otro tema).
      const frase = norm(g.sec_title).replace(/^titulo\s+[ivx]+\s*/, '').replace(/^(de|del|la|las|los|el)\s+/, '').trim()
      const fw = frase.split(' ').filter(w => w.length > 3 && !STOP.has(w) && !lawWords.has(w))
      // ventana deslizante: ¿aparecen >=80% de las palabras de la frase, juntas y en orden?
      let frasal = false
      if (fw.length >= 2) {
        const idxs = fw.map(w => epi.indexOf(w))
        const found = idxs.filter(i => i >= 0)
        if (found.length >= Math.ceil(fw.length * 0.8)) {
          const span = Math.max(...found) - Math.min(...found)
          if (span <= 90) frasal = true // aparecen agrupadas, no dispersas por el blob
        }
      }
      g.frase_literal = frasal
      g.epigrafe_nombra = frasal || (kws.length > 0 && hits.length === kws.length && kws.length >= 3)
    }

    const fuerte = gaps.filter(g => g.flanco_clase === 'fuerte')
    const debil = gaps.filter(g => g.flanco_clase === 'debil')
    console.log(`\n========== REFINAMIENTO de ${gaps.length} títulos huérfanos ==========`)
    console.log(`\nFLANCO DÉBIL  (<=2 artículos a un lado → probable artefacto de cola): ${debil.length}  (${(debil.length / gaps.length * 100).toFixed(0)}%)`)
    console.log(`FLANCO FUERTE (>=3 a ambos lados → hueco sospechoso de verdad):      ${fuerte.length}  (${(fuerte.length / gaps.length * 100).toFixed(0)}%)`)

    const nombra = gaps.filter(g => g.epigrafe_nombra)
    const frasal = gaps.filter(g => g.frase_literal)
    const yaAdj = gaps.filter(g => g.adjudicado)
    // ⚠️ `adjudicado` es BANDERA, NO filtro. Tentación (y error) del 20/07: excluir los
    // (pt,ley) ya `verified_correct` por verify:scope asumiendo que el recorte fue
    // deliberado. Eso ESCONDE justo lo que este detector existe para cazar: es el PUNTO
    // CIEGO del pipeline. Caso probado: administrativo_seguridad_social tiene sus temas de
    // CE en verified_correct y aun así el Tít.V (108-116, 227 preguntas) no está escopado
    // en ninguno, pese a que el epígrafe del T7 dice literalmente "Relaciones entre el
    // Gobierno y las Cortes Generales". Filtrarlo lo habría enterrado.
    const prio = gaps.filter(g => g.flanco_clase === 'fuerte' && g.epigrafe_nombra)
    console.log(`\nEl EPÍGRAFE nombra la materia del título:                             ${nombra.length}`)
    console.log(`  · de ellos, con FRASE LITERAL del título (señal fuerte):            ${frasal.length}`)
    console.log(`Ya ADJUDICADOS por verify:scope (recorte deliberado → excluir):        ${yaAdj.length}`)
    console.log(`\n🔴 PRIORIDAD MÁXIMA (flanco fuerte + epígrafe lo nombra + no adjudicado): ${prio.length}`)

    const rank = (arr) => [...arr].sort((a, b) => (b.users * b.preguntas) - (a.users * a.preguntas))

    console.log(`\n---------- 🔴 HUECOS REALES (flanco fuerte + epígrafe lo nombra) ----------`)
    rank(prio).slice(0, 30).forEach((g, i) => {
      console.log(`${String(i + 1).padStart(2)}. ${g.pt}`)
      console.log(`    ${g.ley} Tít.${g.titulo} (${g.rango}) "${(g.sec_title || '').slice(0, 60)}"`)
      console.log(`    ${g.preguntas} preg · ${g.users} usr/${g.prem} prem · flanco ${g.flanco_izq}←→${g.flanco_der}${g.frase_literal ? " · 🎯 FRASE LITERAL" : ""} · casa: ${g.epigrafe_hits.join(",")}`)
    })

    console.log(`\n---------- 🟠 SOSPECHOSOS (flanco fuerte, epígrafe NO lo nombra) ----------`)
    const sosp = fuerte.filter(g => !g.epigrafe_nombra)
    console.log(`(${sosp.length} — el programa cubre la ley a ambos lados pero no nombra esta materia: revisar contra programa oficial)\n`)
    rank(sosp).slice(0, 15).forEach((g, i) => {
      console.log(`${String(i + 1).padStart(2)}. ${g.pt} · ${g.ley} Tít.${g.titulo} (${g.rango}) "${(g.sec_title || '').slice(0, 45)}" · ${g.preguntas} preg · ${g.users} usr · flanco ${g.flanco_izq}←→${g.flanco_der}`)
    })

    console.log(`\n---------- ⚪ ARTEFACTOS DE COLA (flanco débil) ----------`)
    const porArtefacto = new Map()
    for (const g of debil) {
      const k = `${g.pt} · ${g.ley}`
      let e = porArtefacto.get(k); if (!e) porArtefacto.set(k, e = { k, n: 0, preg: 0, ej: g })
      e.n++; e.preg += g.preguntas
    }
    const arte = [...porArtefacto.values()].sort((a, b) => b.n - a.n)
    console.log(`${debil.length} filas generadas por ${arte.length} combinaciones (pt,ley) con cola suelta.`)
    console.log(`Top generadores de ruido:\n`)
    arte.slice(0, 12).forEach((e, i) => {
      console.log(`${String(i + 1).padStart(2)}. ${e.k.padEnd(56)} ${e.n} títulos falsos · flanco ${e.ej.flanco_izq}←→${e.ej.flanco_der}`)
    })

    if (JSON_OUT) {
      fs.writeFileSync(JSON_OUT, JSON.stringify({ prio, sosp, debil }, null, 1))
      console.log(`\n✅ JSON → ${JSON_OUT}`)
    }
  } finally { await c.end() }
}
main().catch(e => { console.error('❌', e.message); process.exitCode = 1 })
