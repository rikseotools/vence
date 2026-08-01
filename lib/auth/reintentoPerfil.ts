// lib/auth/reintentoPerfil.ts — ¿hay que volver a resolver el perfil de esta sesión? (T-434)
//
// Núcleo PURO: recibe el token y un reloj, devuelve una decisión. No habla con la base de datos
// ni con Auth.js, así que se puede probar entero sin levantar nada.
//
// ── EL FALLO QUE ESTO REPARA ────────────────────────────────────────────────────────────────
//
// `token.appUserId` (el `user_profiles.id` canónico) se escribía en UN SOLO punto del repo
// —`authjs.ts`, dentro de `if (user?.email)`— y en Auth.js **`user` solo llega en el primer
// sign-in**. Verificado en `@auth/core@0.41.2`: la rotación de sesión (`lib/actions/session.js`,
// una por carga de página) invoca el callback con `{ token, trigger?, session }` y **sin `user`**,
// así que ese bloque se salta entero.
//
// Consecuencia medida el 01/08/2026: **si esa única resolución falla, el usuario queda roto para
// siempre**. No se le puede indexar nada por su id, así que sus estadísticas fallan, el checkout
// le responde «User not found in database» y el formulario de soporte también — no puede ni
// avisarnos. **235 usuarios** en ese estado, el más antiguo desde el 7 de julio, y **85 intentos
// de compra rechazados en 7 días de 12 personas distintas**.
//
// Y explica lo que no encajaba: las **2.210 llamadas a `/api/auth/token`** no les curaban porque
// ese endpoint LEE `appUserId` del token; nadie lo vuelve a resolver.
//
// ── POR QUÉ EL ARREGLO NO NECESITA SABER POR QUÉ FALLÓ ──────────────────────────────────────
//
// La causa del primer fallo sigue sin identificarse (descartado que sea un timeout: el límite es
// de 30 s y la consulta tardaba 426 ms). Da igual: reintentar convierte un fallo PERMANENTE en uno
// PASAJERO. Lo que hace daño no es fallar una vez, es no volver a intentarlo nunca.
//
// ── LAS TRES GUARDAS, Y NINGUNA ES OPCIONAL ─────────────────────────────────────────────────
//
// 1. **Acotado en el tiempo.** Reintentar en CADA rotación (una por carga de página) sería
//    martillear la base de datos para un usuario que quizá sea irresoluble. Se guarda la hora del
//    último intento EN EL PROPIO TOKEN —que se re-firma en cada rotación, así que persiste sin
//    estado en servidor— y solo se reintenta pasada la ventana.
// 2. **Un token con la marca en el FUTURO no bloquea para siempre.** Un reloj torcido o un token
//    manipulado podría dejar `perfilReintentoAt` muy por delante y silenciar el reintento de por
//    vida. Si la marca es futura se considera basura y se reintenta.
// 3. **Sin email no se inventa nada.** Si la sesión no trae email no hay por dónde resolver, y eso
//    es un caso DISTINTO que hay que ver (`sin_email`), no un silencio.

/** Ventana entre reintentos, en segundos. */
export const VENTANA_REINTENTO_S = 300

/** Campo del token donde se guarda la hora del último intento (epoch en segundos). */
export const CAMPO_REINTENTO = 'perfilReintentoAt'

export type DecisionReintento =
  /** Ya tiene perfil resuelto: el caso normal. No cuesta nada. */
  | { accion: 'ya_resuelto' }
  /** No hay email en la sesión: no se puede resolver y hay que verlo. */
  | { accion: 'sin_email' }
  /** Se intentó hace poco: no insistir todavía. */
  | { accion: 'en_espera'; faltanS: number }
  /** Toca resolver. */
  | { accion: 'reintentar'; email: string }

/** Lo que se mira del token. Se acepta `unknown` porque el JWT de Auth.js es Record<string,unknown>. */
export interface TokenParcial {
  appUserId?: unknown
  email?: unknown
  [CAMPO_REINTENTO]?: unknown
}

const cadenaNoVacia = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/**
 * @param token     el JWT de la sesión tal cual lo entrega Auth.js
 * @param ahoraS    reloj en segundos (epoch). Se inyecta para poder probar sin esperar.
 * @param ventanaS  ventana entre reintentos
 */
export function decidirReintentoPerfil(
  token: TokenParcial | null | undefined,
  ahoraS: number,
  ventanaS: number = VENTANA_REINTENTO_S,
): DecisionReintento {
  const t = token ?? {}

  // 1. Caso normal y mayoritario: ya está resuelto. Se comprueba lo PRIMERO para que un usuario
  //    sano no pague absolutamente nada por este arreglo.
  if (cadenaNoVacia(t.appUserId)) return { accion: 'ya_resuelto' }

  // 2. Sin email no hay nada que buscar. No es lo mismo que «falló»: es que no se puede intentar,
  //    y quien lo lea tiene que poder distinguirlo (lo emite `authjs.ts` como evento propio).
  const email = cadenaNoVacia(t.email) ? t.email.trim().toLowerCase() : null
  if (!email) return { accion: 'sin_email' }

  // 3. Ventana. Solo frena si la marca es del pasado y reciente: una marca FUTURA (reloj torcido,
  //    token manipulado) se ignora a propósito, porque si no silenciaría el reintento para
  //    siempre — un guardarraíl que se puede desactivar con un valor raro no es un guardarraíl.
  const marca = t[CAMPO_REINTENTO]
  if (typeof marca === 'number' && Number.isFinite(marca)) {
    const transcurrido = ahoraS - marca
    if (transcurrido >= 0 && transcurrido < ventanaS) {
      return { accion: 'en_espera', faltanS: Math.ceil(ventanaS - transcurrido) }
    }
  }

  return { accion: 'reintentar', email }
}
