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
  // Exportada para que el cron LEGACY `detect-boletines` reporte por la MISMA vía
  // que el orquestador (T-187): sus 18 boletines no tenían liveness propia y un
  // boletín que dejara de devolver contenido era invisible. Telemetría, no señal:
  // no hay riesgo de duplicar lo que emite cada capa.
  exports: [RadarTelemetry],
})
export class RadarModule {}
