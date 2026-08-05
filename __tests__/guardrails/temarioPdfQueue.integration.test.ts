/**
 * @jest-environment node
 *
 * Canary/guardrail de la cola de PDFs del temario (T-086 Fase D). Verifica contra la BD REAL que
 * los invariantes se sostienen en producción — no que el código "debería" mantenerlos:
 *  1. Existe el índice parcial de idempotencia y el check de status.
 *  2. INVARIANTE físico: 0 grupos con >1 job VIVO por (oposicion, tema, content_hash).
 *  3. Salud: la función pdfQueueHealth responde y (canary) no hay 'running' colgados sin rescatar.
 *
 * Requiere DATABASE_URL. Sin ella, se salta.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { pdfQueueHealth, type JobDb } from '@/lib/temario/pdf/pdfJobQueue'

const URL = process.env.DATABASE_URL
const d = URL ? describe : describe.skip

d('canary — cola temario_pdf_jobs', () => {
  let conn: ReturnType<typeof postgres>
  let db: JobDb & { execute: (q: unknown) => Promise<any> }

  beforeAll(() => {
    conn = postgres(URL!, { ssl: { rejectUnauthorized: false }, max: 2, prepare: false })
    db = drizzle(conn) as any
  })
  afterAll(async () => { await conn.end() })

  it('existe el índice de idempotencia y el check de status', async () => {
    const idx = await db.execute(sql`SELECT indexname FROM pg_indexes WHERE tablename = 'temario_pdf_jobs'`)
    const names = idx.map((r: any) => r.indexname)
    expect(names).toContain('temario_pdf_jobs_alive_uq')
    expect(names).toContain('temario_pdf_jobs_pending')
    const chk = await db.execute(sql`
      SELECT conname FROM pg_constraint WHERE conname = 'temario_pdf_jobs_status_check'`)
    expect(chk.length).toBe(1)
  })

  it('INVARIANTE: 0 grupos con >1 job vivo (pending/running) por oposicion+tema+content_hash', async () => {
    const dups = await db.execute(sql`
      SELECT oposicion, tema, content_hash, count(*)::int AS n
      FROM temario_pdf_jobs
      WHERE status IN ('pending', 'running')
      GROUP BY oposicion, tema, content_hash
      HAVING count(*) > 1`)
    expect(dups).toEqual([])
  })

  it('pdfQueueHealth responde con la forma esperada y sin negativos', async () => {
    const h = await pdfQueueHealth(db)
    for (const k of ['pending', 'running', 'done', 'failed', 'staleRunning'] as const) {
      expect(typeof h[k]).toBe('number')
      expect(h[k]).toBeGreaterThanOrEqual(0)
    }
  })

  it('CANARY: no hay jobs running colgados (staleRunning) — señal de worker caído sin rescatar', async () => {
    const h = await pdfQueueHealth(db)
    // Si esto salta: un worker murió a media faena y nadie llamó requeueStale. Investigar el worker.
    expect(h.staleRunning).toBe(0)
  })

  it('CANARY: el hook (trigger de topic_scope) sigue instalado', async () => {
    // Si esto salta: un cambio de scope YA no encola la regeneración del PDF → PDFs stale hasta el
    // barrido nocturno. El trigger vive en 20260722_temario_pdf_hook_scope.sql.
    const tg = await db.execute(sql`
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'topic_scope'::regclass AND tgname = 'tg_topic_scope_enqueue_pdf' AND NOT tgisinternal`)
    expect(tg.length).toBe(1)
  })
})
