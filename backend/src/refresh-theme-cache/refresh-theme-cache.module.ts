import { Module } from '@nestjs/common';
import { RefreshThemeCacheCron } from './refresh-theme-cache.cron';
import { RefreshThemeCacheService } from './refresh-theme-cache.service';

@Module({
  providers: [RefreshThemeCacheService, RefreshThemeCacheCron],
  exports: [RefreshThemeCacheService],
})
export class RefreshThemeCacheModule {}
