import { Injectable, Logger } from '@nestjs/common';
import { signCanaryToken } from '../canary-shared/canary-token';

/**
 * Canary de la POLÍTICA DE IDENTIDAD en los endpoints de pago (T-340 / 31-07-2026).
 *
 * ## Qué verifica, y por qué hacen falta las dos mitades
 *
 * Cuando el `userId` que manda el cliente no coincide con el de su token, cada endpoint
 * decide según **el daño de equivocarse de cuenta**:
 *
 *   · `create-checkout` **NO corta** — el peor caso es cobrarse a uno mismo lo que iba a pagar.
 *   · `cancel` **SÍ corta** — seguir cancelaría la suscripción de quien tiene el token.
 *
 * Las dos se comprueban **juntas y en la misma pasada**, porque por separado no prueban nada:
 * si toda la autorización se abriera, la primera pasaría sola; si todo empezara a cortar, la
 * segunda pasaría sola. Solo el par distingue «la política funciona» de «el servidor dice que
 * sí a todo» y de «el servidor dice que no a todo».
 *
 * ## Por qué existe (el caso real)
 *
 * `rdiazprados@gmail.com` intentó comprar premium **17 veces entre las 05:54 y las 06:04** del
 * 31/07 y recibió 403 en todas: su navegador mandaba el id de un usuario que ya no existe. El
 * arreglo desbloquea la caja, pero **nada garantizaba que siguiera desbloqueada**: un
 * `alDiscrepar` cambiado de vuelta, o un refactor del helper, y volvemos al mismo sitio sin
 * enterarnos hasta que alguien no pueda pagar. Los guardarraíles cazan el texto y los tests la
 * lógica; esto prueba el sistema **vivo**, que es lo único que se puede romper al desplegar.
 *
 * ## Seguridad de la sonda destructiva
 *
 * La segunda mitad llama a `cancel` **a propósito**: es la única forma de comprobar que ahí
 * sigue cortando. Para que no pueda hacer daño ni en el peor caso —que la guarda se hubiera
 * roto y la petición siguiera adelante— se comprueba ANTES, en vivo, que el sujeto del canary
 * **no tiene suscripción que cancelar**. Si la tuviera, la sonda se omite y se dice, en vez de
 * arriesgarse o de inventarse un verde (misma lección que T-280 con el gate).
 *
 * Cadencia: sin `@Cron`. Se dispara POST-DEPLOY desde `frontend-deploy`, que es el único
 * momento en que esta política puede cambiar de comportamiento.
 */
@Injectable()
export class CanaryIdentidadPagoService {
  private readonly logger = new Logger(CanaryIdentidadPagoService.name);

  private readonly TARGET_URL = process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly TIMEOUT_MS = 10_000;

  /**
   * Un id con forma de UUID que no es de nadie. No se coge uno real a propósito: la sonda
   * afirma ser otra cuenta, y hacerlo con la cuenta de una persona real dejaría su id en los
   * eventos de identidad ajena y ensuciaría cualquier investigación posterior.
   */
  private readonly ID_AJENO = '00000000-0000-4000-8000-000000000000';

  async run(): Promise<CanaryIdentidadResult> {
    const startedAt = Date.now();
    const userId = process.env.SMOKE_USER_ID;

    const token = signCanaryToken(userId ?? '', { email: 'smoke@vence.es' });
    if (!userId || !token) {
      this.logger.warn('SMOKE_USER_ID o SUPABASE_JWT_SECRET no configurados — canary inactivo.');
      return { skipped: true, reason: 'credentials_not_configured', durationMs: Date.now() - startedAt };
    }

    const cabeceras = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Vence-Canary-IdentidadPago/1.0',
      'x-vence-canary': '1',
    };

    const post = async (ruta: string, body: unknown): Promise<number> => {
      const r = await fetch(`${this.TARGET_URL}${ruta}`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });
      return r.status;
    };

    // ─── Paso 0: ¿esta sesión sirve para algo? ────────────────────────────────────────────
    //
    // Sin esto, un token que ya no vale daría 401 en todo y la sonda del checkout —que solo
    // exige «cualquier cosa menos 403»— pasaría tan campante. Es el mismo agujero que T-280:
    // una sonda que no puede fallar no está midiendo.
    let hasSubscription: boolean | undefined;
    try {
      const r = await fetch(
        `${this.TARGET_URL}/api/stripe/subscription?userId=${encodeURIComponent(userId)}`,
        { headers: cabeceras, signal: AbortSignal.timeout(this.TIMEOUT_MS) },
      );
      if (r.status !== 200) {
        return {
          ok: false,
          step: 'sesion_inutil',
          httpStatus: r.status,
          errorMessage:
            `La sesión del canary no puede ni leer lo suyo (HTTP ${r.status}). Sin sesión válida ` +
            'las sondas de abajo no distinguen «la política funciona» de «no me autentico».',
          durationMs: Date.now() - startedAt,
        };
      }
      const datos = (await r.json()) as { hasSubscription?: boolean };
      hasSubscription = datos.hasSubscription === true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, step: 'sesion_inutil', errorMessage: `Excepción leyendo la suscripción: ${msg}`, durationMs: Date.now() - startedAt };
    }

    // ─── Paso 1: la caja NO se cierra por un id desincronizado ────────────────────────────
    //
    // No se exige 200: sin un priceId real esto acaba en 4xx igualmente, y crear una sesión de
    // checkout de verdad sería escribir en Stripe en cada deploy. Lo que importa es que NO sea
    // el 403 de identidad, que es el que dejó a una persona sin poder pagar.
    let estadoCheckout: number;
    try {
      estadoCheckout = await post('/api/stripe/create-checkout', {
        userId: this.ID_AJENO,
        priceId: 'price_canary_inexistente',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, step: 'checkout_request', errorMessage: `Excepción en el checkout: ${msg}`, durationMs: Date.now() - startedAt };
    }

    if (estadoCheckout === 403) {
      return {
        ok: false,
        step: 'checkout_cerrado',
        httpStatus: 403,
        errorMessage:
          'REGRESIÓN: el checkout vuelve a cortar por identidad (403). Un cliente con la sesión ' +
          'desincronizada NO puede pagar — es exactamente el caso de los 17 intentos del 31/07. ' +
          "Mirar `alDiscrepar` en app/api/stripe/create-checkout/route.js.",
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 2: lo destructivo SIGUE cortando (la otra mitad del par) ────────────────────
    //
    // Solo si no hay nada que cancelar. Ver el bloque de seguridad de la cabecera.
    let cancelAssertion: CanaryCancelAssertion = 'real';
    if (hasSubscription) {
      cancelAssertion = 'omitida_sujeto_con_suscripcion';
      this.logger.warn(
        'El sujeto del canary tiene suscripción: se omite la sonda de cancelar para no poder ' +
          'cancelarla si la guarda estuviera rota.',
      );
    } else {
      let estadoCancel: number;
      try {
        estadoCancel = await post('/api/stripe/cancel', { userId: this.ID_AJENO, reason: 'canary' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, step: 'cancel_request', errorMessage: `Excepción en cancelar: ${msg}`, durationMs: Date.now() - startedAt };
      }

      if (estadoCancel !== 403) {
        return {
          ok: false,
          step: 'cancel_abierto',
          httpStatus: estadoCancel,
          errorMessage:
            `REGRESIÓN GRAVE: cancelar aceptó un userId ajeno (HTTP ${estadoCancel}, esperado 403). ` +
            'Con una pantalla desincronizada se cancelaría la suscripción de quien tiene el token, ' +
            'en silencio. Mirar `alDiscrepar` en app/api/stripe/cancel/route.ts.',
          durationMs: Date.now() - startedAt,
        };
      }
    }

    return {
      ok: true,
      estadoCheckout,
      cancelAssertion,
      durationMs: Date.now() - startedAt,
    };
  }
}

/** ¿Se comprobó de verdad que lo destructivo sigue cortando, o no se pudo sin arriesgar? */
export type CanaryCancelAssertion = 'real' | 'omitida_sujeto_con_suscripcion';

export type CanaryIdentidadResult =
  | { ok: true; estadoCheckout: number; cancelAssertion: CanaryCancelAssertion; durationMs: number }
  | { skipped: true; reason: string; durationMs: number }
  | {
      ok: false;
      step:
        | 'sesion_inutil'
        | 'checkout_request'
        | 'checkout_cerrado'
        | 'cancel_request'
        | 'cancel_abierto';
      httpStatus?: number;
      errorMessage: string;
      durationMs: number;
    };
