// backend/src/radar/layers/competitors/registry.ts
//
// Capa 3 — registro de competidores. Añadir un competidor = crear su fichero
// adapter + añadirlo aquí + su .spec.ts. Cero cambios en core/orquestador.

import { SourceAdapter } from '../../core/types';
import { oposicionesEsAdapter } from './oposiciones-es';
// import { opositatestAdapter } from './opositatest';  // Fase 3

export const COMPETITOR_ADAPTERS: SourceAdapter[] = [
  oposicionesEsAdapter,
  // opositatestAdapter,
];
