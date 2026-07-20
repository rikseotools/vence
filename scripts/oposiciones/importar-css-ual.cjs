#!/usr/bin/env node
/**
 * Importa la "Normativa Interna de Funcionamiento del Comité de Seguridad y Salud de la
 * Universidad de Almería" y la engancha al T8 de Aux. Admin. UAL (T-044).
 *
 * CONTEXTO — segundo defecto del mismo patrón que el T10, destapado esta vez por la
 * verificación scope↔epígrafe con dos agentes (20/07). El epígrafe del T8 dice:
 *   "La Ley 31/1995, de Prevención de Riesgos Laborales. Derechos y obligaciones. El
 *    Delegado de Prevención. El Comité de Seguridad y Salud. **Normativa interna del Comité
 *    de Seguridad y Salud laboral de la Universidad de Almería**."
 * El tramo de la Ley 31/1995 estaba bien acotado, pero esa normativa interna **no estaba en
 * el scope ni en BD**: el tema pedía un documento que no servíamos.
 *
 * Estructura: NO tiene articulado formal, son 15 APARTADOS numerados ("1.-", "2.-"… "15.").
 * Maquetación a limpiar: cabecera repetida "COMITÉ DE SEGURIDAD Y SALUD / GERENCIA".
 *
 * Uso: node scripts/oposiciones/importar-css-ual.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const fs = require('fs'); const os = require('os'); const path = require('path')
const { execFileSync } = require('child_process')

const DRY = process.argv.includes('--dry-run')
const URL = 'https://www.ual.es/application/files/5716/2081/6577/nuevoreglamentocss2018.pdf'
const LAW = {
  short_name: 'Normativa Interna CSS UAL',
  name: 'Normativa Interna de Funcionamiento del Comité de Seguridad y Salud de la Universidad de Almería',
  slug: 'normativa-interna-comite-seguridad-salud-ual',
}
const BASURA = [/^COMITÉ DE SEGURIDAD Y SALUD$/i, /^GERENCIA$/i, /^\d+\s*$/, /^Página\s+\d+/i]

async function bajar() {
  const r = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.slice(0, 4).toString() !== '%PDF') throw new Error('no es PDF')
  const tmp = path.join(os.tmpdir(), `css-${process.pid}.pdf`)
  fs.writeFileSync(tmp, buf)
  try { return execFileSync('pdftotext', ['-enc', 'UTF-8', '-nopgbrk', '-layout', tmp, '-'], { maxBuffer: 32 * 1024 * 1024 }).toString('utf8') }
  finally { fs.unlinkSync(tmp) }
}

const limpiar = (t) => t.split('\n').map((l) => l.replace(/\s+$/, '').replace(/^\s{2,}/, ''))
  .filter((l) => !BASURA.some((re) => re.test(l.trim()))).join('\n').replace(/\n{3,}/g, '\n\n')

/** Apartados "N.-" o "N." — solo abre el número que toca (evita listas internas). */
function trocear(txt) {
  const RE = /^\s*(\d{1,2})\s*\.-?\s*(.*)$/
  const arts = []; let actual = null; let siguiente = 1
  for (const l of txt.split('\n')) {
    const m = l.match(RE)
    if (m && parseInt(m[1]) === siguiente) {
      if (actual) arts.push(actual)
      const resto = (m[2] || '').trim()
      actual = { num: m[1], titulo: resto.slice(0, 90), cuerpo: [resto] }
      siguiente++
    } else if (actual) actual.cuerpo.push(l)
  }
  if (actual) arts.push(actual)
  return arts.map((a) => ({ ...a, cuerpo: a.cuerpo.join('\n').trim() }))
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const arts = trocear(limpiar(await bajar()))
  console.log(`troceado: ${arts.length} apartado(s)`)
  arts.forEach((a) => console.log(`· ap. ${a.num.padStart(2)}  ${String(a.cuerpo.length).padStart(5)} ch  ${a.titulo.slice(0, 60)}`))
  const vacios = arts.filter((a) => a.cuerpo.length < 40)
  if (vacios.length) throw new Error(`${vacios.length} apartado(s) casi vacíos — no importo a ciegas`)

  const c = newClient(); await c.connect()
  try {
    await c.query('BEGIN')
    let law = (await c.query('SELECT id FROM laws WHERE short_name=$1', [LAW.short_name])).rows[0]
    if (!law) {
      law = (await c.query(
        `INSERT INTO laws (name, short_name, type, slug, is_virtual, boe_url, scope)
         VALUES ($1,$2,'regulation',$3,false,$4,'regional') RETURNING id`,
        [LAW.name, LAW.short_name, LAW.slug, URL])).rows[0]
      console.log(`· ley creada (${law.id})`)
    } else console.log('· la ley ya existía')

    let n = 0
    for (const a of arts) {
      if ((await c.query('SELECT id FROM articles WHERE law_id=$1 AND article_number=$2', [law.id, a.num])).rows.length) continue
      await c.query(
        `INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified, verification_date, embedding_stale)
         VALUES ($1,$2,$3,$4,true,true,CURRENT_DATE,true)`, [law.id, a.num, a.titulo, a.cuerpo])
      n++
    }
    console.log(`· ${n} apartado(s) importados`)

    const t = (await c.query(
      `SELECT id FROM topics WHERE position_type='auxiliar_administrativo_universidad_almeria' AND topic_number=8`)).rows[0]
    if ((await c.query('SELECT id FROM topic_scope WHERE topic_id=$1 AND law_id=$2', [t.id, law.id])).rows.length) {
      console.log('· T8 ya la tenía escopada')
    } else {
      await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES ($1,$2,$3,1.0)',
        [t.id, law.id, arts.map((a) => a.num)])
      console.log(`· T8 escopado a los ${arts.length} apartados — cierra el hueco que pedía su epígrafe`)
    }

    if (DRY) { await c.query('ROLLBACK'); console.log('\n--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('\n✅ COMMIT') }
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
