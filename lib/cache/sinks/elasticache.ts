// lib/cache/sinks/elasticache.ts
// Sink ElastiCache (Redis TCP en-VPC, para ECS Fargate). PREPARADO — se activa
// con CACHE_PROVIDER=elasticache una vez provisionado el nodo (ver checklist en
// docs/runbooks/cache-elasticache-migracion.md).
//
// `ioredis` es dep real (Fase 1) → import dinámico NORMAL (nft lo incluye en el
// build standalone de ECS). Carga perezosa: solo se conecta cuando
// CACHE_PROVIDER=elasticache selecciona este sink.
//
// Diferencia clave vs Upstash: ioredis guarda STRINGS → este sink (de)serializa
// JSON él mismo, de modo que los callers reciben el MISMO T que con Upstash.
// El endpoint `rediss://` activa TLS automáticamente en ioredis (sin config extra).
import type { CacheSink } from '../sink'

// Tipo mínimo del cliente ioredis que usamos (evita depender del paquete en build).
interface RedisLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ex: 'EX', ttl: number): Promise<unknown>
  del(...keys: string[]): Promise<unknown>
  incr(key: string): Promise<number>
  incrby(key: string, by: number): Promise<number>
  expire(key: string, ttl: number): Promise<unknown>
  hincrby(hashKey: string, field: string, by: number): Promise<unknown>
  hgetall(hashKey: string): Promise<Record<string, string>>
}

let _clientPromise: Promise<RedisLike> | null = null
async function getClient(): Promise<RedisLike> {
  if (_clientPromise) return _clientPromise
  _clientPromise = (async () => {
    const url = process.env.ELASTICACHE_URL // rediss://host:6379 (TLS) o redis://
    if (!url) throw new Error('ELASTICACHE_URL no configurada')
    const mod = (await import('ioredis')) as unknown as { default: new (u: string, o?: unknown) => RedisLike }
    const RedisCtor = mod.default
    return new RedisCtor(url, {
      // Robustez: no colgar la app si el nodo está caído; el caller cae al fetcher.
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
    })
  })()
  return _clientPromise
}

export function createElastiCacheSink(): CacheSink {
  return {
    name: 'elasticache',
    async get<T>(key: string): Promise<T | null> {
      const raw = await (await getClient()).get(key)
      if (raw === null || raw === undefined) return null
      try { return JSON.parse(raw) as T } catch { return raw as unknown as T }
    },
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await (await getClient()).set(key, JSON.stringify(value), 'EX', ttlSeconds)
    },
    async del(keys: string[]): Promise<void> {
      if (keys.length === 0) return
      await (await getClient()).del(...keys)
    },
    async incr(key: string): Promise<number> {
      return Number(await (await getClient()).incr(key)) || 0
    },
    async incrby(key: string, by: number): Promise<number> {
      return Number(await (await getClient()).incrby(key, by)) || 0
    },
    async expire(key: string, ttlSeconds: number): Promise<void> {
      await (await getClient()).expire(key, ttlSeconds)
    },
    async hincrby(hashKey: string, field: string, by: number): Promise<void> {
      await (await getClient()).hincrby(hashKey, field, by)
    },
    async hgetall(hashKey: string): Promise<Record<string, string | number> | null> {
      const r = await (await getClient()).hgetall(hashKey)
      return r && Object.keys(r).length > 0 ? r : null
    },
  }
}
