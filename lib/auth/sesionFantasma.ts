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

// ## El caso HERMANO, y es el que de verdad está pasando (medido el 05/08/2026)
//
// Lo de arriba supone que el servidor dice «no hay nadie». Al medir los 182 que rebotan en 14
// días apareció que **no es eso lo que les pasa**:
//
//   | | |
//   |---|---|
//   | con fila en `user_profiles` **con el id que rebota** | 0 |
//   | en `deleted_users_log` (no son bajas) | 0 |
//   | con alguna petición de identidad VERIFICADA (o sea, sesión buena) | **180 de 182** |
//
// Es decir: **son usuarios SANOS con DOS identidades en el navegador**. El pre-hydrate resucita
// el id legacy de Supabase de `localStorage`, la sesión Auth.js llega ~700 ms después con el id
// BUENO, y lo que ya disparó en ese hueco manda el id viejo. Los endpoints que reciben el id por
// parámetro (`/api/v2/user-stats?userId=`) rebotan con «Usuario no existe» — 1.920 de esos 401
// traen identidad NO verificada, o sea que vienen del query string y no de un token.
//
// Por eso **ninguna señal del servidor los veía**: el camino del token está sano
// (`auth_sub_reconciliado` = 1 evento en TODA la base, `auth_alta_sin_perfil` = 0) y el reintento
// de perfil no podía curarles, porque no hay nada que reparar en el servidor.
//
// La regla que lo cierra: **si la sesión trae un usuario y su id NO es el pre-hidratado, el
// pre-hidratado es de OTRA identidad** y hay que soltarlo entero (perfil cacheado + blob legacy)
// en el acto, no esperar a que un fetch lo pise. Si coinciden, no se toca nada — ese contraste
// es el que protege al usuario sano, que es el 99% del tráfico que pasa por aquí.

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

// ─── El caso hermano: SÍ hay sesión, pero el cliente arrastra OTRA identidad ─────────────────

/** Qué hacer con el rastro pre-hidratado cuando la sesión sí trae usuario. */
export interface DecisionIdentidadAjena {
  /** ¿Hay que soltar el rastro pre-hidratado (perfil cacheado + blob legacy)? */
  descartar: boolean
  motivo:
    | 'sin_sesion' // no opina: de eso se encarga `decidirSesionFantasma`
    | 'sin_prehidratado' // no había nada del cliente que pudiera contaminar
    | 'coincide' // MISMA persona: no se toca nada (el contraste que protege al sano)
    | 'ajena' // el rastro es de OTRA identidad → soltarlo entero
}

/**
 * ¿El rastro que el cliente traía de `localStorage` es de esta misma persona?
 *
 * Se compara **el id que el cliente creía tener** (pre-hydrate) con **el que dice la sesión ya
 * verificada**. Solo cuando difieren se suelta, porque ahí no hay duda posible: el servidor ya
 * ha hablado y ha dicho otro nombre.
 *
 * Deliberadamente NO opina cuando no hay sesión: ese caso ya tiene dueño arriba, y dos criterios
 * sobre el mismo hecho no protegen el doble — se contradicen.
 */
export function decidirIdentidadAjena(e: {
  /** Id que el pre-hydrate sacó del rastro legacy de `localStorage` (o null si no había). */
  idPrehidratado: string | null | undefined
  /** Id de la sesión verificada por el servidor (o null si no hay sesión). */
  idSesion: string | null | undefined
}): DecisionIdentidadAjena {
  if (!e?.idSesion) return { descartar: false, motivo: 'sin_sesion' }
  if (!e?.idPrehidratado) return { descartar: false, motivo: 'sin_prehidratado' }
  if (e.idPrehidratado === e.idSesion) return { descartar: false, motivo: 'coincide' }
  return { descartar: true, motivo: 'ajena' }
}
