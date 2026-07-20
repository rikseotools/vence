#!/usr/bin/env node
/**
 * Importa el TÍTULO V (Gobernanza de las Universidades Públicas, arts. 88-100) de la
 * Ley 1/2026, de 20 de febrero, Universitaria para Andalucía — `BOE-A-2026-6643`.
 *
 * CONTEXTO — defecto destapado por el gate de publicación (20/07). Al ir a publicar
 * Aux. Admin. UAL, el gate rechazó el T10 porque su ley estaba en `false_green`
 * (`verification_status='actualizada'` con `boe_url` NULL y sin resumen). Al investigarlo
 * apareció algo peor:
 *   · El epígrafe del T10 pide SOLO el "Título V: Gobernanza de las Universidades Públicas".
 *   · El `topic_scope` apuntaba a la ley ENTERA (`article_numbers = NULL`).
 *   · Las 18 preguntas que servía eran de los arts. 1-21 y 101-108 — **ninguna del Título V**.
 *   · Y los artículos 88-100 **no estaban siquiera importados**.
 * O sea: el tema servía justo lo que su epígrafe NO pide, y nada de lo que sí pide.
 *
 * Este script importa los 13 artículos que faltan, acota el scope del T10 al Título V y
 * registra la evidencia de verificación de la ley (fuente + resumen), que es lo que exige
 * el gate. Las 18 preguntas antiguas NO se borran: siguen en BD para cualquier oposición
 * que escope esos otros títulos.
 *
 * Uso: node scripts/oposiciones/importar-lua-titulo-v.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const BOE_ID = 'BOE-A-2026-6643'
const API = `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${BOE_ID}/texto/bloque`
const BOE_URL = `https://www.boe.es/buscar/act.php?id=${BOE_ID}`
const LEY = 'Ley 1/2026 LUA'

// Título V — ids de bloque del índice consolidado del BOE (verificados 20/07)
const BLOQUES = [
  { id: 'a8-10', num: '88' }, { id: 'a8-11', num: '89' }, { id: 'a9-2', num: '90' },
  { id: 'a9-3', num: '91' }, { id: 'a9-4', num: '92' }, { id: 'a9-5', num: '93' },
  { id: 'a9-6', num: '94' }, { id: 'a9-7', num: '95' }, { id: 'a9-8', num: '96' },
  { id: 'a9-9', num: '97' }, { id: 'a9-10', num: '98' }, { id: 'a9-11', num: '99' },
  { id: 'a1-12', num: '100' },
]

const hoy = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')

async function fetchBloque(id) {
  const r = await fetch(`${API}/${id}`, { headers: { Accept: 'application/xml' } })
  if (!r.ok) throw new Error(`BOE ${id}: HTTP ${r.status}`)
  return await r.text()
}

/** Versión VIGENTE hoy (mismo gotcha que la Ley 14/2011: varias <version> por reforma). */
function versionVigente(xml, id) {
  const vs = [...xml.matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)].map((m) => ({
    fecha: (m[1].match(/fecha_vigencia="(\d{8})"/) || [, '00000000'])[1], cuerpo: m[2],
  }))
  if (!vs.length) throw new Error(`${id}: sin <version>`)
  const viv = vs.filter((v) => v.fecha <= hoy())
  if (!viv.length) throw new Error(`${id}: ninguna versión en vigor`)
  viv.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return viv[viv.length - 1]
}

const limpiar = (html) => html.replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é')
  .replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
  .replace(/&ntilde;/g, 'ñ').replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É')
  .replace(/&Iacute;/g, 'Í').replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú')
  .replace(/&Ntilde;/g, 'Ñ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&amp;/g, '&')
  .split('\n').map((s) => s.trim()).filter(Boolean).join('\n')

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  console.log(`→ descargando el Título V de la ${LEY} (${BOE_ID})…\n`)
  const arts = []
  for (const b of BLOQUES) {
    const v = versionVigente(await fetchBloque(b.id), b.id)
    const lineas = limpiar(v.cuerpo).split('\n')
    const cabecera = lineas[0] || ''
    const rubrica = cabecera.replace(/^Artículo\s+[\d\s(bis|ter)]*\.?\s*/i, '').replace(/\.$/, '').trim()
    const cuerpo = lineas.slice(1).join('\n').trim()
    if (!cuerpo) throw new Error(`art. ${b.num}: cuerpo vacío — no importo a ciegas`)
    arts.push({ num: b.num, titulo: rubrica || cabecera, cuerpo })
    console.log(`· art. ${b.num.padStart(3)}  ${String(cuerpo.length).padStart(5)} ch  ${rubrica.slice(0, 60)}`)
  }

  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    const law = (await c.query('SELECT id FROM laws WHERE short_name=$1', [LEY])).rows[0]
    if (!law) throw new Error(`no existe la ley ${LEY}`)

    let nuevos = 0
    for (const a of arts) {
      if ((await c.query('SELECT id FROM articles WHERE law_id=$1 AND article_number=$2', [law.id, a.num])).rows.length) continue
      await c.query(
        `INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified,
                               verification_date, embedding_stale, title_number)
         VALUES ($1,$2,$3,$4,true,true,CURRENT_DATE,true,'V')`,
        [law.id, a.num, a.titulo, a.cuerpo])
      nuevos++
    }
    console.log(`\n· ${nuevos} artículo(s) del Título V importados verbatim`)

    // Evidencia de verificación: es lo que el gate exige y lo que faltaba (false_green).
    await c.query(
      `UPDATE laws SET boe_url=$1, verification_status='actualizada', last_verification_summary=$2::jsonb
       WHERE id=$3`,
      [BOE_URL, JSON.stringify({
        verified_at: new Date().toISOString().slice(0, 10),
        method: 'BOE consolidado (API datos abiertos), bloque a bloque, versión vigente',
        source: BOE_URL,
        scope_verified: 'Título V (arts. 88-100) importado verbatim y verificado',
        note: 'El resto del articulado (Títulos I-IV, VI-VIII) sigue INCOMPLETO en BD: solo se ha verificado e importado el Título V, que es lo que pide el T10 de auxiliar_administrativo_universidad_almeria. No marcar la ley como completa.',
        deliberate_subset: true,
      }), law.id])
    console.log('· evidencia de verificación registrada (boe_url + resumen)')

    // Acotar el T10 al Título V: su epígrafe NO pide la ley entera.
    const t = (await c.query(
      `SELECT id FROM topics WHERE position_type='auxiliar_administrativo_universidad_almeria' AND topic_number=10`)).rows[0]
    const r = await c.query(
      `UPDATE topic_scope SET article_numbers=$1 WHERE topic_id=$2 AND law_id=$3 RETURNING id`,
      [arts.map((a) => a.num), t.id, law.id])
    console.log(`· T10 acotado al Título V (${arts.length} arts) — antes era NULL = toda la ley: ${r.rowCount} fila`)

    if (DRY) { await c.query('ROLLBACK'); console.log('\n--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('\n✅ COMMIT') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
