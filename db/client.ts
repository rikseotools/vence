// db/client.ts - Cliente Drizzle para queries tipadas
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ============================================
// Pool principal (APIs de usuario)
// ============================================
// max: 1 → Una conexión por instancia serverless (recomendado por Supabase)
// ROLLBACK: Si se detectan errores de "too many clients", subir max a 2
//           Si queries de admin fallan, usar getAdminDb() en vez de getDb()
// HISTORIAL: max:8 → max:3 → max:1 (27/04/2026, pool exhaustion con 261 eventos)

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
    max: 1,  // 1 conexión por instancia serverless (recomendado por Supabase)
    idle_timeout: 20,
    connect_timeout: 5,
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

// ============================================
// Pool de READ REPLICA (lecturas analíticas)
// ============================================
// Para descargar lecturas pesadas del primary y aliviar la cola de pool max:1
// que afecta a writes críticos (answer-and-save). Apunta a la réplica
// Supabase eu-west-2 (provisionada 2026-05-09, ID bmeqf) vía Shared Pooler
// del Supavisor (mismo hostname que primary, user con sufijo
// `-rr-eu-west-2-bmeqf` distingue el destino).
//
// IMPORTANTE: solo usar en lecturas tolerables a stale ≤1s (lag típico
// medido: 0.4s). NUNCA usar en read-after-write critical:
//   - validación de answer-and-save
//   - daily-limit (usuario espera ver su contador actualizado)
//   - cualquier read justo después de un write del mismo user
//
// Feature flag USE_READ_REPLICA permite rollback instantáneo:
//   - false (default): getReadDb() devuelve el mismo cliente que getDb() → primary
//   - true:           getReadDb() devuelve el cliente del replica
// Esto permite migrar endpoints uno a uno SIN tocar el flag, y activar/desactivar
// la replica globalmente con una sola variable.

const globalForReadDb = globalThis as unknown as {
  readDb: ReturnType<typeof drizzle<typeof schema>> | undefined
}

function createReadDbClient() {
  const replicaUrl = process.env.DATABASE_URL_REPLICA
  if (!replicaUrl) return null

  // Mismo statement_timeout que primary para consistencia
  const urlWithTimeout = replicaUrl.includes('?')
    ? `${replicaUrl}&options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`
    : `${replicaUrl}?options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`

  const conn = postgres(urlWithTimeout, {
    max: 1,             // Igual que primary — replica también tiene Supavisor max
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,     // Requerido por Supavisor Transaction Pooler
  })

  // Warmup en background (no bloquea)
  conn`SELECT 1`.catch(() => {})

  return drizzle(conn, { schema })
}

/**
 * Cliente Drizzle apuntando al read replica si USE_READ_REPLICA=true,
 * o al primary en caso contrario (fallback rollback-safe).
 *
 * Usar en endpoints SOLO para lecturas tolerables a stale ≤1s.
 */
export function getReadDb() {
  const useReplica = process.env.USE_READ_REPLICA === 'true'
  if (!useReplica) return getDb()

  if (!globalForReadDb.readDb) {
    globalForReadDb.readDb = createReadDbClient() as any
  }
  // Si DATABASE_URL_REPLICA no está set pero USE_READ_REPLICA=true → fallback a primary
  if (!globalForReadDb.readDb) {
    console.warn('[getReadDb] USE_READ_REPLICA=true pero DATABASE_URL_REPLICA no está configurado — fallback a primary')
    return getDb()
  }
  return globalForReadDb.readDb
}

// Re-exportar tipos útiles
export type DbClient = typeof db
