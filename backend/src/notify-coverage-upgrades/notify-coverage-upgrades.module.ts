import { Module } from '@nestjs/common';
import { NotifyCoverageUpgradesCron } from './notify-coverage-upgrades.cron';
import { NotifyCoverageUpgradesService } from './notify-coverage-upgrades.service';

/**
 * Sprint F del roadmap docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md.
 *
 * Cron diario que envía email a users con target_oposicion = slug cuando
 * el cron auto-promote-coverage ha subido el coverage_level. Cierra el
 * ciclo detección → captación.
 */
@Module({
  providers: [NotifyCoverageUpgradesService, NotifyCoverageUpgradesCron],
  exports: [NotifyCoverageUpgradesService],
})
export class NotifyCoverageUpgradesModule {}
