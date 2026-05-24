import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Subconjunto del schema de Vence necesario para los crons de Etapa 1
 * y los endpoints HTTP de Etapa 2 (Bloque 3 canary).
 * Copiado de `db/schema.ts` del repo principal (fuente de verdad: la BD).
 *
 * Solo se declaran las columnas que los handlers leen/escriben — Drizzle
 * mapea el subconjunto sin problema.
 */

/** Tabla `laws` — usada por el cron `check-boe-changes`. */
export const laws = pgTable('laws', {
  id: uuid('id').primaryKey().notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  slug: text('slug'),
  scope: text('scope').default('national'),
  boeUrl: text('boe_url'),
  lastChecked: timestamp('last_checked', { mode: 'string' }),
  changeStatus: text('change_status'),
  changeDetectedAt: timestamp('change_detected_at', { mode: 'string' }),
  lastUpdateBoe: text('last_update_boe'),
  dateByteOffset: integer('date_byte_offset'),
  boeContentLength: integer('boe_content_length'),
});

/** Tabla `user_medals` — usada por el endpoint GET /api/medals (Bloque 3 canary). */
export const userMedals = pgTable('user_medals', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id'),
  medalId: text('medal_id').notNull(),
  medalData: jsonb('medal_data').notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  viewed: boolean('viewed').default(false),
});

/** Tabla `user_profiles` — fuente agnóstica del email del user (no Supabase Auth API).
 *  Ampliada para answer-and-save (markActiveStudentIfFirst toca is_active_student
 *  + first_test_completed_at). target_oposicion lo usa el cálculo de score.
 *  planType + createdAt los usa DailyLimitService.getUserLimitProfile.
 */
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().notNull(),
  email: text('email'),
  fullName: text('full_name'),
  isActiveStudent: boolean('is_active_student'),
  firstTestCompletedAt: timestamp('first_test_completed_at', {
    withTimezone: true,
    mode: 'string',
  }),
  targetOposicion: text('target_oposicion'),
  planType: text('plan_type'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
});

/** Tabla `conversion_events` — log de eventos de conversión (limit_reached, etc.).
 *  Usada por DailyLimitService.getUserLimitProfile para contar cuántas veces
 *  un user ha tocado el límite (input al cálculo del límite graduado).
 */
export const conversionEvents = pgTable('conversion_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id'),
  eventType: text('event_type'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

/** Tabla `email_preferences` — opt-out global de emails por user. */
export const emailPreferences = pgTable('email_preferences', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id'),
  unsubscribedAll: boolean('unsubscribed_all').default(false),
});

/** Tabla `public_user_profiles` — display_name público (para personalizar emails). */
export const publicUserProfiles = pgTable('public_user_profiles', {
  id: uuid('id').primaryKey().notNull(),
  displayName: text('display_name'),
});

// ════════════════════════════════════════════════════════════════
// Tablas para answer-and-save (Bloque 3 — port en curso).
// Ver docs/architecture/bloque3-answer-save-plan.md §3.
// Solo se declaran columnas que el código del backend toca.
// ════════════════════════════════════════════════════════════════

/** Tabla `questions` — preguntas legislativas. Source of truth de correct_option. */
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().notNull(),
  correctOption: integer('correct_option'),
  explanation: text('explanation'),
  primaryArticleId: uuid('primary_article_id'),
  isActive: boolean('is_active'),
});

/** Tabla `articles` — artículos de leyes, JOIN target desde questions. */
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().notNull(),
  lawId: uuid('law_id'),
  articleNumber: text('article_number'),
});

/** Tabla `psychometric_questions` — preguntas psicotécnicas, fallback de validation. */
export const psychometricQuestions = pgTable('psychometric_questions', {
  id: uuid('id').primaryKey().notNull(),
  correctOption: integer('correct_option'),
  explanation: text('explanation'),
});

/** Tabla `tests` — sesiones de test. answer-and-save UPDATE el score. */
export const tests = pgTable('tests', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id'),
  totalQuestions: integer('total_questions').notNull(),
  isCompleted: boolean('is_completed'),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  // numeric en BD; Drizzle expone como string para no perder precisión.
  score: text('score'),
  totalTimeSeconds: integer('total_time_seconds'),
});

/** Tabla `test_questions` — respuestas individuales. answer-and-save INSERT row. */
export const testQuestions = pgTable('test_questions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  testId: uuid('test_id'),
  userId: uuid('user_id'),
  questionId: uuid('question_id'),
  psychometricQuestionId: uuid('psychometric_question_id'),
  articleId: uuid('article_id'),
  questionOrder: integer('question_order'),
  questionText: text('question_text'),
  userAnswer: text('user_answer'),
  correctAnswer: text('correct_answer'),
  isCorrect: boolean('is_correct'),
  wasBlank: boolean('was_blank'),
  confidenceLevel: text('confidence_level'),
  timeSpentSeconds: integer('time_spent_seconds'),
  timeToFirstInteraction: integer('time_to_first_interaction'),
  timeHesitation: integer('time_hesitation'),
  interactionCount: integer('interaction_count'),
  articleNumber: text('article_number'),
  lawName: text('law_name'),
  temaNumber: integer('tema_number'),
  difficulty: text('difficulty'),
  questionType: text('question_type'),
  tags: text('tags').array(),
  previousAttemptsThisArticle: integer('previous_attempts_this_article'),
  historicalAccuracyThisArticle: text('historical_accuracy_this_article'),
  userAgent: text('user_agent'),
  screenResolution: text('screen_resolution'),
  deviceType: text('device_type'),
  browserLanguage: text('browser_language'),
  timezone: text('timezone'),
  fullQuestionContext: jsonb('full_question_context'),
  userBehaviorData: jsonb('user_behavior_data'),
  learningAnalytics: jsonb('learning_analytics'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

/** Tabla `topic_scope` — qué artículos cubren cada topic. Usado por resolveTemaByQuestionIdFast. */
export const topicScope = pgTable('topic_scope', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  topicId: uuid('topic_id'),
  lawId: uuid('law_id'),
  articleNumbers: text('article_numbers').array(),
});

/** Tabla `topics` — topics por oposición. position_type discrimina entre oposiciones. */
export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().notNull(),
  positionType: text('position_type').notNull(),
  topicNumber: integer('topic_number').notNull(),
  title: text('title').notNull(),
  isActive: boolean('is_active'),
});

