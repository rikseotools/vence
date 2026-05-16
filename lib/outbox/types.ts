// lib/outbox/types.ts
// Tipos compartidos del outbox (Fase 2 paso 0).
//
// El propósito de tipar event_type + payload aquí (en vez de string + any) es
// que el compilador atrape errores tipo "encolaste un event con campos que el
// handler no espera". Se irá ampliando a medida que migremos triggers.

/**
 * Tipos de evento soportados por el worker. Cada nuevo handler añadirá su
 * variante aquí. El paso 0 NO añade ningún handler todavía — la unión está
 * vacía a propósito para no comprometer schemas antes de migrar el primer
 * trigger.
 */
export type OutboxEvent =
  | { eventType: '__placeholder__'; payload: Record<string, never> }

export type OutboxEventType = OutboxEvent['eventType']

/**
 * Payload tipado para un eventType concreto. Uso:
 *   const p: PayloadFor<'recalc_question_difficulty'> = { questionId: '...' }
 */
export type PayloadFor<T extends OutboxEventType> = Extract<
  OutboxEvent,
  { eventType: T }
>['payload']
