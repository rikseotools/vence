import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Subconjunto de tablas del schema principal necesarias para el cron
 * `avatar-rotation`. Solo se declaran las columnas que el cron lee o escribe.
 *
 * Fuente de verdad: `db/schema.ts` del repositorio raíz.
 */

/** `tests` — necesaria para el JOIN con `test_questions`. */
export const tests = pgTable(
  'tests',
  {
    id: uuid('id').primaryKey().notNull(),
    userId: uuid('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => [index('idx_tests_user_id_ar').on(table.userId)],
);

/** `test_questions` — métricas de actividad semanal del usuario. */
export const testQuestions = pgTable(
  'test_questions',
  {
    id: uuid('id').primaryKey().notNull(),
    testId: uuid('test_id'),
    isCorrect: boolean('is_correct').notNull(),
    difficulty: text('difficulty'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('idx_test_questions_test_id_ar').on(table.testId),
    index('idx_test_questions_created_at_ar').on(table.createdAt),
  ],
);

/** `user_streaks` — racha actual del usuario. */
export const userStreaks = pgTable('user_streaks', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id').notNull(),
  currentStreak: integer('current_streak').default(0),
});

/** `user_avatar_settings` — configuración de avatar por usuario. */
export const userAvatarSettings = pgTable('user_avatar_settings', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id'),
  mode: text('mode').default('automatic'),
  currentProfile: text('current_profile'),
  currentEmoji: text('current_emoji'),
  currentName: text('current_name'),
  lastRotationAt: timestamp('last_rotation_at', { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  rotationNotificationPending: boolean('rotation_notification_pending').default(false),
  previousProfile: text('previous_profile'),
  previousEmoji: text('previous_emoji'),
});

/** `avatar_profiles` — catálogo estático de perfiles disponibles. */
export const avatarProfiles = pgTable('avatar_profiles', {
  id: text('id').primaryKey().notNull(),
  emoji: text('emoji').notNull(),
  nameEs: text('name_es').notNull(),
  nameEsF: text('name_es_f'),
  descriptionEs: text('description_es').notNull(),
  color: text('color').notNull(),
  priority: integer('priority').default(50),
});

/** `user_profiles` — solo se usa para leer el género del usuario. */
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().notNull(),
  gender: text('gender'),
});

/** `user_notification_settings` — suscripción push del usuario. */
export const userNotificationSettings = pgTable('user_notification_settings', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id'),
  pushEnabled: boolean('push_enabled').default(false),
  pushSubscription: jsonb('push_subscription'),
});

/** `notification_events` — audit log de notificaciones enviadas. */
export const notificationEvents = pgTable('notification_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id'),
  eventType: text('event_type').notNull(),
  notificationType: text('notification_type'),
  notificationData: jsonb('notification_data').default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ── Tipos derivados ──────────────────────────────────────────────────────────

export type AvatarProfileRow = typeof avatarProfiles.$inferSelect;
export type UserAvatarSettingsRow = typeof userAvatarSettings.$inferSelect;
export type UserNotificationSettingsRow = typeof userNotificationSettings.$inferSelect;
