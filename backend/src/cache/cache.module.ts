import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheVersioningService } from './cache-versioning.service';

/**
 * Módulo Global de cache Redis (Upstash REST).
 *
 * Compartido con la app Next.js — mismas keys, mismo formato JSON,
 * misma instancia Upstash. Invalidación coherente cross-runtime
 * porque ambos leen del mismo store.
 *
 * Exporta:
 *   - CacheService: GET/SET/DEL/INCR/getNumber
 *   - CacheVersioningService: tag-like invalidation por versioned keys
 *     (reusable, agnóstico a proveedor — solo usa GET+INCR estándar)
 *
 * Ver docs/architecture/bloque3-redis-cross-runtime.md.
 */
@Global()
@Module({
  providers: [CacheService, CacheVersioningService],
  exports: [CacheService, CacheVersioningService],
})
export class CacheModule {}
