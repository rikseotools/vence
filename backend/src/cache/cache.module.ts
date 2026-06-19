import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheVersioningService } from './cache-versioning.service';

/**
 * Módulo Global de cache (agnóstica por contrato — ver cache-sink.ts).
 *
 * Compartido con la app Next.js — mismas keys, mismo formato JSON, MISMO
 * proveedor (CACHE_PROVIDER: upstash|elasticache). Invalidación coherente
 * cross-runtime porque ambos leen del mismo store. CRÍTICO: frontend y backend
 * deben usar el MISMO CACHE_PROVIDER o `cache_version` diverge → stale.
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
