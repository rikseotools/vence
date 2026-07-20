#!/usr/bin/env node
/**
 * Importa la Ley 14/2011 de la Ciencia, la Tecnología y la Innovación — SECCIÓN 2.ª del
 * Título II, Capítulo I ("Contratación del personal investigador de carácter laboral"),
 * que es lo que pide el T13 del temario de Aux. Admin. de la Universidad de Almería (T-044).
 *
 * Fuente: API de datos abiertos del BOE (texto CONSOLIDADO), BOE-A-2011-9617.
 * Artículos de la sección: 20, 21, 22, 22 bis, 23, 23 bis.
 *
 * ⚠️ GOTCHA que este script resuelve: cada bloque del consolidado trae VARIAS `<version>`
 * (2-3 por artículo aquí) — una por reforma. Coger la primera importaría texto DEROGADO.
 * Se selecciona la versión vigente HOY: la de mayor `fecha_vigencia` que ya haya entrado
 * en vigor. Además la rúbrica real vive en el `<p class="articulo">` del texto, no en el
 * atributo `titulo` del bloque (el índice solo dice "Artículo 20"; la rúbrica es
 * "Modalidades contractuales").
 *
 * Idempotente: si la ley ya existe, no la duplica; salta los artículos ya importados.
 *
 * Uso: node scripts/oposiciones/importar-ley-14-2011-ciencia.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const BOE_ID = 'BOE-A-2011-9617'
const API = `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${BOE_ID}/texto/bloque`
const BOE_URL = `https://www.boe.es/buscar/act.php?id=${BOE_ID}`

// bloque del BOE → número de artículo tal y como lo guardamos
const BLOQUES = [
  { id: 'a20', num: '20' },
  { id: 'a21', num: '21' },
  { id: 'a22', num: '22' },
  { id: 'a2-3', num: '22 bis' },
  { id: 'a23', num: '23' },
  { id: 'a2-2', num: '23 bis' },
]

const LAW = {
  short_name: 'Ley 14/2011 Ciencia',
  name: 'Ley 14/2011, de 1 de junio, de la Ciencia, la Tecnología y la Innovación',
  type: 'law',
  slug: 'ley-14-2011-ciencia-tecnologia-innovacion',
}

const hoy = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')

async function fetchBloque(id) {
  const r = await fetch(`${API}/${id}`, { headers: { Accept: 'application/xml' } })
  if (!r.ok) throw new Error(`BOE ${id}: HTTP ${r.status}`)
  return await r.text()
}

/** Devuelve la <version> VIGENTE hoy (mayor fecha_vigencia ya en vigor). */
function versionVigente(xml, id) {
  const versiones = [...xml.matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)].map((m) => ({
    fecha: (m[1].match(/fecha_vigencia="(\d{8})"/) || [, '00000000'])[1],
    cuerpo: m[2],
  }))
  if (!versiones.length) throw new Error(`${id}: sin <version> en la respuesta del BOE`)
  const enVigor = versiones.filter((v) => v.fecha <= hoy())
  if (!enVigor.length) throw new Error(`${id}: ninguna versión en vigor (¿futura?)`)
  enVigor.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return { ...enVigor[enVigor.length - 1], total: versiones.length }
}

const limpiar = (html) =>
  html.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&amp;/g, '&')
    .split('\n').map((s) => s.trim()).filter(Boolean).join('\n')

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  console.log(`→ descargando la Sección 2.ª de la ${LAW.short_name} del BOE consolidado…\n`)
  const arts = []
  for (const b of BLOQUES) {
    const xml = await fetchBloque(b.id)
    const v = versionVigente(xml, b.id)
    const texto = limpiar(v.cuerpo)
    const lineas = texto.split('\n')
    // La 1ª línea es "Artículo N. Rúbrica." → de ahí sale el título real
    const cabecera = lineas[0] || ''
    const rubrica = (cabecera.replace(/^Artículo\s+[\d\s(bis|ter)]*\.?\s*/i, '').replace(/\.$/, '')).trim()
    const cuerpo = lineas.slice(1).join('\n').trim()
    if (!cuerpo) throw new Error(`${b.id}: cuerpo vacío tras limpiar — no importo a ciegas`)
    arts.push({ num: b.num, titulo: rubrica || cabecera, contenido: cuerpo, versiones: v.total, vigencia: v.fecha })
    console.log(`· art. ${b.num.padEnd(7)} "${(rubrica || '?').slice(0, 52)}"  ${String(cuerpo.length).padStart(5)} chars · ${v.total} versión(es), vigente desde ${v.fecha}`)
  }

  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    let law = (await c.query('SELECT id FROM laws WHERE short_name=$1', [LAW.short_name])).rows[0]
    if (law) {
      console.log(`\n· la ley ya existía (${law.id})`)
    } else {
      law = (await c.query(
        `INSERT INTO laws (name, short_name, type, slug, is_virtual, boe_url, scope)
         VALUES ($1,$2,$3,$4,false,$5,'national') RETURNING id`,
        [LAW.name, LAW.short_name, LAW.type, LAW.slug, BOE_URL])).rows[0]
      console.log(`\n· ley creada (${law.id})`)
    }

    let nuevos = 0
    for (const a of arts) {
      const ya = await c.query('SELECT id FROM articles WHERE law_id=$1 AND article_number=$2', [law.id, a.num])
      if (ya.rows.length) { console.log(`  · art. ${a.num}: ya existe, se salta`); continue }
      await c.query(
        `INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified,
                               verification_date, embedding_stale, title_number, chapter_number, section_number)
         VALUES ($1,$2,$3,$4,true,true,CURRENT_DATE,true,'II','I','2')`,
        [law.id, a.num, a.titulo, a.contenido])
      nuevos++
    }
    console.log(`\n${nuevos} artículo(s) importados verbatim del BOE consolidado.`)

    // Enganchar al T13 de Almería
    const t = (await c.query(
      `SELECT id FROM topics WHERE position_type='auxiliar_administrativo_universidad_almeria' AND topic_number=13`)).rows[0]
    if (!t) { console.log('⚠️  no encuentro el T13 de Almería — scope sin enganchar') }
    else {
      const ex = await c.query('SELECT id FROM topic_scope WHERE topic_id=$1 AND law_id=$2', [t.id, law.id])
      if (ex.rows.length) console.log('· T13 ya tenía la ley escopada')
      else {
        await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES ($1,$2,$3,1.0)',
          [t.id, law.id, arts.map((a) => a.num)])
        console.log(`· T13 Almería escopado a los ${arts.length} artículos de la Sección 2.ª`)
      }
    }

    if (DRY) { await c.query('ROLLBACK'); console.log('\n--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('\n✅ COMMIT') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
