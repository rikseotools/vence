// lib/observability/llm.ts
//
// Observabilidad CENTRAL y AGNÓSTICA de toda llamada a un LLM (OpenAI, Anthropic, …).
//
// PROBLEMA que resuelve: las llamadas LLM estaban dispersas en ~20 call-sites (chat, extractores
// OEP, verificación, generación…), cada uno invocando el SDK crudo, sin registrar uso ni coste.
// La única tabla de coste (`ai_api_usage`) solo la escribían 2 endpoints admin y murió en abril.
// Resultado: ceguera total del gasto de OpenAI/Anthropic.
//
// SOLUCIÓN: un único punto — se instrumenta el cliente compartido (`getAnthropic`/`getOpenAI`) y
// CADA `.create` registra provider, modelo, tokens, coste estimado, feature, latencia y ok/error
// al SINK ESTÁNDAR de observabilidad (`observable_events` vía emitFireAndForget). Agnóstico por
// contrato: el día que el sink migre a AWS, este módulo no cambia (habla con la interfaz `emit`).
//
// GARANTÍA: el registro es fire-and-forget y va envuelto en try/catch — NUNCA rompe ni ralentiza
// la llamada LLM (el chat es user-facing). Si la observabilidad falla, la llamada sigue.

import { AsyncLocalStorage } from 'async_hooks'
import { emitFireAndForget } from './emit'

export type LlmProvider = 'anthropic' | 'openai' | 'google'

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

const EMPTY_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

// Precios USD por 1M tokens (input, output). Fuente: tarifas públicas de cada proveedor
// (jul-2026). Es una ESTIMACIÓN para observabilidad de gasto, no la factura real. Ajustable
// sin tocar la lógica. Los modelos no listados usan una heurística por familia (ver pricingFor).
const PRICING: Record<string, { in: number; out: number }> = {
  // OpenAI
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'text-embedding-3-small': { in: 0.02, out: 0 },
  'text-embedding-3-large': { in: 0.13, out: 0 },
  // Anthropic
  'claude-sonnet-4-5': { in: 3, out: 15 },
  'claude-sonnet-4-5-20250929': { in: 3, out: 15 },
  'claude-opus-4-1': { in: 15, out: 75 },
  'claude-haiku-4-5': { in: 1, out: 5 },
}

function pricingFor(model: string): { in: number; out: number } {
  if (PRICING[model]) return PRICING[model]
  const m = model.toLowerCase()
  // Heurística por familia para modelos nuevos/con sufijo de fecha no listados.
  if (m.includes('embedding')) return { in: 0.02, out: 0 }
  if (m.includes('opus')) return { in: 15, out: 75 }
  // Modelos de razonamiento (o1/o3/o4) — caros; ANTES del branch 'mini' para no infra-estimarlos.
  if (/\bo[134]\b/.test(m) || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return { in: 15, out: 60 }
  if (m.includes('haiku') || m.includes('mini')) return { in: 1, out: 5 }
  if (m.includes('sonnet') || m.includes('gpt-4o') || m.includes('gpt-4') || m.includes('gpt-5')) return { in: 3, out: 15 }
  return { in: 3, out: 15 } // conservador por defecto
}

/** Coste USD estimado de una llamada, a partir de tokens y modelo. */
export function estimateCostUsd(model: string, u: LlmUsage): number {
  const p = pricingFor(model)
  const cost = (u.inputTokens / 1e6) * p.in + (u.outputTokens / 1e6) * p.out
  return Math.round(cost * 1e6) / 1e6 // 6 decimales
}

/** Normaliza el `usage` de cada SDK a un shape común (los proveedores lo devuelven distinto). */
export function normalizeUsage(provider: LlmProvider, raw: unknown): LlmUsage {
  const u = (raw ?? {}) as Record<string, number | undefined>
  if (provider === 'anthropic') {
    const i = u.input_tokens ?? 0
    const o = u.output_tokens ?? 0
    return { inputTokens: i, outputTokens: o, totalTokens: i + o }
  }
  // OpenAI (chat.completions / embeddings): prompt_tokens / completion_tokens / total_tokens
  const i = u.prompt_tokens ?? 0
  const o = u.completion_tokens ?? 0
  return { inputTokens: i, outputTokens: o, totalTokens: u.total_tokens ?? i + o }
}

// ── Feature/caller attribution (opcional, sin tocar los 20 call-sites) ──────────────────────
// Un call-site puede envolver su lógica en `runWithLlmFeature('oep_signals', () => …)` para que
// TODAS las llamadas LLM de dentro se etiqueten con esa feature. Si no lo hace, feature =
// 'unspecified' (igual se capturan provider/model/tokens/coste — lo crítico del gasto).
const featureStore = new AsyncLocalStorage<string>()

export function runWithLlmFeature<T>(feature: string, fn: () => T): T {
  return featureStore.run(feature, fn)
}

/**
 * Fija la feature para el resto del contexto async actual SIN envolver en callback (útil al
 * inicio de un route handler: `enterLlmFeature('chat')` → todas las llamadas LLM de esa request
 * se etiquetan). Cada request HTTP corre en su propio contexto async, así que no se filtra entre
 * peticiones.
 */
export function enterLlmFeature(feature: string): void {
  featureStore.enterWith(feature)
}

export function currentLlmFeature(): string {
  return featureStore.getStore() ?? 'unspecified'
}

export interface LlmCallRecord {
  provider: LlmProvider
  model: string
  feature: string
  usage: LlmUsage
  durationMs: number
  ok: boolean
  error?: string
  streaming?: boolean
}

/**
 * PUNTO CENTRAL de registro. Emite un evento `llm_call` al sink agnóstico (observable_events).
 * Nunca lanza. Consulta de gasto: SELECT metadata->>'model', sum((metadata->>'estimatedCostUsd')::numeric)
 * FROM observable_events WHERE event_type='llm_call' GROUP BY 1.
 */
export function recordLlmCall(r: LlmCallRecord): void {
  try {
    const estimatedCostUsd = r.ok ? estimateCostUsd(r.model, r.usage) : 0
    emitFireAndForget({
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
      },
    })
  } catch {
    // best-effort: la observabilidad NUNCA rompe la llamada LLM.
  }
}

// ── Instrumentación de los clientes SDK (una sola vez por cliente) ──────────────────────────
const INSTRUMENTED = Symbol.for('vence.llm.instrumented')

/* eslint-disable @typescript-eslint/no-explicit-any */

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Envuelve un método `create` de un SDK para registrar la llamada, DEVOLVIENDO EL OBJETO ORIGINAL
 * (APIPromise) intacto. Los SDKs devuelven un `APIPromise` (subclase de Promise) con métodos extra
 * (`.parse()`, `.withResponse()`, `.stream()`…); si envolviéramos en un `async function` se
 * perderían y rompería quien los use. Por eso registramos como SIDE-EFFECT sobre la promesa y
 * devolvemos la original. La feature se captura SÍNCRONAMENTE (contexto ALS activo en la llamada).
 * Streaming: se registra sin tokens (v1); no se itera el stream aquí.
 */
function makeLoggedCreate(provider: LlmProvider, orig: (...a: any[]) => any) {
  return (...args: any[]) => {
    const params = args[0] || {}
    const model: string = params.model || 'unknown'
    const streaming = !!params.stream
    const feature = currentLlmFeature()
    const started = Date.now()

    let p: any
    try {
      p = orig(...args)
    } catch (err) {
      // Throw síncrono (params inválidos antes de la request): registrar y re-lanzar.
      recordLlmCall({ provider, model, feature, usage: EMPTY_USAGE, durationMs: Date.now() - started, ok: false, error: errMsg(err), streaming })
      throw err
    }

    // Registro fire-and-forget cuando resuelva/rechace. NO altera `p` (el caller recibe el original).
    Promise.resolve(p).then(
      (res) => recordLlmCall({ provider, model, feature, usage: streaming ? EMPTY_USAGE : normalizeUsage(provider, res?.usage), durationMs: Date.now() - started, ok: true, streaming }),
      (err) => recordLlmCall({ provider, model, feature, usage: EMPTY_USAGE, durationMs: Date.now() - started, ok: false, error: errMsg(err), streaming }),
    )

    return p
  }
}

/** Envuelve un cliente Anthropic para registrar cada `messages.create`. Idempotente. */
export function instrumentAnthropic<T extends { messages: { create: (...a: any[]) => any } }>(client: T): T {
  const c = client as any
  if (c[INSTRUMENTED]) return client
  client.messages.create = makeLoggedCreate('anthropic', client.messages.create.bind(client.messages)) as any
  c[INSTRUMENTED] = true
  return client
}

/**
 * Envuelve un cliente OpenAI para registrar `chat.completions.create` Y `embeddings.create`.
 * Los embeddings (search semántico del chat) también consumen tokens → si no se instrumentan,
 * su gasto queda invisible (fuga detectada en review). Idempotente.
 */
export function instrumentOpenai<T extends { chat: { completions: { create: (...a: any[]) => any } }; embeddings?: { create: (...a: any[]) => any } }>(client: T): T {
  const c = client as any
  if (c[INSTRUMENTED]) return client
  client.chat.completions.create = makeLoggedCreate('openai', client.chat.completions.create.bind(client.chat.completions)) as any
  if (client.embeddings?.create) {
    client.embeddings.create = makeLoggedCreate('openai', client.embeddings.create.bind(client.embeddings)) as any
  }
  c[INSTRUMENTED] = true
  return client
}
