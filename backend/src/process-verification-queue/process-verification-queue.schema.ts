import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Subconjunto de tablas del repo principal (`db/schema.ts`) que usa el
 * worker `process-verification-queue`.
 *
 * Solo se declaran las columnas que el worker lee/escribe — Drizzle mapea
 * el subconjunto sin problema.
 *
 * Fuente de verdad: `db/schema.ts` del repo raíz.
 */

/**
 * Tabla `verification_queue` — cola de tareas de verificación de preguntas por IA.
 */
export const verificationQueue = pgTable(
  'verification_queue',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    topicId: uuid('topic_id'),
    /** IDs de preguntas a verificar. Si está vacío, se derivan del topic_id. */
    questionIds: uuid('question_ids').array().default([]),
    aiProvider: text('ai_provider').default('openai').notNull(),
    aiModel: text('ai_model').default('gpt-4o-mini').notNull(),
    status: text('status').default('pending').notNull(),
    totalQuestions: integer('total_questions').default(0),
    processedQuestions: integer('processed_questions').default(0),
    successfulVerifications: integer('successful_verifications').default(0),
    failedVerifications: integer('failed_verifications').default(0),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    createdBy: uuid('created_by'),
  },
  (table) => [
    uniqueIndex('idx_verification_queue_active_topic')
      .using('btree', table.topicId)
      .where(sql`(status = ANY (ARRAY['pending'::text, 'processing'::text]))`),
    index('idx_verification_queue_pending')
      .using('btree', table.createdAt)
      .where(sql`(status = 'pending'::text)`),
    index('idx_verification_queue_status').using('btree', table.status),
    index('idx_verification_queue_topic').using('btree', table.topicId),
    check(
      'verification_queue_status_check',
      sql`status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])`,
    ),
  ],
);

/**
 * Tabla `questions` — preguntas de exámenes (subconjunto de columnas).
 *
 * Nota: `is_active` es una columna GENERATED ALWAYS AS en Postgres — no se
 * puede escribir directamente. Solo se declara aquí para lecturas.
 */
export const questions = pgTable(
  'questions',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    primaryArticleId: uuid('primary_article_id').notNull(),
    isActive: boolean('is_active'),
    topicReviewStatus: text('topic_review_status'),
    lifecycleState: text('lifecycle_state').default('draft').notNull(),
  },
  (table) => [
    index('idx_questions_primary_article').using('btree', table.primaryArticleId),
    index('idx_questions_lifecycle_state').using('btree', table.lifecycleState),
  ],
);

/**
 * Tabla `articles` — artículos de legislación (subconjunto de columnas).
 */
export const articles = pgTable(
  'articles',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    lawId: uuid('law_id'),
    articleNumber: text('article_number').notNull(),
  },
  (table) => [
    index('idx_articles_law_id').using('btree', table.lawId),
  ],
);

/**
 * Tabla `topic_scope` — mapeo de temas a artículos de ley.
 */
export const topicScope = pgTable(
  'topic_scope',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    topicId: uuid('topic_id'),
    lawId: uuid('law_id'),
    /** Lista de article_number strings que pertenecen a este scope. */
    articleNumbers: text('article_numbers').array(),
  },
  (table) => [
    index('idx_topic_scope_law_id_topic_id').using('btree', table.lawId, table.topicId),
    index('idx_topic_scope_topic').using('btree', table.topicId),
  ],
);
