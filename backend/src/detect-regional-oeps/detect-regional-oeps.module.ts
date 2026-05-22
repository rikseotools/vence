import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectRegionalOepsCron } from './detect-regional-oeps.cron';
import { DetectRegionalOepsService } from './detect-regional-oeps.service';

@Module({
  imports: [OepSignalsModule],
  providers: [DetectRegionalOepsService, DetectRegionalOepsCron],
})
export class DetectRegionalOepsModule {}
