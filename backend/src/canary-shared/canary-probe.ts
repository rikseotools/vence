// canary-probe.ts — Contrato ÚNICO que todo canary (synthetic probe) implementa.
//
// Objetivo (docs/roadmap/canary-framework.md, P1): que añadir/mantener un canary
// sea declarar metadatos + un `execute()`, y que el resto (cronometrar, emitir a
// observabilidad de forma homogénea, exigir cota a los que escriben, registrarse)
// lo dé el framework. Cierra el incidente 11/07 POR CONSTRUCCIÓN: un canary que
// muta prod sin declarar cómo se acota NO compila el guardarraíl (canary-guardrail).
//
// NO reescribe los canarios existentes por sí solo — es el destino al que se migran
// uno a uno (P2). El guardarraíl CI (P3) se enciende cuando todos conforman.

import { CanaryResult } from './canary-result';

/**
 * Cómo un canary que ESCRIBE en tablas reales de prod evita acumular sin límite.
 * Un `writesToProd` DEBE declarar una estrategia ≠ 'read-only' (invariante forzado).
 * - `read-only`        → no escribe (por defecto).
 * - `unique-constraint`→ el fixture colisiona en una PK fija → 1 fila para siempre
 *                        (molde canary-answer-save: SMOKE_SESSION_ID fijo).
 * - `per-run-cleanup`  → crea y BORRA en la misma pasada, huella cero
 *                        (molde canary-save-contract: DELETE test + fila).
 * - `cap-prune`        → cuenta y purga a un baseline si supera un cap
 *                        (molde canary-stats-pipeline: SMOKE_FIXTURE_CAP + prune).
 */
export type CanaryBounding = 'read-only' | 'unique-constraint' | 'per-run-cleanup' | 'cap-prune';

export interface CanaryProbe {
  /** Slug estable, kebab-case, sin prefijo `canary-` (p.ej. 'answer-save'). Deriva el eventType. */
  readonly name: string;
  /** Expresión cron (UTC) de su cadencia. Fuente única — el framework programa desde aquí. */
  readonly cadence: string;
  /** ¿Escribe (INSERT/UPDATE/DELETE) en tablas REALES de prod? */
  readonly writesToProd: boolean;
  /** Estrategia de acotado del fixture. Invariante: ≠ 'read-only' ⟺ writesToProd. */
  readonly bounding: CanaryBounding;
  /** La comprobación en sí. Devuelve el resultado SIN `durationMs` (lo sella el runner). */
  execute(): Promise<Omit<CanaryResult, 'durationMs'>>;
}

/** eventType canónico de observabilidad para un estado dado del canary. */
export function canaryEventType(name: string, status: CanaryResult['status']): string {
  // p.ej. ('answer-save','failed') → 'canary_answer_save_failed'
  return `canary_${name.replace(/-/g, '_')}_${status}`;
}

/**
 * Invariante estructural del framework: un canary que escribe en prod DEBE declarar
 * una cota (≠ 'read-only'); y uno que declara cota DEBE marcarse como writesToProd.
 * Lo llama el registro al arrancar (fail-fast) y lo aserta el guardarraíl de CI —
 * de modo que es IMPOSIBLE meter un write-canary sin cota (la clase de bug del 11/07).
 * Devuelve el mensaje de violación, o null si el probe es coherente.
 */
export function boundingViolation(probe: Pick<CanaryProbe, 'name' | 'writesToProd' | 'bounding'>): string | null {
  const declaresBound = probe.bounding !== 'read-only';
  if (probe.writesToProd && !declaresBound) {
    return `Canary "${probe.name}" escribe en prod (writesToProd=true) pero bounding='read-only' — DEBE declarar una cota (unique-constraint | per-run-cleanup | cap-prune). Un write-canary sin cota reproduce el incidente 11/07.`;
  }
  if (!probe.writesToProd && declaresBound) {
    return `Canary "${probe.name}" declara bounding='${probe.bounding}' pero writesToProd=false — incoherente (una cota implica que escribe).`;
  }
  return null;
}

/** Aserta el invariante sobre un conjunto de probes; lanza en la 1ª violación. */
export function assertBoundingInvariant(probes: ReadonlyArray<Pick<CanaryProbe, 'name' | 'writesToProd' | 'bounding'>>): void {
  for (const p of probes) {
    const v = boundingViolation(p);
    if (v) throw new Error(v);
  }
}
