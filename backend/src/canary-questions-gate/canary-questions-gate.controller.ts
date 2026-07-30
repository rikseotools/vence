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
import { CanaryQuestionsGateService } from './canary-questions-gate.service';

/**
 * Disparo POST-DEPLOY del canary del gate anti-scraping.
 *
 * Protegido por CRON_SECRET (Bearer) en vez de admin-JWT, para que lo invoque
 * el workflow frontend-deploy tras el rollout (no tiene sesión admin). Emite el
 * resultado a observable_events: si falla, `canary_questions_gate_failed`
 * (critical) dispara RULE_CANARY_QUESTIONS_GATE_FAILED → email [Vence CRITICAL].
 *
 * Devuelve 200 si OK/skipped, 503 si falla (para que el step del workflow lo
 * refleje, aunque va con continue-on-error: el deploy ya está hecho).
 */
@Controller('api/v2/canary')
export class CanaryQuestionsGateController {
  private readonly logger = new Logger(CanaryQuestionsGateController.name);

  constructor(
    private readonly service: CanaryQuestionsGateService,
    private readonly observability: ObservabilityService,
  ) {}

  @Post('run-questions-gate')
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
      this.logger.warn(`canary gate skipped: ${result.reason}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'canary_questions_gate_skipped',
        endpoint: 'canary-questions-gate',
        durationMs: result.durationMs,
        metadata: { reason: result.reason },
      });
      return result;
    }

    if (result.ok) {
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'canary_questions_gate_ok',
        endpoint: 'canary-questions-gate',
        durationMs: result.durationMs,
        // `gateAssertion` va en el evento, no solo en la respuesta HTTP (30/07). El resultado lo
        // lee el workflow que dispara el canary y se pierde; lo que queda para siempre es esta
        // fila. Sin el veredicto, un `canary_questions_gate_ok` en `observable_events` NO distingue
        // «comprobé que al usuario normal no se le reta» de «no pude comprobarlo», que es el mismo
        // defecto que T-280 vino a arreglar una capa más abajo: un verde que no dice qué midió.
        // `gateServidas`/`gateUmbral` acompañan porque son los que explican POR QUÉ se omitió.
        metadata: {
          questionsServed: result.questionsServed,
          gateAssertion: result.gateAssertion,
          gateServidas: result.gateServidas,
          gateUmbral: result.gateUmbral,
        },
      });
      return result;
    }

    // Fallo → critical + 503.
    this.logger.error(`canary gate FAILED [${result.step}]: ${result.errorMessage}`);
    this.observability.emitFireAndForget({
      source: 'fargate',
      severity: 'critical',
      eventType: 'canary_questions_gate_failed',
      endpoint: 'canary-questions-gate',
      durationMs: result.durationMs,
      httpStatus: result.httpStatus,
      errorMessage: result.errorMessage,
      metadata: { step: result.step },
    });
    res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
