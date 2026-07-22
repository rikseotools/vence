/**
 * @jest-environment node
 *
 * Hook de cambio de scope (T-086 Fase D, capa 3): el trigger tg_topic_scope_enqueue_pdf encola el
 * tema al cambiar su topic_scope. Se ejercita sobre un tema REAL dentro de una TRANSACCIÓN CON
 * ROLLBACK → verifica el trigger de verdad sin mutar nada en producción.
 *
 * Requiere DATABASE_URL. Sin ella, se salta.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'

const URL = process.env.DATABASE_URL
const d = URL ? describe : describe.skip
const ROLLBACK = '__rollback_hook_test__'

d('hook topic_scope → encola PDF (trigger, tx con rollback)', () => {
  let conn: ReturnType<typeof postgres>
  let db: ReturnType<typeof drizzle>

  beforeAll(() => {
    conn = postgres(URL!, { ssl: { rejectUnauthorized: false }, max: 2, prepare: false })
    db = drizzle(conn)
  })
  afterAll(async () => { await conn.end() })

  // Ejecuta fn dentro de una transacción que SIEMPRE revierte (no toca datos reales).
  async function inRollback(fn: (tx: any) => Promise<void>) {
    try {
      await db.transaction(async (tx) => { await fn(tx); throw new Error(ROLLBACK) })
    } catch (e) {
      if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
    }
  }

  async function pickRealScope(tx: any) {
    const r = await tx.execute(sql`
      SELECT ts.id, ts.article_numbers, t.position_type AS pt, t.topic_number AS tema
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
      WHERE t.is_active AND t.disponible AND ts.article_numbers IS NOT NULL
        AND array_length(ts.article_numbers, 1) >= 1
      LIMIT 1`)
    return (r as any[])[0]
  }

  it('cambiar article_numbers del scope encola el tema (hook:scope) + emite evento', async () => {
    await inRollback(async (tx) => {
      const s = await pickRealScope(tx)
      expect(s).toBeTruthy()
      // partimos de cero para este tema (en la tx) → el trigger insertará fresco
      await tx.execute(sql`DELETE FROM temario_pdf_jobs WHERE oposicion=${s.pt} AND tema=${s.tema} AND content_hash='hook:scope'`)
      // cambio REAL de article_numbers → dispara el trigger
      await tx.execute(sql`UPDATE topic_scope SET article_numbers = array_append(article_numbers, '__hooktest__') WHERE id=${s.id}`)

      const jobs = await tx.execute(sql`
        SELECT status, content_hash FROM temario_pdf_jobs
        WHERE oposicion=${s.pt} AND tema=${s.tema} AND content_hash='hook:scope'`)
      expect((jobs as any[]).length).toBe(1)
      expect((jobs as any[])[0].status).toBe('pending')

      const ev = await tx.execute(sql`
        SELECT 1 FROM observable_events
        WHERE event_type='temario_pdf_hook_enqueued' AND source='hook'
          AND metadata->>'oposicion'=${s.pt} AND metadata->>'tema'=${String(s.tema)}`)
      expect((ev as any[]).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('encolado idempotente: dos cambios seguidos del mismo tema → 1 solo job vivo', async () => {
    await inRollback(async (tx) => {
      const s = await pickRealScope(tx)
      await tx.execute(sql`DELETE FROM temario_pdf_jobs WHERE oposicion=${s.pt} AND tema=${s.tema} AND content_hash='hook:scope'`)
      await tx.execute(sql`UPDATE topic_scope SET article_numbers = array_append(article_numbers, '__h1__') WHERE id=${s.id}`)
      await tx.execute(sql`UPDATE topic_scope SET article_numbers = array_append(article_numbers, '__h2__') WHERE id=${s.id}`)
      const jobs = await tx.execute(sql`
        SELECT count(*)::int AS n FROM temario_pdf_jobs
        WHERE oposicion=${s.pt} AND tema=${s.tema} AND content_hash='hook:scope' AND status IN ('pending','running')`)
      expect(Number((jobs as any[])[0].n)).toBe(1) // dedup por _alive_uq
    })
  })

  it('update NO-relevante (mismo article_numbers) NO encola', async () => {
    await inRollback(async (tx) => {
      const s = await pickRealScope(tx)
      await tx.execute(sql`DELETE FROM temario_pdf_jobs WHERE oposicion=${s.pt} AND tema=${s.tema} AND content_hash='hook:scope'`)
      // UPDATE que deja article_numbers y law_id igual → el guard del trigger corta → no encola
      await tx.execute(sql`UPDATE topic_scope SET article_numbers = article_numbers WHERE id=${s.id}`)
      const jobs = await tx.execute(sql`
        SELECT count(*)::int AS n FROM temario_pdf_jobs
        WHERE oposicion=${s.pt} AND tema=${s.tema} AND content_hash='hook:scope'`)
      expect(Number((jobs as any[])[0].n)).toBe(0)
    })
  })
})
