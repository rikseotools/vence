import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectNotasConvocatoriaCron } from './detect-notas-convocatoria.cron';
import { DetectNotasConvocatoriaService } from './detect-notas-convocatoria.service';
import { ReconcileConvocatoriaCron } from './reconcile-convocatoria.cron';
import { ReconcileConvocatoriaService } from './reconcile-convocatoria.service';

/**
 * Notas de convocatoria + reconciliación del proceso. Dos pases con responsabilidades separadas:
 *
 *  1. `detect-notas` (09:30 UTC) — CRAWLER: lee el seguimiento, saca los PDF, extrae señales de
 *     versión/criterio y **llena el corpus** (`convocatoria_documentos`, texto íntegro).
 *  2. `reconcile-convocatoria` (10:00 UTC) — RECONCILIADOR: lee el CORPUS (no la red), extrae los
 *     hechos del proceso con su cita literal y los compara con lo que mostramos → findings.
 *
 * Separados a propósito: reconciliar no debe re-descargar nada (para eso se guarda el texto), y así
 * se puede re-correr la reconciliación sola cuando cambia el prompt o las reglas.
 *
 * Importa `OepSignalsModule` para reutilizar `OepSignalsLlmService.fetchPageHtml`
 * (http→headless Lambda). `AnthropicService` y `DRIZZLE` son globales.
 */
@Module({
  imports: [OepSignalsModule],
  providers: [
    DetectNotasConvocatoriaService,
    DetectNotasConvocatoriaCron,
    ReconcileConvocatoriaService,
    ReconcileConvocatoriaCron,
  ],
})
export class DetectNotasConvocatoriaModule {}
