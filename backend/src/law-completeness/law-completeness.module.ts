import { Module } from '@nestjs/common';
import { LawCompletenessCron } from './law-completeness.cron';
import { LawCompletenessService } from './law-completeness.service';

@Module({
  providers: [LawCompletenessService, LawCompletenessCron],
  exports: [LawCompletenessService],
})
export class LawCompletenessModule {}
