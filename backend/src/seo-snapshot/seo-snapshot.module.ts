import { Module } from '@nestjs/common';
import { SeoSnapshotCron } from './seo-snapshot.cron';
import { SeoSnapshotService } from './seo-snapshot.service';

@Module({
  providers: [SeoSnapshotService, SeoSnapshotCron],
  exports: [SeoSnapshotService],
})
export class SeoSnapshotModule {}
