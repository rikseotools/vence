// __tests__/backend/answerSavePresupuestoParidad.test.ts
//
// Guardarraíl de la CADENA de timeouts de POST /api/v2/answer-and-save ([T-315]).
//
// El defecto de origen no fue un número mal puesto: fue que había CINCO números en cuatro
// ficheros distintos, cada uno subido en un momento distinto, que solo funcionaban si sumaban
// bien — y nadie los ataba. En mayo/2026 el techo del backend subió 10 s → 25 s en dos días
// sin que nadie mirara el del cliente; en agosto seguían coincidiendo por casualidad.
//
// El backend NO puede importar los del frontend (su imagen Docker solo copia `backend/src`),
// así que la relación se vigila LEYENDO los ficheros como texto. Mismo patrón que
// `alert-rules.endpoint-latency.spec.ts`.
//
// La relación que tiene que cumplirse, y por qué cada eslabón:
//
//   presupuesto del backend  <  timeout del proxy  ≤  timeout del cliente  <  maxDuration
//
//   · backend < proxy   → el backend termina DENTRO de la ventana del proxy, así que quien
//                         contesta es él: el usuario recibe nuestro 503 con `Retry-After` y no
//                         un abort sin causa. Al revés (que es como estaba) el 503 del backend
//                         no llegaba nunca.
//   · proxy ≤ cliente   → si el cliente cortara antes, el 503 del servidor tampoco se vería
//                         (era exactamente el bug del 28/05: el 100 % de los 503 duraban 10 s
//                         justos porque abortaba el cliente).
//   · proxy < maxDuration → la plataforma no puede matar la función antes de que nuestro
//                         código pueda responder; si la mata, el fallo no pasa por ningún
//                         `catch` y no deja rastro en `observable_events` ([T-635]).
import { readFileSync } from 'fs';
import { join } from 'path';

import { ANSWER_SAVE_BUDGET_MS } from '../../backend/src/answer-save/presupuesto';

const RAIZ = join(__dirname, '..', '..');

function leer(rel: string): string {
  return readFileSync(join(RAIZ, rel), 'utf8');
}

/** Extrae un número de la primera línea que case con el patrón dado. */
function numeroDe(texto: string, patron: RegExp, queEs: string): number {
  const m = texto.match(patron);
  if (!m) {
    throw new Error(
      `No se encontró ${queEs}. Si lo has movido o renombrado, ACTUALIZA este guardarraíl: ` +
        `sin él la cadena de timeouts vuelve a quedar sin nadie que la ate.`,
    );
  }
  return Number(m[1]);
}

describe('cadena de timeouts de answer-and-save (T-315)', () => {
  const routeTs = leer('app/api/v2/answer-and-save/route.ts');
  const clientTs = leer('lib/api/v2/answer-and-save/client.ts');

  const proxyMs = numeroDe(
    routeTs,
    /setTimeout\(\s*\(\)\s*=>\s*controller\.abort\(\),\s*(\d+)\)/,
    'el timeout del proxy en app/api/v2/answer-and-save/route.ts',
  );
  const maxDurationS = numeroDe(
    routeTs,
    /export const maxDuration\s*=\s*(\d+)/,
    'el maxDuration de app/api/v2/answer-and-save/route.ts',
  );
  const clienteMs = numeroDe(
    clientTs,
    /const timeoutMs\s*=\s*(\d+)/,
    'el timeout del cliente en lib/api/v2/answer-and-save/client.ts',
  );

  it('el presupuesto del backend cabe DENTRO de la ventana del proxy', () => {
    // Si no, corta siempre el proxy y nuestro 503 (con Retry-After) no llega al usuario.
    expect(ANSWER_SAVE_BUDGET_MS).toBeLessThan(proxyMs);
  });

  it('el cliente no corta antes que el proxy', () => {
    // El bug del 28/05: el 100 % de los 503 duraban 10 s justos porque abortaba el cliente
    // antes de que el servidor pudiera contestar.
    expect(clienteMs).toBeGreaterThanOrEqual(proxyMs);
  });

  it('la plataforma no mata la función antes de que podamos responder', () => {
    // Un 504 por `maxDuration` no pasa por ningún catch: no deja rastro ([T-635]).
    expect(proxyMs).toBeLessThan(maxDurationS * 1000);
  });

  it('guardar conserva al menos los 15 s que tenía antes del cambio', () => {
    // El cambio no puede empeorar la fase que de verdad importa: la que guarda la respuesta.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      COMPROBACIONES_MAX_MS,
    } = require('../../backend/src/answer-save/presupuesto') as {
      COMPROBACIONES_MAX_MS: number;
    };
    expect(ANSWER_SAVE_BUDGET_MS - COMPROBACIONES_MAX_MS).toBeGreaterThanOrEqual(15_000);
  });
});
