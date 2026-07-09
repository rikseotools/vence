import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Canary AI-MODEL — detecta que el modelo del chat sigue VIVO en el proveedor.
 * El bug del 09/07 (chat premium roto 2 días, 7 users) fue que Anthropic retiró el
 * modelo configurado (claude-sonnet-4-20250514 → 404) y NADIE se enteró hasta el
 * feedback de una usuaria. Este canary lee el `default_model` de `ai_api_config`
 * (la misma fuente que usa el chat) y hace un ping mínimo al proveedor: si el modelo
 * ya no existe (4xx/404), falla → alerta en minutos, no en días.
 *
 * Escalable: recorre TODOS los proveedores activos con default_model (hoy anthropic;
 * openai/otros se cubren igual). Fix operativo cuando salta: UPDATE del default_model
 * en BD (el chat lo lee sin deploy).
 */
export interface CanaryAiModelResult {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  step?: string;
  errorMessage?: string;
  httpStatus?: number;
  durationMs: number;
  checked?: string[];
}

type ProviderRow = { provider: string; default_model: string | null; api_key_encrypted: string | null };

@Injectable()
export class CanaryAiModelService {
  private readonly logger = new Logger(CanaryAiModelService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async pingAnthropic(model: string, key: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4, messages: [{ role: 'user', content: 'ping' }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 200) return { ok: true, status: 200 };
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, status: res.status, error: (j.error?.message ?? '').slice(0, 160) };
  }

  private async pingOpenAI(model: string, key: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4, messages: [{ role: 'user', content: 'ping' }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 200) return { ok: true, status: 200 };
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, status: res.status, error: (j.error?.message ?? '').slice(0, 160) };
  }

  async run(): Promise<CanaryAiModelResult> {
    const started = Date.now();
    const dur = () => Date.now() - started;

    let rows: ProviderRow[];
    try {
      const r = (await this.db.execute(
        sql`SELECT provider, default_model, api_key_encrypted FROM ai_api_config WHERE is_active = true AND default_model IS NOT NULL`,
      )) as unknown as ProviderRow[] | { rows: ProviderRow[] };
      rows = Array.isArray(r) ? r : r.rows;
    } catch (err) {
      return { ok: false, step: 'db', errorMessage: err instanceof Error ? err.message : String(err), durationMs: dur() };
    }
    if (!rows || rows.length === 0) {
      return { skipped: true, reason: 'no_active_providers_with_model', durationMs: dur() };
    }

    const checked: string[] = [];
    for (const row of rows) {
      if (!row.default_model || !row.api_key_encrypted) continue;
      const key = Buffer.from(row.api_key_encrypted, 'base64').toString('utf-8');
      const tag = `${row.provider}:${row.default_model}`;
      checked.push(tag);
      let ping: { ok: boolean; status: number; error?: string };
      try {
        if (row.provider === 'anthropic') ping = await this.pingAnthropic(row.default_model, key);
        else if (row.provider === 'openai') ping = await this.pingOpenAI(row.default_model, key);
        else continue; // proveedor sin ping implementado → no bloquea
      } catch (err) {
        return { ok: false, step: `ping_exc:${row.provider}`, errorMessage: `${tag}: ${err instanceof Error ? err.message : String(err)}`, durationMs: dur(), checked };
      }
      if (!ping.ok) {
        return {
          ok: false,
          step: 'model_dead',
          httpStatus: ping.status,
          errorMessage: `Modelo del chat MUERTO: ${tag} → ${ping.status} ${ping.error ?? ''} — actualizar ai_api_config.default_model (regresión clase 09/07)`,
          durationMs: dur(),
          checked,
        };
      }
    }
    return { ok: true, durationMs: dur(), checked };
  }
}
