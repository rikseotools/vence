// lib/auth/sesionFantasma.ts
//
// «Cree que está dentro, y no lo está» — cuándo hay que soltar una sesión que ya no existe. [T-434]
//
// ## El bucle que cierra este módulo
//
// En el cliente conviven dos guardas, razonables por separado, que juntas encierran a una
// persona indefinidamente:
//
//   1. **Pre-hydrate.** En cada carga se lee el blob de sesión LEGACY de Supabase de
//      `localStorage` y se fija el usuario *y* su perfil cacheado, para que la interfaz no
//      parpadee. La persona se ve dentro, con su nombre y su plan.
//   2. **La guarda de limpieza.** Cuando el servidor dice que no hay sesión, NO se suelta al
//      usuario si hay un perfil cacheado — puesto para que un premium no viera «Regístrate»
//      cuando Supabase no lograba refrescar el token (pool saturado, época pre-Auth.js).
//
// El problema es que **la primera fabrica justo la condición que bloquea la segunda**: el
// perfil cacheado que impide limpiar lo acaba de poner el pre-hydrate. Resultado medido el
// 01/08/2026: ~90 personas desde el 07/07 —cuatro días después del flip de Auth.js— navegando,
// respondiendo preguntas y viendo su perfil, mientras **cada llamada al servidor les rebota**,
// no se les guarda nada y no pueden pagar. Para siempre, porque nada rompe el bucle. Y con un
// goteo de 1-5 nuevos al día: no son bajas de la migración, sigue ocurriendo.
//
// ## La distinción que lo resuelve, y por qué es estrecha a propósito
//
// El comentario de la guarda decía que se soltaría *«tras confirmar que la sesión está
// realmente perdida»*, y ese camino de confirmación **no existía**. Pues bien: **`INITIAL_SESSION`
// con la sesión a `null` ES esa confirmación**. Es el veredicto del arranque, cuando Auth.js ya
// ha mirado la cookie y ha dicho que no hay nadie. No es un fallo transitorio de refresco.
//
// Por eso el cambio se limita a ESE caso. En cualquier otro evento —un refresco que falla, un
// hueco momentáneo— se mantiene el comportamiento anterior, que protege de soltar a un usuario
// sano por un tropiezo de red. **El radio de acción es exactamente el caso roto y ni uno más:**
// soltar de menos deja gente encerrada, pero soltar de más desloguea a premium sanos.

/** Qué hacer con el usuario que el cliente tiene en memoria. */
export interface DecisionSesion {
  /** ¿Hay que soltar al usuario (y su perfil cacheado y el blob legacy)? */
  limpiar: boolean
  motivo:
    | 'sesion_valida' // el servidor confirma sesión: no se toca nada
    | 'veredicto_inicial' // INITIAL_SESSION sin sesión: fantasma confirmado → soltar
    | 'sin_nada_que_conservar' // no hay sesión ni perfil cacheado → soltar (como siempre)
    | 'posible_fallo_transitorio' // sin sesión pero con perfil cacheado y NO es el arranque
}

export interface EntradaDecisionSesion {
  /** Evento del proveedor de sesión (`INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`…). */
  evento: string | null | undefined
  /** ¿El servidor ha devuelto una sesión con usuario? */
  haySesion: boolean
  /** ¿Hay un perfil cacheado en memoria (puesto por el pre-hydrate o por una carga previa)? */
  hayPerfilCacheado: boolean
}

/**
 * El veredicto del arranque: el único momento en que un `null` significa «no hay nadie» en vez
 * de «ahora mismo no lo sé».
 */
export const EVENTO_VEREDICTO = 'INITIAL_SESSION'

export function decidirSesionFantasma(e: EntradaDecisionSesion): DecisionSesion {
  // 1. Hay sesión: no se toca nada. Va lo primero para que el usuario sano no dependa de
  //    ninguna de las reglas de abajo.
  if (e?.haySesion) return { limpiar: false, motivo: 'sesion_valida' }

  // 2. Sin perfil cacheado no hay nada que proteger — es el comportamiento de siempre.
  if (!e?.hayPerfilCacheado) return { limpiar: true, motivo: 'sin_nada_que_conservar' }

  // 3. EL ARREGLO. Sin sesión, con perfil cacheado, y estamos en el veredicto del arranque:
  //    Auth.js ya ha mirado la cookie y dice que no hay nadie. Eso no es un tropiezo, es un
  //    fantasma — y conservarlo es lo que encierra a la persona.
  if (e?.evento === EVENTO_VEREDICTO) return { limpiar: true, motivo: 'veredicto_inicial' }

  // 4. Cualquier otro evento sin sesión pero con perfil cacheado: puede ser un refresco que
  //    falló. Se conserva, como hasta ahora. Preferimos un premium con la interfaz intacta
  //    durante un bache a soltar a un usuario sano por un problema de red.
  return { limpiar: false, motivo: 'posible_fallo_transitorio' }
}
