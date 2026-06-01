import { Module } from '@nestjs/common';
import { AutoPromoteCoverageCron } from './auto-promote-coverage.cron';
import { AutoPromoteCoverageService } from './auto-promote-coverage.service';

/**
 * Sprint D del roadmap docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md.
 *
 * Cron diario que sube coverage_level cuando se cumplen criterios objetivos.
 * Conecta detección automática (Lambda headless + sensor LLM Haiku) con el
 * ciclo de vida del catálogo de oposiciones.
 */
@Module({
  providers: [AutoPromoteCoverageService, AutoPromoteCoverageCron],
  exports: [AutoPromoteCoverageService],
})
export class AutoPromoteCoverageModule {}
