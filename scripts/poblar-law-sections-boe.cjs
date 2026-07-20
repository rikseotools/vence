#!/usr/bin/env node
/**
 * poblar-law-sections-boe.cjs — puebla `law_sections` (títulos/capítulos) de una ley
 * desde la ESTRUCTURA OFICIAL del BOE consolidado (T-012).
 *
 * Uso:
 *   node scripts/poblar-law-sections-boe.cjs --law "LPRL"              # dry-run
 *   node scripts/poblar-law-sections-boe.cjs --law "LPRL" --apply      # inserta
 *   node scripts/poblar-law-sections-boe.cjs --sweep --limit 40        # dry-run de un lote
 *   node scripts/poblar-law-sections-boe.cjs --sweep --limit 40 --apply
 *
 * Fuente: API de datos abiertos del BOE. Requiere `Accept: application/xml`
 * (con json devuelve 400 — ver reference_extraccion_boletines_oficiales).
 *
 * CONVENCIÓN (verificada contra las 13 leyes ya pobladas, 20/07):
 *   - Se usa el nivel TÍTULO si la ley tiene títulos; si no, CAPÍTULO. Un solo nivel,
 *     sin solapes. Las 13 leyes existentes usan títulos con rúbrica "Título I. <nombre>".
 *
 * ROBUSTEZ (cada punto salió de un fallo real medido con --sweep, 4 iteraciones):
 *   - El nº de artículo se saca del <titulo> del bloque ("Artículo 10"), NUNCA del id:
 *     el BOE desambigua ids repetidos con sufijo (`a1-2` = artículo 10, no el 1). Fiarse
 *     del id daba rangos FALSOS que parecían cuadrar.
 *   - Ids de sección romanos Y textuales (ti / tpreliminar / tprimero).
 *   - Cada artículo se asigna al título precedente más cercano → maneja el anidamiento
 *     (un título con capítulos dentro recibe los artículos de sus capítulos).
 *   - Cruza cada rango con los artículos REALES en BD; si un rango queda vacío o hay
 *     solape, NO inserta esa ley (desalineación → revisión humana), nunca mete basura.
 *   - Idempotente. Nunca usa el "art 0 — Estructura" sintético.
 */
require('dotenv').config({ path: '.env.local' })
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })

const XML = { headers: { Accept: 'application/xml' } }
const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const boeId = (u) => (String(u || '').match(/BOE-A-\d{4}-\d+/) || [])[0]

// La lógica de parseo (qué es título/capítulo/artículo, de dónde sale el nº) vive en el
// módulo PURO lib/laws/parseBoeSections, testeado en __tests__/laws/parseBoeSections.
// Aquí solo queda lo que necesita red (fetch del índice + rúbrica).
const { parseBoeSections } = require('../lib/laws/parseBoeSections')

/** Rúbrica descriptiva de un título/capítulo: viene DENTRO de su bloque, tras el
 *  encabezado "TÍTULO I". Fetch extra por sección (por eso se hace solo al aplicar). */
async function rubrica(bid, blockId) {
  try {
    const body = clean(await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/bloque/${blockId}`, XML)).text())
    const m = body.match(/(?:CAP[IÍ]TULO|T[IÍ]TULO|LIBRO|PARTE)\s+[IVXLCDM]+\.?\s+([^.]{3,140})/i)
    return m ? m[1].trim().replace(/\s+/g, ' ') : null
  } catch { return null }
}

async function estructura(bid, { conRubrica = false } = {}) {
  const idx = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/indice`, XML)).text()
  const bl = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)].map((m) => ({ id: m[1].trim(), label: clean(m[2]) }))
  const { tipo, secciones } = parseBoeSections(bl)
  const out = secciones.map((s) => ({ tipo, blockId: s.blockId, num: s.num, from: s.from, to: s.to }))
  if (conRubrica) for (const s of out) { s.rubrica = await rubrica(bid, s.blockId) }
  return out
}

/** Devuelve {ok, secs, motivo} tras validar contra los artículos reales de la ley. */
async function validar(lawId, secs) {
  if (!secs.length) return { ok: false, motivo: 'sin_secciones' }
  for (const s of secs) {
    const n = (await sql`SELECT count(*)::int c FROM articles WHERE law_id=${lawId} AND article_number ~ '^[0-9]+$' AND article_number::int BETWEEN ${s.from} AND ${s.to}`)[0].c
    if (n === 0) return { ok: false, motivo: `rango_vacio(${s.num}:${s.from}-${s.to})` }
  }
  for (let i = 0; i < secs.length; i++) for (let j = i + 1; j < secs.length; j++) if (secs[i].from <= secs[j].to && secs[j].from <= secs[i].to) return { ok: false, motivo: 'solape' }
  return { ok: true, secs }
}

async function insertar(lawId, secs, tipo) {
  const nombreTipo = tipo === 'titulo' ? 'Título' : 'Capítulo'
  // TODO-o-nada: una ley entra entera o no entra. Sin transacción, un slug repetido a
  // mitad dejaba la ley a medias (bug real: RD 137/1993 quedó con 1 de N secciones).
  return sql.begin(async (tx) => {
    let i = 0
    for (const s of secs) {
      const title = s.rubrica ? `${nombreTipo} ${s.num}. ${s.rubrica}` : `${nombreTipo} ${s.num}`
      // slug ÚNICO GLOBAL (law_sections_slug_key): incluye el law_id, si no "titulo-i"
      // colisiona en cuanto una 2ª ley tiene un "Título I".
      const slug = `${lawId.slice(0, 8)}-${tipo}-${String(s.num).toLowerCase()}`
      await tx`INSERT INTO law_sections (law_id, section_type, section_number, title, description, article_range_start, article_range_end, slug, order_position, is_active, created_at, updated_at)
        VALUES (${lawId}, ${tipo}, ${s.num}, ${title}, NULL, ${s.from}, ${s.to}, ${slug}, ${++i}, true, now(), now())`
    }
    return i
  })
}

async function procesarLey(l, { apply }) {
  const bid = boeId(l.boe_url)
  if (!bid) return { slug: l.short_name, estado: 'no_boe' }
  const ya = (await sql`SELECT count(*)::int n FROM law_sections WHERE law_id=${l.id}`)[0].n
  if (ya > 0) return { slug: l.short_name, estado: 'ya_poblada', n: ya }
  const secs = await estructura(bid, { conRubrica: apply })
  const v = await validar(l.id, secs)
  if (!v.ok) return { slug: l.short_name, estado: 'rechazada', motivo: v.motivo, n: secs.length }
  if (!apply) return { slug: l.short_name, estado: 'lista', n: secs.length, tipo: secs[0].tipo }
  const n = await insertar(l.id, secs, secs[0].tipo)
  return { slug: l.short_name, estado: 'insertada', n, tipo: secs[0].tipo }
}

;(async () => {
  const apply = process.argv.includes('--apply')
  const sweep = process.argv.includes('--sweep')
  const limit = parseInt(process.argv[process.argv.indexOf('--limit') + 1] || '40', 10)

  let leyes
  if (sweep) {
    leyes = await sql`
      SELECT DISTINCT l.short_name, l.id, l.boe_url, (SELECT count(*)::int FROM articles a WHERE a.law_id=l.id) arts
      FROM laws l JOIN topic_scope ts ON ts.law_id=l.id JOIN topics t ON t.id=ts.topic_id AND t.is_active=true
      WHERE l.is_active=true AND coalesce(l.is_virtual,false)=false AND l.boe_url ~ 'BOE-A-'
        AND (SELECT count(*) FROM articles a WHERE a.law_id=l.id) >= 20
        AND (SELECT count(*) FROM law_sections s WHERE s.law_id=l.id) = 0
      ORDER BY arts DESC LIMIT ${limit}`
  } else {
    const law = process.argv[process.argv.indexOf('--law') + 1] || ''
    if (!law) { console.error('uso: --law "<short_name>" [--apply]  |  --sweep --limit N [--apply]'); process.exit(1) }
    leyes = await sql`SELECT short_name, id, boe_url FROM laws WHERE short_name=${law} AND is_active=true`
    if (!leyes.length) { console.error(`ley no encontrada: ${law}`); process.exit(1) }
  }

  const cont = { insertada: 0, lista: 0, rechazada: 0, ya_poblada: 0, no_boe: 0 }
  for (const l of leyes) {
    const r = await procesarLey(l, { apply }).catch((e) => ({ slug: l.short_name, estado: 'error', motivo: e.message.slice(0, 40) }))
    cont[r.estado] = (cont[r.estado] || 0) + 1
    const tag = { insertada: '✅', lista: '·', rechazada: '⚠️', ya_poblada: '=', no_boe: '×', error: '✗' }[r.estado] || '?'
    console.log(`  ${tag} ${String(r.slug).slice(0, 44).padEnd(46)} ${r.estado}${r.n != null ? ` (${r.n}${r.tipo ? ' ' + r.tipo : ''})` : ''}${r.motivo ? ' — ' + r.motivo : ''}`)
  }
  console.log('\nresumen:', JSON.stringify(cont))
  await sql.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
