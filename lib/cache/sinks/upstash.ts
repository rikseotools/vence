// lib/cache/sinks/upstash.ts
// Sink Upstash Redis (REST). Implementación actual. Upstash auto-(de)serializa
// JSON, así que get/set pasan el valor tal cual.
import { Redis } from '@upstash/redis'
import type { CacheSink } from '../sink'

export function createUpstashSink(): CacheSink | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const redis = new Redis({ url, token })

  return {
    name: 'upstash',
    async get<T>(key: string): Promise<T | null> {
      const v = await redis.get<T>(key)
      return v === undefined ? null : v
    },
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await redis.set(key, value, { ex: ttlSeconds })
    },
    async del(keys: string[]): Promise<void> {
      if (keys.length === 0) return
      await redis.del(...keys)
    },
    async incr(key: string): Promise<number> {
      return Number(await redis.incr(key)) || 0
    },
    async incrby(key: string, by: number): Promise<number> {
      return Number(await redis.incrby(key, by)) || 0
    },
    async expire(key: string, ttlSeconds: number): Promise<void> {
      await redis.expire(key, ttlSeconds)
    },
    async hincrby(hashKey: string, field: string, by: number): Promise<void> {
      await redis.hincrby(hashKey, field, by)
    },
    async hgetall(hashKey: string): Promise<Record<string, string | number> | null> {
      return (await redis.hgetall<Record<string, string | number>>(hashKey)) ?? null
    },
  }
}
