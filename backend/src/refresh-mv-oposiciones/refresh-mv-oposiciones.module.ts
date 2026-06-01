import { Module } from '@nestjs/common';
import { RefreshMvOposicionesCron } from './refresh-mv-oposiciones.cron';
import { RefreshMvOposicionesService } from './refresh-mv-oposiciones.service';

/**
 * Sprint G.4 — refresh nocturno cada 30 min de mv_oposiciones_activas.
 */
@Module({
  providers: [RefreshMvOposicionesService, RefreshMvOposicionesCron],
  exports: [RefreshMvOposicionesService],
})
export class RefreshMvOposicionesModule {}
