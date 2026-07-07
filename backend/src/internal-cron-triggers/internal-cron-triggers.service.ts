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
    // Reintento único ante 5xx: algunos endpoints son lentos (~16s, p.ej.
    // check-stats-drift) y ocasionalmente cortan por timeout del gateway → 5xx
    // transitorio. Un segundo intento evita falsas alarmas. Es un cron nocturno,
    // no hay usuario esperando; el coste de reintentar es irrelevante.
    let last: { ok: boolean; status: number; body: string } = {
      ok: false,
      status: 0,
      body: '',
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.cronSecret}` },
        });
        const body = await res.text();
        last = { ok: res.ok, status: res.status, body: body.slice(0, 500) };
      } catch (err) {
        last = {
          ok: false,
          status: 0,
          body: err instanceof Error ? err.message : String(err),
        };
      }
      // 2xx → done. 4xx (auth/config) → no reintentar (no es transitorio).
      if (last.ok || (last.status >= 400 && last.status < 500)) break;
      if (attempt === 1) this.logger.warn(`${path} → ${last.status}, reintentando…`);
    }
    return last;
  }
}
