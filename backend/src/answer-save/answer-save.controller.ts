import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AntifraudService } from '../antifraud/antifraud.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-verifier';
import { JwtGuard } from '../auth/jwt.guard';
import { BackgroundService } from '../background/background.service';
import { CacheService } from '../cache/cache.service';
import {
  isTimeoutError,
  withTimeout,
} from '../common/with-timeout';
import { DailyLimitService } from '../daily-limit/daily-limit.service';
import { AnswerSaveService } from './answer-save.service';
import {
  safeParseAnswerSaveRequest,
  type AnswerSaveResponse,
} from './answer-save.types';

/** Quick-fail: anti-fraud (3 RPCs paralelas) normalmente <500ms. */
const ANTIFRAUD_TIMEOUT_MS = 10_000;
/** Quick-fail: validate+save (cache miss + insert + 8 triggers) normal <500ms. */
const VALIDATE_AND_SAVE_TIMEOUT_MS = 15_000;

/**
 * Controller del endpoint POST /api/v2/answer-and-save.
 *
 * Port literal de app/api/v2/answer-and-save/route.ts del frontend
 * Vercel, adaptado al patrón Nest con guards, decorators y DI.
 *
 * Flow:
 *   1. JwtGuard valida Bearer + inyecta @CurrentUser.
 *   2. Zod valida body → BadRequestException si falla.
 *   3. PARALELO con quick-fail 10s: registerAndCheckDevice +
 *      getDailyLimitStatus + checkDeviceDailyUsage.
 *   4. Bloqueo por device limit / device daily / user daily → 403.
 *   5. validateAndSaveAnswer con quick-fail 15s.
 *   6. BACKGROUND (no bloquea response):
 *      - markActiveStudentIfFirst
 *      - invalidar caches Upstash (user_stats / exam_pending / theme_stats)
 *   7. Mapeo status: success → 200, correctOption null → 404, timeout → 503.
 */
@Controller('api/v2/answer-and-save')
export class AnswerSaveController {
  private readonly logger = new Logger(AnswerSaveController.name);

  constructor(
    private readonly answerSave: AnswerSaveService,
    private readonly antifraud: AntifraudService,
    private readonly dailyLimit: DailyLimitService,
    private readonly cache: CacheService,
    private readonly bg: BackgroundService,
  ) {}

  @Post()
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async post(
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AnswerSaveResponse | { success: false; error: string }> {
    const startTime = Date.now();

    // 1. Validar body con Zod
    const parsed = safeParseAnswerSaveRequest(rawBody);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new BadRequestException(
        `Validación: ${first?.path.join('.')} - ${first?.message}`,
      );
    }
    const body = parsed.data;

    const deviceId = AntifraudService.extractDeviceId(headers);
    const hwFingerprint = AntifraudService.extractHwFingerprint(headers);
    const userAgent = (() => {
      const ua = headers['user-agent'];
      if (typeof ua === 'string') return ua;
      if (Array.isArray(ua) && typeof ua[0] === 'string') return ua[0];
      return null;
    })();

    // 2. Anti-fraud paralelo con quick-fail 10s
    let deviceCheck: Awaited<ReturnType<typeof this.antifraud.registerAndCheckDevice>>;
    let dailyLimit: Awaited<ReturnType<typeof this.dailyLimit.getDailyLimitStatus>>;
    let deviceUsage: Awaited<ReturnType<typeof this.dailyLimit.checkDeviceDailyUsage>>;
    try {
      [deviceCheck, dailyLimit, deviceUsage] = await withTimeout(
        () =>
          Promise.all([
            this.antifraud.registerAndCheckDevice(
              user.userId,
              deviceId,
              userAgent,
              hwFingerprint,
            ),
            this.dailyLimit.getDailyLimitStatus(user.userId),
            this.dailyLimit.checkDeviceDailyUsage(deviceId),
          ]),
        ANTIFRAUD_TIMEOUT_MS,
        'antifraud',
      );
    } catch (err) {
      if (isTimeoutError(err)) {
        this.logTimeout(err.timeoutMs, 'antifraud', startTime);
        return this.serviceSaturatedResponse(res);
      }
      throw err;
    }

    // 3. Bloqueos por anti-fraud → 403
    if (!deviceCheck.allowed) {
      throw new ForbiddenException({
        success: false,
        error: `Ya tienes ${deviceCheck.deviceCount} dispositivos conectados (${deviceCheck.existingDevices || 'desconocidos'}). Para usar este, desconecta uno de ellos.`,
        deviceLimitReached: true,
        deviceCount: deviceCheck.deviceCount,
        maxDevices: deviceCheck.maxDevices,
        existingDevices: deviceCheck.existingDevices,
        userId: user.userId,
      });
    }

    if (!dailyLimit.isPremium && deviceUsage && !deviceUsage.allowed) {
      throw new ForbiddenException({
        success: false,
        error:
          'Este dispositivo ha alcanzado el límite diario de preguntas. Vuelve mañana o hazte premium.',
        limitReached: true,
        questionsToday: deviceUsage.deviceTotal,
      });
    }

    if (!dailyLimit.allowed) {
      throw new ForbiddenException({
        success: false,
        error: dailyLimit.isGraduated
          ? 'Vence tiene mucha demanda actualmente. Actualiza a Premium para acceso prioritario.'
          : 'Has alcanzado el límite diario de preguntas. Vuelve mañana o hazte premium.',
        limitReached: true,
        questionsToday: dailyLimit.questionsToday,
        dailyLimit: dailyLimit.dailyLimit,
        isGraduated: dailyLimit.isGraduated,
      });
    }

    // 4. Validar + guardar con quick-fail 15s
    let result: AnswerSaveResponse;
    try {
      result = await withTimeout(
        () => this.answerSave.validateAndSaveAnswer(body, user.userId),
        VALIDATE_AND_SAVE_TIMEOUT_MS,
        'validate-and-save',
      );
    } catch (err) {
      if (isTimeoutError(err)) {
        this.logTimeout(err.timeoutMs, 'validate-and-save', startTime);
        return this.serviceSaturatedResponse(res);
      }
      throw err;
    }

    const totalMs = Date.now() - startTime;
    if (totalMs > 2000) {
      this.logger.warn(
        `Respuesta lenta: ${totalMs}ms questionId=${body.questionId}`,
      );
    }

    // 5. BACKGROUND — no bloquea response. Equivalente al after() de Next.js.
    this.bg.runAfter(
      () => this.answerSave.markActiveStudentIfFirst(user.userId),
      'markActiveStudentIfFirst',
    );
    this.bg.runAfter(
      () =>
        this.cache.invalidateMany([
          `user_stats:${user.userId}`,
          `exam_pending:${user.userId}:all:10`,
          `exam_pending:${user.userId}:exam:10`,
          `exam_pending:${user.userId}:practice:10`,
          `theme_stats:${user.userId}`,
        ]),
      'invalidate-user-caches',
    );

    // 6. Headers de identificación (mismo patrón que medals)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('x-served-by', 'vence-backend');

    if (!result.success) {
      // save_failed con correctOption=null → 404 (pregunta no encontrada).
      // save_failed con correctOption válido → 500 (insert falló).
      const status =
        result.saveAction === 'save_failed' && result.correctAnswer === 0
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;
      res.status(status);
    }

    return result;
  }

  private logTimeout(timeoutMs: number, label: string, startTime: number): void {
    const totalMs = Date.now() - startTime;
    this.logger.warn(
      `Timeout (quick-fail) en ${label} tras ${totalMs}ms (límite ${timeoutMs}ms)`,
    );
  }

  /**
   * Devuelve 503 con Retry-After: 300 al cliente. Body con
   * `retryable: true` para que el frontend sepa que debe reintentar.
   *
   * NO usamos `ServiceUnavailableException` porque NestJS no permite
   * setear Retry-After via excepción. Con res.passthrough podemos
   * setear el header y status correctamente antes de devolver el body.
   */
  private serviceSaturatedResponse(res: Response): {
    success: false;
    error: string;
  } {
    res.status(HttpStatus.SERVICE_UNAVAILABLE);
    res.setHeader('Retry-After', '300');
    res.setHeader('x-served-by', 'vence-backend');
    return {
      success: false,
      error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.',
    };
  }
}
