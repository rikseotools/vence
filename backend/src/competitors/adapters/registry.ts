// backend/src/competitors/adapters/registry.ts
//
// Registro de adapters de competidores. Añadir un competidor = crear su fichero
// adapter + añadirlo aquí + su .spec.ts. No habrá muchos competidores y cada uno
// tiene su markup propio → un fichero por competidor.

import { CompetitorAdapter } from './types';
import { tecnoszubiaAdapter } from './tecnoszubia';

export const COMPETITOR_ADAPTERS: CompetitorAdapter[] = [tecnoszubiaAdapter];

/** Busca el adapter por su key (== competitors.slug). */
export function adapterByKey(key: string): CompetitorAdapter | undefined {
  return COMPETITOR_ADAPTERS.find((a) => a.key === key);
}
