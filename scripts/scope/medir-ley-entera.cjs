#!/usr/bin/env node
/**
 * ¿Cuántos scopes «toda la ley» contradicen a su propio epígrafe? [T-528, punto 1]
 *
 * SOLO LEE: no escribe, no toca BD y no pinga ningún badge. Es la MEDICIÓN que la ficha pedía
 * antes de decidir nada — «1.501 verified_correct con NULL no son 1.501 defectos, y hoy nada
 * distingue un caso del otro».
 *
 * Cómo: por cada `topic_scope` con `article_numbers IS NULL` en un tema activo, se baja el
 * ÍNDICE de su ley del BOE (datos abiertos, cacheado por ley) y se pregunta al núcleo puro
 * `contradiceLeyEntera` si el epígrafe enumera dos o más secciones REALES de esa ley.
 *
 * Reutiliza `parseBoeSections` —el mismo parser del detector de fronteras— en vez de abrir un
 * segundo lector del índice.
 *
 * COBERTURA, que hay que leer antes que el resultado: solo opina sobre leyes con `boe_url` de
 * BOE consolidado (**476 de 1.957 filas, 24%** el 04/08). Del resto —autonómicas, reglamentos
 * propios, leyes virtuales de ofimática— no hay índice y NO se afirma nada. Un cero aquí no es
 * «no hay problema»: es «no se ha podido mirar el 76%».
 *
 * Uso:  node scripts/scope/medir-ley-entera.cjs [--limite N] [--json]
 */
const { Client } = require('pg')
const path = require('path')
const { pgConfig } = require(path.join(__dirname, '..', '..', 'lib', 'db', 'pgSsl.cjs'))
const { parseBoeSectionsMultinivel } = require(path.join(__dirname, '..', '..', 'lib', 'laws', 'parseBoeSections'))
const { contradiceLeyEntera } = require(path.join(__dirname, '..', '..', 'lib', 'laws', 'epigrafeEnumeraSecciones.cjs'))

const LIMITE = Number((process.argv.find(a => a.startsWith('--limite')) || '').split('=')[1] || 0)
const JSON_OUT = process.argv.includes('--json')
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()

const cache = new Map()
async function seccionesDe(boeId) {
  if (cache.has(boeId)) return cache.get(boeId)
  let secs = null
  try {
    const r = await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/texto/indice`, {
      headers: { Accept: 'application/xml' },
    })
    if (r.ok) {
      const idx = await r.text()
      const bl = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)]
        .map(m => ({ id: m[1].trim(), label: clean(m[2]) }))
      const { niveles } = parseBoeSectionsMultinivel(bl)
      // Se juntan títulos y capítulos: el epígrafe puede nombrar cualquiera de los dos niveles.
      secs = niveles.flatMap(n => n.secciones)
    }
  } catch { /* sin índice → no se opina, se cuenta aparte */ }
  cache.set(boeId, secs)
  return secs
}

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()
  const { rows } = await c.query(`
    SELECT t.position_type, t.topic_number, t.epigrafe, l.short_name, l.name AS law_name, l.boe_url,
           coalesce(v.state,'(sin verificar)') AS estado_scope
      FROM topic_scope ts
      JOIN topics t ON t.id = ts.topic_id AND t.is_active
      JOIN laws  l ON l.id = ts.law_id
      LEFT JOIN topic_scope_verification v ON v.topic_id = t.id
     WHERE ts.article_numbers IS NULL
       AND l.boe_url ~ 'BOE-A-'
       AND coalesce(t.epigrafe,'') <> ''
     ORDER BY t.position_type, t.topic_number
     ${LIMITE ? `LIMIT ${LIMITE}` : ''}`)

  const hits = []
  let sinIndice = 0
  for (const r of rows) {
    const boeId = (String(r.boe_url).match(/BOE-A-\d{4}-\d+/) || [])[0]
    if (!boeId) { sinIndice++; continue }
    const secs = await seccionesDe(boeId)
    if (!secs || !secs.length) { sinIndice++; continue }
    // La ley va SIEMPRE: sin ella, un epígrafe con varias normas atribuye las secciones a la
    // que no es (T-129).
    const v = contradiceLeyEntera(r.epigrafe, secs, { shortName: r.short_name, name: r.law_name })
    if (v.contradice) hits.push({ ...r, ...v })
  }

  if (JSON_OUT) { console.log(JSON.stringify({ examinadas: rows.length, sinIndice, hits }, null, 1)); await c.end(); return }

  console.log(`\n══ scopes «toda la ley» con epígrafe que enumera secciones ══`)
  console.log(`   filas examinadas: ${rows.length} · sin índice utilizable: ${sinIndice} · CONTRADICEN: ${hits.length}\n`)
  for (const h of hits) {
    console.log(`  ❌ ${h.position_type} T${h.topic_number} · ${h.short_name}  [scope: ${h.estado_scope}]`)
    console.log(`     ${h.motivo}`)
    console.log(`     epígrafe: ${String(h.epigrafe).replace(/\s+/g, ' ').slice(0, 150)}`)
  }
  const verdes = hits.filter(h => h.estado_scope === 'verified_correct').length
  console.log(`\n   de los ${hits.length}, ${verdes} están marcados «verified_correct» — el verde que T-528 viene a quitar.`)
  console.log(`   ⚠️ Cobertura: solo leyes con índice del BOE. Un cero aquí NO dice que el resto esté bien.`)
  await c.end()
})()
