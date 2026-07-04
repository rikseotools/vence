// backend/src/radar/core/types.ts
//
// Contrato ÚNICO del radar multi-capa. Todas las fuentes (boletines,
// agregadores oficiales, competidores) implementan `SourceAdapter`.
// Los adapters son deliberadamente "tontos": SOLO fetch + parse de su fuente
// a candidatos crudos. Todo lo inteligente (filtro de nicho, extracción LLM,
// match contra catálogo, dedup, persistencia) vive una sola vez en `core/`.
//
// Diseño: docs/roadmap/radar-multicapa.md

import type { RegionalOep } from '../../oep-signals/oep-signals.schemas';

/** Las tres capas en cascada por prioridad (menor `priority` = antes). */
export type Layer = 'boletin' | 'aggregator' | 'competitor';

/** Contexto que el orquestador pasa a cada `scan()`. */
export interface ScanContext {
  /** "Hoy" inyectable (tests + determinismo). */
  readonly today: Date;
  /** Ventana hacia atrás en días (boletines cubren fin de semana en cron L-V). */
  readonly daysBack: number;
  /** Señal de aborto para respetar timeouts del orquestador. */
  readonly signal?: AbortSignal;
}

/**
 * Candidato CRUDO tal como lo ve una fuente, antes de filtro/LLM/match.
 * Un boletín devuelve texto de sumario; un competidor devuelve una tarjeta ya
 * semi-estructurada. El pipeline los normaliza aguas abajo.
 */
export interface RawCandidate {
  /** URL de origen (trazabilidad). En competidores, la del agregador. */
  sourceUrl: string;
  /**
   * Enlace al BOLETÍN OFICIAL si la fuente lo expone (competidores lo traen en
   * el detalle). Es lo que permite verificar el dato real sin fiarse del
   * agregador. Null si la propia fuente ya ES el boletín oficial.
   */
  officialUrl?: string | null;
  /** Texto libre para que el LLM extraiga (sumario de boletín, o resumen). */
  text: string;
  /**
   * OEPs YA ESTRUCTURADas → saltan el LLM. Lo usan las fuentes que ya devuelven
   * datos parseados (agregador PAG: jsonDetalle). Si viene, el pipeline lo usa
   * directamente en vez de llamar al LLM sobre `text`.
   */
  preExtracted?: RegionalOep[];
  /**
   * Clave de dedup EXPLÍCITA. Si se omite, el orquestador la deriva de la ref
   * oficial. La usa PAG para conservar la misma clave que su cron legacy
   * (`pag:${id}`) → migración sin duplicar señales.
   */
  dedupeKey?: string;
  /** Nombre/cuerpo tal cual lo da la fuente (opcional; el LLM afina). */
  rawName?: string | null;
  /** Región/CCAA si la fuente la conoce. */
  regionName?: string | null;
  /** Nivel de administración (Estatal/Autonómica/Local/Universidad) si se conoce
   *  — input del matcher. Lo aporta PAG (jsonDetalle); boletines/competidores no. */
  admin?: string | null;
  /** Órgano convocante (Ayuntamiento/Universidad/Consejería…) — input del matcher. */
  organismo?: string | null;
  /** Fecha del boletín/publicación (para dedup y trazabilidad). */
  publishedDate?: Date | null;
}

/**
 * Fuente del radar. Una por fichero. Se registra en el registry de su capa.
 * Añadir una fuente = 1 fichero (este) + 1 línea de registro + 1 test.
 */
export interface SourceAdapter {
  /** Identificador estable: 'boe', 'dogc', 'pag-empleo', 'oposiciones-es'. */
  readonly key: string;
  readonly layer: Layer;
  /** Orden de cascada dentro y entre capas (boletines < aggregators < competitors). */
  readonly priority: number;
  /**
   * `sensor_type` para `oep_detection_signals` (taxonomía cerrada por CHECK).
   * Si se omite, el orquestador usa el default de la capa:
   * boletin→'regional_scan', aggregator→'pag_empleo', competitor→'competitor'.
   * (BOE declara 'boe_api'.)
   */
  readonly sensorType?: string;
  /** CCAA/ámbito por defecto de la fuente (opcional). */
  readonly regionName?: string;
  /**
   * SOLO fetch + parse. Nunca escribe en BD ni llama al LLM/matcher.
   * Debe ser fail-safe respecto a su propia fuente: si el HTML cambió o el
   * proveedor está caído, lanza — el orquestador lo captura y lo registra.
   */
  scan(ctx: ScanContext): Promise<RawCandidate[]>;
}

/** Resultado de un adapter dentro de una pasada (para telemetría). */
export type AdapterStatus = 'ok' | 'empty' | 'failed' | 'timeout' | 'skipped';

export interface AdapterRunResult {
  runId: string;
  layer: Layer;
  adapterKey: string;
  status: AdapterStatus;
  startedAt: Date;
  durationMs: number;
  itemsScanned: number;
  candidates: number;
  signalsNew: number;
  signalsDupe: number;
  httpStatus?: number | null;
  errorMessage?: string | null;
}
