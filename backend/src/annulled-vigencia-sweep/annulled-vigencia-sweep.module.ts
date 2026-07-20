import { Module } from '@nestjs/common';
import { AnnulledVigenciaSweepCron } from './annulled-vigencia-sweep.cron';
import { AnnulledVigenciaSweepService } from './annulled-vigencia-sweep.service';

@Module({
  providers: [AnnulledVigenciaSweepService, AnnulledVigenciaSweepCron],
  exports: [AnnulledVigenciaSweepService],
})
export class AnnulledVigenciaSweepModule {}
