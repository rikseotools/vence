import { Injectable, Logger } from '@nestjs/common';

/**
 * External heartbeat — el "watcher del watcher".
 *
 * Hace ping cada 5min a un servicio externo (Healthchecks.io / BetterUptime
 * / dead-mans-snitch). Si el servicio externo NO recibe ping en su ventana
 * configurada (típicamente 10min con grace 5min), dispara alarma por email
 * o SMS al admin.
 *
 * Es la ÚNICA línea de defensa para el caso "Fargate cae completo":
 *   - canary-smoke-auth NO emite porque el cron está muerto.
 *   - canary-db-pool NO emite porque el cron está muerto.
 *   - RULE_CRON_OVERDUE no puede dispararse porque vive en el mismo backend.
 *   - alertas-engine no corre porque vive en el mismo backend.
 *   - observable_events queda silencioso.
 *
 * Sin heartbeat externo, este apagón sería invisible. Con heartbeat
 * externo, en ≤15min un servicio independiente notifica al admin.
 *
 * Modo idle si `HEARTBEAT_URL` no está configurada — no spam.
 *
 * Setup humano (5 min):
 *   1. Crear cuenta gratis en https://healthchecks.io.
 *   2. Crear check "vence-backend-heartbeat" con period=10min + grace=5min.
 *   3. Copiar URL UUID (https://hc-ping.com/<uuid>).
 *   4. aws ssm put-parameter --profile vence --region eu-west-2 \
 *        --name /vence-backend/HEARTBEAT_URL --value '<url>' --type String
 *   5. Añadir HEARTBEAT_URL al backend/infra/main.tf (environment, no secret).
 *   6. terraform apply -target=aws_ecs_task_definition.backend.
 *   7. aws ecs update-service --force-new-deployment.
 *
 * Healthchecks.io alertará al admin si NO recibe ping en >15min (10min
 * period + 5min grace) → señal inequívoca de que el backend está caído.
 */
@Injectable()
export class ExternalHeartbeatService {
  private readonly logger = new Logger(ExternalHeartbeatService.name);
  private readonly TIMEOUT_MS = 5_000;

  async run(): Promise<HeartbeatResult> {
    const startedAt = Date.now();
    const url = process.env.HEARTBEAT_URL;

    if (!url) {
      this.logger.warn(
        'HEARTBEAT_URL no configurada — heartbeat inactivo. Crear check en healthchecks.io y configurar SSM.',
      );
      return {
        skipped: true,
        reason: 'url_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

    // Validación mínima: debe ser URL HTTPS. Defense contra typos.
    if (!/^https?:\/\//.test(url)) {
      return {
        ok: false,
        errorMessage: `HEARTBEAT_URL no parece URL válida: ${url.slice(0, 50)}`,
        durationMs: Date.now() - startedAt,
      };
    }

    try {
      // Healthchecks.io acepta GET o POST. Usamos POST con body vacío
      // por convención (permite enviar metadata en el futuro sin cambio).
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'Vence-Backend-Heartbeat/1.0',
        },
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      // Healthchecks.io devuelve 200 con body "OK" o similar.
      // Otros servicios (BetterUptime) devuelven 200/204. Aceptamos 2xx.
      if (!res.ok) {
        return {
          ok: false,
          httpStatus: res.status,
          errorMessage: `Heartbeat HTTP ${res.status}`,
          durationMs: Date.now() - startedAt,
        };
      }

      return { ok: true, httpStatus: res.status, durationMs: Date.now() - startedAt };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        errorMessage: `Heartbeat excepción: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

export type HeartbeatResult =
  | { ok: true; httpStatus: number; durationMs: number }
  | { skipped: true; reason: string; durationMs: number }
  | {
      ok: false;
      httpStatus?: number;
      errorMessage: string;
      durationMs: number;
    };
