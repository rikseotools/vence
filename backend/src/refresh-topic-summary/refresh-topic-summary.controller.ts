import {
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-verifier';
import { JwtGuard } from '../auth/jwt.guard';
import { RefreshTopicSummaryService } from './refresh-topic-summary.service';

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

/**
 * Endpoint admin para refrescar las MVs de Fase D-bis Iter 1.5 on-demand.
 *
 * Casos de uso:
 *   - Tras aprobar/retirar preguntas desde el admin: invalidar el snapshot
 *     que sirve `/api/topics/[numero]` sin esperar al cron nocturno.
 *   - Tras importación masiva de exámenes oficiales: forzar consistencia.
 *
 * REFRESH CONCURRENTLY no bloquea SELECT, así que es seguro disparar
 * incluso en horas pico — el endpoint sigue sirviendo el snapshot viejo
 * hasta que el refresh termina (~4-10s) y hace swap atómico.
 */
@Controller('api/v2/admin/topic-summary')
export class RefreshTopicSummaryController {
  private readonly logger = new Logger(RefreshTopicSummaryController.name);

  constructor(private readonly service: RefreshTopicSummaryService) {}

  @Post('refresh')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(@CurrentUser() user: AuthenticatedUser) {
    if (!isAdmin(user.email)) {
      throw new ForbiddenException({
        success: false,
        error: 'Solo admin puede refrescar las MVs de topic_summary',
      });
    }
    this.logger.log(`Refresh on-demand topic_summary disparado por ${user.email}`);
    const stats = await this.service.run();
    return {
      success: true,
      ...stats,
      ranBy: user.email ?? user.userId,
    };
  }
}
