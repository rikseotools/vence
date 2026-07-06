import { Module } from '@nestjs/common';
import { CompetitorQueriesService } from './competitor-queries.service';
import { CompetitorSyncService } from './competitor-sync.service';
import { CompetitorsCron } from './competitors.cron';

/**
 * Subsistema "Analizador de Competidores". Catálogo duradero de competidores +
 * cron de sincronización (sitemap/cursos/precios/cambios). Complementa el radar
 * de señales OEP; la Capa 3 del radar se alimenta de estas tablas.
 *
 * DRIZZLE, ObservabilityService y HeartbeatRegistry son globales.
 * Diseño: docs/roadmap/analizador-competidores.md
 */
@Module({
  providers: [CompetitorQueriesService, CompetitorSyncService, CompetitorsCron],
  exports: [CompetitorQueriesService],
})
export class CompetitorsModule {}
