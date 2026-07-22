/**
 * @jest-environment node
 *
 * Integración de la cola de PDFs contra la BD real (RDS). Ejercita el CÓDIGO del módulo
 * (no SQL duplicado) sobre una instancia Drizzle de test → verifica la semántica de
 * concurrencia que un mock no cubriría: idempotencia, claim, skip-locked, retry/DLQ, stale.
 *
 * Requiere DATABASE_URL. Sin ella, se salta (no rompe CI local).
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import {
  enqueuePdfJob, claimNextPdfJob, markPdfJobDone, markPdfJobFailed,
  requeueStalePdfJobs, pdfJobStats, type JobDb,
} from '@/lib/temario/pdf/pdfJobQueue'

const URL = process.env.DATABASE_URL
const d = URL ? describe : describe.skip

// Sentinela de test: todas las filas de este suite usan esta oposición → limpieza segura.
const OPO = '__test_pdf_queue__'
const h = (s: string) => `testhash_${s}`

d('pdfJobQueue — integración RDS', () => {
  let conn: ReturnType<typeof postgres>
  let db: JobDb & { execute: (q: unknown) => Promise<unknown> }

  beforeAll(async () => {
    conn = postgres(URL!, { ssl: { rejectUnauthorized: false }, max: 4, prepare: false })
    db = drizzle(conn) as any
    await db.execute(sql`DELETE FROM temario_pdf_jobs WHERE oposicion = ${OPO}`)
  })
  afterAll(async () => {
    await db.execute(sql`DELETE FROM temario_pdf_jobs WHERE oposicion = ${OPO}`)
    await conn.end()
  })
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM temario_pdf_jobs WHERE oposicion = ${OPO}`)
  })

  it('enqueue es idempotente sobre jobs vivos (no duplica)', async () => {
    expect(await enqueuePdfJob(db, { oposicion: OPO, tema: 1, contentHash: h('a') })).toBe(true)
    expect(await enqueuePdfJob(db, { oposicion: OPO, tema: 1, contentHash: h('a') })).toBe(false)
    const n = await db.execute(sql`SELECT count(*)::int AS n FROM temario_pdf_jobs WHERE oposicion=${OPO} AND tema=1`)
    expect(Number((n as any[])[0].n)).toBe(1)
  })

  it('distinto contentHash → distinto job (regeneración por cambio de contenido)', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 2, contentHash: h('v1') })
    await enqueuePdfJob(db, { oposicion: OPO, tema: 2, contentHash: h('v2') })
    const n = await db.execute(sql`SELECT count(*)::int AS n FROM temario_pdf_jobs WHERE oposicion=${OPO} AND tema=2`)
    expect(Number((n as any[])[0].n)).toBe(2)
  })

  // Todos los claims van scoped al sentinela (oposicionPrefix) → nunca tocan jobs reales de la cola.
  const P = { oposicionPrefix: OPO }

  it('claim marca running + attempts=1; sin pendientes devuelve null', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 3, contentHash: h('c') })
    const job = await claimNextPdfJob(db, P)
    expect(job).toMatchObject({ oposicion: OPO, tema: 3, attempts: 1 })
    const st = await db.execute(sql`SELECT status FROM temario_pdf_jobs WHERE id=${job!.id}`)
    expect((st as any[])[0].status).toBe('running')
    // No quedan pendientes del sentinela → null (aislado de la cola real)
    expect(await claimNextPdfJob(db, P)).toBeNull()
  })

  it('cada job se reclama UNA sola vez (no doble-grab)', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 10, contentHash: h('x') })
    await enqueuePdfJob(db, { oposicion: OPO, tema: 11, contentHash: h('y') })
    await enqueuePdfJob(db, { oposicion: OPO, tema: 12, contentHash: h('z') })
    const ids = new Set<string>()
    for (let i = 0; i < 3; i++) {
      const j = await claimNextPdfJob(db, P)
      if (j) ids.add(j.id)
    }
    expect(ids.size).toBe(3) // 3 jobs distintos, ninguno repetido
    expect(await claimNextPdfJob(db, P)).toBeNull()
  })

  it('fail reintenta bajo el tope y va a DLQ al agotarlo', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 4, contentHash: h('r') })
    const j = await claimNextPdfJob(db, P)
    expect(j!.attempts).toBe(1)
    // maxAttempts=2 → tras el 1er fallo (attempts=1) vuelve a pending
    expect(await markPdfJobFailed(db, j!.id, { error: 'boom', maxAttempts: 2 })).toBe('pending')
    // 2º claim → attempts=2 → fallo → DLQ
    const j2 = await claimNextPdfJob(db, P)
    expect(j2!.id).toBe(j!.id)
    expect(j2!.attempts).toBe(2)
    expect(await markPdfJobFailed(db, j2!.id, { error: 'boom2', maxAttempts: 2 })).toBe('failed')
    const st = await db.execute(sql`SELECT status, last_error FROM temario_pdf_jobs WHERE id=${j!.id}`)
    expect((st as any[])[0].status).toBe('failed')
    expect((st as any[])[0].last_error).toBe('boom2')
  })

  it('done marca el job con bytes/ms', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 5, contentHash: h('d') })
    const j = await claimNextPdfJob(db, P)
    await markPdfJobDone(db, j!.id, { bytes: 12345, ms: 678 })
    const st = await db.execute(sql`SELECT status, bytes, ms FROM temario_pdf_jobs WHERE id=${j!.id}`)
    expect((st as any[])[0].status).toBe('done')
    expect(Number((st as any[])[0].bytes)).toBe(12345)
    expect(Number((st as any[])[0].ms)).toBe(678)
  })

  it('requeueStale rescata un running colgado', async () => {
    // Inserta un running con claimed_at antiguo directamente.
    await db.execute(sql`
      INSERT INTO temario_pdf_jobs (oposicion, tema, content_hash, status, attempts, claimed_at)
      VALUES (${OPO}, 6, ${h('s')}, 'running', 1, now() - interval '2 hours')`)
    const rescued = await requeueStalePdfJobs(db, 60, P) // scoped: no toca running reales
    expect(rescued).toBe(1)
    const st = await db.execute(sql`SELECT status FROM temario_pdf_jobs WHERE oposicion=${OPO} AND tema=6`)
    expect((st as any[])[0].status).toBe('pending')
  })

  it('pdfJobStats devuelve contadores por estado', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 7, contentHash: h('p1') })
    await enqueuePdfJob(db, { oposicion: OPO, tema: 8, contentHash: h('p2') })
    const stats = await pdfJobStats(db)
    expect(stats.pending).toBeGreaterThanOrEqual(2)
    expect(stats).toHaveProperty('running')
    expect(stats).toHaveProperty('done')
    expect(stats).toHaveProperty('failed')
  })
})
