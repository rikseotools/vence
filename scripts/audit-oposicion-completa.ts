// scripts/audit-oposicion-completa.ts
//
// REEVALUACIÓN INDEPENDIENTE de completitud de una oposición contra el manual
// docs/maintenance/crear-nueva-oposicion.md. NO confía en la memoria de quien la
// creó: comprueba mecánicamente cada artefacto (FASES 2-6) en BD + config + FS y
// reporta ✅/❌/⚠️ por sub-paso. Exit 1 si hay algún ❌ → gate antes de is_active/commit.
//
//   npx tsx --env-file=.env.local scripts/audit-oposicion-completa.ts <slug>
//   npx tsx --env-file=.env.local scripts/audit-oposicion-completa.ts auxiliar-administrativo-diputacion-cordoba
//
// Complementa (no sustituye) a `npm run audit:epigrafe <position_type>` (coherencia
// epígrafe↔scope) — ese se sigue corriendo aparte (FASE 3g).

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { OPOSICIONES } from '@/lib/config/oposiciones'

const slug = process.argv[2]
if (!slug) { console.error('Uso: ... audit-oposicion-completa.ts <slug>'); process.exit(2) }

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const PT = slug.replace(/-/g, '_')

let fails = 0, warns = 0
const ok = (m: string) => console.log('  ✅ ' + m)
const bad = (m: string) => { console.log('  ❌ ' + m); fails++ }
const warn = (m: string) => { console.log('  🟡 ' + m); warns++ }

async function countQuestionsForTopic(topicId: string): Promise<number> {
  const { data: sc } = await s.from('topic_scope').select('law_id,article_numbers,include_full_title').eq('topic_id', topicId)
  let ids: string[] = []
  for (const e of sc || []) {
    let q = s.from('articles').select('id').eq('law_id', e.law_id)
    if (!e.include_full_title && e.article_numbers) q = q.in('article_number', e.article_numbers)
    const { data: a } = await q
    ids.push(...(a || []).map((x: any) => x.id))
  }
  let c = 0
  for (let i = 0; i < ids.length; i += 200) {
    const { count } = await s.from('questions').select('id', { count: 'exact', head: true })
      .in('primary_article_id', ids.slice(i, i + 200)).eq('is_active', true)
    c += count || 0
  }
  return c
}

async function main() {
  console.log(`\n━━━ Auditoría de completitud: ${slug} ━━━\n`)

  // ── FASE 4: Config oposiciones.ts ──
  console.log('FASE 4 — config oposiciones.ts')
  const cfg = OPOSICIONES.find((o: any) => o.slug === slug)
  if (!cfg) { bad('entrada en oposiciones.ts NO existe'); }
  else {
    ok('entrada en oposiciones.ts existe')
    if (cfg.positionType === PT) ok('positionType coincide con slug') ; else bad(`positionType '${cfg.positionType}' ≠ '${PT}'`)
    const themeSum = cfg.blocks.reduce((n: number, b: any) => n + b.themes.length, 0)
    if (themeSum === cfg.totalTopics) ok(`totalTopics (${cfg.totalTopics}) == suma de themes`) ; else bad(`totalTopics ${cfg.totalTopics} ≠ suma themes ${themeSum}`)
    const es: any = (cfg as any).examScoring
    if (!es) bad('examScoring AUSENTE (obligatorio, FASE 4a.ter)')
    else {
      if (es.penaltyDivisor === null || (typeof es.penaltyDivisor === 'number' && es.penaltyDivisor > 0)) ok(`examScoring.penaltyDivisor OK (${es.penaltyDivisor})`) ; else bad('penaltyDivisor inválido')
      if (es.source && es.source.length > 10) ok('examScoring.source cita boletín') ; else bad('examScoring.source vacío/insuficiente')
    }
    const aliases: string[] = (cfg as any).aliases || []
    if (aliases.length >= 3) ok(`aliases (${aliases.length})`) ; else warn(`aliases <3 (${aliases.length}) — recomendado ≥3`)
  }

  // ── FASE 2a: fila oposiciones ──
  console.log('\nFASE 2a — fila oposiciones')
  const { data: o } = await s.from('oposiciones').select('*').eq('slug', slug).single()
  if (!o) { bad('fila oposiciones NO existe'); finish(); return }
  ok('fila oposiciones existe')
  const REQ = ['nombre','categoria','grupo','subgrupo','administracion','titulo_requerido','temas_count','bloques_count','plazas_libres','estado_proceso','programa_url','seguimiento_url','diario_oficial','diario_referencia','seo_title','seo_description','landing_description','color_primario']
  const missing = REQ.filter(f => o[f] === null || o[f] === undefined || o[f] === '')
  if (!missing.length) ok('campos requeridos completos') ; else bad('campos NULL/vacíos: ' + missing.join(', '))
  if (cfg && o.temas_count === cfg.totalTopics) ok(`temas_count (${o.temas_count}) == config`) ; else if (cfg) bad(`temas_count ${o.temas_count} ≠ config ${cfg.totalTopics}`)
  if (cfg && o.bloques_count === cfg.blocks.length) ok(`bloques_count (${o.bloques_count}) == config`) ; else if (cfg) bad(`bloques_count ${o.bloques_count} ≠ config blocks ${cfg.blocks.length}`)
  if (o.examen_config && Object.keys(o.examen_config).length) ok('examen_config poblado') ; else bad('examen_config vacío')
  // schema JSONB landing (footgun 500)
  const est = o.landing_estadisticas || []
  if (Array.isArray(est) && est.length && est.every((e: any) => 'numero' in e && 'texto' in e && 'color' in e)) ok(`landing_estadisticas schema {numero,texto,color} (${est.length})`) ; else bad('landing_estadisticas mal: faltan claves numero/texto/color (riesgo 500 SSR)')
  const faqs = o.landing_faqs || []
  if (Array.isArray(faqs) && faqs.length >= 4 && faqs.every((f: any) => 'pregunta' in f && 'respuesta' in f)) ok(`landing_faqs schema {pregunta,respuesta} (${faqs.length})`) ; else bad(`landing_faqs mal o <4 (${faqs.length})`)

  // ── FASE 2b: topics ──
  console.log('\nFASE 2b — topics')
  const { data: topics } = await s.from('topics').select('id,topic_number,title,epigrafe,descripcion_corta,bloque_number,disponible').eq('position_type', PT).order('topic_number')
  if (!topics || !topics.length) { bad('0 topics'); }
  else {
    if (topics.length === o.temas_count) ok(`${topics.length} topics == temas_count`) ; else bad(`${topics.length} topics ≠ temas_count ${o.temas_count}`)
    const incompletos = topics.filter((t: any) => !t.title || !t.epigrafe || !t.descripcion_corta || t.bloque_number == null)
    if (!incompletos.length) ok('todos los topics: title+epigrafe+descripcion_corta+bloque_number') ; else bad(`${incompletos.length} topics incompletos: T` + incompletos.map((t: any) => t.topic_number).join(',T'))
  }

  // ── FASE 2b.2: oposicion_bloques ──
  console.log('\nFASE 2b.2 — oposicion_bloques')
  const { data: bloques } = await s.from('oposicion_bloques').select('bloque_number').eq('position_type', PT)
  if (bloques && bloques.length) {
    if (bloques.length === o.bloques_count) ok(`${bloques.length} bloques == bloques_count`) ; else bad(`${bloques.length} bloques ≠ bloques_count ${o.bloques_count}`)
    const tb = new Set((topics || []).map((t: any) => t.bloque_number))
    const bb = new Set(bloques.map((b: any) => b.bloque_number))
    const orphan = [...tb].filter(n => !bb.has(n))
    if (!orphan.length) ok('cada bloque_number de topics tiene fila en oposicion_bloques') ; else bad('topics con bloque sin fila en oposicion_bloques: ' + orphan.join(','))
  } else bad('0 oposicion_bloques → /temario daría 404 (FASE 2b.2)')

  // ── FASE 3: topic_scope + cobertura ──
  console.log('\nFASE 3 — topic_scope (cobertura)')
  let sinScope = 0, dispSinPreg = 0
  for (const t of topics || []) {
    const { count } = await s.from('topic_scope').select('id', { count: 'exact', head: true }).eq('topic_id', t.id)
    if (!count) { sinScope++; if (t.disponible) dispSinPreg++ ; continue }
    if (t.disponible) {
      const q = await countQuestionsForTopic(t.id)
      if (q === 0) { dispSinPreg++; warn(`T${t.topic_number} disponible=true pero 0 preguntas`) }
    }
  }
  if (sinScope === 0) ok('todos los topics tienen topic_scope') ; else warn(`${sinScope} topics sin topic_scope`)
  if (dispSinPreg === 0) ok('ningún topic disponible=true sin preguntas') ; else bad(`${dispSinPreg} topics disponibles sin preguntas (no activar)`)

  // ── FASE 2c: tabla convocatorias ──
  console.log('\nFASE 2c — tabla convocatorias')
  const { count: convN } = await s.from('convocatorias').select('id', { count: 'exact', head: true }).eq('oposicion_id', o.id)
  if (convN && convN > 0) ok(`${convN} fila(s) en convocatorias`) ; else bad('0 filas en tabla convocatorias (FASE 2c, alimenta <ConvocatoriaLinks>)')

  // ── FASE 5b: convocatoria_hitos ──
  console.log('\nFASE 5b — convocatoria_hitos')
  const { count: hitosN } = await s.from('convocatoria_hitos').select('id', { count: 'exact', head: true }).eq('oposicion_id', o.id)
  if (hitosN && hitosN > 0) ok(`${hitosN} hitos`) ; else warn('0 hitos (timeline vacío)')

  // ── FASE 5: rutas frontend ──
  console.log('\nFASE 5 — rutas frontend')
  for (const r of [`app/${slug}/temario/page.tsx`, `app/${slug}/test/page.tsx`, `app/${slug}/test/tema/[numero]/page.tsx`]) {
    if (fs.existsSync(path.join(process.cwd(), r))) ok(r) ; else bad('falta ' + r)
  }

  // ── FASE 4c: registros en UI (OnboardingModal + perfil) ──
  console.log('\nFASE 4c — registros UI')
  for (const [file, label] of [['components/OnboardingModal.tsx','OnboardingModal'],['app/perfil/page.tsx','perfil']] as const) {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    if (content.includes(PT)) ok(`${label} contiene ${PT}`) ; else bad(`${label} NO contiene ${PT}`)
  }

  finish()
}

function finish() {
  console.log(`\n━━━ ${fails} ❌  /  ${warns} 🟡 ━━━`)
  if (fails === 0) console.log('✅ Completitud OK. Recuerda además: `npm run audit:epigrafe ' + PT + '` (FASE 3g) y build/tests verdes antes de is_active=true.')
  process.exit(fails > 0 ? 1 : 0)
}

main().catch(e => { console.error(e?.message || e); process.exit(2) })
