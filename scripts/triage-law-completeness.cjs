#!/usr/bin/env node
/**
 * Triaje de una ley `false_green` / `never_verified` / `incomplete`: clasifica
 * el trabajo real que necesita, LEYENDO de BD.
 *
 * Uso:  node scripts/triage-law-completeness.cjs <law_slug>
 *       node scripts/triage-law-completeness.cjs --all-false-green   (lista las 43)
 *
 * La pregunta clave que responde: ¿los artículos importados CUBREN lo que el
 * `topic_scope` de los temas VIVOS pide? Distingue dos mundos que el detector
 * de completitud mezcla:
 *
 *   - DIGEST-COMPLETO : los artículos en BD ⊇ los artículos escopados por temas
 *     disponibles. No falta nada que se sirva; el defecto es solo la EVIDENCIA
 *     (marcada actualizada sin verificar). Fix barato: verificar verbatim +
 *     escribir `last_verification_summary`. (Caso ordenanza Madrid.)
 *
 *   - FALTAN-ESCOPADOS : hay artículos que un tema vivo escopa y que NO están en
 *     BD. Eso sí es import pendiente (verbatim desde fuente oficial). (Caso ULE.)
 *
 * Nota: un tema puede escopar la ley ENTERA (`article_numbers = NULL`). En ese
 * caso no se puede saber "qué falta" sin la fuente oficial → se marca
 * SCOPE-LEY-ENTERA (requiere la fuente para dictaminar).
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

async function triage(slug) {
  const law = (await s`SELECT id, short_name, boe_url, scope FROM laws WHERE slug=${slug}`)[0]
  if (!law) return { slug, error: 'no encontrada' }

  const imported = new Set((await s`SELECT article_number FROM articles WHERE law_id=${law.id}`).map((r) => r.article_number))

  // Artículos escopados por temas DISPONIBLES. NULL = ley entera.
  const scopes = await s`
    SELECT t.position_type, t.topic_number, ts.article_numbers
    FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id
    WHERE ts.law_id=${law.id} AND t.disponible`

  const preg = (await s`
    SELECT count(*) n FROM questions q JOIN articles a ON a.id=q.primary_article_id
    WHERE a.law_id=${law.id} AND q.is_active`)[0].n

  const scopeEntera = scopes.some((x) => x.article_numbers === null)
  const scoped = new Set()
  for (const x of scopes) if (x.article_numbers) for (const n of x.article_numbers) scoped.add(n)
  const faltan = [...scoped].filter((n) => !imported.has(n))

  let clase
  if (scopeEntera) clase = 'SCOPE-LEY-ENTERA (requiere fuente oficial para dictaminar)'
  else if (faltan.length === 0) clase = 'DIGEST-COMPLETO (solo falta evidencia — fix barato)'
  else clase = `FALTAN-ESCOPADOS: ${faltan.length} art(s) que un tema vivo pide y no están en BD`

  return {
    slug, short_name: law.short_name, scope: law.scope, hasBOE: !!law.boe_url,
    preg_vivas: +preg, arts_en_bd: imported.size, arts_escopados: scoped.size,
    temas_vivos: scopes.length, clase, faltan: faltan.slice(0, 20),
  }
}

;(async () => {
  const arg = process.argv[2]
  if (!arg) { console.error('uso: node scripts/triage-law-completeness.cjs <law_slug> | --all-false-green'); process.exit(1) }

  if (arg === '--all-false-green') {
    // false_green (mirror de classifyLawCompleteness): dice actualizada/verificada
    // pero NO tiene summary-objeto con evidencia, y no es virtual.
    const all = await s`SELECT slug, verification_status, is_virtual, jsonb_typeof(last_verification_summary) sut FROM laws`
    const fg = all.filter((r) => {
      const claims = ['actualizada', 'verificada'].includes((r.verification_status || '').toLowerCase())
      const hasEvidence = r.sut === 'object'
      return claims && !hasEvidence && r.is_virtual !== true
    })
    const rows = []
    for (const r of fg) rows.push(await triage(r.slug))
    rows.sort((a, b) => b.preg_vivas - a.preg_vivas)
    const by = { 'DIGEST-COMPLETO': 0, 'FALTAN-ESCOPADOS': 0, 'SCOPE-LEY-ENTERA': 0 }
    for (const r of rows) {
      const k = r.clase.startsWith('DIGEST') ? 'DIGEST-COMPLETO' : r.clase.startsWith('FALTAN') ? 'FALTAN-ESCOPADOS' : 'SCOPE-LEY-ENTERA'
      by[k]++
      console.log(`${String(r.preg_vivas).padStart(4)}p ${r.hasBOE ? 'BOE' : ' - '} ${k.padEnd(16)} ${r.slug}`)
    }
    console.log(`\n${rows.length} false_green · DIGEST-COMPLETO:${by['DIGEST-COMPLETO']} · FALTAN-ESCOPADOS:${by['FALTAN-ESCOPADOS']} · SCOPE-LEY-ENTERA:${by['SCOPE-LEY-ENTERA']}`)
  } else {
    console.log(JSON.stringify(await triage(arg), null, 2))
  }
  await s.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
