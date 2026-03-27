// db/client.ts - Cliente Drizzle para queries tipadas
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ============================================
// Pool principal (APIs de usuario)
// ============================================
// max: 1 → Una conexión por instancia serverless (recomendado por Supabase)
// connect_timeout: 2 → Fail fast: pooler saturado no mejora esperando más
// ROLLBACK: Si se detectan errores de "too many clients", subir max a 2
//           Si queries de admin fallan, usar getAdminDb() en vez de getDb()
// VALORES ANTERIORES: max: 8, connect_timeout: 5

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
    max: 1,            // Una conexión por instancia serverless (evita saturar pooler)
    idle_timeout: 20,
    connect_timeout: 5,   // 5s para cold start (build + Vercel). Lo importante es max:1
    prepare: false, // Requerido para Supabase Transaction Pooler (puerto 6543)
  })

  // Warmup: establecer conexión al crear el cliente (no bloquea, se ejecuta en background)
  conn`SELECT 1`.catch(() => {})

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
// Pool para admin/dashboard (queries paralelas)
// ============================================
// max: 4 → Permite queries paralelas del dashboard sin saturar pooler
// Solo usar en rutas /admin/* o /api/v2/admin/*

const globalForAdminDb = globalThis as unknown as {
  adminDb: ReturnType<typeof drizzle<typeof schema>> | undefined
}

function createAdminDbClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null

  const urlWithTimeout = connectionString.includes('?')
    ? `${connectionString}&options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`
    : `${connectionString}?options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`

  const conn = postgres(urlWithTimeout, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 3,
    prepare: false,
  })

  return drizzle(conn, { schema })
}

export function getAdminDb() {
  if (!globalForAdminDb.adminDb) {
    globalForAdminDb.adminDb = createAdminDbClient() as any
  }
  if (!globalForAdminDb.adminDb) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return globalForAdminDb.adminDb
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
