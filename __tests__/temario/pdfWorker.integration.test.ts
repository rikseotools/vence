/**
 * @jest-environment node
 *
 * Worker de la cola de PDFs (capa 2): orquestación claim→render→done|fail con el render INYECTADO
 * (fake) contra la cola REAL (RDS). Verifica lo que un mock puro no cubre: la interacción con la
 * semántica de la cola (done, retry, DLQ, rescate de colgados, drenado).
 *
 * Requiere DATABASE_URL. Sin ella, se salta.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { enqueuePdfJob, type JobDb } from '@/lib/temario/pdf/pdfJobQueue'
import { processOnePdfJob, runPdfWorker, type RenderFn, type EmitFn } from '@/lib/temario/pdf/pdfWorker'

const URL = process.env.DATABASE_URL
const d = URL ? describe : describe.skip
const OPO = '__test_pdf_worker__'
const h = (s: string) => `wtesthash_${s}`

d('pdfWorker — orquestación contra cola real', () => {
  let conn: ReturnType<typeof postgres>
  let db: JobDb
  const events: any[] = []
  const emit: EmitFn = (e) => { events.push(e) }
  const okRender: RenderFn = async () => ({ ok: true, outcome: 'uploaded', bytes: 1000, ms: 50 })
  const skipRender: RenderFn = async () => ({ ok: true, outcome: 'skipped', bytes: 2000, ms: 5 })
  const failRender: RenderFn = async () => ({ ok: false, outcome: 'error', error: 'render_boom' })
  const throwRender: RenderFn = async () => { throw new Error('excepción_render') }

  beforeAll(async () => {
    conn = postgres(URL!, { ssl: { rejectUnauthorized: false }, max: 4, prepare: false })
    db = drizzle(conn) as any
  })
  afterAll(async () => {
    await (db as any).execute(sql`DELETE FROM temario_pdf_jobs WHERE oposicion = ${OPO}`)
    await conn.end()
  })
  beforeEach(async () => {
    events.length = 0
    await (db as any).execute(sql`DELETE FROM temario_pdf_jobs WHERE oposicion = ${OPO}`)
  })

  // Reclama SOLO jobs del sentinela (oposicionPrefix) → aislado de la cola real, seguro en CI/local
  // aunque haya jobs de producción activos.
  async function processOwn(render: RenderFn, maxAttempts?: number) {
    return processOnePdfJob({ db, render, emit, maxAttempts, oposicionPrefix: OPO })
  }

  it('render ok → job done + evento info', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 1, contentHash: h('ok') })
    const r = await processOwn(okRender)
    expect(r).toMatchObject({ oposicion: OPO, tema: 1, outcome: 'done' })
    const st = await (db as any).execute(sql`SELECT status, bytes FROM temario_pdf_jobs WHERE oposicion=${OPO} AND tema=1`)
    expect(st[0].status).toBe('done')
    expect(Number(st[0].bytes)).toBe(1000)
    expect(events.some((e) => e.severity === 'info' && e.tema === 1)).toBe(true)
  })

  it('render skipped (ya en S3) también cuenta como done', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 2, contentHash: h('skip') })
    const r = await processOwn(skipRender)
    expect(r!.outcome).toBe('done')
    expect(events.some((e) => e.outcome === 'skipped')).toBe(true)
  })

  it('render ok:false → fail; con maxAttempts alto reintenta (pending)', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 3, contentHash: h('fail') })
    const r = await processOwn(failRender, 5)
    expect(r!.outcome).toBe('pending') // reintento
    const st = await (db as any).execute(sql`SELECT status, last_error FROM temario_pdf_jobs WHERE oposicion=${OPO} AND tema=3`)
    expect(st[0].status).toBe('pending')
    expect(st[0].last_error).toBe('render_boom')
    expect(events.some((e) => e.outcome === 'retry')).toBe(true)
  })

  it('render que lanza excepción se captura → fail (no tumba el worker)', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 4, contentHash: h('throw') })
    const r = await processOwn(throwRender, 5)
    expect(r!.outcome).toBe('pending')
    const st = await (db as any).execute(sql`SELECT last_error FROM temario_pdf_jobs WHERE oposicion=${OPO} AND tema=4`)
    expect(st[0].last_error).toBe('excepción_render')
  })

  it('fallos repetidos → DLQ (failed) al agotar intentos + evento error', async () => {
    await enqueuePdfJob(db, { oposicion: OPO, tema: 5, contentHash: h('dlq') })
    // maxAttempts=2 → 1er fallo pending, 2º fallo failed
    let r = await processOwn(throwRender, 2)
    expect(r!.outcome).toBe('pending')
    r = await processOwn(throwRender, 2)
    expect(r!.outcome).toBe('failed')
    expect(events.some((e) => e.severity === 'error' && e.outcome === 'dlq')).toBe(true)
  })

  it('processOne devuelve null si no quedan pendientes propios', async () => {
    // (no encolamos nada del sentinela) → drena ruido y comprueba que no hay ninguno nuestro
    const r = await processOwn(okRender)
    expect(r).toBeNull()
  })

  it('runPdfWorker drena varios + resumen; rescata colgados al arrancar', async () => {
    // 2 jobs pendientes + 1 running colgado (claimed_at viejo)
    await enqueuePdfJob(db, { oposicion: OPO, tema: 6, contentHash: h('a') })
    await enqueuePdfJob(db, { oposicion: OPO, tema: 7, contentHash: h('b') })
    await (db as any).execute(sql`
      INSERT INTO temario_pdf_jobs (oposicion, tema, content_hash, status, attempts, claimed_at)
      VALUES (${OPO}, 8, ${h('stale')}, 'running', 1, now() - interval '2 hours')`)
    const summary = await runPdfWorker({ db, render: okRender, emit, staleSeconds: 60, maxJobs: 50, oposicionPrefix: OPO })
    expect(summary.rescued).toBeGreaterThanOrEqual(1)
    expect(summary.done).toBeGreaterThanOrEqual(3) // los 2 + el rescatado
    // ninguno del sentinela debe quedar pending/running
    const left = await (db as any).execute(sql`SELECT count(*)::int AS n FROM temario_pdf_jobs WHERE oposicion=${OPO} AND status IN ('pending','running')`)
    expect(Number(left[0].n)).toBe(0)
  })
})
