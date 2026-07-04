// backend/src/radar/layers/aggregators/registry.ts
//
// Capa 2 — agregadores oficiales. El adapter PAG ya está listo (usa
// `preExtracted` → salta el LLM). Igual que con los boletines, NO se registra
// mientras el cron `detect-pag-empleo` siga vivo (se ejecutaría dos veces →
// señales duplicadas). Se activa al retirar ese cron y pasar el orquestador a
// OWNER de la Capa 2.

import { SourceAdapter } from '../../core/types';
import { pagEmpleoAdapter } from './pag-empleo';

export const PAG_WRAPPED: SourceAdapter = pagEmpleoAdapter;

// Activado 04/07/2026: PAG usa dedupeKey `pag:${id}` (misma clave que el cron
// legacy) → migración sin duplicar señales. El cron `detect-pag-empleo` se
// retira a la vez (quitado de app.module) para que no corra dos veces.
export const AGGREGATOR_ADAPTERS: SourceAdapter[] = [pagEmpleoAdapter];
