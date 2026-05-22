import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectOepLlmCron } from './detect-oep-llm.cron';
import { DetectOepLlmService } from './detect-oep-llm.service';

@Module({
  imports: [OepSignalsModule],
  providers: [DetectOepLlmService, DetectOepLlmCron],
})
export class DetectOepLlmModule {}
