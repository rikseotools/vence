// db/client.ts - Cliente Drizzle para queries tipadas
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

console.log('🔌 [Drizzle] Inicializando cliente...')

// Singleton para evitar múltiples conexiones en desarrollo
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ [Drizzle] DATABASE_URL no está definida!')
  throw new Error('DATABASE_URL environment variable is not set')
}

console.log('🔌 [Drizzle] DATABASE_URL encontrada, creando conexión...')

// Usar conexión existente en desarrollo, crear nueva en producción
const conn = globalForDb.conn ?? postgres(connectionString, {
  max: 1, // Limitar conexiones en serverless
  idle_timeout: 20,
  connect_timeout: 10,
})

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn
}

console.log('🔌 [Drizzle] Conexión postgres creada, inicializando Drizzle ORM...')

// Cliente Drizzle con schema para relaciones y tipos
export const db = drizzle(conn, { schema })

console.log('✅ [Drizzle] Cliente inicializado correctamente')

// Re-exportar tipos útiles
export type DbClient = typeof db
