import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Schema del subsistema "Analizador de Competidores".
 * Solo se declaran las columnas que el módulo lee/escribe (Drizzle mapea el
 * subconjunto). Fuente de verdad del DDL: supabase/migrations/20260706_competitor_intelligence.sql
 * Diseño: docs/roadmap/analizador-competidores.md
 */

/** `competitors` — la academia/plataforma competidora. */
export const competitors = pgTable('competitors', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  tipo: text('tipo'), // academia_presencial | plataforma_online | hibrida
  region: text('region'),
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

/** `competitor_sources` — fuentes a vigilar por competidor (con last_hash). */
export const competitorSources = pgTable(
  'competitor_sources',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    competitorId: uuid('competitor_id').notNull(),
    sourceType: text('source_type').notNull(), // sitemap|sitemap_index|listing_html|rss|api
    url: text('url').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastHash: text('last_hash'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true, mode: 'string' }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'string' }),
    lastError: text('last_error'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('competitor_sources_uniq').on(t.competitorId, t.url),
    index('idx_competitor_sources_active').on(t.competitorId, t.isActive),
  ],
);

/** `competitor_urls` — sitemap completo del competidor (tracking de URLs). */
export const competitorUrls = pgTable(
  'competitor_urls',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    competitorId: uuid('competitor_id').notNull(),
    url: text('url').notNull(),
    urlType: text('url_type').default('other').notNull(), // oposicion|categoria|page|post|other
    contentHash: text('content_hash'),
    lastmod: timestamp('lastmod', { withTimezone: true, mode: 'string' }),
    isActive: boolean('is_active').default(true).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    contentCheckedAt: timestamp('content_checked_at', { withTimezone: true, mode: 'string' }),
    lastChangedAt: timestamp('last_changed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('competitor_urls_uniq').on(t.competitorId, t.url),
    index('idx_competitor_urls_type').on(t.competitorId, t.urlType),
    index('idx_competitor_urls_active').on(t.competitorId, t.isActive),
  ],
);

/** `competitor_courses` — una fila por oposición que prepara el competidor. */
export const competitorCourses = pgTable(
  'competitor_courses',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    competitorId: uuid('competitor_id').notNull(),
    competitorUrlId: uuid('competitor_url_id').notNull(),
    oposicionId: uuid('oposicion_id'), // NULL = gap (la preparan y nosotros no)
    rawName: text('raw_name').notNull(),
    modalidad: text('modalidad'), // online | presencial | mixta
    region: text('region'),
    isActive: boolean('is_active').default(true).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('competitor_courses_url_uniq').on(t.competitorUrlId),
    index('idx_competitor_courses_oposicion').on(t.oposicionId),
    index('idx_competitor_courses_active').on(t.competitorId, t.isActive),
  ],
);

/** `competitor_prices` — precios por curso (tipo × audiencia × periodo) + histórico. */
export const competitorPrices = pgTable(
  'competitor_prices',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    competitorCourseId: uuid('competitor_course_id').notNull(),
    priceKind: text('price_kind').notNull(), // matricula|cuota|intensivo|tasa|material|otro
    audience: text('audience'), // nuevo | antiguo | general
    amountCents: integer('amount_cents'),
    period: text('period'), // mensual | trimestral | unico | curso
    currency: text('currency').default('EUR').notNull(),
    raw: text('raw'),
    isCurrent: boolean('is_current').default(true).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    supersededAt: timestamp('superseded_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    index('idx_competitor_prices_current').on(t.competitorCourseId, t.isCurrent),
    index('idx_competitor_prices_hist').on(t.competitorCourseId, t.priceKind, t.capturedAt),
  ],
);

/** `competitor_changes` — log append-only de cambios detectados. */
export const competitorChanges = pgTable(
  'competitor_changes',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    competitorId: uuid('competitor_id').notNull(),
    changeType: text('change_type').notNull(), // url_added|url_removed|url_modified|course_added|course_removed|price_changed
    url: text('url'),
    courseId: uuid('course_id'),
    detail: jsonb('detail').default(sql`'{}'::jsonb`).notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_competitor_changes_recent').on(t.competitorId, t.detectedAt),
    index('idx_competitor_changes_type').on(t.changeType, t.detectedAt),
  ],
);

/** `oposiciones` — subconjunto mínimo para el match de cursos → oposición. */
export const oposiciones = pgTable('oposiciones', {
  id: uuid('id').default(sql`uuid_generate_v4()`).primaryKey().notNull(),
  nombre: text('nombre').notNull(),
  slug: text('slug'),
  shortName: text('short_name'),
  subgrupo: text('subgrupo'),
  administracion: text('administracion'),
  isActive: boolean('is_active').default(true),
  estadoProceso: text('estado_proceso'),
});
