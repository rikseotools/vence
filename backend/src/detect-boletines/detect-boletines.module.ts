import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectBoletinesCron } from './detect-boletines.cron';
import { DetectBoletinesService } from './detect-boletines.service';

@Module({
  imports: [OepSignalsModule],
  providers: [DetectBoletinesService, DetectBoletinesCron],
})
export class DetectBoletinesModule {}
