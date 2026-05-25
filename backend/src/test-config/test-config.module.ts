import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { TestConfigController } from './test-config.controller';
import { TestConfigService } from './test-config.service';

/**
 * Módulo Test-Config: 4 endpoints públicos para el configurador de tests.
 *
 * GET /api/v2/test-config/{articles,sections,essential-articles,estimate}
 *
 * Cache versionado con CacheVersioningService (tag 'test-config' compartido
 * con frontend `lib/cache/test-config.ts`). Invalidación cross-runtime
 * desde admin lifecycle transitions vía INCR del contador en Upstash.
 *
 * Port de los 4 endpoints Vercel `app/api/v2/test-config/*`. Ver
 * `docs/architecture/bloque3-audit-hot-path.md` §2.5.
 */
@Module({
  imports: [CacheModule],
  controllers: [TestConfigController],
  providers: [TestConfigService],
  exports: [TestConfigService],
})
export class TestConfigModule {}
