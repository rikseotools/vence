import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-verifier';
import { JwtGuard } from '../auth/jwt.guard';

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
  'mcasadocano@gmail.com',
];

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es');
}

interface RunNowBody {
  name?: unknown;
}

interface RunNowResponse {
  success: boolean;
  cron: string;
  durationMs: number;
  ranAt: string;
  ranBy: string;
}

/**
 * Endpoint admin para disparar manualmente cualquier @Cron registrado en
 * `SchedulerRegistry` sin esperar a su próximo tick natural.
 *
 * Casos de uso:
 *   - Tras incidente que paralizó un cron y queremos confirmar manualmente
 *     que el path crítico vuelve a funcionar (en vez de esperar al siguiente
 *     tick natural, que puede ser hasta 7 días si es weekly).
 *   - Cuando el siguiente tick natural cae en fin de semana y queremos
 *     resetear el contador de overdue antes de tiempo.
 *   - Smoke manual post-deploy de un cron concreto.
 *
 * Cobertura por contrato — no requiere mantener una lista de servicios
 * dispatchables: usa `cronJob.fireOnTick()` del propio CronJob, que invoca
 * el `onTick` original (handle()) y pasa por TODOS los wrappers (heartbeat,
 * runWithHeartbeat, emit observable cron_run). Equivalente a un tick real.
 *
 * Cualquier cron añadido con `@Cron(expr, { name })` queda automáticamente
 * dispatcheable sin tocar este controller.
 */
@Controller('api/v2/admin/cron')
export class CronRunnerController {
  private readonly logger = new Logger(CronRunnerController.name);

  constructor(private readonly registry: SchedulerRegistry) {}

  @Post('run-now')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async runNow(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RunNowBody,
  ): Promise<RunNowResponse> {
    if (!isAdmin(user.email)) {
      throw new ForbiddenException({
        success: false,
        error: 'Solo admin puede disparar crons manualmente',
      });
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      throw new BadRequestException({
        success: false,
        error: 'Body debe incluir { "name": "<nombre-del-cron>" }',
      });
    }

    const job = (() => {
      try {
        return this.registry.getCronJob(name);
      } catch {
        return null;
      }
    })();
    if (!job) {
      throw new NotFoundException({
        success: false,
        error: `Cron '${name}' no está registrado en SchedulerRegistry`,
      });
    }

    this.logger.log(`Cron '${name}' disparado on-demand por ${user.email}`);
    const startedAt = Date.now();
    await job.fireOnTick();
    const durationMs = Date.now() - startedAt;

    return {
      success: true,
      cron: name,
      durationMs,
      ranAt: new Date().toISOString(),
      ranBy: user.email ?? user.userId,
    };
  }
}
