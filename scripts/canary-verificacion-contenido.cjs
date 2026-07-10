#!/usr/bin/env node
// scripts/canary-verificacion-contenido.cjs
//
// CANARY (verifica EN BD) de los dos sistemas de verificación de contenido:
//   S1 = topic_scope_verification (scope ↔ epígrafe)
//   S2 = topic_epigrafe_verification (literalidad epígrafe ↔ convocatoria)
//
// Prueba el camino REAL contra RDS: crea un tema throwaway (+ oposición + convocatoria
// + scope), ejercita las funciones/triggers/vista/badge, asserta el comportamiento y
// limpia. Exit 1 si algo del round-trip falla → apto para CI/cron post-deploy.
// Cubre el modo de fallo "una migración se cayó / un trigger dejó de disparar en prod".
//
// Uso: node scripts/canary-verificacion-contenido.cjs   (carga .env.local si está)
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

try {
  const p = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const RAW = process.env.DATABASE_URL
if (!RAW) { console.error('⏭️  Sin DATABASE_URL — canary saltado'); process.exit(0) }

const PT = 'canary_verif_content'
const SLUG = 'canary-verif-content' // = replace(PT,'_','-') → el join topics→oposiciones cuadra
function assert(cond, msg) { if (!cond) throw new Error(msg) }

async function main() {
  const c = new Client({ connectionString: RAW.split('?')[0], ssl: { rejectUnauthorized: false } })
  await c.connect()
  let topicId, oposicionId, convId
  try {
    // limpieza defensiva de restos de un canary anterior interrumpido
    await c.query(`DELETE FROM topics WHERE position_type=$1`, [PT])
    await c.query(`DELETE FROM oposiciones WHERE slug=$1`, [SLUG])

    // setup throwaway
    oposicionId = (await c.query(
      `INSERT INTO oposiciones (slug, nombre, tipo_acceso, administracion, is_active)
       VALUES ($1,'Canary','libre','test',true) RETURNING id`, [SLUG])).rows[0].id
    convId = (await c.query(
      `INSERT INTO convocatorias (oposicion_id, año, is_current) VALUES ($1, 2099, true) RETURNING id`, [oposicionId])).rows[0].id
    topicId = (await c.query(
      `INSERT INTO topics (position_type, topic_number, title, epigrafe, descripcion_corta, is_active)
       VALUES ($1,1,'Canary','Epígrafe canary','c',true) RETURNING id`, [PT])).rows[0].id
    const lawId = (await c.query(`SELECT id FROM laws LIMIT 1`)).rows[0].id
    await c.query(`INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES ($1,$2,ARRAY['1','2'])`, [topicId, lawId])

    // ── S1: record → verified_correct ; editar scope → stale ; verdict inválido → throw ──
    await c.query(`SELECT record_topic_verification($1,'correct','{}'::jsonb,'canary','multi_agent')`, [topicId])
    assert((await c.query(`SELECT state FROM topic_scope_verification WHERE topic_id=$1`, [topicId])).rows[0].state === 'verified_correct', 'S1 record no dejó verified_correct')
    await c.query(`UPDATE topic_scope SET article_numbers=ARRAY['1','2','3'] WHERE topic_id=$1`, [topicId])
    assert((await c.query(`SELECT state FROM topic_scope_verification WHERE topic_id=$1`, [topicId])).rows[0].state === 'stale', 'S1 trigger no invalidó a stale al cambiar scope')
    let threw = false
    try { await c.query(`SELECT record_topic_verification($1,'xxx','{}'::jsonb,'c','a')`, [topicId]) } catch { threw = true }
    assert(threw, 'S1 record no rechazó verdict inválido')

    // ── S2: record → verified_literal ; hash programa distinto → vista outdated ; editar epígrafe → stale ; verdict inválido → throw ──
    await c.query(`SELECT record_epigrafe_verification($1,'literal',$2,'H1','{}'::jsonb,'multi_agent')`, [topicId, convId])
    assert((await c.query(`SELECT state FROM topic_epigrafe_verification WHERE topic_id=$1`, [topicId])).rows[0].state === 'verified_literal', 'S2 record no dejó verified_literal')
    let eff = (await c.query(`SELECT effective_state FROM topic_epigrafe_verification_effective WHERE topic_id=$1`, [topicId])).rows[0].effective_state
    assert(eff === 'verified_literal', `S2 vista efectiva debería ser verified_literal, fue ${eff}`)
    await c.query(`UPDATE convocatorias SET programa_last_hash='H2' WHERE id=$1`, [convId]) // verificado con H1
    eff = (await c.query(`SELECT effective_state FROM topic_epigrafe_verification_effective WHERE topic_id=$1`, [topicId])).rows[0].effective_state
    assert(eff === 'outdated_convocatoria', `S2 vista no derivó outdated al cambiar programa_hash, fue ${eff}`)
    await c.query(`UPDATE topics SET epigrafe='Epígrafe canary cambiado' WHERE id=$1`, [topicId])
    assert((await c.query(`SELECT state FROM topic_epigrafe_verification WHERE topic_id=$1`, [topicId])).rows[0].state === 'stale', 'S2 trigger no invalidó a stale al cambiar epígrafe')
    threw = false
    try { await c.query(`SELECT record_epigrafe_verification($1,'xxx',$2,'H','{}'::jsonb,'a')`, [topicId, convId]) } catch { threw = true }
    assert(threw, 'S2 record no rechazó verdict inválido')

    // ── Badge combinado: query coherente ──
    const b = (await c.query(`
      SELECT count(*) FILTER (WHERE coalesce(sv.state,'never_verified') IN ('never_verified','stale','verified_issues')
                                 OR coalesce(ev.effective_state,'never_sourced') <> 'verified_literal')::int AS count
      FROM topics t
      LEFT JOIN topic_scope_verification sv ON sv.topic_id=t.id
      LEFT JOIN topic_epigrafe_verification_effective ev ON ev.topic_id=t.id
      WHERE t.is_active`)).rows[0]
    assert(Number.isInteger(b.count) && b.count >= 1, `badge combinado devolvió count inválido: ${b.count}`)

    console.log('✅ CANARY OK — S1 (scope) + S2 (epígrafe): record/trigger/vista/badge funcionan en BD')
  } finally {
    if (topicId) await c.query(`DELETE FROM topics WHERE id=$1`, [topicId]).catch(() => {})
    if (oposicionId) await c.query(`DELETE FROM oposiciones WHERE id=$1`, [oposicionId]).catch(() => {})
    await c.end()
  }
}

main().catch((e) => { console.error(`❌ CANARY FALLÓ — ${e.message}`); process.exit(1) })
