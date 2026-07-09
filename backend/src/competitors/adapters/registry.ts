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
import { temariosehsAdapter } from './temariosehs';
import { oposicionesflouAdapter } from './oposicionesflou';
import { superaoposicionesAdapter } from './superaoposiciones';
import { madAdapter } from './mad';
import { opositasAdapter } from './opositas';
import { adamsAdapter } from './adams';
import { gokoanAdapter } from './gokoan';
import { examinatestAdapter } from './examinatest';
import { opomurAdapter } from './opomur';
import { temariosenpdfAdapter } from './temariosenpdf';
import { GENERIC_ACADEMY_ADAPTERS } from './generic-academy';

export const COMPETITOR_ADAPTERS: CompetitorAdapter[] = [
  tecnoszubiaAdapter,
  opositatestAdapter,
  avaoposicionesAdapter,
  lideropositorAdapter,
  opomasterAdapter,
  temariosehsAdapter,
  oposicionesflouAdapter,
  superaoposicionesAdapter,
  madAdapter,
  opositasAdapter,
  adamsAdapter,
  gokoanAdapter,
  examinatestAdapter,
  opomurAdapter,
  temariosenpdfAdapter,
  // Academias con estructura estándar (config-driven, 1 config/competidor).
  ...GENERIC_ACADEMY_ADAPTERS,
];

/** Busca el adapter por su key (== competitors.slug). */
export function adapterByKey(key: string): CompetitorAdapter | undefined {
  return COMPETITOR_ADAPTERS.find((a) => a.key === key);
}
