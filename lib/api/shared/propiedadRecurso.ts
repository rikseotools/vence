// lib/api/shared/propiedadRecurso.ts
//
// ¿Puede QUIEN LLAMA tocar este recurso? Núcleo puro, sin red ni Next.
//
// ## Por qué existe: una guarda que no distinguía «no eres tú» de «no sé quién eres» ([T-671])
//
// `requireDuenoDelRecurso` ([T-565]) protege los exámenes: con solo el UUID de un test ajeno se
// podía forzar su corrección. La comprobación es correcta y no se toca. Lo que estaba mal es que
// **colapsaba dos situaciones muy distintas en la misma respuesta**:
//
//   · el llamante ES otra persona            → 403, y es una señal de seguridad de verdad.
//   · el llamante NO TRAE IDENTIDAD NINGUNA  → también 403 «no tienes acceso a este recurso»,
//     etiquetado `auth_identidad_ajena_rechazada` con `motivo: 'recurso_ajeno'`.
//
// El segundo caso no es un intento de acceder a lo ajeno: es **su propio examen**, pedido por un
// cliente al que se le cayó el token. Medido el 07/08/2026 sobre el incidente: de las **195**
// rechazadas por «recurso ajeno» en 32 h, **195 llegaron sin identidad de llamante** — es decir,
// **ni una sola** era realmente de otra persona. Eso costó tres cosas a la vez:
//
//   1. **Al opositor:** hizo ocho exámenes de 25 preguntas y no pudo corregir ninguno, con un
//      aviso que le decía que revisara SU conexión (feedbacks `86071bf9` y `3bcbd41b`).
//   2. **Al diagnóstico:** la investigación de [T-671] descartó `auth_identidad_ajena_rechazada`
//      como pista porque «no aparece en user-stats»... y era justo el rastro del fallo, con el
//      nombre equivocado. Una señal que miente desvía más que una señal que falta.
//   3. **A la vigilancia:** un pico de identidad ajena es, por diseño, un indicio de abuso. Si
//      una caída de sesión lo dispara, el día que haya abuso de verdad nadie lo mirará.
//
// La regla nueva no permite NADA que antes se denegara: las tres salidas siguen denegando lo
// mismo. Lo único que cambia es **cómo se llama cada una**, que es lo que permite responder con
// la verdad («vuelve a entrar») en vez de con una conjetura («comprueba tu conexión»).
//
// Se separa en un módulo puro porque el criterio lo comparten la guarda del servidor y sus
// pruebas, y porque así se puede razonar sobre él sin levantar una petición.

export type VeredictoPropiedad =
  /** El recurso no tiene dueño (examen anónimo) o el dueño es quien llama. */
  | 'permitido'
  /** Hay dueño y quien llama no trae identidad: sesión caída, no intrusión. → 401 */
  | 'sin_identidad'
  /** Hay dueño, quien llama SÍ está identificado, y es otra persona. → 403 */
  | 'recurso_ajeno'

/**
 * @param duenoReal   Dueño según la BD (nunca el que afirme el cliente), o `null` si es anónimo.
 * @param callerUserId Identidad verificada del llamante, o `null` si no hay token válido.
 */
export function juzgarPropiedad(args: {
  duenoReal: string | null
  callerUserId: string | null
}): VeredictoPropiedad {
  const { duenoReal, callerUserId } = args
  // Sin dueño no hay nada que proteger: el examen se puede hacer sin cuenta, y ese caso ya
  // pasaba antes. Se comprueba PRIMERO para que un recurso anónimo nunca dependa de la sesión.
  if (duenoReal === null) return 'permitido'
  if (callerUserId === null) return 'sin_identidad'
  return duenoReal === callerUserId ? 'permitido' : 'recurso_ajeno'
}

/** ¿Este veredicto deja pasar? Un solo sitio decide, para que nadie invierta el booleano. */
export function dejaPasar(v: VeredictoPropiedad): boolean {
  return v === 'permitido'
}

/**
 * Código HTTP de cada denegación. **401 y 403 no son intercambiables aquí**: el cliente decide
 * con esto si te manda a volver a entrar (tu sesión) o si te dice que ese recurso no es tuyo.
 */
export function statusDe(v: Exclude<VeredictoPropiedad, 'permitido'>): 401 | 403 {
  return v === 'sin_identidad' ? 401 : 403
}
