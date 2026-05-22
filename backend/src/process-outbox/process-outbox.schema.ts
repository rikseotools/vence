import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Tabla `outbox_events` — cola in-database del patrón Outbox.
 *
 * Copiado de `db/schema.ts` del repo principal (fuente de verdad: la BD).
 * Solo se declaran las columnas que el worker lee/escribe — Drizzle mapea
 * el subconjunto sin problema.
 *
 * Migración original: supabase/migrations/20260516_outbox_events.sql.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
  },
  (table) => [
    index('outbox_events_pending_idx')
      .using('btree', table.createdAt)
      .where(sql`processed_at IS NULL`),
    index('outbox_events_type_idx').using('btree', table.eventType, table.createdAt),
    check('outbox_events_attempts_nonneg', sql`attempts >= 0`),
  ],
);
