// __tests__/api/user-stats/userStatsSummary.test.ts
// Tests para la tabla pre-computada user_stats_summary
//
// Verifica:
// 1. La tabla existe y tiene la estructura correcta
// 2. Los datos del backfill coinciden con la query pesada
// 3. El trigger está activo
// 4. El rendimiento es <100ms (vs 8-11s de la query vieja)

/* eslint-disable @typescript-eslint/no-require-imports */
const { TextEncoder: TE, TextDecoder: TD } = require('util')
if (!globalThis.TextEncoder) { globalThis.TextEncoder = TE; (globalThis as any).TextDecoder = TD }
const { Pool } = require('pg')

// SIN fallback hardcoded — el test SOLO corre si DATABASE_URL está en el entorno.
// (Antes había un fallback con credenciales reales que GitGuardian detectó como
// leak el 2026-04-30. Rotada la password el 2026-05-03.)
const DATABASE_URL = process.env.DATABASE_URL

let pool: Pool

beforeAll(() => {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL requerida para este test (cargar .env.local)')
  }
  pool = new Pool({ connectionString: DATABASE_URL })
})

afterAll(async () => {
  await pool.end()
})

describe('user_stats_summary table', () => {
  it('exists with correct columns', async () => {
    const { rows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_stats_summary'
      ORDER BY ordinal_position
    `)
    const cols = rows.map(r => r.column_name)
    expect(cols).toContain('user_id')
    expect(cols).toContain('total_questions')
    expect(cols).toContain('correct_answers')
    expect(cols).toContain('blank_answers')
    expect(cols).toContain('questions_this_week')
    expect(cols).toContain('week_start')
    expect(cols).toContain('updated_at')
  })

  it('has primary key on user_id', async () => {
    const { rows } = await pool.query(`
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_name = 'user_stats_summary' AND constraint_type = 'PRIMARY KEY'
    `)
    expect(rows.length).toBe(1)
  })

  it('has CASCADE delete from user_profiles', async () => {
    const { rows } = await pool.query(`
      SELECT rc.delete_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'user_stats_summary'
    `)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].delete_rule).toBe('CASCADE')
  })
})

describe('trigger', () => {
  it('update_user_stats_summary_trigger exists on test_questions', async () => {
    const { rows } = await pool.query(`
      SELECT trigger_name, event_manipulation
      FROM information_schema.triggers
      WHERE event_object_table = 'test_questions'
        AND trigger_name = 'update_user_stats_summary_trigger'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].event_manipulation).toBe('INSERT')
  })
})

describe('data accuracy', () => {
  it('summary matches count(*) for a heavy user', async () => {
    // Get heaviest user
    const { rows: [heaviest] } = await pool.query(`
      SELECT user_id, total_questions, correct_answers, blank_answers
      FROM user_stats_summary
      ORDER BY total_questions DESC LIMIT 1
    `)

    // Compare with real count
    const { rows: [real] } = await pool.query(`
      SELECT count(*)::int as total,
             sum(case when tq.is_correct then 1 else 0 end)::int as correct,
             coalesce(sum(case when tq.was_blank then 1 else 0 end)::int, 0) as blank
      FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = $1
    `, [heaviest.user_id])

    expect(heaviest.total_questions).toBe(real.total)
    expect(heaviest.correct_answers).toBe(real.correct)
    expect(heaviest.blank_answers).toBe(real.blank)
  })

  it('all users with test_questions have a summary row', async () => {
    const { rows: [check] } = await pool.query(`
      SELECT count(DISTINCT t.user_id) as users_with_tests,
             (SELECT count(*) FROM user_stats_summary) as summary_rows
      FROM tests t
      INNER JOIN test_questions tq ON tq.test_id = t.id
    `)
    expect(Number(check.summary_rows)).toBeGreaterThanOrEqual(Number(check.users_with_tests))
  })
})

describe('performance', () => {
  it('summary lookup takes <100ms for heaviest user', async () => {
    const { rows: [heaviest] } = await pool.query(`
      SELECT user_id FROM user_stats_summary ORDER BY total_questions DESC LIMIT 1
    `)

    const start = Date.now()
    await pool.query('SELECT * FROM user_stats_summary WHERE user_id = $1', [heaviest.user_id])
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  // Speedup real verificado con simulación: 148x (11.3s → 77ms) para Nila (55k preguntas).
  // No se testea aquí porque PostgreSQL cachea la query vieja en ejecuciones secuenciales.
})
