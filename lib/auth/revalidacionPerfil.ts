// lib/auth/revalidacionPerfil.ts — ¿sigue existiendo el perfil que la sesión ya tiene cacheado? (T-352)
//
// Núcleo PURO, mismo patrón que `reintentoPerfil.ts` (T-434): recibe el token y un reloj,
// devuelve una decisión. No habla con la base de datos.
//
// ── EL HUECO QUE ESTO CIERRA, Y POR QUÉ NO LO CUBRÍA NADA DE LO YA CONSTRUIDO ───────────────
//
// `decidirReintentoPerfil` (T-434) mira `token.appUserId` y decide "¿hay que resolverlo?" — pero
// SOLO pregunta si está VACÍO. En cuanto tiene CUALQUIER valor no vacío, lo da por bueno para
// siempre (`ya_resuelto`): nunca vuelve a comprobar que ese id SIGA teniendo fila en
// `user_profiles`. Si el perfil desaparece DESPUÉS de que la sesión ya lo cacheó —borrado de
// cuenta, entre otras causas— la sesión queda apuntando a un id fantasma indefinidamente: ni
// expira sola (JWT sin estado en servidor, sin lista de revocación) ni se autocura.
//
// `canonicalSubForToken` (T-245) SÍ valida existencia y reconcilia por email — pero vive en
// `/api/auth/token` (el acuñado del ACCESS TOKEN), que es un endpoint DISTINTO sin forma de
// escribir de vuelta en la cookie de sesión de Auth.js. Cura la llamada a la API de turno; dos
// llamadas después, con el mismo token de sesión sin tocar, hay que volver a curarla desde cero.
// Medido en producción (06/08): un mismo usuario reconciliado 5 veces en 2 días — la cura
// nunca se queda pegada porque no hay dónde pegarla.
//
// El caso real que lo destapó ([T-352], 31/07): `df73ec53`… no, otro caso — un id
// (`140ef91a-2d5a-4f36-a38a-c872467763a8`) con 247 eventos en 3 días, 44 acuñados de token
// (200 OK) y CERO filas en `user_profiles` desde el primer evento — la sesión nunca fue
// revalidada porque nunca estuvo vacía.
//
// ── LA VENTANA, y por qué no se revalida en CADA rotación ───────────────────────────────────
//
// El caso sano (>99,9%) no puede pagar una consulta extra en cada carga de página — el mismo
// principio que ya protege `decidirReintentoPerfil`. Se guarda la hora de la ÚLTIMA
// revalidación EN EL PROPIO TOKEN (se re-firma en cada rotación, así que persiste sin estado
// en servidor) y solo se vuelve a comprobar pasada la ventana.

/** Ventana entre revalidaciones, en segundos. 1h: la comprobación es un lookup por PK
 *  (microsegundos, mismo coste que ya paga `/api/auth/token` en cada mint — T-245), así que no
 *  hace falta una ventana tan corta como la de reintento (que sí hace un seq-scan por email). */
export const VENTANA_REVALIDACION_S = 3600

/** Campo del token donde se guarda la hora de la última revalidación (epoch en segundos). */
export const CAMPO_REVALIDACION = 'perfilRevalidadoAt'

export type DecisionRevalidacion =
  /** `appUserId` vacío: no es esto lo que hay que resolver — ya lo cubre `reintentoPerfil`. */
  | { accion: 'no_aplica' }
  /** Se revalidó hace poco: no insistir todavía. */
  | { accion: 'en_espera'; faltanS: number }
  /** Toca comprobar que el perfil sigue existiendo. */
  | { accion: 'revalidar'; appUserId: string; email: string | null }

export interface TokenRevalidacion {
  appUserId?: unknown
  email?: unknown
  [CAMPO_REVALIDACION]?: unknown
}

const cadenaNoVacia = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/**
 * @param token     el JWT de la sesión tal cual lo entrega Auth.js
 * @param ahoraS    reloj en segundos (epoch). Se inyecta para poder probar sin esperar.
 * @param ventanaS  ventana entre revalidaciones
 */
export function decidirRevalidacionPerfil(
  token: TokenRevalidacion | null | undefined,
  ahoraS: number,
  ventanaS: number = VENTANA_REVALIDACION_S,
): DecisionRevalidacion {
  const t = token ?? {}

  // Sin `appUserId` no hay nada que revalidar — es el caso que ya resuelve `reintentoPerfil`,
  // y mezclar los dos caminos duplicaría la decisión en dos sitios.
  if (!cadenaNoVacia(t.appUserId)) return { accion: 'no_aplica' }

  const marca = t[CAMPO_REVALIDACION]
  if (typeof marca === 'number' && Number.isFinite(marca)) {
    const transcurrido = ahoraS - marca
    // Igual que en reintentoPerfil: una marca en el FUTURO (reloj torcido, token manipulado)
    // se ignora a propósito — si no, silenciaría la revalidación para siempre.
    if (transcurrido >= 0 && transcurrido < ventanaS) {
      return { accion: 'en_espera', faltanS: Math.ceil(ventanaS - transcurrido) }
    }
  }

  const email = cadenaNoVacia(t.email) ? t.email.trim().toLowerCase() : null
  return { accion: 'revalidar', appUserId: t.appUserId, email }
}
