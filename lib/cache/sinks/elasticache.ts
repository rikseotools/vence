// lib/cache/sinks/elasticache.ts
// Sink ElastiCache (Redis TCP en-VPC, para ECS Fargate). PREPARADO — se activa
// con CACHE_PROVIDER=elasticache una vez provisionado el nodo (ver checklist en
// docs/runbooks/cache-elasticache-migracion.md).
//
// `ioredis` NO está instalado aún (Fase 0 es dependency-free): el import usa un
// especificador VARIABLE para que el tracer de `next build` (nft) no intente
// empaquetarlo. En Fase 1: `npm i ioredis` + provisionar nodo + ELASTICACHE_URL.
//
// Diferencia clave vs Upstash: ioredis guarda STRINGS → este sink (de)serializa
// JSON él mismo, de modo que los callers reciben el MISMO T que con Upstash.
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
    const url = process.env.ELASTICACHE_URL // redis://host:6379 (o rediss:// si TLS)
    if (!url) throw new Error('ELASTICACHE_URL no configurada')
    // Especificador variable → nft no lo traza; requiere `npm i ioredis` en runtime.
    const moduleName = 'ioredis'
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as { default: new (u: string, o?: unknown) => RedisLike }
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
