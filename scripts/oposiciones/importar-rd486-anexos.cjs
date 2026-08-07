#!/usr/bin/env node
/**
 * scripts/oposiciones/importar-rd486-anexos.cjs — importa los ANEXOS del RD 486/1997
 * (`BOE-A-1997-8669`) desde la API de datos abiertos del BOE, VERBATIM.
 *
 * ## POR QUÉ (T-676, 07/08/2026) — lo encontró un usuario, no un detector
 *
 * `casterpepe76` (Ordenanza del Ayuntamiento de Córdoba) escribió: *«comparando el tema con el
 * real decreto 486/1997 sacado del BOE veo que faltan anexos y que los anexos que ponéis vosotros
 * están como resumidos»*. Tenía razón y se quedaba corto. Medido contra el BOE:
 *
 *   Anexo I   17.320 car. en el BOE → teníamos `AI-suelos` con **129** (solo los suelos)
 *   Anexo II   1.779 car.           → completo ✅
 *   Anexo III  3.657 car.           → NO ESTABA
 *   Anexo IV   3.774 car.           → NO ESTABA
 *   Anexo V    6.595 car.           → NO ESTABA
 *   Anexo VI   3.496 car.           → NO ESTABA
 *
 * Un anexo completo de seis, y son justo los que se examinan: las cifras concretas (temperaturas,
 * lux, dimensiones, dotación de vestuarios) viven en los anexos; los 12 artículos son remisiones
 * de dos líneas. Alcance: 6 oposiciones, ~500 usuarios. Había incluso una pregunta que dice
 * *«Según el RD 486/1997 (Anexo V)…»* colgada del art. 9, porque el Anexo V no existía.
 *
 * ## POR QUÉ LA API Y NO EL HTML
 *
 * `act.php` sirve la norma entera en una página: para sacar un anexo hay que recortar por
 * marcadores, y ahí es donde se cuelan los resúmenes y los cortes a mitad de frase — que es
 * exactamente el defecto que este script viene a reparar. La API de datos abiertos devuelve
 * **el bloque** (`/texto/bloque/<id>`) con su texto delimitado por el propio BOE. Nada de recortes
 * nuestros. ⚠️ Exige `Accept: application/xml`: sin esa cabecera responde 400 «No soportado ningún
 * mime type», con cuerpo XML de 187 bytes que parece una descarga válida si solo miras el código.
 *
 * ## LA COMPROBACIÓN QUE HACE QUE ESTO SEA FIABLE
 *
 * Tras escribir, **relee de la BD y compara carácter a carácter contra lo descargado**. Importar
 * y decir «ya está» es lo que produjo el estado actual; aquí lo que vale es el contraste, no la
 * intención. Si un anexo no cuadra, aborta y lo dice.
 *
 * Uso:  node scripts/oposiciones/importar-rd486-anexos.cjs [--apply]   (dry-run por defecto)
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const https = require('https')
// ⚠️ NO se construye la conexión a mano: el `sslmode` de la URL PISA la opción `ssl` y la
// conexión muere con «self-signed certificate in certificate chain». El criterio vive en un
// solo sitio desde el cutover a RDS.
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const APPLY = process.argv.includes('--apply')
const BOE_ID = 'BOE-A-1997-8669'
const BOE_URL = `https://www.boe.es/buscar/act.php?id=${BOE_ID}`

// Ids de bloque del índice consolidado del BOE (verificados el 07/08/2026 contra
// /texto/indice). `article_number` sigue la convención que ya usa esta ley en BD (`AII`).
const ANEXOS = [
  { bloque: 'ani',   num: 'AI',   titulo: 'Anexo I — Condiciones generales de seguridad en los lugares de trabajo' },
  { bloque: 'anii',  num: 'AII',  titulo: 'Anexo II — Orden, limpieza y mantenimiento' },
  { bloque: 'aniii', num: 'AIII', titulo: 'Anexo III — Condiciones ambientales de los lugares de trabajo' },
  { bloque: 'aniv',  num: 'AIV',  titulo: 'Anexo IV — Iluminación de los lugares de trabajo' },
  { bloque: 'anv',   num: 'AV',   titulo: 'Anexo V — Servicios higiénicos y locales de descanso' },
  { bloque: 'anvi',  num: 'AVI',  titulo: 'Anexo VI — Material y locales de primeros auxilios' },
]

function bajar(bloque) {
  const url = `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${BOE_ID}/texto/bloque/${bloque}`
  return new Promise((res, rej) => {
    https.get(url, { headers: { Accept: 'application/xml' } }, (r) => {
      let d = ''
      r.on('data', (c) => { d += c })
      r.on('end', () => (r.statusCode === 200 ? res(d) : rej(new Error(`HTTP ${r.statusCode} en ${bloque}`))))
    }).on('error', rej)
  })
}

/**
 * Del XML del bloque al texto plano del anexo.
 *
 * Se conservan los saltos de párrafo (`<p>` → línea) porque los anexos son listas numeradas y
 * aplanarlos los vuelve ilegibles — es la mitad de la queja del usuario («están como resumidos»).
 */
function aTexto(xml) {
  const cuerpo = xml.replace(/^[\s\S]*?<version[^>]*>/, '').replace(/<\/version>[\s\S]*$/, '')
  return cuerpo
    .split(/<\/p>/i)
    .map((p) => p.replace(/<[^>]+>/g, '')
      .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
      .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
      .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
      .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
      .replace(/&uuml;/g, 'ü').replace(/&ordm;/g, 'º').replace(/&ordf;/g, 'ª')
      .replace(/&deg;/g, '°').replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

async function main() {
  const c = new Client(pgConfig())
  await c.connect()
  const ley = (await c.query(
    `SELECT id, short_name FROM laws WHERE short_name ILIKE '%486/1997%' LIMIT 1`)).rows[0]
  if (!ley) throw new Error('no encuentro la ley RD 486/1997')
  console.log(`\nLEY: ${ley.short_name} (${ley.id})\nFUENTE: ${BOE_URL}\n`)

  const trabajo = []
  for (const a of ANEXOS) {
    const texto = aTexto(await bajar(a.bloque))
    if (texto.length < 500 && a.num !== 'AII') throw new Error(`${a.num}: descarga sospechosamente corta (${texto.length})`)
    const actual = (await c.query(
      `SELECT id, article_number, length(content) n FROM articles
        WHERE law_id=$1 AND (article_number=$2 OR article_number LIKE $3)`,
      [ley.id, a.num, a.num + '-%'])).rows[0]
    trabajo.push({ ...a, texto, actual })
    const antes = actual ? `${actual.article_number} (${actual.n} car.)` : 'NO EXISTE'
    console.log(`  ${a.num.padEnd(5)} BOE ${String(texto.length).padStart(6)} car.  ←  BD: ${antes}`)
  }

  if (!APPLY) { console.log('\n(dry-run: nada escrito — repite con --apply)\n'); await c.end(); return }

  console.log('')
  for (const t of trabajo) {
    if (t.actual) {
      await c.query(
        `UPDATE articles SET article_number=$1, title=$2, content=$3, is_active=true, updated_at=now() WHERE id=$4`,
        [t.num, t.titulo, t.texto, t.actual.id])
      console.log(`  ✏️  ${t.num}: actualizado (era ${t.actual.article_number}, ${t.actual.n} → ${t.texto.length} car.)`)
    } else {
      await c.query(
        `INSERT INTO articles (law_id, article_number, title, content, is_active)
         VALUES ($1,$2,$3,$4,true)`, [ley.id, t.num, t.titulo, t.texto])
      console.log(`  ➕ ${t.num}: importado (${t.texto.length} car.)`)
    }
  }

  // ── La comprobación que hace fiable el import: releer de la BD y comparar con la fuente ──
  console.log('\n── verificación carácter a carácter contra el BOE ──')
  let fallos = 0
  for (const t of trabajo) {
    const r = (await c.query(
      `SELECT content FROM articles WHERE law_id=$1 AND article_number=$2`, [ley.id, t.num])).rows[0]
    const ok = r && r.content === t.texto
    if (!ok) fallos++
    console.log(`  ${ok ? '✅' : '❌'} ${t.num.padEnd(5)} ${r ? r.content.length : 0} car. en BD vs ${t.texto.length} descargados`)
  }
  await c.end()
  if (fallos) { console.error(`\n❌ ${fallos} anexo(s) no coinciden con la fuente.`); process.exit(1) }
  console.log('\n✅ los 6 anexos coinciden con el BOE, carácter a carácter.\n')
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1) })

// Exportado para poder probarlo: `aTexto` es lo que decide si el anexo queda VERBATIM o
// destrozado, y es justo la pieza que produjo el estado que este script repara.
module.exports = { aTexto }
