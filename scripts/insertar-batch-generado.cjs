#!/usr/bin/env node
/**
 * Inserta un batch de preguntas IA-generadas en `draft` desde un JSON borrador.
 *
 * Uso:
 *   node scripts/insertar-batch-generado.cjs <fichero.json> <law_slug> <batch_id>
 *
 * <law_slug> es la ley POR DEFECTO. Un tema que se apoya en varias leyes puede
 * poner `"law_slug"` en cada pregunta del JSON; en ese caso pásale `-` como
 * law_slug de CLI y cada pregunta resuelve su propia ley. El dedup del Paso 3
 * corre contra TODAS las leyes que toque el batch.
 *
 * Implementa los Pasos 3, 4 y 5 del manual `docs/maintenance/generar-preguntas-con-ia.md`:
 *
 *   Paso 3 — DEDUP previo: aborta si alguna pregunta del borrador coincide (texto
 *            normalizado) con otra ya existente en BD sobre la misma ley.
 *   Paso 4 — Inserta UNA pregunta y valida los 6 invariantes ANTES de tocar el resto.
 *            Si alguno falla, aborta sin insertar nada más.
 *   Paso 5 — Inserta el resto y vuelca los IDs a <batch_id>_inserted_ids.json.
 *
 * Todo entra como `lifecycle_state='draft'` → el trigger fuerza `is_active=false`.
 * Nada es visible para el usuario hasta la transición explícita del Paso 8.
 *
 * Formato del JSON de entrada (array):
 *   [{"primary_article_number":"3","question_text":"...",
 *     "options":["A","B","C","D"],"correct_option":0,"explanation":"..."}]
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))

const [FILE, LAW_SLUG, BATCH] = process.argv.slice(2)
if (!FILE || !LAW_SLUG || !BATCH) {
  console.error('uso: node scripts/insertar-batch-generado.cjs <fichero.json> <law_slug> <batch_id>')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

const norm = (t) => t.replace(/\s+/g, ' ').trim().toLowerCase()

// Resolución de ley por slug con caché. Cada pregunta puede traer su propio
// `law_slug` (temas que se apoyan en >1 ley); si no, se usa el del CLI.
const _lawCache = new Map()
async function resolveLaw(slug) {
  if (_lawCache.has(slug)) return _lawCache.get(slug)
  const row = (await s`SELECT id, short_name FROM laws WHERE slug=${slug}`)[0] || null
  _lawCache.set(slug, row)
  return row
}

async function insertOne(q, defaultLawId) {
  const slug = q.law_slug
  const lawId = slug ? (await resolveLaw(slug))?.id : defaultLawId
  if (!lawId) return { skipped: `ley no encontrada para la pregunta (law_slug=${slug || '(sin default)'})` }
  const art = (await s`SELECT id FROM articles WHERE law_id=${lawId} AND article_number=${q.primary_article_number}`)[0]
  if (!art) return { skipped: `artículo ${q.primary_article_number} no existe en la ley ${slug || defaultLawId}` }
  const r = await s`
    INSERT INTO questions
      (question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
       primary_article_id, question_type, difficulty, lifecycle_state, tags,
       deactivation_reason, topic_review_status)
    VALUES (${q.question_text}, ${q.options[0]}, ${q.options[1]}, ${q.options[2]}, ${q.options[3]},
       ${q.correct_option}, ${q.explanation}, ${art.id}, 'single', 'medium', 'draft',
       ${['ia_generada', BATCH]}, 'Pendiente de revisión post-generación IA', 'pending')
    RETURNING id`
  return { id: r[0].id }
}

;(async () => {
  const Q = JSON.parse(fs.readFileSync(FILE, 'utf8'))

  // LAW_SLUG del CLI es el default; se puede pasar '-' si cada pregunta trae su
  // propio `law_slug` (temas multi-ley). El default puede no existir en ese caso.
  const defaultLaw = LAW_SLUG === '-' ? null : (await s`SELECT id, short_name FROM laws WHERE slug=${LAW_SLUG}`)[0]
  if (LAW_SLUG !== '-' && !defaultLaw) throw new Error(`ley no encontrada: ${LAW_SLUG}`)

  // Conjunto real de leyes que toca el batch (default + cualquier law_slug por pregunta).
  const slugs = new Set(Q.map((q) => q.law_slug).filter(Boolean))
  if (defaultLaw) slugs.add(LAW_SLUG)
  const lawIds = []
  for (const sl of slugs) { const l = await resolveLaw(sl); if (l) lawIds.push(l.id) }
  if (!lawIds.length) throw new Error('el batch no referencia ninguna ley válida (ni default ni law_slug)')
  console.log(`leyes del batch: ${[...slugs].join(', ')} · borrador: ${Q.length} preguntas · batch: ${BATCH}\n`)

  // ---- Paso 3: dedup contra lo ya existente sobre TODAS las leyes del batch ----
  const existentes = await s`
    SELECT q.question_text FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    WHERE a.law_id = ANY(${lawIds})`
  const set = new Set(existentes.map((e) => norm(e.question_text)))
  const dups = Q.filter((q) => set.has(norm(q.question_text)))
  if (dups.length) {
    console.error(`❌ DEDUP: ${dups.length} pregunta(s) del borrador ya existen en BD. Abortado, no se inserta nada.`)
    dups.forEach((d) => console.error(`   · ${d.question_text.slice(0, 90)}…`))
    await s.end()
    process.exit(2)
  }
  console.log(`✅ Paso 3 — dedup: 0 colisiones (${existentes.length} preguntas previas sobre ${lawIds.length} ley(es))`)

  // ---- Paso 4: una sola pregunta + invariantes ----
  const first = await insertOne(Q[0], defaultLaw?.id)
  if (first.skipped) throw new Error(`la primera pregunta no se pudo insertar: ${first.skipped}`)
  const v = (await s`SELECT lifecycle_state, is_active, tags, content_hash, correct_option, question_type
                     FROM questions WHERE id=${first.id}`)[0]
  const checks = [
    ["lifecycle_state='draft'", v.lifecycle_state === 'draft'],
    ['is_active=false', v.is_active === false],
    ['tags contiene ia_generada + batch_id', v.tags?.includes('ia_generada') && v.tags?.includes(BATCH)],
    ['content_hash de 32 chars', typeof v.content_hash === 'string' && v.content_hash.length === 32],
    [`correct_option=${Q[0].correct_option}`, v.correct_option === Q[0].correct_option],
    ["question_type='single'", v.question_type === 'single'],
  ]
  console.log('\n✅ Paso 4 — invariantes de la pregunta de prueba:')
  checks.forEach(([n, ok]) => console.log(`   ${ok ? '✅' : '❌'} ${n}`))
  if (checks.some(([, ok]) => !ok)) {
    console.error('\n❌ INVARIANTE FALLIDA — abortado. Revisa antes de insertar el resto.')
    await s.end()
    process.exit(2)
  }

  // ---- Paso 5: el resto ----
  const ids = [first.id]
  const skipped = []
  for (let i = 1; i < Q.length; i++) {
    const r = await insertOne(Q[i], defaultLaw?.id)
    if (r.skipped) skipped.push(`Q${i + 1}: ${r.skipped}`)
    else ids.push(r.id)
  }
  const out = path.join(path.dirname(FILE), `${BATCH}_inserted_ids.json`)
  fs.writeFileSync(out, JSON.stringify(ids, null, 1))

  const f = (await s`SELECT count(*) tot,
      count(*) FILTER (WHERE lifecycle_state='draft') draft,
      count(*) FILTER (WHERE is_active) act
    FROM questions WHERE ${BATCH} = ANY(tags)`)[0]
  console.log(`\n✅ Paso 5 — insertadas ${ids.length}/${Q.length}`)
  if (skipped.length) skipped.forEach((sk) => console.log(`   ⚠️ saltada — ${sk}`))
  console.log(`   en BD con el tag: ${f.tot} · draft: ${f.draft} · ACTIVAS: ${f.act}`)
  console.log(`   ids → ${out}`)
  console.log(`\nSiguiente: node scripts/verificar-batch-generado.cjs ${BATCH}`)

  await s.end()
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
