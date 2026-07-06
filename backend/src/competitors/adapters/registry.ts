// backend/src/competitors/adapters/registry.ts
//
// Registro de adapters de competidores. Añadir un competidor = crear su fichero
// adapter + añadirlo aquí + su .spec.ts. No habrá muchos competidores y cada uno
// tiene su markup propio → un fichero por competidor.

import { CompetitorAdapter } from './types';
import { tecnoszubiaAdapter } from './tecnoszubia';
import { opositatestAdapter } from './opositatest';
import { avaoposicionesAdapter } from './avaoposiciones';
import { lideropositorAdapter } from './lideropositor';
import { opomasterAdapter } from './opomaster';

export const COMPETITOR_ADAPTERS: CompetitorAdapter[] = [
  tecnoszubiaAdapter,
  opositatestAdapter,
  avaoposicionesAdapter,
  lideropositorAdapter,
  opomasterAdapter,
];

/** Busca el adapter por su key (== competitors.slug). */
export function adapterByKey(key: string): CompetitorAdapter | undefined {
  return COMPETITOR_ADAPTERS.find((a) => a.key === key);
}
