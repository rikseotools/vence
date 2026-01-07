// db/client.ts - Cliente Drizzle para queries tipadas
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton para evitar múltiples conexiones en desarrollo
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined
}

const connectionString = process.env.DATABASE_URL!

// Usar conexión existente en desarrollo, crear nueva en producción
const conn = globalForDb.conn ?? postgres(connectionString, {
  max: 1, // Limitar conexiones en serverless
  idle_timeout: 20,
  connect_timeout: 10,
})

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn
}

// Cliente Drizzle con schema para relaciones y tipos
export const db = drizzle(conn, { schema })

// Re-exportar tipos útiles
export type DbClient = typeof db
