import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Resultado de un disparo del drain de conversiones. Espeja el `DrainSummary`
 * del worker (lib/conversions/worker.ts) que devuelve el endpoint, más el estado
 * HTTP del disparo.
 */
export interface DrainTriggerResult {
  ok: boolean;
  httpStatus: number | null;
  scanned?: number;
  delivered?: number;
  validated?: number;
  retried?: number;
  dlq?: number;
  skipped?: number;
  errorMessage?: string;
  /** Motivo de skip cuando el disparo no se intenta (config ausente). */
  skippedReason?: string;
}

/**
 * Dispara el drain del outbox de conversiones invocando el endpoint
 * `/api/cron/conversion-outbox` del frontend, de forma FIABLE desde el worker
 * Fargate caliente (cada 2 min vía ConversionDrainCron) en lugar del cron de
 * GitHub Actions, que disparaba de hecho cada ~2,6h (mediana, hasta 6h).
 *
 * Por qué HTTP-drive y no in-process: el backend es un proyecto TS aislado (sin
 * `google-ads-api`, sin la tabla en su schema, sin path-alias a `lib/`), y un
 * port in-process exigiría secretos SSM + Terraform nuevos. La causa raíz
 * DOMINANTE (medida en el spike 23/06) es la CADENCIA, no el runtime; este
 * disparador fiable la corrige sin tocar infra. El endpoint es idempotente
 * (order_id en Google) → invocarlo de más nunca duplica.
 */
@Injectable()
export class ConversionDrainService {
  private readonly logger = new Logger(ConversionDrainService.name);
  /** Por debajo del maxDuration=60s del endpoint, para no cortar a media subida. */
  private readonly TIMEOUT_MS = 55_000;

  constructor(private readonly config: ConfigService) {}

  async run(): Promise<DrainTriggerResult> {
    const baseUrl =
      this.config.get<string>('APP_BASE_URL') ?? 'https://www.vence.es';
    const secret = this.config.get<string>('CRON_SECRET') ?? '';

    if (!secret) {
      // Sin secret no podemos autenticar el cron. No es un fallo reintentable:
      // es config ausente. Lo señalamos para que la cadena de alertas lo vea.
      this.logger.warn(
        'CRON_SECRET no configurado — drain de conversiones inactivo.',
      );
      return { ok: false, httpStatus: null, skippedReason: 'cron_secret_missing' };
    }

    const url = `${baseUrl}/api/cron/conversion-outbox`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${secret}`,
          'User-Agent': 'Vence-Backend-ConversionDrain/1.0',
        },
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });
    } catch (e) {
      // Red/timeout: reintentable. El endpoint es idempotente, así que el
      // siguiente tick (2 min) reintenta sin riesgo de duplicar.
      const errorMessage = e instanceof Error ? e.message : String(e);
      return { ok: false, httpStatus: null, errorMessage };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, httpStatus: res.status, errorMessage: body.slice(0, 300) };
    }

    const summary = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: true,
      httpStatus: res.status,
      scanned: Number(summary.scanned ?? 0),
      delivered: Number(summary.delivered ?? 0),
      validated: Number(summary.validated ?? 0),
      retried: Number(summary.retried ?? 0),
      dlq: Number(summary.dlq ?? 0),
      skipped: Number(summary.skipped ?? 0),
    };
  }
}
