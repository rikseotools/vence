// backend/src/observability/llm-usage.ts
//
// Observabilidad de uso/coste de LLM en el BACKEND (NestJS) — ESPEJO del módulo del frontend
// (lib/observability/llm.ts). Fase 2: instrumenta el cliente Anthropic del backend (AnthropicService)
// para que las llamadas de los extractores OEP y detect-notas registren provider/modelo/tokens/coste
// al MISMO sink (`observable_events`, vía ObservabilityService). Mantener en sync con el frontend.
//
// GARANTÍA: registro fire-and-forget + try/catch → NUNCA rompe ni ralentiza la llamada LLM.

import { AsyncLocalStorage } from 'async_hooks';
import type { ObservabilityService } from './observability.service';

export type LlmProvider = 'anthropic' | 'openai';

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

const EMPTY_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

// Precios USD por 1M tokens (input, output). Espejo del frontend — mantener sincronizado.
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'text-embedding-3-small': { in: 0.02, out: 0 },
  'text-embedding-3-large': { in: 0.13, out: 0 },
  'claude-sonnet-4-5': { in: 3, out: 15 },
  'claude-sonnet-4-5-20250929': { in: 3, out: 15 },
  'claude-opus-4-1': { in: 15, out: 75 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

function pricingFor(model: string): { in: number; out: number } {
  if (PRICING[model]) return PRICING[model];
  const m = model.toLowerCase();
  if (m.includes('embedding')) return { in: 0.02, out: 0 };
  if (m.includes('opus')) return { in: 15, out: 75 };
  if (/\bo[134]\b/.test(m) || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return { in: 15, out: 60 };
  if (m.includes('haiku') || m.includes('mini')) return { in: 1, out: 5 };
  if (m.includes('sonnet') || m.includes('gpt-4o') || m.includes('gpt-4') || m.includes('gpt-5')) return { in: 3, out: 15 };
  return { in: 3, out: 15 };
}

export function estimateCostUsd(model: string, u: LlmUsage): number {
  const p = pricingFor(model);
  const cost = (u.inputTokens / 1e6) * p.in + (u.outputTokens / 1e6) * p.out;
  return Math.round(cost * 1e6) / 1e6;
}

export function normalizeUsage(provider: LlmProvider, raw: unknown): LlmUsage {
  const u = (raw ?? {}) as Record<string, number | undefined>;
  if (provider === 'anthropic') {
    const i = u.input_tokens ?? 0;
    const o = u.output_tokens ?? 0;
    return { inputTokens: i, outputTokens: o, totalTokens: i + o };
  }
  const i = u.prompt_tokens ?? 0;
  const o = u.completion_tokens ?? 0;
  return { inputTokens: i, outputTokens: o, totalTokens: u.total_tokens ?? i + o };
}

// ── Feature attribution ─────────────────────────────────────────────────────────────────────
const featureStore = new AsyncLocalStorage<string>();

export function enterLlmFeature(feature: string): void {
  featureStore.enterWith(feature);
}

export function runWithLlmFeature<T>(feature: string, fn: () => T): T {
  return featureStore.run(feature, fn);
}

export function currentLlmFeature(): string {
  return featureStore.getStore() ?? 'unspecified';
}

// ── Instrumentación del cliente Anthropic del backend ───────────────────────────────────────
const INSTRUMENTED = Symbol.for('vence.llm.instrumented');

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── Mirror INLINE de lib/observability/llmErrorKind.cjs — MANTENER EN SYNC ──────────────────
// El backend NestJS no puede importar `lib/` del frontend (build separado). Convierte el mensaje
// del proveedor en una CLASE accionable: sin esto, `ok:false` obliga a repetir el diagnóstico a
// mano — pasó el 26/07 con 8 horas de radar muerto por falta de saldo, que Anthropic devuelve
// como 400 invalid_request_error y por eso parecía un error de petición.
// El test `llm-error-kind-parity` compara estas reglas con las del núcleo POR COMPORTAMIENTO.
const CLASES_ERROR: Array<{ kind: string; re: RegExp; accion: string }> = [
  {
    kind: 'sin_credito',
    re: /credit balance is too low|insufficient[_ ]quota|billing_hard_limit|exceeded your current quota|payment required/i,
    accion: 'recarga saldo en el proveedor (Plans & Billing). No es un bug de código.',
  },
  {
    kind: 'auth_invalida',
    re: /authentication_error|api key is invalid|invalid[_ ]api[_ ]key|incorrect api key|unauthorized/i,
    accion: 'la clave está revocada o es de otra cuenta: regenérala y actualízala donde toque.',
  },
  {
    kind: 'permiso',
    re: /permission_error|does not have access|not allowed to access|forbidden/i,
    accion: 'la clave existe pero no tiene permiso sobre ese modelo/organización.',
  },
  { kind: 'rate_limit', re: /rate[_ ]limit|too many requests|429/i, accion: 'se está pidiendo más rápido de lo permitido: reintentar con espera.' },
  {
    kind: 'modelo_no_disponible',
    re: /model[^.]{0,40}(not found|does not exist|deprecated|retired)|not_found_error/i,
    accion: 'el modelo ya no existe o no está disponible: cambiar el modelo configurado.',
  },
  { kind: 'sobrecarga', re: /overloaded|server_error|internal server error|503|502|bad gateway/i, accion: 'problema temporal del proveedor: reintentar.' },
  { kind: 'timeout', re: /timeout|timed out|aborted|ETIMEDOUT|ECONNRESET/i, accion: 'la llamada no llegó a completarse: revisar red o subir el timeout.' },
];

export function clasificarErrorLlm(mensaje?: string | null, status?: number | null): { kind: string; accion: string } {
  const txt = `${status != null ? `${status} ` : ''}${mensaje == null ? '' : String(mensaje)}`;
  if (!txt.trim()) return { kind: 'desconocido', accion: 'el fallo no dejó mensaje: revisar el call-site.' };
  for (const c of CLASES_ERROR) if (c.re.test(txt)) return { kind: c.kind, accion: c.accion };
  // El texto manda sobre el código: un 400 de Anthropic puede ser falta de saldo.
  if (status === 401) return { kind: 'auth_invalida', accion: CLASES_ERROR[1].accion };
  if (status === 403) return { kind: 'permiso', accion: CLASES_ERROR[2].accion };
  if (status === 429) return { kind: 'rate_limit', accion: CLASES_ERROR[3].accion };
  if (status != null && status >= 500) return { kind: 'sobrecarga', accion: CLASES_ERROR[5].accion };
  return { kind: 'otro', accion: 'sin patrón conocido: mirar `error_message` del evento.' };
}

export function requiereIntervencionLlm(kind: string): boolean {
  return kind === 'sin_credito' || kind === 'auth_invalida' || kind === 'permiso' || kind === 'modelo_no_disponible';
}

function record(
  obs: Pick<ObservabilityService, 'emitFireAndForget'>,
  r: { provider: LlmProvider; model: string; feature: string; usage: LlmUsage; durationMs: number; ok: boolean; error?: string; streaming: boolean },
): void {
  try {
    const estimatedCostUsd = r.ok ? estimateCostUsd(r.model, r.usage) : 0;
    obs.emitFireAndForget({
      source: 'fargate',
      severity: r.ok ? 'info' : 'warn',
      eventType: 'llm_call',
      endpoint: r.feature,
      durationMs: r.durationMs,
      errorMessage: r.error ?? null,
      metadata: {
        provider: r.provider,
        model: r.model,
        feature: r.feature,
        inputTokens: r.usage.inputTokens,
        outputTokens: r.usage.outputTokens,
        totalTokens: r.usage.totalTokens,
        estimatedCostUsd,
        ok: r.ok,
        streaming: !!r.streaming,
        ...(r.ok
          ? {}
          : (() => {
              const c = clasificarErrorLlm(r.error, null);
              return { errorKind: c.kind, errorAccion: c.accion, requiereIntervencion: requiereIntervencionLlm(c.kind) };
            })()),
      },
    });
  } catch {
    /* best-effort: la observabilidad NUNCA rompe la llamada */
  }
}

/**
 * Instrumenta un cliente Anthropic para registrar cada `messages.create` vía ObservabilityService.
 * Devuelve el APIPromise original intacto (registro como side-effect). Idempotente.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function instrumentAnthropicClient<T extends { messages: { create: (...a: any[]) => any } }>(
  client: T,
  obs: Pick<ObservabilityService, 'emitFireAndForget'>,
): T {
  const c = client as any;
  if (c[INSTRUMENTED]) return client;
  const orig = client.messages.create.bind(client.messages);
  client.messages.create = ((...args: any[]) => {
    const params = args[0] || {};
    const model: string = params.model || 'unknown';
    const streaming = !!params.stream;
    const feature = currentLlmFeature();
    const started = Date.now();
    let p: any;
    try {
      p = orig(...args);
    } catch (err) {
      record(obs, { provider: 'anthropic', model, feature, usage: EMPTY_USAGE, durationMs: Date.now() - started, ok: false, error: errMsg(err), streaming });
      throw err;
    }
    Promise.resolve(p).then(
      (res) => record(obs, { provider: 'anthropic', model, feature, usage: streaming ? EMPTY_USAGE : normalizeUsage('anthropic', res?.usage), durationMs: Date.now() - started, ok: true, streaming }),
      (err) => record(obs, { provider: 'anthropic', model, feature, usage: EMPTY_USAGE, durationMs: Date.now() - started, ok: false, error: errMsg(err), streaming }),
    );
    return p;
  }) as any;
  c[INSTRUMENTED] = true;
  return client;
}
