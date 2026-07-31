import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryIdentidadPagoService } from './canary-identidad-pago.service';

/**
 * Disparo POST-DEPLOY del canary de la política de identidad en los endpoints de pago.
 *
 * Calcado del canary del gate anti-scraping: protegido por CRON_SECRET (Bearer) porque lo
 * invoca el workflow `frontend-deploy`, que no tiene sesión admin. 200 si OK/skipped, 503 si
 * falla.
 *
 * **El `endpoint: 'canary-identidad-pago'` no es decorativo.** El panel `/admin/salud-sistema`
 * agrega el uptime de canaries con `WHERE endpoint LIKE 'canary-%'`: con ese prefijo, este
 * canary entra en el indicador de salud sin tocar el panel. Sin él sería una isla que solo
 * mira su ombligo.
 */
@Controller('api/v2/canary')
export class CanaryIdentidadPagoController {
  private readonly logger = new Logger(CanaryIdentidadPagoController.name);

  constructor(
    private readonly service: CanaryIdentidadPagoService,
    private readonly observability: ObservabilityService,
  ) {}

  @Post('run-identidad-pago')
  @HttpCode(HttpStatus.OK)
  async run(
    @Headers('authorization') authHeader: string | undefined,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<unknown> {
    const expected = process.env.CRON_SECRET;
    if (!expected || authHeader !== `Bearer ${expected}`) {
      throw new ForbiddenException('CRON_SECRET inválido');
    }

    const result = await this.service.run();

    if ('skipped' in result) {
      this.logger.warn(`canary identidad-pago skipped: ${result.reason}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'canary_identidad_pago_skipped',
        endpoint: 'canary-identidad-pago',
        durationMs: result.durationMs,
        metadata: { reason: result.reason },
      });
      return result;
    }

    if (result.ok) {
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'canary_identidad_pago_ok',
        endpoint: 'canary-identidad-pago',
        durationMs: result.durationMs,
        // `cancelAssertion` va en el EVENTO y no solo en la respuesta HTTP: la respuesta se la
        // queda el workflow y se pierde; esta fila es lo que queda. Sin ella, un verde no
        // distingue «comprobé que cancelar sigue cortando» de «no lo comprobé para no arriesgar
        // una cancelación» — que es la misma lección de T-280 con el gate.
        metadata: {
          estadoCheckout: result.estadoCheckout,
          cancelAssertion: result.cancelAssertion,
        },
      });
      return result;
    }

    this.logger.error(`canary identidad-pago FAILED [${result.step}]: ${result.errorMessage}`);
    this.observability.emitFireAndForget({
      source: 'fargate',
      severity: 'critical',
      eventType: 'canary_identidad_pago_failed',
      endpoint: 'canary-identidad-pago',
      durationMs: result.durationMs,
      httpStatus: result.httpStatus,
      errorMessage: result.errorMessage,
      metadata: { step: result.step },
    });
    res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
