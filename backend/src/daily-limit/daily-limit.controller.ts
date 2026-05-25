import {
  Controller,
  Get,
  Logger,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-verifier';
import { JwtGuard } from '../auth/jwt.guard';
import { CacheService } from '../cache/cache.service';
import { isTimeoutError, withTimeout } from '../common/with-timeout';
import { DailyLimitService } from './daily-limit.service';

/**
 * Espejo de `GET /api/daily-limit` de Vercel — devuelve estado del
 * límite diario de preguntas del usuario autenticado.
 *
 * Patrón stale-while-error con Upstash compartido (misma clave
 * `daily_limit:${userId}` que el frontend) — cross-runtime coherente.
 *
 * Llamado en CADA page load del usuario logueado → fresh window 30s.
 * Stale TTL 24h para sobrevivir blips largos del pooler. Timeout BD
 * 5s — quick-fail libera la lambda/task y sirve stale en lugar de 503.
 */
interface DailyLimitResponse {
  questionsToday: number;
  questionsRemaining: number;
  dailyLimit: number;
  isLimitReached: boolean;
  isPremium: boolean;
  isGraduated: boolean;
  tierLabel: string | null;
}

interface CachedDailyLimit {
  data: DailyLimitResponse;
  ts: number;
}

const FRESH_WINDOW_MS = 30_000;
const STALE_TTL_S = 24 * 60 * 60;
const DAILY_LIMIT_TIMEOUT_MS = 5_000;

@Controller('api/daily-limit')
export class DailyLimitController {
  private readonly logger = new Logger(DailyLimitController.name);

  constructor(
    private readonly dailyLimit: DailyLimitService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @UseGuards(JwtGuard)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DailyLimitResponse | { error: string; retryable?: boolean }> {
    const cacheKey = `daily_limit:${user.userId}`;
    const cached = await this.cache.getCached<CachedDailyLimit>(cacheKey);

    // Fast path: cache fresco (<30s) → sin tocar BD
    if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('x-daily-limit-cache', 'hit');
      res.setHeader('x-served-by', 'vence-backend');
      return cached.data;
    }

    // Cache miss/stale → consultar BD con quick-fail
    try {
      const status = await withTimeout(
        () => this.dailyLimit.getDailyLimitStatus(user.userId),
        DAILY_LIMIT_TIMEOUT_MS,
        'daily-limit',
      );

      const response: DailyLimitResponse = {
        questionsToday: status.questionsToday,
        questionsRemaining: status.questionsRemaining,
        dailyLimit: status.dailyLimit,
        isLimitReached: !status.allowed,
        isPremium: status.isPremium,
        isGraduated: status.isGraduated,
        tierLabel: status.tierLabel,
      };

      // Fire-and-forget: refresca cache con timestamp nuevo
      this.cache.setCached(
        cacheKey,
        { data: response, ts: Date.now() },
        STALE_TTL_S,
      );

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('x-daily-limit-cache', cached ? 'refresh' : 'miss');
      res.setHeader('x-served-by', 'vence-backend');
      return response;
    } catch (err) {
      // BD timeout + tenemos stale → devolver stale (200) en lugar de 503
      if (isTimeoutError(err) && cached) {
        this.logger.warn(
          `BD timeout — sirviendo stale (${Math.round(
            (Date.now() - cached.ts) / 1000,
          )}s old) user=${user.userId}`,
        );
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('x-daily-limit-cache', 'stale');
        res.setHeader('x-served-by', 'vence-backend');
        return cached.data;
      }

      // Sin stale → 503 retryable
      if (isTimeoutError(err)) {
        this.logger.warn(
          `Timeout sin cache stale para user=${user.userId}: ${err.message}`,
        );
        res.status(503);
        res.setHeader('Retry-After', '300');
        res.setHeader('x-served-by', 'vence-backend');
        return {
          error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.',
          retryable: true,
        };
      }

      this.logger.error(`Error inesperado para user=${user.userId}`, err);
      res.status(500);
      res.setHeader('x-served-by', 'vence-backend');
      return { error: 'Error interno' };
    }
  }
}
