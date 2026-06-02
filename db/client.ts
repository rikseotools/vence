// db/client.ts - Cliente Drizzle para queries tipadas
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ============================================
// max_lifetime compartido — TODOS los pools
// ============================================
// El default de postgres-js es 60*(30+random*30) = 30-60 MIN. Demasiado
// largo contra un pooler externo: si Supavisor (o cualquier pooler/red)
// medio-cierra una conexión TCP en un blip, postgres-js NO lo detecta
// (keep_alive=60s es lento) y reutiliza el socket ZOMBI hasta su
// max_lifetime → cada query por él cuelga hasta withDbTimeout (10s) y la BD
// ni se entera (queda ociosa). Confirmado 02/06/2026 con datos: distribución
// bimodal en /api/auth/track-session-ip (p50=57ms, p95=10003ms) con la BD a
// 1-4 conns activas durante los picos — causa raíz del incidente abierto
// 28/05 (ver memoria project_supavisor_zombie_conn_root_cause y
// ARCHITECTURE_ROADMAP §Fase 3 "TRAMPA HISTÓRICA 2").
//
// 90s fuerza el reciclado y acota CUALQUIER zombi a ≤90s. Es un ajuste
// universalmente correcto (no un parche para Supavisor): sigue siendo
// correcto con PgBouncer self-hosted o RDS. Por eso se aplica a TODOS los
// pools, no solo al que tocó el incidente.
const POOL_MAX_LIFETIME_S = 90

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
    max_lifetime: POOL_MAX_LIFETIME_S, // acota zombis de pooler — ver bloque arriba
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
// Probe de diagnóstico (SOLO se invoca en el path de TIMEOUT)
// ============================================
// Cuando una query del pool max:1 timeoutea (withDbTimeout), no sabemos si la
// BD está caída o si la conexión del pool quedó ZOMBI (medio-cerrada por
// Supavisor en un blip, pero postgres-js la cree viva). Este probe abre una
// conexión NUEVA de un solo uso y hace SELECT 1:
//   - responde rápido  → BD/red sanas, la conexión del POOL era el problema
//                          → confirma la hipótesis zombi.
//   - también falla     → fallo real de BD/red en ese instante.
// Si DATABASE_URL_SELF_POOLER está set, prueba también el path PgBouncer
// self-hosted: PgBouncer OK mientras Supavisor falla = evidencia directa para
// reenrutar el path de escritura (Capa 2 del fix).
//
// COSTE: solo corre en el path de fallo (~cientos/día), nunca en el camino
// sano → cero impacto en latencia de requests normales. Acotado a ~1.5-2s.

const PROBE_BUDGET_MS = 1500

async function probeOnce(connectionString: string): Promise<{ ok: boolean; ms: number; error?: string }> {
  const start = Date.now()
  const probe = postgres(connectionString, {
    max: 1,
    connect_timeout: 2,
    idle_timeout: 1,
    max_lifetime: 5,
    prepare: false,
  })
  try {
    const query = probe`SELECT 1`
    // Evita unhandledRejection si el timer gana la carrera y la query
    // subyacente rechaza más tarde.
    query.catch(() => {})
    await Promise.race([
      query,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`probe_timeout_${PROBE_BUDGET_MS}ms`)), PROBE_BUDGET_MS),
      ),
    ])
    return { ok: true, ms: Date.now() - start }
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: e instanceof Error ? e.message.slice(0, 120) : 'unknown' }
  } finally {
    probe.end({ timeout: 1 }).catch(() => {})
  }
}

export interface DbProbeResult {
  supavisorFreshOk: boolean
  supavisorMs: number
  supavisorError?: string
  pgbouncerOk: boolean | null
  pgbouncerMs: number | null
  pgbouncerError?: string
}

/**
 * Diagnostica el camino a BD tras un timeout. Abre conexiones nuevas de un
 * solo uso (no toca los pools de la app). Devuelve si una conexión fresca a
 * Supavisor —y, si está configurado, al PgBouncer self-hosted— responde AHORA.
 */
export async function probeDbPaths(): Promise<DbProbeResult> {
  const supaUrl = process.env.DATABASE_URL
  const poolerUrl = process.env.DATABASE_URL_SELF_POOLER
  const supa = supaUrl
    ? await probeOnce(supaUrl)
    : { ok: false, ms: 0, error: 'no DATABASE_URL' }
  const pooler = poolerUrl ? await probeOnce(poolerUrl) : null
  return {
    supavisorFreshOk: supa.ok,
    supavisorMs: supa.ms,
    supavisorError: supa.error,
    pgbouncerOk: pooler ? pooler.ok : null,
    pgbouncerMs: pooler ? pooler.ms : null,
    pgbouncerError: pooler?.error,
  }
}

// ============================================
// Pool para admin/dashboard (queries paralelas)
// ============================================
// Prefiere el self-hosted PgBouncer (pooler.vence.es) si está disponible —
// el Supavisor regional de Supabase cuelga indefinidamente con queries
// paralelas (medido: 11 queries con max:4 → 2 se quedan sin resolver y
// dejan slots muertos en el pool → 503 en /admin). Con el pooler propio
// las 11 queries pasan en ~520ms con max:12.
// Fallback al DATABASE_URL normal si DATABASE_URL_SELF_POOLER no está set.

const globalForAdminDb = globalThis as unknown as {
  adminDb: ReturnType<typeof drizzle<typeof schema>> | undefined
}

function createAdminDbClient() {
  const connectionString = process.env.DATABASE_URL_SELF_POOLER || process.env.DATABASE_URL
  if (!connectionString) return null

  const urlWithTimeout = connectionString.includes('?')
    ? `${connectionString}&options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`
    : `${connectionString}?options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`

  // max:12 = 1 conexión por query del dashboard (11) + 1 de margen.
  // Seguro porque PgBouncer multiplexa transacciones: cada query libera
  // su slot upstream al terminar (~200ms cada una), no por toda la sesión.
  const conn = postgres(urlWithTimeout, {
    max: 12,
    idle_timeout: 20,
    connect_timeout: 5,
    max_lifetime: POOL_MAX_LIFETIME_S, // acota zombis de pooler — ver bloque arriba
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
    max_lifetime: POOL_MAX_LIFETIME_S, // acota zombis de pooler — ver bloque arriba
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
    max_lifetime: POOL_MAX_LIFETIME_S, // acota zombis de pooler — ver bloque arriba
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

// ============================================
// Pool del SELF-HOSTED POOLER (PgBouncer en Lightsail London)
// ============================================
// Self-hosted PgBouncer 1.25.2 corriendo en pooler.vence.es:6543. Aísla
// nuestro tráfico del Supavisor regional compartido (que tiene blips).
// Provisión y arquitectura completas en docs/roadmap/self-hosted-pooler.md
// y infra/pooler/README.md.
//
// Auth: SCRAM passthrough — cliente y upstream usan el mismo usuario `postgres`
// con la misma password. PgBouncer reutiliza las SCRAM keys del cliente para
// autenticar al upstream sin recomputar el proof (workaround de un bug
// conocido de PgBouncer 1.22-1.25 contra Supabase Postgres 17).
//
// DSN esperado (Vercel env var DATABASE_URL_SELF_POOLER):
//   postgresql://postgres:<MISMO_PASSWORD_QUE_DATABASE_URL>@pooler.vence.es:6543/postgres?sslmode=require
//
// IMPORTANTE: este pool inicialmente sirve como CANARY para 1 endpoint
// read-only de bajo riesgo. Solo se activa con USE_SELF_HOSTED_POOLER=true.
// Si el flag está OFF (default), getPoolerDb() devuelve getDb() (transparente).
//
// Patrón actual: feature flag binario (Patrón A del plan).
// Pendiente Fase 4+: añadir fallback automático al primary si el self-pooler
// devuelve errores de conexión (Patrón B del plan).

const globalForPoolerDb = globalThis as unknown as {
  poolerDb: ReturnType<typeof drizzle<typeof schema>> | undefined
}

function createPoolerDbClient() {
  const poolerUrl = process.env.DATABASE_URL_SELF_POOLER
  if (!poolerUrl) return null

  const urlWithTimeout = poolerUrl.includes('?')
    ? `${poolerUrl}&options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`
    : `${poolerUrl}?options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000`

  // max:8 — el self-hosted PgBouncer (transaction mode) multiplexa transacciones
  // sobre ~30 conexiones upstream. Cada cliente postgres-js puede pedir hasta 8
  // conexiones lógicas; el upstream las sirve sin saturar Postgres porque cada
  // query libera su slot en ms (no por toda la sesión).
  //
  // Comparativa pools del repo (mismo schema):
  //   - createDbClient (Supavisor regional)  max:1  histórico tras 261 events 2026-04-27
  //   - createPoolerDbClient (self-hosted)    max:8  ← este — PgBouncer multiplexa OK
  //   - createAdminDbClient (admin queries)   max:12 ya en prod sin problemas
  //
  // CHANGELOG max:1 → max:8 (2026-06-01, Fase 1 pool-segregation):
  //   La Hipótesis D del incidente 31/05/2026 reveló que max:1 sufre starvation
  //   durante rolling deploy Fargate (container nuevo arranca con pool vacío,
  //   las primeras requests bloquean al `pool.acquire()` mientras se establece
  //   la conexión TCP/TLS). max:8 + warmup robusto cierra esa ventana.
  const conn = postgres(urlWithTimeout, {
    max: 8,
    idle_timeout: 20,
    connect_timeout: 5,
    max_lifetime: POOL_MAX_LIFETIME_S, // acota zombis de pooler — ver bloque arriba
    prepare: false,     // Requerido por compat — PgBouncer transaction mode
  })

  // Warmup robusto al boot del container — abre 3 conexiones en paralelo y
  // ejecuta SELECT 1 sobre cada una. Sin esto, el pool arranca con 0
  // conexiones reales y la primera request real espera el handshake TCP/TLS.
  // Con desired=2 instancias y max:8, 3 warmups por container = 6 conexiones
  // calientes al arrancar, suficiente para absorber el primer minuto de
  // tráfico real sin esperar al pool.acquire().
  //
  // `void` para evitar warning sobre promesa no manejada — los errores se
  // loggean dentro del bloque, no propagamos al boot del módulo.
  void (async () => {
    const warmupResults = await Promise.allSettled([
      conn`SELECT 1`,
      conn`SELECT 1`,
      conn`SELECT 1`,
    ])
    const failures = warmupResults.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      console.warn(
        `[poolerDb] warmup parcial: ${failures.length}/3 fallaron. ` +
          `Primer error: ${(failures[0] as PromiseRejectedResult).reason}`,
      )
    } else {
      console.log('[poolerDb] warmup OK: 3 conns establecidas a pooler.vence.es')
    }
  })()

  return drizzle(conn, { schema })
}

/**
 * Cliente Drizzle apuntando al self-hosted PgBouncer si USE_SELF_HOSTED_POOLER=true,
 * o al primary en caso contrario (fallback rollback-safe).
 *
 * Usar en endpoints específicos durante canary. Migración gradual:
 * - Fase 2-3: 1 endpoint read-only (canary)
 * - Fase 4: todos los reads
 * - Fase 5: writes
 *
 * El pool del pooler propio elimina los blips del Supavisor regional al usar
 * un PgBouncer dedicado a nuestro tráfico (no compartido con otros clientes
 * Supabase).
 */
export function getPoolerDb() {
  const useSelfPooler = process.env.USE_SELF_HOSTED_POOLER === 'true'
  if (!useSelfPooler) return getDb()

  if (!globalForPoolerDb.poolerDb) {
    globalForPoolerDb.poolerDb = createPoolerDbClient() as any
  }
  // Si DATABASE_URL_SELF_POOLER no está set pero USE_SELF_HOSTED_POOLER=true → fallback a primary
  if (!globalForPoolerDb.poolerDb) {
    console.warn('[getPoolerDb] USE_SELF_HOSTED_POOLER=true pero DATABASE_URL_SELF_POOLER no está configurado — fallback a primary')
    return getDb()
  }
  return globalForPoolerDb.poolerDb
}

// Re-exportar tipos útiles
export type DbClient = typeof db
