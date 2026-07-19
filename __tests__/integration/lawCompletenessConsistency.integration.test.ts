/**
 * @jest-environment node
 *
 * Simulacro de robustez: la lógica de estado de completitud de leyes está
 * ESPEJADA en varios sitios (módulo TS `lib/laws/completeness.ts`, mirrors inline
 * en `health-sweep.cjs` / `audit-law-completeness.cjs`, y la VISTA SQL
 * `law_verification_effective`). Si divergen, el badge/detector/vista mostrarían
 * estados distintos para la misma ley = bug latente.
 *
 * Verifica que la VISTA SQL y el MÓDULO TS coinciden en TODAS las leyes.
 */
import { classifyLawCompleteness } from '@/lib/laws/completeness'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const postgres = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres')

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

describeIfDb('law_verification_effective (SQL) ↔ classifyLawCompleteness (TS)', () => {
  let sql: any
  beforeAll(() => { sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 }) })
  afterAll(async () => { if (sql) await sql.end() })

  test('la vista SQL y el módulo TS asignan el MISMO estado a todas las leyes', async () => {
    const rows = await sql`
      SELECT l.id AS law_id, l.is_virtual, l.scope, l.boe_url,
             l.verification_status, l.last_verification_summary,
             e.effective_state AS view_state
      FROM laws l JOIN law_verification_effective e ON e.law_id = l.id`
    expect(rows.length).toBeGreaterThan(1000)

    const mismatches: string[] = []
    for (const r of rows) {
      const ts = classifyLawCompleteness({
        isVirtual: r.is_virtual, scope: r.scope, boeUrl: r.boe_url,
        verificationStatus: r.verification_status, lastVerificationSummary: r.last_verification_summary,
      })
      if (ts.state !== r.view_state) mismatches.push(`${r.law_id}: TS=${ts.state} SQL=${r.view_state}`)
    }
    if (mismatches.length) console.error('DRIFT vista↔módulo:', mismatches.slice(0, 20))
    expect(mismatches).toEqual([])
  }, 60000)

  test('INVARIANTE: ninguna ley viva actualizada+summary NULL sale verified (falso verde imposible en la vista)', async () => {
    const [row] = await sql`
      SELECT count(*)::int AS n FROM law_verification_effective e
      JOIN laws l ON l.id = e.law_id
      WHERE e.serving_live AND e.effective_state='verified'
        AND l.verification_status='actualizada' AND l.last_verification_summary IS NULL
        AND NOT coalesce(l.is_virtual,false)`
    expect(row.n).toBe(0)
  }, 60000)
})
