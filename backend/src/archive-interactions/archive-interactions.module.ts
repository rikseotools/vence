import { Module } from '@nestjs/common';
import { ArchiveInteractionsCron } from './archive-interactions.cron';
import { ArchiveInteractionsService } from './archive-interactions.service';

@Module({
  providers: [ArchiveInteractionsService, ArchiveInteractionsCron],
  exports: [ArchiveInteractionsService],
})
export class ArchiveInteractionsModule {}
