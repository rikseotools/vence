// backend/src/tipificar-documentos/tipificar-documentos.cron.ts
//
// Disparador de T-147 "paso 2": reclasifica en lotes las filas 'nota' del hub de provenance
// que ya tienen señal suficiente (convocatoria, bases, OEP, temario…), para que el backlog no
// se rellene solo cada día. Diario, justo después de detect-notas-convocatoria (09:30 UTC) —
// hueco propio, no colisiona con nada.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { TipificarDocumentosService } from './tipificar-documentos.service';

@Injectable()
export class TipificarDocumentosCron {
  private readonly logger = new Logger(TipificarDocumentosCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: TipificarDocumentosService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Diario → umbral 2 días (tolera 1 día de retraso), igual que detect-notas-convocatoria.
    heartbeatRegistry.register(
      'tipificar-documentos',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 172_800_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('45 9 * * *', { name: 'tipificar-documentos', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'tipificar-documentos',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron tipificar-documentos disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'tipificar-documentos',
        durationMs: Date.now() - startedAt,
        metadata: { status: 'success', ...result },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron tipificar-documentos falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'tipificar-documentos',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
