import { Module } from '@nestjs/common';
import { OutboxProcessorModule } from '../outbox-processor/outbox-processor.module';
import { HealthController } from './health.controller';

@Module({
  imports: [OutboxProcessorModule],
  controllers: [HealthController],
})
export class HealthModule {}
