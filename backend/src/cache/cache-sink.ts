// backend/src/cache/cache-sink.ts
// Contrato AGNÓSTICO de la caché del backend (espejo de lib/cache/sink.ts del
// frontend). CacheService contiene la LÓGICA (timeout/fallback) y habla SÓLO
// con esta interfaz → cambiar de proveedor = cambiar sink, no reescribir.
//
// COHERENCIA cross-runtime: frontend y backend DEBEN usar el mismo proveedor
// (CACHE_PROVIDER) para que la clave compartida `cache_version:${tag}` sea la
// misma → invalidación versionada coherente. Migrar uno solo serviría stale.

export interface CacheSink {
  readonly name: string;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(keys: string[]): Promise<void>;
  incr(key: string): Promise<number>;
}

export interface CacheSinkOptions {
  provider: string; // 'upstash' (default) | 'elasticache'
  upstashUrl?: string;
  upstashToken?: string;
  elasticacheUrl?: string; // rediss://host:6379 (TLS) o redis://
}

/** Devuelve el sink configurado o null (sin credenciales → cache bypassed). */
export function createCacheSink(opts: CacheSinkOptions): CacheSink | null {
  if (opts.provider === 'elasticache') {
    if (!opts.elasticacheUrl) return null;
    return createElastiCacheSink(opts.elasticacheUrl);
  }
  if (!opts.upstashUrl || !opts.upstashToken) return null;
  return createUpstashSink(opts.upstashUrl, opts.upstashToken);
}

// ---- Upstash (REST) ----
function createUpstashSink(url: string, token: string): CacheSink {
  // require perezoso para no cargar el SDK si se usa elasticache.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  const redis = new Redis({ url, token });
  return {
    name: 'upstash',
    async get<T>(key: string): Promise<T | null> {
      const v = await redis.get<T>(key);
      return v === undefined ? null : v;
    },
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await redis.set(key, value, { ex: ttlSeconds });
    },
    async del(keys: string[]): Promise<void> {
      if (keys.length === 0) return;
      await redis.del(...keys);
    },
    async incr(key: string): Promise<number> {
      return Number(await redis.incr(key)) || 0;
    },
  };
}

// ---- ElastiCache (Redis TCP, ioredis) ----
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: 'EX', ttl: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  incr(key: string): Promise<number>;
}

function createElastiCacheSink(url: string): CacheSink {
  let clientPromise: Promise<RedisLike> | null = null;
  const getClient = (): Promise<RedisLike> => {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      const mod = (await import('ioredis')) as unknown as {
        default: new (u: string, o?: unknown) => RedisLike;
      };
      return new mod.default(url, { maxRetriesPerRequest: 1, enableReadyCheck: true });
    })();
    return clientPromise;
  };
  return {
    name: 'elasticache',
    async get<T>(key: string): Promise<T | null> {
      const raw = await (await getClient()).get(key);
      if (raw === null || raw === undefined) return null;
      try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
    },
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await (await getClient()).set(key, JSON.stringify(value), 'EX', ttlSeconds);
    },
    async del(keys: string[]): Promise<void> {
      if (keys.length === 0) return;
      await (await getClient()).del(...keys);
    },
    async incr(key: string): Promise<number> {
      return Number(await (await getClient()).incr(key)) || 0;
    },
  };
}
