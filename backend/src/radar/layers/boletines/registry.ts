// backend/src/radar/layers/boletines/registry.ts
//
// Capa 1 — registro de boletines oficiales (fuente de verdad). Un fichero por
// boletín. Los legacy (BOE, BOCYL) se reutilizan envueltos desde
// detect-boletines; los nuevos CCAA se añaden como adapters propios.
//
// PENDIENTE: completar los 17 CCAA (1 fichero c/u). Hueco confirmado primero:
// DOGC(CAT) BOIB(BAL) BORM(MUR). Resto: BOJA BOA BOPA BOC-CAN BOC-CANT DOCM DOE
// DOG BOR BOCM BON BOPV DOGV. BOPs provinciales → Fase 4 (guiados por gaps).

import { SourceAdapter } from '../../core/types';
import { BOLETIN_ADAPTERS as LEGACY_BOLETINES } from '../../../detect-boletines/boletines';
import { wrapBoletin } from './_wrap';
import { bonAdapter } from './bon'; // Navarra — 1er CCAA nuevo (§16bis)
// import { dogcAdapter } from './dogc';   // CAT: SPA, requiere §16bis/Playwright
// import { bopvAdapter } from './bopv';   // PV: viable (Ultimo.shtml, 178 hits)

// ⚠️ TRANSICIÓN: mientras el cron `detect-boletines` siga vivo, NO registrar
// aquí BOE/BOCYL — se ejecutarían dos veces (con dedupe keys distintos) →
// señales duplicadas. El wrap ya está listo (`wrapBoletin`); se activa cuando
// se retire `detect-boletines.cron` y el orquestador pase a OWNER de la Capa 1.
export const LEGACY_BOLETINES_WRAPPED: SourceAdapter[] = LEGACY_BOLETINES.map(
  (a, i) => wrapBoletin(a, 100 + i),
);

export const BOLETIN_ADAPTERS: SourceAdapter[] = [
  bonAdapter, // Navarra — nuevo, NO duplica (detect-boletines solo hace BOCYL+BOE)
  // ...LEGACY_BOLETINES_WRAPPED,   // ← activar al retirar detect-boletines.cron
];
