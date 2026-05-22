import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Subconjunto de `ai_api_config` necesario para obtener la clave Anthropic.
 * Solo se declaran las columnas que lee este módulo.
 */
export const aiApiConfig = pgTable('ai_api_config', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  provider: text('provider').notNull(),
  apiKeyEncrypted: text('api_key_encrypted'),
  isActive: boolean('is_active').default(true),
  defaultModel: text('default_model'),
  lastVerifiedAt: timestamp('last_verified_at', {
    withTimezone: true,
    mode: 'string',
  }),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).defaultNow(),
});
