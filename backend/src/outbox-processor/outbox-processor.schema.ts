// Schema Zod para los eventos del outbox de test_questions.
//
// Cada fila de `test_questions_outbox` representa un INSERT/UPDATE/DELETE
// emitido por el trigger `tg_test_questions_emit_outbox` (ver migración
// `supabase/migrations/20260528_test_questions_outbox.sql`).
//
// El worker `outbox-processor` lee batches de eventos pendientes
// (`processed_at IS NULL`), valida el payload con Zod, dispatch a los
// handlers correspondientes, y marca `processed_at = NOW()` en éxito.

import { z } from 'zod';

/** Snapshot de un row de `test_questions` (subset relevante para handlers). */
export const TestQuestionPayloadSchema = z.object({
  id: z.string().uuid(),
  test_id: z.string().uuid(),
  user_id: z.string().uuid(),
  question_id: z.string().uuid().nullable().optional(),
  psychometric_question_id: z.string().uuid().nullable().optional(),
  article_id: z.string().uuid().nullable().optional(),
  question_order: z.number().int().nullable().optional(),
  user_answer: z.string().nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  is_correct: z.boolean().nullable().optional(),
  was_blank: z.boolean().nullable().optional(),
  time_spent_seconds: z.number().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
}).passthrough();
export type TestQuestionPayload = z.infer<typeof TestQuestionPayloadSchema>;

/** Fila de la tabla `test_questions_outbox`. */
export const OutboxEventSchema = z.object({
  id: z.coerce.bigint(),
  test_question_id: z.string().uuid(),
  event_type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  payload: TestQuestionPayloadSchema,
  old_payload: TestQuestionPayloadSchema.nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  processed_at: z.string().nullable(),
  retry_count: z.number().int().min(0),
  error_message: z.string().nullable(),
});
export type OutboxEvent = z.infer<typeof OutboxEventSchema>;

/** Resultado de procesar un batch. */
export interface BatchResult {
  /** Tamaño del batch leído (puede ser menor que el max si hay pocos pendientes). */
  size: number;
  /** Cuántos procesados exitosamente (processed_at marcado). */
  succeeded: number;
  /** Cuántos fallaron (retry_count incrementado). */
  failed: number;
  /** Cuántos entraron en DLQ tras este batch (retry_count llega a 3). */
  movedToDlq: number;
  /** Duración total del batch en ms. */
  durationMs: number;
}

/** Configuración del worker. */
export interface OutboxProcessorConfig {
  /** Tamaño máximo del batch por tick. Default 100. */
  batchSize: number;
  /** Máximo de retries antes de mandar a DLQ. Default 3. */
  maxRetries: number;
  /** Frecuencia del cron en segundos (no usar, gestionado por @Cron). */
  intervalSeconds: number;
}

// batchSize=10 (era 100): cada evento dispara 9 handlers en paralelo, cada handler
// hace 2 queries (SELECT EXISTS + UPSERT). Con batchSize=100 → ~1800 queries/tick,
// saturó pool BD el 29/05/2026 al activar SHADOW_HANDLERS_ENABLED. Con 10 → 180
// queries/tick, margen seguro. Si la queue crece, reducir intervalo del cron en
// vez de subir batchSize. Ver docs/roadmap/sprint-outbox-test-questions.md §1.5.
export const DEFAULT_CONFIG: OutboxProcessorConfig = {
  batchSize: 10,
  maxRetries: 3,
  intervalSeconds: 1,
};
