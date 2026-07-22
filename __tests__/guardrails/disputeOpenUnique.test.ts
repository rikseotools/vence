/**
 * @jest-environment node
 */
/**
 * GUARDARRAÍL anti-regresión del bug de impugnaciones duplicadas (María José, 22/07).
 *
 * Root cause: `createDispute` hacía "SELECT ¿existe? → INSERT" y el código YA esperaba una
 * constraint UNIQUE (la nombraba en su manejo de error) que NUNCA se creó en la BD. Sin ella, una
 * ráfaga de multi-tap (5 POST en 44 ms) pasó todos el SELECT y creó 5 duplicados.
 *
 * Este test asegura que los índices únicos PARCIALES que lo impiden EXISTEN y son correctos, para
 * que no vuelvan a faltar en silencio (migración 20260722_dispute_open_unique.sql). Se salta si no
 * hay BD (unit CI); corre en integración y en local.
 */
import postgres from 'postgres'

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('guardrail: índices únicos parciales de impugnaciones ABIERTAS', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sql: any
  beforeAll(() => {
    sql = postgres(DB_URL as string, { ssl: { rejectUnauthorized: false }, connect_timeout: 30 })
  })
  afterAll(async () => {
    if (sql) await sql.end()
  })

  it('question_disputes_open_uq: único, sobre (question_id,user_id), parcial en pending/reviewing', async () => {
    const rows = await sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'question_disputes_open_uq'`
    expect(rows.length).toBe(1)
    const def: string = rows[0].indexdef
    expect(def).toMatch(/UNIQUE/i)
    expect(def).toMatch(/question_id/)
    expect(def).toMatch(/user_id/)
    // Parcial: SOLO abiertas → permite re-impugnar tras resolución.
    expect(def).toMatch(/pending/)
    expect(def).toMatch(/reviewing/)
    expect(def).not.toMatch(/resolved/)
  })

  it('psychometric_question_disputes_open_uq: mismo blindaje para psicotécnicas', async () => {
    const rows = await sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'psychometric_question_disputes_open_uq'`
    expect(rows.length).toBe(1)
    expect(rows[0].indexdef).toMatch(/UNIQUE/i)
    expect(rows[0].indexdef).toMatch(/pending/)
  })

  it('INVARIANTE: no existe ningún (question_id,user_id) con >1 impugnación ABIERTA', async () => {
    const dups = await sql`
      SELECT count(*)::int AS n FROM (
        SELECT 1 FROM question_disputes
        WHERE status IN ('pending','reviewing') AND question_id IS NOT NULL
        GROUP BY question_id, user_id HAVING count(*) > 1
      ) x`
    expect(dups[0].n).toBe(0)
  })
})
