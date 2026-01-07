// db/client.ts - Cliente Drizzle para queries tipadas
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton para evitar múltiples conexiones en desarrollo
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined
  db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

// Función para obtener el cliente de forma lazy (solo cuando se necesita)
function getDb() {
  // Si ya existe el cliente, devolverlo
  if (globalForDb.db) {
    return globalForDb.db
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // Crear conexión postgres
  const conn = globalForDb.conn ?? postgres(connectionString, {
    max: 1, // Limitar conexiones en serverless
    idle_timeout: 20,
    connect_timeout: 10,
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.conn = conn
  }

  // Crear cliente Drizzle
  const db = drizzle(conn, { schema })

  // Cache en desarrollo
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.db = db
  }

  return db
}

// Exportar como proxy que inicializa lazy
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    const realDb = getDb()
    return (realDb as any)[prop]
  }
})

// Re-exportar tipos útiles
export type DbClient = typeof db
