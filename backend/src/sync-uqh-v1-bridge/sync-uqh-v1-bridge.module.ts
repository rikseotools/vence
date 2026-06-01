import { Module } from '@nestjs/common';
import { SyncUqhV1BridgeCron } from './sync-uqh-v1-bridge.cron';
import { SyncUqhV1BridgeService } from './sync-uqh-v1-bridge.service';

// ⚠️  PUENTE TEMPORAL — eliminar este módulo cuando los 4 lectores de
// `user_question_history` (v1) estén migrados a `user_question_history_v2`
// y se haga el DROP TABLE de v1. Ver sync-uqh-v1-bridge.service.ts.
@Module({
  providers: [SyncUqhV1BridgeService, SyncUqhV1BridgeCron],
  exports: [SyncUqhV1BridgeService],
})
export class SyncUqhV1BridgeModule {}
