/**
 * Gate de re-análisis LLM del sensor `detect-notas-convocatoria`. Lógica PURA.
 *
 * PROBLEMA que resuelve (medido 24-25/07/2026): el sensor llamaba a Haiku UNA VEZ POR OPOSICIÓN
 * en CADA pase diario, con hasta 60.000 caracteres de prompt (≈14k tokens). Con 2.207 oposiciones
 * con `seguimiento_url` eso son ~19M tokens/día ≈ 17 $/día… para releer PDFs idénticos a los de
 * ayer: el 24/07 hubo 1.117 llamadas al LLM y sólo 5 documentos nuevos en el corpus (0,4%).
 *
 * SOLUCIÓN: el texto de cada nota YA se hashea (`convocatoria_notas.content_hash`) y la extracción
 * YA se guarda (`llm_extraction`). Si ninguna nota de la oposición ha cambiado, la respuesta del
 * LLM sería la misma → se reutiliza la guardada y no se llama.
 *
 * LÍMITES ASUMIDOS, a propósito:
 *  - El gate mira los DOCUMENTOS, no el texto de la página de seguimiento (que también va en el
 *    prompt). Las páginas cambian a diario por cosas irrelevantes (fechas de render, banners) y
 *    hashearlas dejaría el gate inservible. Un documento nuevo o editado SÍ cambia el hash → se
 *    re-analiza; una página que sólo reescribe su prosa sin tocar documentos, no.
 *  - Por eso el análisis CADUCA: pasados `llmCacheTtlDays` días se re-analiza aunque nada haya
 *    cambiado. Eso cierra el hueco anterior y hace que las mejoras de prompt/modelo entren solas.
 *  - La caducidad va ESCALONADA por oposición (10-16 días). Sin escalonar, las ~1.300 caducarían
 *    el mismo día y el ahorro se convertiría en un pico de 17 $ cada dos semanas.
 *  - Un documento que DESAPARECE de la página no fuerza re-análisis (la extracción cacheada cubre
 *    un superconjunto). Es conservador: preferimos de más a de menos.
 */
import * as crypto from 'crypto';

/** Días mínimos de validez de una extracción LLM. */
export const LLM_CACHE_BASE_DAYS = 10;
/** Amplitud del escalonado; TTL real ∈ [BASE, BASE + JITTER - 1]. */
export const LLM_CACHE_JITTER_DAYS = 7;

/** Una nota leída en el pase actual. */
export interface NotaActual {
  url: string;
  hash: string;
}

/** Fila de `convocatoria_notas` tal como la deja el pase anterior. */
export interface NotaCacheada {
  url: string;
  contentHash: string | null;
  llmExtraction: Record<string, unknown> | null;
  confianza: string | null;
  llmAnalyzedAt: Date | string | null;
}

export type MotivoReanalisis =
  | 'sin_notas'
  | 'sin_cache'
  | 'doc_nuevo_o_cambiado'
  | 'sin_extraccion'
  | 'caducada';

export type CacheDecision =
  | {
      reuse: true;
      llmExtraction: Record<string, unknown>;
      confianza: string | null;
    }
  | { reuse: false; motivo: MotivoReanalisis };

/**
 * TTL en días del análisis de una oposición. Determinista (mismo id → mismo TTL) y repartido por
 * el primer byte del sha1 del id, para que las caducidades se espacien en el calendario.
 */
export function llmCacheTtlDays(oposicionId: string): number {
  const byte = crypto.createHash('sha1').update(oposicionId).digest()[0];
  return LLM_CACHE_BASE_DAYS + (byte % LLM_CACHE_JITTER_DAYS);
}

function toMs(value: Date | string | null): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * ¿Hay que volver a llamar al LLM para esta oposición, o vale la extracción guardada?
 *
 * Reutiliza SOLO si se cumple todo: cada nota del pase actual está en la caché con el MISMO hash,
 * hay extracción guardada, y el análisis más viejo de esas notas no ha caducado.
 */
export function decideReanalisis(
  oposicionId: string,
  actuales: NotaActual[],
  cache: NotaCacheada[],
  now: Date,
): CacheDecision {
  if (actuales.length === 0) return { reuse: false, motivo: 'sin_notas' };
  if (cache.length === 0) return { reuse: false, motivo: 'sin_cache' };

  const porUrl = new Map(cache.map((c) => [c.url, c]));
  const emparejadas: NotaCacheada[] = [];
  for (const actual of actuales) {
    const previa = porUrl.get(actual.url);
    if (!previa) return { reuse: false, motivo: 'doc_nuevo_o_cambiado' };
    if (previa.contentHash !== actual.hash) {
      return { reuse: false, motivo: 'doc_nuevo_o_cambiado' };
    }
    emparejadas.push(previa);
  }

  const conExtraccion = emparejadas.find((e) => e.llmExtraction !== null);
  if (!conExtraccion || conExtraccion.llmExtraction === null) {
    return { reuse: false, motivo: 'sin_extraccion' };
  }

  // La edad la marca la nota analizada hace MÁS tiempo: si una sola está caducada, se re-analiza
  // el conjunto (el prompt es único para toda la oposición).
  const sellos = emparejadas.map((e) => toMs(e.llmAnalyzedAt));
  if (sellos.some((s) => s === null))
    return { reuse: false, motivo: 'caducada' };
  const masViejo = Math.min(...(sellos as number[]));
  const edadDias = (now.getTime() - masViejo) / 86_400_000;
  if (edadDias >= llmCacheTtlDays(oposicionId)) {
    return { reuse: false, motivo: 'caducada' };
  }

  return {
    reuse: true,
    llmExtraction: conExtraccion.llmExtraction,
    confianza: conExtraccion.confianza,
  };
}
