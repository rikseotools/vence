import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Subconjunto de columnas de `oposiciones` necesario para el cron check-seguimiento.
 *
 * Las columnas `seguimiento_last_hash`, `seguimiento_last_checked`,
 * `seguimiento_change_status` y `seguimiento_change_detected_at` existen en la
 * BD pero no están en el schema principal de Drizzle (db/schema.ts). Se declaran
 * aquí para que el servicio pueda acceder a ellas de forma tipada.
 *
 * Nota: solo se declaran las columnas que lee/escribe este cron. Drizzle mapea
 * el subconjunto sin problemas.
 */
export const oposiciones = pgTable('oposiciones', {
  id: uuid('id').primaryKey().notNull(),
  nombre: text('nombre').notNull(),
  slug: text('slug'),
  shortName: text('short_name'),
  isActive: boolean('is_active').default(true),
  seguimientoUrl: text('seguimiento_url'),
  seguimientoLastHash: text('seguimiento_last_hash'),
  seguimientoLastChecked: timestamp('seguimiento_last_checked', { mode: 'string' }),
  seguimientoChangeStatus: text('seguimiento_change_status'),
  seguimientoChangeDetectedAt: timestamp('seguimiento_change_detected_at', { mode: 'string' }),
});

/** Tipos inferidos para uso en el servicio. */
export type OposicionRow = typeof oposiciones.$inferSelect;
