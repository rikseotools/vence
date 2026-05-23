import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Módulo Global de cache Redis (Upstash REST).
 *
 * Compartido con la app Next.js — mismas keys, mismo formato JSON,
 * misma instancia Upstash. Invalidación coherente cross-runtime
 * porque ambos leen del mismo store.
 *
 * Ver docs/architecture/bloque3-redis-cross-runtime.md.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
