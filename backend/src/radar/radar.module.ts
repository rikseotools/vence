import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { CompetitorsModule } from '../competitors/competitors.module';
import { RadarTelemetry } from './core/telemetry';
import { RadarOrchestrator } from './orchestrator';
import { RadarCron } from './radar.cron';

/**
 * Radar multi-capa de convocatorias. Orquestador único + telemetría total.
 * ObservabilityService y HeartbeatRegistry son globales; OepSignalsModule
 * aporta las queries y el LLM. Diseño: docs/roadmap/radar-multicapa.md
 */
@Module({
  imports: [OepSignalsModule, CompetitorsModule],
  providers: [RadarOrchestrator, RadarTelemetry, RadarCron],
})
export class RadarModule {}
