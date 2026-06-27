import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectNotasConvocatoriaCron } from './detect-notas-convocatoria.cron';
import { DetectNotasConvocatoriaService } from './detect-notas-convocatoria.service';

/**
 * Sensor de notas informativas de convocatorias. Importa `OepSignalsModule`
 * para reutilizar `OepSignalsLlmService.fetchPageHtml` (http→headless Lambda).
 * `AnthropicService` y `DRIZZLE` son globales.
 */
@Module({
  imports: [OepSignalsModule],
  providers: [DetectNotasConvocatoriaService, DetectNotasConvocatoriaCron],
})
export class DetectNotasConvocatoriaModule {}
