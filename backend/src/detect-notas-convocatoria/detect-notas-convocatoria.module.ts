import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectNotasConvocatoriaCron } from './detect-notas-convocatoria.cron';
import { DetectNotasConvocatoriaService } from './detect-notas-convocatoria.service';

/**
 * Sensor de notas informativas de convocatorias (versiones de software, criterios, fechas) +
 * volcado de lo que descarga al corpus como evidencia BRUTA (`curado=false`).
 *
 * ⚠️ NO hay cron de reconciliación (se eliminó el 16/07, el mismo día que se creó — decisión Manuel):
 *  · DUPLICABA al radar: `oep_detection_signals` YA extrae fecha_examen/plazas/boc_ref/estado con
 *    su confianza. Volver a llamar al LLM para lo mismo es duplicar un sensor que funciona
 *    (390 señales aplicadas, 1.256 descartadas).
 *  · Y hacía JUICIO A CIEGAS. Un crawler por regex no distingue las bases de un PDF titulado
 *    "previsión de plazas a convocar" — que contiene números de plazas que NO son los de esta
 *    convocatoria. Extraer sobre un corpus sin discriminar envenena el resultado POR CONSTRUCCIÓN.
 *
 * El juicio (discriminar la señal → elegir los documentos reales → clonarlos bien → extraer con
 * cita literal → reconciliar) lo hace **Claude, a la orden del usuario**, siguiendo
 * `docs/runbooks/verificar-convocatorias.md`. Es la misma doctrina que el gemelo S2 del temario y
 * que el triaje de señales OEP: **los sensores se automatizan; el criterio no**.
 *
 * Importa `OepSignalsModule` para reutilizar `OepSignalsLlmService.fetchPageHtml`
 * (http→headless Lambda). `AnthropicService` y `DRIZZLE` son globales.
 */
@Module({
  imports: [OepSignalsModule],
  providers: [DetectNotasConvocatoriaService, DetectNotasConvocatoriaCron],
})
export class DetectNotasConvocatoriaModule {}
