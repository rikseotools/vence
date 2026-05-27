import {
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-verifier';
import { CanaryAnswerSaveService } from '../canary-answer-save/canary-answer-save.service';
import { CanaryDatabasePoolService } from '../canary-database-pool/canary-database-pool.service';
import { CanaryRedisUpstashService } from '../canary-redis-upstash/canary-redis-upstash.service';
import { CanarySmokeAuthService } from '../canary-smoke-auth/canary-smoke-auth.service';
import { CanaryStripeWebhookService } from '../canary-stripe-webhook/canary-stripe-webhook.service';
import { ExternalHeartbeatService } from '../external-heartbeat/external-heartbeat.service';

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
];

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es');
}

/**
 * Endpoint admin para disparar TODOS los canarios on-demand.
 *
 * Casos de uso:
 *   - Pre-deploy: "verifica que TODO está sano antes de mergear".
 *   - Post-incidente: "¿ya está sano tras mi fix? confirma sin esperar 5min".
 *   - Smoke manual: tras cambiar SSM/Terraform sin redeploy completo.
 *
 * Devuelve resultados sincrónicos de los 5 canarios paralelizados.
 * NO emite a observable_events para distinguir runs manuales vs scheduled
 * (que sí emiten). Si esto cambia, marcar `manual: true` en metadata.
 */
@Controller('api/v2/canary')
export class CanaryRunnerController {
  private readonly logger = new Logger(CanaryRunnerController.name);

  constructor(
    private readonly smokeAuth: CanarySmokeAuthService,
    private readonly stripeWebhook: CanaryStripeWebhookService,
    private readonly answerSave: CanaryAnswerSaveService,
    private readonly dbPool: CanaryDatabasePoolService,
    private readonly redis: CanaryRedisUpstashService,
    private readonly heartbeat: ExternalHeartbeatService,
  ) {}

  @Post('run-now')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async runAll(@CurrentUser() user: AuthenticatedUser): Promise<RunAllResponse> {
    if (!isAdmin(user.email)) {
      throw new ForbiddenException({
        success: false,
        error: 'Solo admin puede disparar canarios manualmente',
      });
    }

    this.logger.log(`Canary run-now disparado por ${user.email}`);
    const startedAt = Date.now();

    // 6 canarios en paralelo. Promise.allSettled para que un fallo de un
    // canary NO impida ver los resultados de los otros.
    const [smokeAuth, stripeWebhook, answerSave, dbPool, redis, heartbeat] =
      await Promise.allSettled([
        this.smokeAuth.run(),
        this.stripeWebhook.run(),
        this.answerSave.run(),
        this.dbPool.run(),
        this.redis.run(),
        this.heartbeat.run(),
      ]);

    const summarize = (
      name: string,
      r: PromiseSettledResult<unknown>,
    ): CanarySummaryResult => {
      if (r.status === 'rejected') {
        return {
          name,
          status: 'exception',
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        };
      }
      const value = r.value as Record<string, unknown>;
      if ('skipped' in value && value.skipped) {
        return { name, status: 'skipped', reason: String(value.reason ?? '?') };
      }
      if ('ok' in value && value.ok) {
        return {
          name,
          status: 'ok',
          durationMs: typeof value.durationMs === 'number' ? value.durationMs : null,
        };
      }
      if ('questionInvalid' in value && value.questionInvalid) {
        return {
          name,
          status: 'question_invalid',
          error: String(value.errorMessage ?? '?'),
        };
      }
      return {
        name,
        status: 'failed',
        step: typeof value.step === 'string' ? value.step : 'unknown',
        error: String(value.errorMessage ?? '?'),
        httpStatus: typeof value.httpStatus === 'number' ? value.httpStatus : null,
      };
    };

    const results = [
      summarize('canary-smoke-auth', smokeAuth),
      summarize('canary-stripe-webhook', stripeWebhook),
      summarize('canary-answer-save', answerSave),
      summarize('canary-database-pool', dbPool),
      summarize('canary-redis-upstash', redis),
      summarize('external-heartbeat', heartbeat),
    ];

    const failed = results.filter((r) => r.status === 'failed' || r.status === 'exception');
    const ok = results.filter((r) => r.status === 'ok');

    return {
      success: failed.length === 0,
      totalMs: Date.now() - startedAt,
      ranAt: new Date().toISOString(),
      ranBy: user.email ?? user.userId,
      summary: {
        total: results.length,
        ok: ok.length,
        failed: failed.length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        other: results.length - ok.length - failed.length - results.filter((r) => r.status === 'skipped').length,
      },
      results,
    };
  }
}

type CanarySummaryResult =
  | { name: string; status: 'ok'; durationMs: number | null }
  | { name: string; status: 'skipped'; reason: string }
  | { name: string; status: 'question_invalid'; error: string }
  | {
      name: string;
      status: 'failed';
      step: string;
      error: string;
      httpStatus: number | null;
    }
  | { name: string; status: 'exception'; error: string };

interface RunAllResponse {
  success: boolean;
  totalMs: number;
  ranAt: string;
  ranBy: string;
  summary: {
    total: number;
    ok: number;
    failed: number;
    skipped: number;
    other: number;
  };
  results: CanarySummaryResult[];
}
