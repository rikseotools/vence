import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import * as Sentry from '@sentry/nestjs';
import { ObservabilityService } from './observability.service';

/**
 * ExceptionFilter global — captura TODA excepción no manejada y, si
 * resulta en HTTP ≥500, emite un evento `http_5xx` a `observable_events`.
 *
 * Errores 4xx (BadRequest, Unauthorized, Forbidden, NotFound, etc.) NO
 * se emiten — son comportamiento esperado del cliente. Solo nos interesa
 * lo que indica fallo del servidor.
 *
 * Tras emitir (fire-and-forget), delega al manejo HTTP estándar de Nest
 * para que la respuesta al cliente sea idéntica a antes (no rompe nada).
 *
 * Registrado como APP_FILTER global en AppModule (`useClass:
 * AllExceptionsFilter`) — captura cualquier endpoint del backend sin
 * que cada controller tenga que importarlo.
 *
 * Bloque 4 Gap 3 del manual de observabilidad.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly observability: ObservabilityService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse();

    // Resolver HTTP status:
    //   - HttpException → usa su status
    //   - Cualquier otro Error → 500
    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Resolver mensaje legible
    const errorMessage =
      exception instanceof Error
        ? exception.message
        : typeof exception === 'string'
          ? exception
          : 'Unknown error';

    // Emitir SOLO si es 5xx (errores del servidor). 4xx son
    // comportamiento esperado del cliente y no nos aportan señal.
    if (httpStatus >= 500) {
      // 1. Emit a observable_events (queryable SQL)
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: httpStatus >= 503 ? 'critical' : 'error',
        eventType: 'http_5xx',
        endpoint: request?.url ?? null,
        httpStatus,
        errorMessage: errorMessage.slice(0, 2000),
        metadata: {
          method: request?.method ?? null,
          userAgent: request?.headers?.['user-agent']?.toString().slice(0, 200) ?? null,
          stack:
            exception instanceof Error && exception.stack
              ? exception.stack.slice(0, 2000)
              : null,
        },
      });

      // 2. Capturar en Sentry para Issue Alerts, Session Replay
      //    correlation, grouping y dashboard.
      try {
        Sentry.withScope((scope) => {
          scope.setTag('endpoint', request?.url ?? 'unknown');
          scope.setTag('http_status', String(httpStatus));
          scope.setTag('method', request?.method ?? 'unknown');
          if (request?.headers?.['x-forwarded-by']) {
            scope.setTag(
              'x-forwarded-by',
              String(request.headers['x-forwarded-by']),
            );
          }
          Sentry.captureException(
            exception instanceof Error ? exception : new Error(errorMessage),
          );
        });
      } catch {
        // Sentry NUNCA debe romper el flujo de respuesta
      }

      // También log a stdout — los logs CloudWatch siguen siendo el
      // "audit trail" canónico para forensic deep dive (más rico que
      // observable_events, que es señal agregada).
      this.logger.error(
        `[${httpStatus}] ${request?.method ?? '?'} ${request?.url ?? '?'} — ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Delegar al manejo estándar — la respuesta al cliente NO cambia.
    // (Para HttpException Nest haría esto solo, pero como capturamos
    // TODO, lo hacemos explícito para errores no-HttpException.)
    if (exception instanceof HttpException) {
      httpAdapter.reply(response, exception.getResponse(), httpStatus);
    } else {
      httpAdapter.reply(
        response,
        {
          statusCode: httpStatus,
          message: 'Internal server error',
        },
        httpStatus,
      );
    }
  }
}
