#!/usr/bin/env node
/**
 * scripts/leyes/medir-anexos-faltantes.cjs — ¿cuántas leyes SERVIMOS a las que les falta el anexo
 * que su fuente sí tiene? (T-726, 08/08/2026)
 *
 * ## POR QUÉ SE MIDE ASÍ Y NO CON UN `WHERE`
 *
 * La consulta obvia —«leyes servidas sin ninguna fila de anexo en `articles`»— da **404** y es un
 * número inútil: la Constitución no tiene anexos, la Ley 39/2015 tampoco. Contarlas como huecos es
 * el error de medida que el manual de impugnaciones advierte en su §sistémico (un número gordo que
 * te crees y sobre el que escribes una ficha de un fenómeno inventado).
 *
 * El hueco REAL solo se puede afirmar comparando con la FUENTE: se pide el índice consolidado del
 * BOE de cada ley y se mira si declara bloques `ANEXO …` que nosotros no tengamos. Eso son ~400
 * peticiones, así que esto es **on-demand** — igual que `npm run laws:derogadas`, y por la misma
 * razón: una señal que cambia dos o tres veces al año no se barre cada noche.
 *
 * NO escribe nada: lista y ordena por alcance (nº de oposiciones que sirven la ley).
 *
 * Uso:  node scripts/leyes/medir-anexos-faltantes.cjs [--limite 400] [--json <fichero>]
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const https = require('https')
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { indiceBloques, clasificarBloque } = require('../../lib/boe/bloquesConsolidados.cjs')

const argv = process.argv.slice(2)
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
const LIMITE = Number(arg('--limite') || 400)
const JSON_OUT = arg('--json')

function bajarIndice(boeId) {
  const url = `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/texto/indice`
  return new Promise((res) => {
    https.get(url, { headers: { Accept: 'application/xml' } }, (r) => {
      let d = ''
      r.on('data', (c) => { d += c })
      r.on('end', () => res(r.statusCode === 200 ? d : null))
    }).on('error', () => res(null))
  })
}

async function main() {
  const c = new Client(pgConfig())
  await c.connect()

  const leyes = (await c.query(`
    SELECT l.id, l.short_name, l.boe_url,
           (SELECT COUNT(DISTINCT t.position_type) FROM topic_scope ts
              JOIN topics t ON t.id = ts.topic_id WHERE ts.law_id = l.id)::int AS oposiciones,
           ARRAY(SELECT a.article_number FROM articles a
                  WHERE a.law_id = l.id AND a.is_active AND a.article_number ~ '^A[IVX]+$') AS anexos_bd
      FROM laws l
     WHERE l.is_active AND l.boe_url ~ 'BOE-A-'
       AND EXISTS (SELECT 1 FROM topic_scope ts WHERE ts.law_id = l.id)
     ORDER BY oposiciones DESC
     LIMIT $1`, [LIMITE])).rows

  console.log(`\nComprobando ${leyes.length} leyes servidas contra su índice consolidado del BOE…\n`)

  const huecos = []
  let sinIndice = 0
  let sinAnexos = 0
  for (const l of leyes) {
    const boeId = (l.boe_url.match(/BOE-A-\d{4}-\d+/) || [])[0]
    const xml = boeId ? await bajarIndice(boeId) : null
    if (!xml) { sinIndice++; continue }

    const enFuente = indiceBloques(xml)
      .map((b) => clasificarBloque(b))
      .filter((x) => x && x.clase === 'anexo')
      .map((x) => x.articleNumber)
    if (enFuente.length === 0) { sinAnexos++; continue }

    const faltan = enFuente.filter((n) => !l.anexos_bd.includes(n))
    if (faltan.length) huecos.push({ ley: l.short_name, oposiciones: l.oposiciones, faltan, enFuente: enFuente.length, boeId })
  }

  huecos.sort((a, b) => b.oposiciones - a.oposiciones || b.faltan.length - a.faltan.length)
  console.log(`── ${huecos.length} leyes SERVIDAS a las que les falta algún anexo que su fuente sí tiene ──\n`)
  for (const h of huecos) {
    console.log(`  ${String(h.oposiciones).padStart(3)} oposic. | ${h.ley.padEnd(28)} faltan ${h.faltan.length}/${h.enFuente}: ${h.faltan.join(', ')}`)
  }
  console.log(`\n  (${sinAnexos} leyes no tienen anexos en su fuente · ${sinIndice} sin índice accesible)\n`)

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ huecos, sinAnexos, sinIndice }, null, 2))
    console.log(`  → ${JSON_OUT}\n`)
  }
  await c.end()
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
