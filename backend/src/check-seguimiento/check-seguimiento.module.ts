import { Module } from '@nestjs/common';
import { CheckSeguimientoCron } from './check-seguimiento.cron';
import { CheckSeguimientoService } from './check-seguimiento.service';

@Module({
  providers: [CheckSeguimientoService, CheckSeguimientoCron],
  exports: [CheckSeguimientoService],
})
export class CheckSeguimientoModule {}
