// scripts/backfill-position-type-and-theme-stats.mjs
//
// Backfill de la regresión position_type=NULL (05/07/2026, commit b4ef6fc9).
// Repara en DOS pasos, en UNA transacción:
//   1) tests.position_type: deriva de test_url (mismo criterio que el runtime,
//      derivePositionTypeFromPathname) para los tests con URL de oposición.
//   2) user_theme_stats: recompute idempotente de los pares (user_id, position_type)
//      afectados — el trigger SALTA cuando position_type es NULL, así que esas
//      stats no se crearon nunca. Se reconstruyen desde test_questions con la
//      MISMA semántica del trigger (total, correct=Σis_correct, last_study=max).
//
// Uso (tsx: el script importa el helper TS de runtime, fuente única):
//   Dry-run (por defecto, NO escribe):
//     NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/backfill-position-type-and-theme-stats.mjs
//   Aplicar de verdad:
//     NODE_TLS_REJECT_UNAUTHORIZED=0 APPLY=1 npx tsx scripts/backfill-position-type-and-theme-stats.mjs
//
// Ordenado para DESPUÉS del deploy del fix (si no, prod sigue generando NULLs).
import dotenv from 'dotenv'
import pg from 'pg'
import { derivePositionTypeFromPathname } from '../lib/config/oposiciones.ts'

dotenv.config({ path: '.env.local', override: true })
const APPLY = process.env.APPLY === '1'
const url = process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

const log = (...a) => console.log(...a)

async function main() {
  await c.connect()
  log(`\n=== Backfill position_type + user_theme_stats — modo ${APPLY ? 'APLICAR' : 'DRY-RUN (sin escribir)'} ===\n`)

  // 1) Candidatos: tests con position_type NULL y test_url → derivar
  const { rows: candidates } = await c.query(
    "SELECT id, test_url FROM tests WHERE position_type IS NULL AND test_url IS NOT NULL",
  )
  const updates = [] // { id, positionType }
  for (const r of candidates) {
    const pt = derivePositionTypeFromPathname(r.test_url)
    if (pt) updates.push({ id: r.id, positionType: pt })
  }
  log(`Paso 1 — tests a rellenar position_type: ${updates.length} (de ${candidates.length} NULL+url; el resto son URLs globales legítimas)`)

  // Pares (user, positionType) afectados → para recompute de stats
  const { rows: pairs } = await c.query(
    `SELECT DISTINCT t.user_id, $1::text[] AS _ignore
     FROM tests t WHERE false`, [[]],
  ).catch(() => ({ rows: [] }))
  void pairs

  if (!APPLY) {
    // Dry-run: simular el efecto para reportar impacto sin escribir.
    const ids = updates.map(u => u.id)
    const { rows: affPairs } = await c.query(
      `SELECT DISTINCT t.user_id, u.pt AS position_type
       FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS pt) u
       JOIN tests t ON t.id = u.id`,
      [ids, updates.map(u => u.positionType)],
    )
    const users = new Set(affPairs.map(p => p.user_id))
    // Cuántas filas user_theme_stats se (re)construirían para esos pares
    const { rows: [{ n: themeRows }] } = await c.query(
      `SELECT count(*)::int n FROM (
         SELECT t.user_id, u.pt, tq.tema_number
         FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS pt) u
         JOIN tests t ON t.id = u.id
         JOIN test_questions tq ON tq.test_id = t.id
         WHERE tq.tema_number IS NOT NULL
         GROUP BY t.user_id, u.pt, tq.tema_number
       ) x`,
      [ids, updates.map(u => u.positionType)],
    )
    log(`Paso 2 — pares (user, oposición) afectados: ${affPairs.length} | usuarios distintos: ${users.size}`)
    log(`         filas user_theme_stats que se crearían/actualizarían (de estos tests): ${themeRows}`)
    log(`\nDRY-RUN: no se ha escrito nada. Relanza con APPLY=1 para aplicar.\n`)
    await c.end()
    return
  }

  // 2) APLICAR en transacción
  await c.query('BEGIN')
  try {
    // 2a) UPDATE position_type (batched via unnest)
    const ids = updates.map(u => u.id)
    const pts = updates.map(u => u.positionType)
    const upd = await c.query(
      `UPDATE tests t SET position_type = u.pt
       FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS pt) u
       WHERE t.id = u.id AND t.position_type IS NULL`,
      [ids, pts],
    )
    log(`Paso 1 aplicado — tests actualizados: ${upd.rowCount}`)

    // 2b) Recompute idempotente de user_theme_stats para los pares afectados.
    //     DELETE + rebuild desde test_questions (misma semántica del trigger).
    const { rows: affPairs } = await c.query(
      `SELECT DISTINCT t.user_id, t.position_type
       FROM (SELECT unnest($1::uuid[]) AS id) u JOIN tests t ON t.id = u.id
       WHERE t.position_type IS NOT NULL`,
      [ids],
    )
    const uUsers = affPairs.map(p => p.user_id)
    const uPts = affPairs.map(p => p.position_type)
    const del = await c.query(
      `DELETE FROM user_theme_stats s
       USING (SELECT unnest($1::uuid[]) AS user_id, unnest($2::text[]) AS position_type) a
       WHERE s.user_id = a.user_id AND s.position_type = a.position_type`,
      [uUsers, uPts],
    )
    const ins = await c.query(
      `INSERT INTO user_theme_stats (user_id, position_type, tema_number, total, correct, last_study, updated_at)
       SELECT t.user_id, t.position_type, tq.tema_number,
              count(*)::int, count(*) FILTER (WHERE tq.is_correct)::int,
              max(tq.created_at), NOW()
       FROM (SELECT unnest($1::uuid[]) AS user_id, unnest($2::text[]) AS position_type) a
       JOIN tests t ON t.user_id = a.user_id AND t.position_type = a.position_type
       JOIN test_questions tq ON tq.test_id = t.id
       WHERE tq.tema_number IS NOT NULL
       GROUP BY t.user_id, t.position_type, tq.tema_number`,
      [uUsers, uPts],
    )
    log(`Paso 2 aplicado — pares recomputados: ${affPairs.length} | filas borradas: ${del.rowCount} | filas reconstruidas: ${ins.rowCount}`)

    // Verificación: ningún test de oposición recién tocado queda NULL
    const { rows: [{ n: leftNull }] } = await c.query(
      `SELECT count(*)::int n FROM tests WHERE id = ANY($1::uuid[]) AND position_type IS NULL`,
      [ids],
    )
    if (leftNull > 0) throw new Error(`Verificación falló: ${leftNull} tests siguen NULL tras el UPDATE`)
    await c.query('COMMIT')
    log(`\n✅ COMMIT — backfill + recompute aplicados. Verificación: 0 tests objetivo quedan NULL.\n`)
  } catch (e) {
    await c.query('ROLLBACK')
    log(`\n❌ ROLLBACK — ${e.message}\n`)
    process.exitCode = 1
  }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
