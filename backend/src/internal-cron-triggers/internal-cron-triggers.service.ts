import { Injectable, Logger } from '@nestjs/common';

/**
 * Dispara endpoints de cron del frontend (Next `/api/cron/*`) vía HTTP con
 * Bearer CRON_SECRET — exactamente como lo hacían los workflows de GitHub
 * Actions, pero desde Fargate (AWS-native, sin dependencia de GitHub).
 *
 * NO reimplementa la lógica: el trabajo lo sigue haciendo el mismo endpoint
 * (idéntico comportamiento, cero riesgo de parity). Solo se mueve el "quién
 * aprieta el botón" de GitHub a un @Cron del backend.
 */
@Injectable()
export class InternalCronTriggersService {
  private readonly logger = new Logger(InternalCronTriggersService.name);
  private readonly baseUrl = process.env.APP_BASE_URL ?? 'https://www.vence.es';
  private readonly cronSecret = process.env.CRON_SECRET ?? '';

  async trigger(
    path: string,
  ): Promise<{ ok: boolean; status: number; body: string }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.cronSecret}` },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
  }
}
