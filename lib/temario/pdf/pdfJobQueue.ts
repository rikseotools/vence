// lib/temario/pdf/pdfJobQueue.ts
//
// Contrato de la COLA de generación de PDFs del temario (tabla temario_pdf_jobs, migración
// 20260722). La generación se desacopla del serving: se ENCOLA aquí y un worker aislado (fuera
// del ALB) la consume. Todo el acceso a BD vive en este módulo para poder testearlo de una pieza.
//
// El `db` (instancia Drizzle postgres-js) se INYECTA como primer argumento: en runtime se pasa
// getDb(); en los tests, una instancia sobre la conexión de test → se ejercita el código real.
//
// Semántica clave:
//  - enqueue: idempotente por el índice parcial `_alive_uq` (a lo sumo 1 job vivo por
//    oposicion+tema+hash). Reencolar el mismo contenido NO duplica.
//  - claim: FOR UPDATE SKIP LOCKED → N workers en paralelo nunca cogen el mismo job.
//  - fail: reintento con backoff hasta maxAttempts; agotado → 'failed' (DLQ), nunca se pierde.
//  - requeueStale: un 'running' cuyo worker murió (claimed_at viejo) vuelve a 'pending'.

import { sql } from 'drizzle-orm'

/** El `db` que aceptamos: cualquier cosa con `execute(sql)` (Drizzle postgres-js). */
export interface JobDb {
  execute: (query: unknown) => Promise<unknown>
}

export interface PdfJob {
  id: string
  oposicion: string
  tema: number
  contentHash: string
  attempts: number
}

export type PdfJobStatus = 'pending' | 'running' | 'done' | 'failed'

/** Número máximo de intentos antes de mandar el job a la DLQ ('failed'). */
export const DEFAULT_MAX_ATTEMPTS = 3

/** Un 'running' más viejo que esto (sin terminar) se considera colgado y se re-encola. */
export const DEFAULT_STALE_SECONDS = 30 * 60 // 30 min

/**
 * Decisión PURA de reintento (unit-testeable sin BD): dado el nº de intentos ya consumidos
 * y el tope, ¿reintentar (pending) o rendirse (failed/DLQ)?
 */
export function shouldRetry(attempts: number, maxAttempts: number = DEFAULT_MAX_ATTEMPTS): boolean {
  return attempts < maxAttempts
}

const rows = (r: unknown): any[] => (Array.isArray(r) ? r : ((r as any)?.rows ?? []))

/**
 * Encola la generación de un tema. Idempotente: si ya hay un job vivo (pending/running) para el
 * mismo (oposicion, tema, contentHash) no crea otro. Devuelve true si insertó, false si ya existía.
 */
export async function enqueuePdfJob(
  db: JobDb,
  job: { oposicion: string; tema: number; contentHash: string },
): Promise<boolean> {
  const res = await db.execute(sql`
    INSERT INTO temario_pdf_jobs (oposicion, tema, content_hash)
    VALUES (${job.oposicion}, ${job.tema}, ${job.contentHash})
    ON CONFLICT DO NOTHING
    RETURNING id
  `)
  return rows(res).length > 0
}

/**
 * Coge el siguiente trabajo pendiente (el más antiguo) y lo marca 'running' incrementando
 * attempts. FOR UPDATE SKIP LOCKED → seguro con varios workers. Devuelve null si no hay pendientes.
 */
export async function claimNextPdfJob(db: JobDb): Promise<PdfJob | null> {
  const res = await db.execute(sql`
    WITH claimed AS (
      SELECT id FROM temario_pdf_jobs
      WHERE status = 'pending'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE temario_pdf_jobs j
    SET status = 'running', claimed_at = now(), attempts = attempts + 1, updated_at = now()
    FROM claimed
    WHERE j.id = claimed.id
    RETURNING j.id, j.oposicion, j.tema, j.content_hash AS "contentHash", j.attempts
  `)
  const r = rows(res)[0]
  return r ? { id: r.id, oposicion: r.oposicion, tema: Number(r.tema), contentHash: r.contentHash, attempts: Number(r.attempts) } : null
}

/** Marca un job como completado con éxito. */
export async function markPdfJobDone(
  db: JobDb,
  id: string,
  meta: { bytes?: number; ms?: number } = {},
): Promise<void> {
  await db.execute(sql`
    UPDATE temario_pdf_jobs
    SET status = 'done', bytes = ${meta.bytes ?? null}, ms = ${meta.ms ?? null},
        last_error = NULL, updated_at = now()
    WHERE id = ${id}
  `)
}

/**
 * Marca un intento fallido. Si aún quedan intentos (attempts < maxAttempts) vuelve a 'pending'
 * (reintento); si se agotaron pasa a 'failed' (DLQ). Devuelve el estado resultante.
 */
export async function markPdfJobFailed(
  db: JobDb,
  id: string,
  meta: { error: string; maxAttempts?: number },
): Promise<PdfJobStatus> {
  const max = meta.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const res = await db.execute(sql`
    UPDATE temario_pdf_jobs
    SET status = CASE WHEN attempts >= ${max} THEN 'failed' ELSE 'pending' END,
        last_error = ${meta.error}, claimed_at = NULL, updated_at = now()
    WHERE id = ${id}
    RETURNING status
  `)
  return (rows(res)[0]?.status ?? 'failed') as PdfJobStatus
}

/**
 * Re-encola trabajos 'running' colgados (worker muerto a media faena): claimed_at más viejo que
 * staleSeconds → vuelven a 'pending'. Devuelve cuántos rescató.
 */
export async function requeueStalePdfJobs(
  db: JobDb,
  staleSeconds: number = DEFAULT_STALE_SECONDS,
): Promise<number> {
  const res = await db.execute(sql`
    UPDATE temario_pdf_jobs
    SET status = 'pending', claimed_at = NULL, updated_at = now()
    WHERE status = 'running' AND claimed_at < now() - make_interval(secs => ${staleSeconds})
    RETURNING id
  `)
  return rows(res).length
}

/** Contadores por estado (para la observabilidad / SLO de cobertura). */
export async function pdfJobStats(db: JobDb): Promise<Record<PdfJobStatus, number>> {
  const res = await db.execute(sql`SELECT status, count(*)::int AS n FROM temario_pdf_jobs GROUP BY status`)
  const out: Record<PdfJobStatus, number> = { pending: 0, running: 0, done: 0, failed: 0 }
  for (const r of rows(res)) out[r.status as PdfJobStatus] = Number(r.n)
  return out
}
