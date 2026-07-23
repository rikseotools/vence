// canary-registry.ts — CATÁLOGO ÚNICO de canaries (synthetic probes).
//
// Fuente de verdad declarativa de QUÉ canaries existen y sus metadatos. Hoy esa
// información está en 3 listas manuales desincronizadas (app.module imports,
// canary-runner imports, canary-runner.summarize) y en los @Cron dispersos. Este
// catálogo las unifica y, sobre todo, permite el GUARDARRAÍL (canary-registry.spec):
//   - invariante de cota (ningún write-canary sin acotar → anti-incidente 11/07),
//   - cobertura de alertas (todo canary que emite `_failed` debería tener su regla).
//
// ⚠️ `eventBase` NO es derivable del `name` en 3 canaries (deuda histórica): el dir
// `smoke-auth` emite `canary_auth_*`, `database-pool`→`canary_db_pool_*`,
// `redis-upstash`→`canary_redis_*`. Por eso el eventBase es EXPLÍCITO: al migrar un
// canary al contrato (P2) hay que preservar su event-type o se rompen sus alertas.
//
// Diseño: docs/roadmap/canary-framework.md (P1.2 / P3).

import { CanaryBounding, assertBoundingInvariant } from './canary-probe';

export interface CanaryRegistryEntry {
  /** slug del directorio (`backend/src/canary-<name>`), sin prefijo. */
  readonly name: string;
  /** Base del event-type de observabilidad: `canary_<eventBase>_<status>`. NO siempre == name. */
  readonly eventBase: string;
  /** Cadencia (@Cron UTC) o mecanismo de disparo. */
  readonly cadence: string;
  /** ¿Escribe en tablas REALES de prod? */
  readonly writesToProd: boolean;
  /** Estrategia de acotado del fixture (invariante: ≠'read-only' ⟺ writesToProd). */
  readonly bounding: CanaryBounding;
  /** ¿Tiene una RULE_CANARY_*_FAILED en backend/src/alerts/alert-rules.ts? (reflejo de la realidad) */
  readonly alertRule: boolean;
}

/**
 * Los 16 canaries. `runner`/`shared` son infraestructura, no van aquí.
 * writesToProd/bounding verificados contra el código (Agent map 20/07):
 *   answer-save = unique-constraint (SMOKE_SESSION_ID fijo, 1 fila),
 *   save-contract = per-run-cleanup (crea y borra en la pasada),
 *   stats-pipeline = cap-prune (SMOKE_FIXTURE_CAP=500 + pruneFixtureIfNeeded).
 */
export const CANARY_REGISTRY: readonly CanaryRegistryEntry[] = [
  { name: 'ai-model',               eventBase: 'ai_model',               cadence: '*/10 * * * *', writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'answer-premium',         eventBase: 'answer_premium',         cadence: '*/5 * * * *',  writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'answer-save',            eventBase: 'answer_save',            cadence: '*/5 * * * *',  writesToProd: true,  bounding: 'unique-constraint', alertRule: true  },
  { name: 'competitor-mention',     eventBase: 'competitor_mention',     cadence: '7 * * * *',    writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'database-pool',          eventBase: 'db_pool',                cadence: '*/5 * * * *',  writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'pdf-queue',              eventBase: 'pdf_queue',              cadence: '*/15 * * * *', writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'por-leyes-scope',        eventBase: 'por_leyes_scope',        cadence: '*/5 * * * *',  writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'psychometric-integrity', eventBase: 'psychometric_integrity', cadence: '*/15 * * * *', writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'questions-gate',         eventBase: 'questions_gate',         cadence: 'controller',   writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'redis-upstash',          eventBase: 'redis',                  cadence: '*/5 * * * *',  writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'save-contract',          eventBase: 'save_contract',          cadence: '*/5 * * * *',  writesToProd: true,  bounding: 'per-run-cleanup',   alertRule: true  },
  { name: 'smoke-auth',             eventBase: 'auth',                   cadence: '*/5 * * * *',  writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'stats-pipeline',         eventBase: 'stats_pipeline',         cadence: '*/5 * * * *',  writesToProd: true,  bounding: 'cap-prune',         alertRule: true  },
  { name: 'stripe-webhook',         eventBase: 'stripe_webhook',         cadence: '*/5 * * * *',  writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'synthetic-external',     eventBase: 'synthetic_external',     cadence: '*/5 * * * *',  writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'theme-stats',            eventBase: 'theme_stats',            cadence: '*/10 * * * *', writesToProd: false, bounding: 'read-only',         alertRule: true  },
  { name: 'topic-data',             eventBase: 'topic_data',             cadence: '*/5 * * * *',  writesToProd: false, bounding: 'read-only',         alertRule: true  },
];

/** Valida el invariante de cota sobre TODO el catálogo (lo llama el guardarraíl + boot). */
export function assertRegistryBounding(): void {
  assertBoundingInvariant(CANARY_REGISTRY);
}

/** Canaries que emiten `_failed` pero NO tienen regla de alerta (deuda P3 a cerrar). */
export function canariesMissingAlertRule(): CanaryRegistryEntry[] {
  return CANARY_REGISTRY.filter((c) => !c.alertRule);
}
