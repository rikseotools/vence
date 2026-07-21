import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectExamenesSignalsCron } from './detect-examenes-signals.cron';
import { DetectExamenesSignalsService } from './detect-examenes-signals.service';

/**
 * Sensor `nota_examen`: emite señales OEP a partir de las fechas de examen que
 * `detect-notas-convocatoria` ya extrae a `convocatoria_notas`. Cierra el hueco que
 * dejó el sensor retirado `hash_change`: convierte "una convocatoria trackeada
 * publicó su fecha de examen" en una alerta accionable en `/admin/oep-signals`.
 */
@Module({
  imports: [OepSignalsModule],
  providers: [DetectExamenesSignalsService, DetectExamenesSignalsCron],
})
export class DetectExamenesSignalsModule {}
