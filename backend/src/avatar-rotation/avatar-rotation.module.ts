import { Module } from '@nestjs/common';
import { AvatarRotationCron } from './avatar-rotation.cron';
import { AvatarRotationService } from './avatar-rotation.service';

@Module({
  providers: [AvatarRotationService, AvatarRotationCron],
  exports: [AvatarRotationService],
})
export class AvatarRotationModule {}
