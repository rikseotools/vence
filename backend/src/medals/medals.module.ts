import { Module } from '@nestjs/common';
import { MedalsController } from './medals.controller';
import { MedalsService } from './medals.service';

@Module({
  controllers: [MedalsController],
  providers: [MedalsService],
})
export class MedalsModule {}
