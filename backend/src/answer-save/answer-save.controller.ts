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
  currentDeviceLimitMode,
  shouldBlock,
} from '../daily-limit/device-limit-mode';
import {
  isTimeoutError,
  withTimeout,
} from '../common/with-timeout';
import {
  DailyLimitService,
  debeConsumirCupo,
} from '../daily-limit/daily-limit.service';
import { ObservabilityService } from '../observability/observability.service';
import { AnswerSaveService } from './answer-save.service';
import {
  safeParseAnswerSaveRequest,
  type AnswerSaveResponse,
} from './answer-save.types';
import {
  ANSWER_SAVE_BUDGET_MS,
  crearPresupuesto,
  type Presupuesto,
} from './presupuesto';

/**
 * A partir de cuántos ms una respuesta correcta es lo bastante lenta como para
 * dejar rastro con el desglose por fases. Es el hueco de [T-312]: de una
 * petición de 20 s que devuelve 200 no se guardaba NADA de dónde se fue el
 * tiempo, así que «¿por qué tardó?» era incontestable.
 */
const LENTA_MS = 2_000;

/**
 * Controller del endpoint POST /api/v2/answer-and-save.
 *
 * Port literal de app/api/v2/answer-and-save/route.ts del frontend
 * Vercel, adaptado al patrón Nest con guards, decorators y DI.
 *
 * Flow:
 *   1. JwtGuard valida Bearer + inyecta @CurrentUser.
 *   2. Zod valida body → BadRequestException si falla.
 *   3. PARALELO, con el techo de comprobaciones del presupuesto:
 *      registerAndCheckDevice + getDailyLimitStatus + checkDeviceDailyUsage.
 *   4. Bloqueo por device limit / device daily / user daily → 403.
 *   5. validateAndSaveAnswer con LO QUE QUEDE del presupuesto.
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
    private readonly obs: ObservabilityService,
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
    // UN presupuesto para toda la petición: las fases consumen de él en vez de
    // tener cada una su número propio (ver `presupuesto.ts`).
    const presupuesto = crearPresupuesto();

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

    // 2. Comprobaciones en paralelo, con el techo CORTO del presupuesto. Su
    //    fallo sigue cerrando (403/503) igual que antes: lo que cambia es que
    //    no puede quedarse con el tiempo que le toca a guardar.
    let deviceCheck: Awaited<ReturnType<typeof this.antifraud.registerAndCheckDevice>>;
    let dailyLimit: Awaited<ReturnType<typeof this.dailyLimit.getDailyLimitStatus>>;
    let deviceUsage: Awaited<ReturnType<typeof this.dailyLimit.checkDeviceDailyUsage>>;
    const comprobarInicio = Date.now();
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
            this.dailyLimit.checkDeviceDailyUsage(deviceId, hwFingerprint),
          ]),
        presupuesto.comprobacionesMs(),
        'antifraud',
      );
    } catch (err) {
      if (isTimeoutError(err)) {
        this.logTimeout(err.timeoutMs, 'antifraud', startTime);
        this.emitPresupuestoAgotado(
          'comprobaciones',
          err.timeoutMs,
          presupuesto,
          user.userId,
          body.questionId,
        );
        return this.serviceSaturatedResponse(res);
      }
      throw err;
    }
    const comprobarMs = Date.now() - comprobarInicio;

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
      // MODO SOMBRA (T-304): por defecto se MIDE lo que habría pasado, no se corta. El ancla
      // nueva (huella v2) agrupa cuentas que antes no se agrupaban, y antes de dejar a alguien
      // sin servicio hay que ver sobre tráfico real a quién estaríamos bloqueando.
      const modo = currentDeviceLimitMode();
      // Corte DIRIGIDO a los ya confirmados: se aplica aunque el modo global sea `shadow`
      // (decisión de Manuel, 30/07 — son 8 dispositivos revisados uno a uno). Espejo del
      // frontend; `answer-and-save` reparte tráfico entre los dos caminos.
      const confirmado = await this.dailyLimit
        .esFraudeConfirmado(user.userId, deviceId, hwFingerprint)
        .catch(() => false);
      this.logger.warn(
        `[device-limit:${modo}] dispositivo con ${deviceUsage.deviceTotal} preguntas hoy entre sus cuentas` +
          (shouldBlock(modo) ? ' — BLOQUEADO' : ' — solo registrado (sombra)'),
      );
      if (shouldBlock(modo) || confirmado) {
        throw new ForbiddenException({
          success: false,
          error:
            'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.',
          limitReached: true,
          questionsToday: deviceUsage.deviceTotal,
        });
      }
    }

    if (!dailyLimit.allowed) {
      throw new ForbiddenException({
        success: false,
        error: dailyLimit.isGraduated
          ? 'Vence tiene mucha demanda actualmente. Actualiza a Premium para acceso prioritario.'
          : 'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.',
        limitReached: true,
        questionsToday: dailyLimit.questionsToday,
        dailyLimit: dailyLimit.dailyLimit,
        isGraduated: dailyLimit.isGraduated,
      });
    }

    // 4. Validar + guardar con LO QUE QUEDE del presupuesto (nunca por debajo
    //    del suelo: es la fase cuyo fallo le cuesta la respuesta al usuario).
    let result: AnswerSaveResponse;
    const guardarInicio = Date.now();
    try {
      result = await withTimeout(
        () => this.answerSave.validateAndSaveAnswer(body, user.userId),
        presupuesto.guardarMs(),
        'validate-and-save',
      );
    } catch (err) {
      if (isTimeoutError(err)) {
        this.logTimeout(err.timeoutMs, 'validate-and-save', startTime);
        this.emitPresupuestoAgotado(
          'guardar',
          err.timeoutMs,
          presupuesto,
          user.userId,
          body.questionId,
        );
        return this.serviceSaturatedResponse(res);
      }
      throw err;
    }
    const guardarMs = Date.now() - guardarInicio;

    const totalMs = Date.now() - startTime;
    if (totalMs > LENTA_MS) {
      this.logger.warn(
        `Respuesta lenta: ${totalMs}ms questionId=${body.questionId}`,
      );
      // El desglose que faltaba ([T-312]): una respuesta lenta que acaba en 200
      // no dejaba rastro de DÓNDE se fue el tiempo, y el backend no emitía ni
      // un evento propio de este endpoint. Sin esto, la respuesta a «¿por qué
      // tardó?» sigue siendo un `logger.warn` en CloudWatch, no consultable.
      void this.obs.emit({
        source: 'fargate',
        severity: 'warn',
        eventType: 'answer_save_fases',
        endpoint: '/api/v2/answer-and-save',
        userId: user.userId,
        durationMs: totalMs,
        httpStatus: 200,
        metadata: {
          comprobarMs,
          guardarMs,
          presupuestoMs: ANSWER_SAVE_BUDGET_MS,
          fase: guardarMs >= comprobarMs ? 'guardar' : 'comprobaciones',
          questionId: body.questionId,
        },
      });
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

    // 5.bis COBRO DEL CUPO DIARIO — igual que el route de Next: lo hace el
    // SERVIDOR y solo si la fila entró por primera vez en `test_questions`
    // (`saved_new`). Un reintento de la cola devuelve `already_saved` y no
    // vuelve a cobrar; la idempotencia la da el constraint único.
    // Va en background: no debe añadir latencia a la respuesta del usuario y
    // `incrementDailyCount` ya es fail-silent.
    if (debeConsumirCupo(result.saveAction, dailyLimit.isPremium)) {
      this.bg.runAfter(
        () => this.dailyLimit.incrementDailyCount(user.userId),
        'incrementDailyCount',
      );
    }

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

  /**
   * Deja rastro CONSULTABLE de un 503 por presupuesto agotado, diciendo QUÉ
   * fase se lo comió.
   *
   * Hasta hoy el único rastro de esto era `this.logger.warn` → CloudWatch: ni
   * consultable ni alertable, y el backend no emitía NINGÚN evento propio de
   * este endpoint (comprobado: cero filas `source='fargate'` para tráfico
   * orgánico). Todo lo que se sabía venía del wrapper del proxy, que mide el
   * viaje entero y no puede decir dónde se fue el tiempo.
   *
   * Fire-and-forget: `obs.emit` no bloquea y ya traga sus propios errores. La
   * observabilidad no puede añadir latencia al camino que estamos arreglando.
   */
  private emitPresupuestoAgotado(
    fase: 'comprobaciones' | 'guardar',
    limiteMs: number,
    presupuesto: Presupuesto,
    userId: string,
    questionId: string,
  ): void {
    void this.obs.emit({
      source: 'fargate',
      severity: 'error',
      eventType: 'answer_save_presupuesto_agotado',
      endpoint: '/api/v2/answer-and-save',
      userId,
      durationMs: presupuesto.gastadoMs(),
      httpStatus: 503,
      errorMessage: `Presupuesto agotado en ${fase} (límite ${limiteMs} ms)`,
      metadata: {
        fase,
        limiteMs,
        presupuestoMs: ANSWER_SAVE_BUDGET_MS,
        gastadoMs: presupuesto.gastadoMs(),
        questionId,
      },
    });
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
