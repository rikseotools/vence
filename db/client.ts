// db/client.ts - Cliente Drizzle para queries tipadas
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton global para persistir entre invocaciones en serverless
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

// Crear cliente solo si DATABASE_URL existe (evita error en build)
function createDbClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    // Durante build, DATABASE_URL no existe - retornar null
    return null
  }

  // Crear conexión postgres optimizada para serverless
  // 🛡️ Agregar statement_timeout via connection string para prevenir queries infinitas
  const urlWithTimeout = connectionString.includes('?')
    ? `${connectionString}&options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`
    : `${connectionString}?options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`

  const conn = postgres(urlWithTimeout, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // 🔧 Requerido para Supabase Transaction Pooler (puerto 6543)
  })

  return drizzle(conn, { schema })
}

// Inicializar solo si no existe
if (!globalForDb.db) {
  globalForDb.db = createDbClient() as any
}

// Exportar el cliente (puede ser null durante build, pero siempre existe en runtime)
export const db = globalForDb.db!

// Función helper para verificar si el cliente está disponible
export function getDb() {
  if (!globalForDb.db) {
    globalForDb.db = createDbClient() as any
  }
  if (!globalForDb.db) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return globalForDb.db
}

// ============================================
// Cliente dedicado para trace inserts (background)
// Sin statement_timeout para evitar fallos en after()
// ============================================

const globalForTraceDb = globalThis as unknown as {
  traceDb: ReturnType<typeof drizzle<typeof schema>> | undefined
}

function createTraceDbClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null

  // Sin statement_timeout - los traces se insertan en after() con tiempo limitado
  // No queremos que el timeout de Postgres compita con el de Vercel
  const conn = postgres(connectionString, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 5,
    prepare: false,
  })

  return drizzle(conn, { schema })
}

export function getTraceDb() {
  if (!globalForTraceDb.traceDb) {
    globalForTraceDb.traceDb = createTraceDbClient() as any
  }
  if (!globalForTraceDb.traceDb) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return globalForTraceDb.traceDb
}

// Re-exportar tipos útiles
export type DbClient = typeof db
