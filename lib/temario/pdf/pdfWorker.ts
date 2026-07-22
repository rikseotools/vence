// lib/temario/pdf/pdfWorker.ts
//
// Capa 2 de la generación robusta (T-086 Fase D): el WORKER que consume la cola temario_pdf_jobs.
// Debe correr AISLADO del serving (task fuera del ALB o @Cron) — el render bloquea el event loop;
// en una task que sirve tráfico falla health checks y la matan.
//
// La ORQUESTACIÓN vive aquí con el `render` INYECTADO (no importa @react-pdf) → 100% testeable sin
// el bundle pesado. El entrypoint de producción (pdfWorkerEntry) inyecta pregenerateTopicPdf.
//
//   requeueStale (rescata colgados) → [claim → render → done|fail(retry/DLQ)]* hasta vaciar/budget
//
// Nunca lanza hacia arriba: un render que peta baja el job a retry/DLQ y el worker sigue con el
// siguiente (un tema roto no puede parar la cola entera).

import {
  claimNextPdfJob, markPdfJobDone, markPdfJobFailed, requeueStalePdfJobs,
  DEFAULT_MAX_ATTEMPTS, DEFAULT_STALE_SECONDS, type JobDb, type PdfJob,
} from './pdfJobQueue'

/** Resultado del render de un tema (forma de PregenResult, sin acoplar el import). */
export interface RenderOutcome {
  ok: boolean
  bytes?: number
  ms?: number
  outcome?: string
  error?: string
}

/** El render inyectable. En producción = pregenerateTopicPdf. */
export type RenderFn = (oposicion: string, tema: number, opts: { force?: boolean }) => Promise<RenderOutcome>

/** Evento de observabilidad inyectable (no acopla el sink; en prod = emitFireAndForget). */
export type EmitFn = (ev: {
  severity: 'info' | 'warn' | 'error'
  outcome: string
  oposicion: string
  tema: number
  jobId: string
  attempts: number
  ms?: number
  bytes?: number
  error?: string
}) => void

export interface WorkerDeps {
  db: JobDb
  render: RenderFn
  emit?: EmitFn
  maxAttempts?: number
  staleSeconds?: number
  /** true = re-renderiza aunque el hash actual ya esté en S3; false (default) = salta lo cacheado.
   * false es lo correcto para el worker: pregenerate es content-addressed, así que si el contenido
   * cambió el hash cambia y NO estará cacheado → lo regenera igual; si no cambió, lo salta (barato). */
  force?: boolean
  /** Acota el claim a oposiciones con este prefijo (worker dedicado / aislamiento de tests). */
  oposicionPrefix?: string
}

export interface JobResult {
  id: string
  oposicion: string
  tema: number
  /** 'done' = generado/ya-cacheado; 'pending' = fallo con reintento; 'failed' = fallo a DLQ. */
  outcome: 'done' | 'pending' | 'failed'
}

/**
 * Procesa EXACTAMENTE un trabajo (claim → render → done|fail). Devuelve null si la cola está vacía.
 * No lanza: cualquier fallo del render se traduce en fail (retry o DLQ).
 */
export async function processOnePdfJob(deps: WorkerDeps): Promise<JobResult | null> {
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const job: PdfJob | null = await claimNextPdfJob(deps.db, { oposicionPrefix: deps.oposicionPrefix })
  if (!job) return null

  const fail = async (error: string): Promise<JobResult> => {
    const status = await markPdfJobFailed(deps.db, job.id, { error, maxAttempts })
    deps.emit?.({
      severity: status === 'failed' ? 'error' : 'warn',
      outcome: status === 'failed' ? 'dlq' : 'retry',
      oposicion: job.oposicion, tema: job.tema, jobId: job.id, attempts: job.attempts, error,
    })
    return { id: job.id, oposicion: job.oposicion, tema: job.tema, outcome: status as 'pending' | 'failed' }
  }

  try {
    const r = await deps.render(job.oposicion, job.tema, { force: deps.force ?? false })
    if (!r.ok) return await fail(r.error ?? r.outcome ?? 'render_failed')
    await markPdfJobDone(deps.db, job.id, { bytes: r.bytes, ms: r.ms })
    deps.emit?.({
      severity: 'info', outcome: r.outcome ?? 'uploaded',
      oposicion: job.oposicion, tema: job.tema, jobId: job.id, attempts: job.attempts, ms: r.ms, bytes: r.bytes,
    })
    return { id: job.id, oposicion: job.oposicion, tema: job.tema, outcome: 'done' }
  } catch (e) {
    return await fail(e instanceof Error ? e.message : 'excepción_desconocida')
  }
}

export interface WorkerSummary {
  processed: number
  done: number
  retried: number
  failed: number
  rescued: number
}

/**
 * Vacía la cola: primero rescata colgados (requeueStale), luego procesa hasta agotar los
 * pendientes o alcanzar `maxJobs` (tope de seguridad anti-bucle). Devuelve el resumen.
 */
export async function runPdfWorker(deps: WorkerDeps, opts: { maxJobs?: number } = {}): Promise<WorkerSummary> {
  const rescued = await requeueStalePdfJobs(deps.db, deps.staleSeconds ?? DEFAULT_STALE_SECONDS, { oposicionPrefix: deps.oposicionPrefix })
  const limit = opts.maxJobs ?? Number.MAX_SAFE_INTEGER
  const s: WorkerSummary = { processed: 0, done: 0, retried: 0, failed: 0, rescued }
  while (s.processed < limit) {
    const r = await processOnePdfJob(deps)
    if (!r) break
    s.processed++
    if (r.outcome === 'done') s.done++
    else if (r.outcome === 'failed') s.failed++
    else s.retried++
  }
  return s
}
