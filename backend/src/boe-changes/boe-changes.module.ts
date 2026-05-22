import { Module } from '@nestjs/common';
import { BoeChangesCron } from './boe-changes.cron';
import { BoeChangesService } from './boe-changes.service';

@Module({
  providers: [BoeChangesService, BoeChangesCron],
  exports: [BoeChangesService],
})
export class BoeChangesModule {}
