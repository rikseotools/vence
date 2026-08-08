#!/usr/bin/env node
/**
 * scripts/oposiciones/importar-anexos-boe.cjs — importa los ANEXOS (y opcionalmente las
 * DISPOSICIONES) de una norma consolidada del BOE, VERBATIM, para cualquier ley de nuestra BD.
 *
 * ## POR QUÉ (T-726, 08/08/2026) — el mismo usuario, la segunda ley
 *
 * `casterpepe76` avisó el 07/08 de que el RD 486/1997 servía los anexos «resumidos» ([T-676]) y,
 * al día siguiente, de que **al RD 485/1997 le pasaba lo mismo**. Medido contra el BOE: de esa
 * norma teníamos los 6 artículos y NINGUNO de sus 7 anexos ni sus 4 disposiciones — **34.714
 * caracteres, el 85% del texto**, y son la parte que se examina (colores de seguridad, formas de
 * los paneles, señales gestuales).
 *
 * Que el mismo aviso llegue dos veces es lo que convierte esto en herramienta: el script de
 * [T-676] resolvía UNA ley con sus bloques escritos a mano. Este descubre los bloques del índice
 * consolidado, así que sirve para la siguiente sin tocar código. La causa raíz está documentada
 * desde hace tiempo en `docs/maintenance/monitoreo-boe-y-crear-leyes-nuevas.md` («Limitación 1 —
 * Anexos no se importan»): esta es la pieza que la repara caso a caso.
 *
 * ## POR QUÉ LA API Y NO EL HTML
 *
 * `act.php` sirve la norma entera en una página: para sacar un anexo hay que recortar por
 * marcadores, y ahí es donde se cuelan los resúmenes y los cortes a mitad de frase — que es
 * exactamente el defecto que este script repara. La API devuelve **el bloque** ya delimitado por
 * el BOE. ⚠️ Exige `Accept: application/xml`: sin esa cabecera responde 400 «No soportado ningún
 * mime type» con un cuerpo XML de 187 bytes que parece una descarga válida si solo miras el código.
 *
 * ## LA COMPROBACIÓN QUE HACE QUE ESTO SEA FIABLE
 *
 * Tras escribir, **relee de la BD y compara carácter a carácter contra lo descargado**. Importar y
 * decir «ya está» es lo que produjo el estado actual; lo que vale es el contraste, no la intención.
 *
 * Uso:
 *   node scripts/oposiciones/importar-anexos-boe.cjs --ley "485/1997"                    (dry-run)
 *   node scripts/oposiciones/importar-anexos-boe.cjs --ley "485/1997" --disposiciones --apply
 *   node scripts/oposiciones/importar-anexos-boe.cjs --ley "485/1997" --boe-id BOE-A-1997-8668
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const https = require('https')
// ⚠️ NO se construye la conexión a mano: el `sslmode` de la URL PISA la opción `ssl` y la conexión
// muere con «self-signed certificate in certificate chain».
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { aTexto, indiceBloques, clasificarBloque, tituloYCuerpo } = require('../../lib/boe/bloquesConsolidados.cjs')

const argv = process.argv.slice(2)
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
const APPLY = argv.includes('--apply')
const CON_DISPOSICIONES = argv.includes('--disposiciones')
const LEY = arg('--ley')
const BOE_ID_MANUAL = arg('--boe-id')

/** Descarga sospechosamente corta = 400 disfrazado o bloque vacío. No se escribe a ciegas. */
const MINIMO_CREIBLE = 200

function bajar(boeId, ruta) {
  const url = `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/texto${ruta}`
  return new Promise((res, rej) => {
    https.get(url, { headers: { Accept: 'application/xml' } }, (r) => {
      let d = ''
      r.on('data', (c) => { d += c })
      r.on('end', () => (r.statusCode === 200 ? res(d) : rej(new Error(`HTTP ${r.statusCode} en ${url}`))))
    }).on('error', rej)
  })
}

async function main() {
  if (!LEY) throw new Error('falta --ley "<patrón del short_name>" (p. ej. --ley "485/1997")')

  const c = new Client(pgConfig())
  await c.connect()

  const ley = (await c.query(
    `SELECT id, short_name, name, boe_url FROM laws
      WHERE short_name ILIKE $1 OR name ILIKE $1 OR slug ILIKE $1 LIMIT 2`, [`%${LEY}%`])).rows
  if (ley.length === 0) throw new Error(`no encuentro ninguna ley que case con "${LEY}"`)
  if (ley.length > 1) throw new Error(`"${LEY}" casa con varias leyes (${ley.map((l) => l.short_name).join(', ')}) — afina el patrón`)
  const l = ley[0]

  const boeId = BOE_ID_MANUAL || (l.boe_url || '').match(/BOE-A-\d{4}-\d+/)?.[0]
  if (!boeId) throw new Error(`la ley ${l.short_name} no tiene un BOE-A-… en boe_url; pásalo con --boe-id`)

  console.log(`\nLEY:    ${l.short_name} — ${l.name}`)
  console.log(`FUENTE: https://www.boe.es/buscar/act.php?id=${boeId}\n`)

  const bloques = indiceBloques(await bajar(boeId, ''))
  const candidatos = bloques
    .map((b) => ({ ...b, clasif: clasificarBloque(b) }))
    .filter((b) => b.clasif && (b.clasif.clase === 'anexo' || CON_DISPOSICIONES))

  if (candidatos.length === 0) {
    console.log('No hay anexos' + (CON_DISPOSICIONES ? ' ni disposiciones' : '') + ' en el índice consolidado.\n')
    await c.end(); return
  }

  const trabajo = []
  for (const b of candidatos) {
    const texto = aTexto(await bajar(boeId, `/bloque/${b.id}`))
    if (texto.length < MINIMO_CREIBLE) {
      throw new Error(`${b.id}: descarga sospechosamente corta (${texto.length} car.) — no se escribe nada`)
    }
    const { title, content } = tituloYCuerpo(texto, b.clasif.clase, b.clasif.romano)
    // Se busca también por prefijo (`AI-…`): así se cazan los muñones con nombre inventado, que es
    // como estaba el Anexo I del RD 486/1997 (`AI-suelos`, 129 car. de 17.320).
    const actual = (await c.query(
      `SELECT id, article_number, length(content) n FROM articles
        WHERE law_id=$1 AND (article_number=$2 OR article_number LIKE $3)`,
      [l.id, b.clasif.articleNumber, b.clasif.articleNumber + '-%'])).rows[0]
    trabajo.push({ ...b, num: b.clasif.articleNumber, title, content, actual })
    const antes = actual ? `${actual.article_number} (${actual.n} car.)` : 'NO ESTÁ'
    console.log(`  ${b.clasif.articleNumber.padEnd(8)} BOE ${String(content.length).padStart(6)} car.  ←  BD: ${antes}`)
  }

  const faltan = trabajo.filter((t) => !t.actual).length
  const cortos = trabajo.filter((t) => t.actual && t.actual.n < t.content.length * 0.9).length
  console.log(`\n  ${faltan} sin importar · ${cortos} más corto(s) que la fuente · ${trabajo.length} bloques en total`)

  if (!APPLY) { console.log('\n(dry-run: nada escrito — repite con --apply)\n'); await c.end(); return }

  console.log('')
  for (const t of trabajo) {
    if (t.actual) {
      await c.query(
        `UPDATE articles SET article_number=$1, title=$2, content=$3, is_active=true, updated_at=now() WHERE id=$4`,
        [t.num, t.title, t.content, t.actual.id])
      console.log(`  ✏️  ${t.num}: actualizado (era ${t.actual.article_number}, ${t.actual.n} → ${t.content.length} car.)`)
    } else {
      await c.query(
        `INSERT INTO articles (law_id, article_number, title, content, is_active) VALUES ($1,$2,$3,$4,true)`,
        [l.id, t.num, t.title, t.content])
      console.log(`  ➕ ${t.num}: importado (${t.content.length} car.)`)
    }
  }

  // ── La comprobación que hace fiable el import: releer de la BD y comparar con la fuente ──
  console.log('\n── verificación carácter a carácter contra el BOE ──')
  let fallos = 0
  for (const t of trabajo) {
    const r = (await c.query(
      `SELECT content FROM articles WHERE law_id=$1 AND article_number=$2`, [l.id, t.num])).rows[0]
    const ok = r && r.content === t.content
    if (!ok) fallos++
    console.log(`  ${ok ? '✅' : '❌'} ${t.num.padEnd(8)} ${r ? r.content.length : 0} car. en BD vs ${t.content.length} descargados`)
  }
  await c.end()
  if (fallos) { console.error(`\n❌ ${fallos} bloque(s) no coinciden con la fuente.`); process.exit(1) }
  console.log(`\n✅ los ${trabajo.length} bloques coinciden con el BOE, carácter a carácter.\n`)
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
