#!/usr/bin/env node
'use strict'
/**
 * audit-atajos-coherencia.cjs — ¿el banco se contradice a sí mismo sobre un atajo de teclado?
 *
 * BAJO DEMANDA (`npm run audit:atajos`). No pinga el badge hasta medir cuánto saca: ver T-354.
 *
 * Recorre artículos virtuales de ofimática/informática Y las preguntas activas de esos
 * contenedores (enunciado + opción marcada + explicación), extrae los pares (acción, tecla) con el
 * núcleo puro `lib/health/atajoCoherencia.js` y agrupa. No consulta ninguna fuente externa y no
 * decide cuál es la correcta: solo señala que no puede haber dos.
 *
 * Uso:
 *   node scripts/audit-atajos-coherencia.cjs                # todo, resumen + detalle
 *   node scripts/audit-atajos-coherencia.cjs --banda interna
 *   node scripts/audit-atajos-coherencia.cjs --familia word --json
 */
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const postgres = require(path.join(ROOT, 'node_modules/postgres'))
const { extraerAtajos, contradicciones } = require(path.join(ROOT, 'lib/health/atajoCoherencia.js'))

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null }
const SOLO_BANDA = arg('--banda')
const SOLO_FAMILIA = arg('--familia')
const JSON_OUT = process.argv.includes('--json')

/** La familia es la APP, no el contenedor: `Word 365`, `Word 365 Escritorio` y `Word 2016` son la misma. */
function familiaDe(shortName) {
  const s = String(shortName || '').toLowerCase()
  // Solo apps de OFIMÁTICA: es donde Microsoft localiza los atajos y donde se cuela el set inglés.
  // Windows/Explorador quedan fuera a propósito — sus combinaciones (Win+E, Win+R) no se traducen,
  // así que ahí el detector solo produciría ruido.
  for (const f of ['word', 'excel', 'powerpoint', 'access', 'outlook', 'libreoffice'])
    if (s.includes(f)) return f
  if (/procesadores? texto/.test(s)) return 'word'
  if (/hoja de c[aá]lculo/.test(s)) return 'excel'
  return null
}

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 3, idle_timeout: 20 })

;(async () => {
  const items = []

  const arts = await sql`
    SELECT a.id, a.article_number num, a.content, l.short_name ley
      FROM articles a JOIN laws l ON l.id = a.law_id
     WHERE a.is_active AND l.is_virtual AND a.content ~* 'ctrl *\\+'`
  for (const a of arts) {
    const fam = familiaDe(a.ley)
    if (!fam) continue
    for (const p of extraerAtajos(a.content))
      items.push({ ...p, familia: fam, contenedor: a.ley, ref: `art:${a.id}`, fuente: `${a.ley} art.${a.num}` })
  }

  const qs = await sql`
    SELECT q.id, q.question_text, q.correct_option, q.option_a, q.option_b, q.option_c, q.option_d,
           q.explanation, l.short_name ley,
           (SELECT count(*)::int FROM test_questions t WHERE t.question_id = q.id) exp
      FROM questions q JOIN articles a ON a.id = q.primary_article_id JOIN laws l ON l.id = a.law_id
     WHERE q.is_active AND l.is_virtual
       AND (q.question_text || coalesce(q.explanation,'')) ~* 'ctrl *\\+'`
  for (const q of qs) {
    const fam = familiaDe(q.ley)
    if (!fam) continue
    // Lo que la pregunta AFIRMA: su enunciado junto a la opción marcada, y su explicación.
    const clave = q[['option_a', 'option_b', 'option_c', 'option_d'][q.correct_option]] || ''
    const afirma = `${q.question_text} ${clave}`.replace(/\n/g, ' ')
    for (const p of extraerAtajos(afirma))
      items.push({ ...p, familia: fam, contenedor: q.ley, ref: `q:${q.id}`, fuente: `pregunta ${q.id.slice(0, 8)} (${q.exp} exp, clave)` })
    for (const p of extraerAtajos(q.explanation || ''))
      items.push({ ...p, familia: fam, contenedor: q.ley, ref: `q:${q.id}`, fuente: `pregunta ${q.id.slice(0, 8)} (${q.exp} exp, explicación)` })
  }

  let res = contradicciones(items)
  if (SOLO_BANDA) res = res.filter((r) => r.banda === SOLO_BANDA)
  if (SOLO_FAMILIA) res = res.filter((r) => r.familia === SOLO_FAMILIA)

  if (JSON_OUT) { console.log(JSON.stringify(res, null, 2)); await sql.end(); return }

  console.log(`\n🔎 Coherencia de atajos — ${items.length} afirmaciones extraídas de ${arts.length} artículos y ${qs.length} preguntas\n`)
  const porBanda = { interna: 0, contenedor: 0, familia: 0 }
  for (const r of res) porBanda[r.banda]++
  console.log(`   interna    ${String(porBanda.interna).padStart(3)}  ← un mismo texto se contradice: indefendible`)
  console.log(`   contenedor ${String(porBanda.contenedor).padStart(3)}  ← dos textos del mismo contenedor discrepan`)
  console.log(`   familia    ${String(porBanda.familia).padStart(3)}  ← contenedores hermanos: puede ser diferencia real de versión/soporte\n`)

  for (const r of res) {
    console.log(`${'='.repeat(92)}\n[${r.banda}] ${r.familia} · ${r.accion} → ${r.teclas.join('  vs  ')}`)
    for (const a of r.afirmaciones)
      console.log(`   ${a.tecla.padEnd(14)} ${a.fuente}\n      «${a.linea.slice(0, 118)}»`)
  }
  if (!res.length) console.log('✅ sin contradicciones')
  await sql.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
