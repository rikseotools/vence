#!/usr/bin/env node
/**
 * arbol-ley-boe.cjs — estructura LIBRO › TÍTULO › CAPÍTULO › artículos de una ley del BOE,
 * con la RÚBRICA VIGENTE de cada bloque. Herramienta de LECTURA para adjudicar sobre-inclusión
 * de scope; no escribe en BD.
 *
 *   node scripts/scope/arbol-ley-boe.cjs <BOE-ID|short_name> [--rubricas] [--json]
 *   node scripts/scope/arbol-ley-boe.cjs BOE-A-1882-6036 --rubricas
 *   node scripts/scope/arbol-ley-boe.cjs "LO 6/1985" --rubricas       (resuelve el id por BD)
 *
 * POR QUÉ EXISTE: `poblar-law-sections-boe.cjs` aplana la ley a una lista de secciones y RECHAZA
 * a propósito las leyes-código, porque sus títulos reinician por libro (T-104). Para adjudicar
 * un scope hace falta lo contrario: saber a qué (libro, título, capítulo) pertenece cada
 * artículo. La lógica vive en el núcleo puro `lib/laws/arbolLeyBoe.js`, testeada sin red.
 *
 * NUNCA teclees el id del BOE de memoria: pásale el `short_name` y lo resuelve de `laws.boe_url`.
 * Me costó un diagnóstico entero confundir las DOS "LO 14/2007" que existen (biomédica y
 * Estatuto de CyL).
 *
 * ⚠️ Normativa de la UE (RGPD, TUE, TFUE) NO está en la API del BOE consolidado: vive como
 * documento DOUE y este script no la cubre. Ver el runbook.
 */
const fs = require('fs')
const path = require('path')
const { construirArbol, articulosDe, resumenArbol } = require('../../lib/laws/arbolLeyBoe')
const { rubricaVigente } = require('../../lib/laws/parseBoeSections')

const CACHE = path.join(process.env.TMPDIR || '/tmp', 'arbol-ley-boe')
const clean = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function resolverBoeId(arg) {
  const directo = String(arg || '').match(/BOE-A-\d{4}-\d+/)
  if (directo) return directo[0]
  require('dotenv').config({ path: '.env.local' })
  const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
  const rows = await sql`SELECT short_name, boe_url FROM laws WHERE short_name = ${arg}`
  await sql.end()
  if (!rows.length) throw new Error(`no hay ninguna ley con short_name "${arg}"`)
  const id = (String(rows[0].boe_url).match(/BOE-A-\d{4}-\d+/) || [])[0]
  if (!id) throw new Error(`"${arg}" no tiene id del BOE consolidado en boe_url (${rows[0].boe_url}) — ¿normativa UE o autonómica?`)
  return id
}

async function bajar(url, fichero) {
  fs.mkdirSync(CACHE, { recursive: true })
  const f = path.join(CACHE, fichero)
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8')
  const r = await fetch(url, { headers: { Accept: 'application/xml' } })
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)   // fallar RUIDOSO: nunca seguir a ciegas
  const txt = await r.text()
  fs.writeFileSync(f, txt)
  await dormir(250)
  return txt
}

async function arbolDe(bid, conRubricas) {
  const xml = await bajar(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/indice`, `${bid}.indice.xml`)
  const bloques = [...xml.matchAll(/<bloque>\s*<id>([\s\S]*?)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)]
    .map((m) => ({ id: m[1].trim(), label: clean(m[2]) }))
  const arbol = construirArbol(bloques)
  const resumen = resumenArbol(arbol)
  // Un árbol vacío NO es "ley sin estructura": suele ser un índice que no se descargó entero.
  if (!resumen.ok) throw new Error(`árbol NO utilizable para ${bid}: ${resumen.motivo} (${bloques.length} bloques leídos)`)
  const rub = {}
  if (conRubricas) {
    const nodos = arbol.flatMap((L) => [L, ...L.titulos.flatMap((T) => [T, ...T.caps])]).filter((n) => n.id && n.id !== '-')
    for (const n of nodos) {
      try {
        const x = await bajar(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/bloque/${n.id}`, `${bid}.blk.${n.id}.xml`)
        rub[n.id] = rubricaVigente(x)?.rubrica || null
      } catch { rub[n.id] = null }
    }
  }
  return { arbol, rub, resumen, bloques: bloques.length }
}

async function main() {
  const args = process.argv.slice(2)
  const arg = args.find((a) => !a.startsWith('--'))
  if (!arg) { console.error('uso: arbol-ley-boe.cjs <BOE-ID|short_name> [--rubricas] [--json]'); process.exit(2) }
  const bid = await resolverBoeId(arg)
  const { arbol, rub, resumen, bloques } = await arbolDe(bid, args.includes('--rubricas'))
  if (args.includes('--json')) { console.log(JSON.stringify({ bid, resumen, arbol, rubricas: rub }, null, 1)); return }
  console.log(`📘 ${bid} · ${bloques} bloques · ${resumen.libros} libro(s) · ${resumen.titulos} título(s) · ${resumen.articulos} artículo(s)\n`)
  const rango = (as) => (as.length ? `${as[0].et}–${as[as.length - 1].et} [${as.length}]` : '(vacío)')
  for (const L of arbol) {
    if (L.num !== '—') console.log(`█ LIBRO ${L.num}${rub[L.id] ? '  — ' + rub[L.id] : ''}`)
    for (const T of L.titulos) {
      if (T.num !== '—') console.log(`   TÍTULO ${String(T.num).padEnd(9)} ${rango(articulosDe(T)).padEnd(22)} ${rub[T.id] || ''}`)
      for (const C of T.caps) console.log(`      cap. ${String(C.num).padEnd(9)} ${rango(C.arts).padEnd(22)} ${rub[C.id] || ''}`)
    }
  }
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
module.exports = { arbolDe, resolverBoeId }
