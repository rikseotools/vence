import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectTimelineSilenceCron } from './detect-timeline-silence.cron';
import { DetectTimelineSilenceService } from './detect-timeline-silence.service';

@Module({
  imports: [OepSignalsModule],
  providers: [DetectTimelineSilenceService, DetectTimelineSilenceCron],
})
export class DetectTimelineSilenceModule {}
