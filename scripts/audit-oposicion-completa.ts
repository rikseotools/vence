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

import postgres from 'postgres'
import * as fs from 'fs'
import * as path from 'path'
import { OPOSICIONES } from '@/lib/config/oposiciones'
import { hasCcaaFlag, resolveEscudo, resolveFlagKey } from '@/components/CcaaFlag'
import { oposicionToCcaa } from '@/app/oposiciones/lib/oposiciones-filters'
// [T-522] El gate pregunta a PRODUCCIÓN cuántas preguntas serviría, en vez de contarlas él.
// Ver `contarServibles` más abajo.
import { getFilteredQuestions } from '@/lib/api/filtered-questions'

const slug = process.argv[2]
if (!slug) { console.error('Uso: ... audit-oposicion-completa.ts <slug>'); process.exit(2) }

// Agnóstico a la BD: postgres-js sobre DATABASE_URL (RDS/Neon/…), el MISMO driver
// que usa la app (db/client.ts). NO usa el cliente Supabase.
const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado (agnóstico: RDS/Neon; NO Supabase). Ver db/client.ts'); process.exit(2) }
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} })
async function rows(q: any): Promise<any[]> { return await q }
const PT = slug.replace(/-/g, '_')

let fails = 0, warns = 0
// Los hallazgos se ACUMULAN además de imprimirse: hasta el 01/08 (T-455) este gate escribía CERO
// filas en `content_health_findings` y CERO en `observable_events`, así que comprobaba diez fases
// y todo moría en la terminal de quien lo ejecutaba. Si el gate fallaba —o no se corría— no
// quedaba rastro en ninguna parte, y la oposición podía publicarse igual. Es el mismo modo de
// fallo que ya costó semanas con `landing_incompleta`: una comprobación ON-DEMAND que nadie repite
// no es una comprobación, es un buen propósito.
const hallazgos: Array<{ severity: 'error' | 'warn'; message: string }> = []
const ok = (m: string) => console.log('  ✅ ' + m)
const bad = (m: string) => { console.log('  ❌ ' + m); fails++; hallazgos.push({ severity: 'error', message: m }) }
const warn = (m: string) => { console.log('  🟡 ' + m); warns++; hallazgos.push({ severity: 'warn', message: m }) }

async function contarEnScope(topicId: string): Promise<number> {
  const sc = await rows(sql`SELECT law_id, article_numbers, include_full_title FROM topic_scope WHERE topic_id = ${topicId}`)
  let ids: string[] = []
  for (const e of sc) {
    const a = (!e.include_full_title && e.article_numbers)
      ? await rows(sql`SELECT id FROM articles WHERE law_id = ${e.law_id} AND article_number = ANY(${e.article_numbers}::text[])`)
      : await rows(sql`SELECT id FROM articles WHERE law_id = ${e.law_id}`)
    ids.push(...a.map((x: any) => x.id))
  }
  if (!ids.length) return 0
  // RDS acepta el array como parámetro (sin el límite de URL del PostgREST) → una sola query.
  const r = (await rows(sql`SELECT COUNT(*)::int AS c FROM questions WHERE primary_article_id = ANY(${ids}::uuid[]) AND is_active = true`))[0]
  return r?.c || 0
}

/**
 * Lo que el TEST de ese tema puede entregar de verdad, preguntándoselo a producción
 * (`getFilteredQuestions`, la misma función que sirve /api/questions/filtered).
 *
 * ── POR QUÉ NO VALE CONTAR EL SCOPE (T-522, 04/08/2026) ─────────────────────────────────────
 * Este gate existe para impedir publicar un tema que invite a entrar y no tenga test. Contaba
 * las preguntas del scope… y el serve aplica dos filtros que ese conteo ignoraba
 * (`buildOfficialExamFilter` y `buildQuestionTagFilter`), así que daba ✅ a un tema que sirve
 * CERO. Caso real: Parque Móvil del Estado, tema 11 «Maniobras de circulación», `disponible=true`,
 * 40 preguntas en el scope y **0 servibles** — todas son de Policía Nacional, que las tiene
 * marcadas como exclusivas suyas. La oposición está ACTIVA y con inscripción abierta.
 *
 * Es el mismo defecto de clase que [T-507] arregló en los contadores de pantalla, en el gate.
 * La lección es la de `audit-served-questions.ts`: **no reimplementes el criterio, pregúntale a
 * producción** — una tercera copia del conteo es una tercera verdad.
 */
async function contarServibles(topicNumber: number, positionType: string): Promise<number> {
  try {
    const res: any = await getFilteredQuestions({
      topicNumber,
      positionType,
      numQuestions: 200,
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
    } as never)
    return res?.questions?.length ?? 0
  } catch {
    return -1 // no se pudo preguntar: no se inventa un veredicto (lo dice el mensaje)
  }
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
  const o = (await rows(sql`SELECT * FROM oposiciones WHERE slug = ${slug}`))[0]
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
  const topics = await rows(sql`SELECT id, topic_number, title, epigrafe, descripcion_corta, bloque_number, disponible FROM topics WHERE position_type = ${PT} ORDER BY topic_number`)
  if (!topics || !topics.length) { bad('0 topics'); }
  else {
    if (topics.length === o.temas_count) ok(`${topics.length} topics == temas_count`) ; else bad(`${topics.length} topics ≠ temas_count ${o.temas_count}`)
    const incompletos = topics.filter((t: any) => !t.title || !t.epigrafe || !t.descripcion_corta || t.bloque_number == null)
    if (!incompletos.length) ok('todos los topics: title+epigrafe+descripcion_corta+bloque_number') ; else bad(`${incompletos.length} topics incompletos: T` + incompletos.map((t: any) => t.topic_number).join(',T'))
  }

  // ── FASE 2b.2: oposicion_bloques ──
  console.log('\nFASE 2b.2 — oposicion_bloques')
  const bloques = await rows(sql`SELECT bloque_number FROM oposicion_bloques WHERE position_type = ${PT}`)
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
    const scn = Number((await rows(sql`SELECT COUNT(*)::int AS c FROM topic_scope WHERE topic_id = ${t.id}`))[0]?.c || 0)
    if (!scn) { sinScope++; if (t.disponible) dispSinPreg++ ; continue }
    if (t.disponible) {
      // Lo que decide es lo SERVIBLE, no lo escopado: un tema puede tener cientos de preguntas
      // en su scope y no poder dar ni una (T-522).
      const servibles = await contarServibles(t.topic_number, PT)
      if (servibles === 0) {
        dispSinPreg++
        const enScope = await contarEnScope(t.id)
        warn(enScope > 0
          ? `T${t.topic_number} disponible=true y el test sirve 0 (tiene ${enScope} en el scope, pero son de otra oposición)`
          : `T${t.topic_number} disponible=true pero 0 preguntas`)
      } else if (servibles < 0) {
        warn(`T${t.topic_number}: no se pudo preguntar a producción cuántas serviría`)
      }
    }
  }
  if (sinScope === 0) ok('todos los topics tienen topic_scope') ; else warn(`${sinScope} topics sin topic_scope`)
  if (dispSinPreg === 0) ok('ningún topic disponible=true que el test no pueda servir') ; else bad(`${dispSinPreg} topics disponibles que sirven 0 preguntas (no activar)`)

  // ── FASE 2c: tabla convocatorias (SSOT del proceso que lee el catálogo/banner) ──
  console.log('\nFASE 2c — tabla convocatorias')
  const convAll = Number((await rows(sql`SELECT COUNT(*)::int AS c FROM convocatorias WHERE oposicion_id = ${o.id}`))[0]?.c || 0)
  const conv = (await rows(sql`SELECT estado_proceso, plazas_libres, inscription_start, inscription_deadline FROM convocatorias WHERE oposicion_id = ${o.id} AND is_current = true LIMIT 1`))[0] as { estado_proceso?: string | null; plazas_libres?: number | null; inscription_start?: unknown; inscription_deadline?: unknown } | undefined
  if (!conv) {
    bad('0 filas is_current en convocatorias (FASE 2c: es el SSOT que lee /api/oposiciones/catalog y el banner)')
  } else {
    ok(`${convAll} fila(s) en convocatorias (1 is_current)`)
    // La convocatoria vigente DEBE traer los campos que el catálogo pinta, y cuadrar con oposiciones.
    // Bug real (León, 06/07/2026): la plantilla _*_fase23 escribía la fila pero OMITÍA inscription_*
    // → el catálogo mostraba la tarjeta sin fechas de inscripción.
    const op = (await rows(sql`SELECT estado_proceso, inscription_start, inscription_deadline FROM oposiciones WHERE id = ${o.id}`))[0] as { estado_proceso?: string | null; inscription_start?: unknown; inscription_deadline?: unknown } | undefined
    if (!conv.estado_proceso) bad('convocatoria vigente sin estado_proceso (badge de estado vacío en el catálogo)')
    if (conv.plazas_libres == null) warn('convocatoria vigente sin plazas_libres')
    if (op?.inscription_deadline && !conv.inscription_deadline) bad('convocatoria vigente SIN inscription_deadline pero oposiciones SÍ la tiene → catálogo con fechas en blanco (copiar a convocatorias)')
    if (op?.inscription_start && !conv.inscription_start) bad('convocatoria vigente SIN inscription_start pero oposiciones SÍ la tiene → copiar a convocatorias')
    if (op?.estado_proceso && conv.estado_proceso && op.estado_proceso !== conv.estado_proceso) warn(`estado_proceso divergente: oposiciones='${op.estado_proceso}' vs convocatoria vigente='${conv.estado_proceso}' (sincronizar)`)
  }

  // ── FASE 5b: convocatoria_hitos ──
  console.log('\nFASE 5b — convocatoria_hitos')
  const hitosN = Number((await rows(sql`SELECT COUNT(*)::int AS c FROM convocatoria_hitos WHERE oposicion_id = ${o.id}`))[0]?.c || 0)
  if (hitosN > 0) ok(`${hitosN} hitos`) ; else warn('0 hitos (timeline vacío)')

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
  // mapeo CCAA para filtros del catálogo (oposicionToCcaa); null → no aparece bien filtrada
  if (oposicionToCcaa(slug)) ok(`oposicionToCcaa('${slug}') = '${oposicionToCcaa(slug)}'`) ; else bad(`oposicionToCcaa('${slug}') = null → falta mapeo CCAA (app/oposiciones/lib/oposiciones-filters.ts)`)

  // ── FASE 4c.bis: identidad visual oficial (CcaaFlag) ──
  // Sin escudo ni bandera, la oposición cae al emoji genérico 🏛️ (señal de "falta configurar").
  console.log('\nFASE 4c.bis — identidad visual (CcaaFlag)')
  const escudo = resolveEscudo(slug) || resolveEscudo(PT)
  const flag = resolveFlagKey(slug) || resolveFlagKey(PT)
  if (hasCcaaFlag(slug) || hasCcaaFlag(PT)) {
    ok(`CcaaFlag resuelve ${escudo ? 'escudo (' + escudo.src + ')' : 'bandera (' + flag + ')'}`)
  } else {
    bad(`CcaaFlag NO resuelve nada → emoji de fallback. Añadir keyword a CcaaFlag.tsx (FASE 4c.bis)`)
  }

  await publicarHallazgos()
  finish()
}

/**
 * Publica lo encontrado donde SE MIRA: `content_health_findings` (lo pinta `/admin/contenido` y el
 * badge de salud del contenido) y una traza en `observable_events`.
 *
 * Se REEMPLAZA lo anterior de este slug+kind en vez de acumular: el gate es una foto del estado
 * actual, y dejar hallazgos viejos de una oposición ya arreglada es la forma más rápida de que el
 * panel deje de leerse. Si no hay hallazgos, se borra y no se inserta nada — el verde es la
 * ausencia de filas, igual que en el barrido nocturno.
 *
 * Fail-open: un problema al publicar NO cambia el veredicto del gate (su exit code manda), pero se
 * dice en voz alta. Una comprobación que se cae por su telemetría sería peor que la de antes.
 */
async function publicarHallazgos() {
  try {
    // Acotado también por origen (T-455, 07/08/2026): desde que `audit:served` publica en el
    // MISMO kind+slug (misma tabla, mismo destino en /admin/contenido), un DELETE que solo
    // mirara kind+slug haría que la última herramienta en correr borrara los hallazgos de la
    // otra en vez de solo los suyos — "reemplaza, no acumula" tiene que ser POR HERRAMIENTA,
    // no por slug entero.
    await sql`DELETE FROM content_health_findings WHERE kind = 'oposicion_incompleta' AND oposicion_slug = ${slug} AND detail->>'origen' = 'audit:oposicion'`
    for (const h of hallazgos) {
      await sql`
        INSERT INTO content_health_findings (id, category, severity, oposicion_slug, kind, message, detail, computed_at)
        VALUES (gen_random_uuid(), 'content', ${h.severity}, ${slug}, 'oposicion_incompleta',
                ${`${slug}: ${h.message}`}, ${sql.json({ origen: 'audit:oposicion', fase: 'creacion' })}, NOW())`
    }
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:audit-oposicion',
              ${fails > 0 ? 'error' : warns > 0 ? 'warn' : 'info'}, 'oposicion_auditada',
              ${sql.json({ slug, fails, warns })}, NOW())`
    if (hallazgos.length) {
      console.log(`\n📋 ${hallazgos.length} hallazgo(s) publicados en /admin/contenido (kind: oposicion_incompleta).`)
    }
  } catch (e: any) {
    console.log(`\n⚠️  no se pudieron publicar los hallazgos: ${e?.message || e}`)
    console.log('   El veredicto del gate NO cambia, pero esta ejecución no deja rastro en el panel.')
  }
}

function finish() {
  console.log(`\n━━━ ${fails} ❌  /  ${warns} 🟡 ━━━`)
  if (fails === 0) console.log('✅ Completitud OK. Recuerda además: `npm run audit:epigrafe ' + PT + '` (FASE 3g) y build/tests verdes antes de is_active=true.')
  process.exit(fails > 0 ? 1 : 0)
}

main().catch(e => { console.error(e?.message || e); process.exit(2) })
