import { Module } from '@nestjs/common';
import { ConversionDrainCron } from './conversion-drain.cron';
import { ConversionDrainService } from './conversion-drain.service';

/**
 * Drain fiable del outbox de conversiones desde el worker Fargate caliente.
 * Ver conversion-drain.cron.ts para el porqué (reemplaza el cron de GHA, causa
 * raíz dominante de las conversiones en DLQ, incidente 19-23/06).
 *
 * ObservabilityService y HeartbeatRegistry vienen de módulos @Global; ConfigService
 * de ConfigModule.forRoot({isGlobal:true}). No hace falta importarlos aquí.
 */
@Module({
  providers: [ConversionDrainService, ConversionDrainCron],
  exports: [ConversionDrainService],
})
export class ConversionDrainModule {}
