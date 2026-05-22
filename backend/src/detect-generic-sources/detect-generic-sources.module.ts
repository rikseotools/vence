import { Module } from '@nestjs/common';
import { OepSignalsModule } from '../oep-signals/oep-signals.module';
import { DetectGenericSourcesCron } from './detect-generic-sources.cron';
import { DetectGenericSourcesService } from './detect-generic-sources.service';

@Module({
  imports: [OepSignalsModule],
  providers: [DetectGenericSourcesService, DetectGenericSourcesCron],
})
export class DetectGenericSourcesModule {}
