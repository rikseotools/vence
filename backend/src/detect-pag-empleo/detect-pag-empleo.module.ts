import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectPagEmpleoCron } from './detect-pag-empleo.cron';
import { DetectPagEmpleoService } from './detect-pag-empleo.service';

@Module({
  imports: [OepSignalsModule],
  providers: [DetectPagEmpleoService, DetectPagEmpleoCron],
})
export class DetectPagEmpleoModule {}
