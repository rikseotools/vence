// lib/cache/sink.ts
// Contrato AGNÓSTICO de la caché (principio: "AWS-native by default, agnóstico
// by contract"). Las funciones públicas de `redis.ts` (getOrSet/getCached/…)
// contienen TODA la lógica (timeout, singleflight, métricas, fallback) y hablan
// SÓLO con esta interfaz → cambiar de proveedor = cambiar el sink, no reescribir.
//
// Sinks disponibles:
//   - upstash     (lib/cache/sinks/upstash) — REST, actual. Funciona desde
//                 cualquier runtime; límite de tamaño por request (~1MB plan).
//   - elasticache (lib/cache/sinks/elasticache) — Redis TCP en-VPC (ECS Fargate).
//                 Sin límite de 1MB (valores hasta 512MB); más barato a escala.
//
// Selección por env `CACHE_PROVIDER` (default 'upstash' → cero cambio de comportamiento).
// El sink normaliza serialización: get devuelve el valor ya deserializado, set
// lo serializa — así los callers reciben T consistente con cualquier proveedor.

export interface CacheSink {
  /** Nombre del proveedor (telemetría/debug). */
  readonly name: string
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
  del(keys: string[]): Promise<void>
  incr(key: string): Promise<number>
  incrby(key: string, by: number): Promise<number>
  expire(key: string, ttlSeconds: number): Promise<void>
  hincrby(hashKey: string, field: string, by: number): Promise<void>
  hgetall(hashKey: string): Promise<Record<string, string | number> | null>
}

let _sink: CacheSink | null | undefined

/**
 * Devuelve el sink configurado, o `null` si la caché está desactivada
 * (`REDIS_CACHE_ENABLED=false`) o sin credenciales → los callers caen al fetcher
 * (preserva disponibilidad). Cacheado por proceso (cold start lo resetea).
 */
export function getSink(): CacheSink | null {
  // Flag chequeado en CADA llamada (rollback instantáneo; semántica del getRedis
  // original). El bypass por flag NO se cachea.
  if (process.env.REDIS_CACHE_ENABLED === 'false') return null
  if (_sink) return _sink
  const provider = (process.env.CACHE_PROVIDER || 'upstash').toLowerCase()
  /* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
  const sink: CacheSink | null = provider === 'elasticache'
    ? require('./sinks/elasticache').createElastiCacheSink()
    : require('./sinks/upstash').createUpstashSink()
  /* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
  // Solo cachear un sink real; `null` (sin credenciales) se re-evalúa la próxima vez.
  if (sink) _sink = sink
  return sink
}

/** Sólo para tests: inyecta un sink fake / resetea la selección. */
export function _setSinkForTests(sink: CacheSink | null | undefined): void {
  _sink = sink
}
