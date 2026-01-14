// lib/chat/shared/db.ts
// Re-exportar cliente Drizzle desde el módulo central

export { getDb, db } from '@/db/client'
export type { DbClient as Database } from '@/db/client'

// Re-exportar el schema para conveniencia
export * as schema from '@/db/schema'
