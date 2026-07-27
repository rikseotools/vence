import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { RadarModule } from '../radar/radar.module';
import { DetectBoletinesCron } from './detect-boletines.cron';
import { DetectBoletinesService } from './detect-boletines.service';

@Module({
  imports: [OepSignalsModule, RadarModule],
  providers: [DetectBoletinesService, DetectBoletinesCron],
})
export class DetectBoletinesModule {}
