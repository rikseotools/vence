// lib/tests/avisoDeCorreccion.ts
//
// Qué se le dice al opositor cuando la corrección de su examen no sale. Núcleo puro.
//
// ## Por qué existe ([T-671], 07/08/2026 — lo escribió un usuario, no una alerta)
//
// `ExamLayout` tenía UN solo aviso para CUALQUIER fallo:
//
//     alert('Error al enviar el examen. Comprueba tu conexión e inténtalo de nuevo.')
//
// Un usuario premium de tres días (`rbsc87`) hizo **ocho exámenes de 25 preguntas** y no pudo
// corregir ninguno. Lo que fallaba era su sesión (el cliente mandaba la petición sin token y el
// servidor la rechazaba), pero lo que leyó fue que revisara su conexión. Escribió, literalmente:
//
//     «lanza el mensaje de que no tengo conexión y hubo un problema con el envío de la
//      información cuando la conexión es perfecta»
//
// Dos daños, y el segundo es el caro: le hicimos **dudar de su equipo** —o sea, cargarle a él la
// culpa de un fallo nuestro— y le dejamos **sin la única acción que lo habría resuelto**, que
// era volver a entrar. Adivinar la causa y decirla en voz alta es peor que no decir ninguna: el
// aviso no era un detalle de redacción, era el callejón sin salida.
//
// Regla de la que sale este módulo: **si no sabemos la causa, no la nombramos.** «Comprueba tu
// conexión» solo se dice cuando el fallo ES de red (`ApiNetworkError` / timeout); en los demás
// casos se describe lo que sabemos y se ofrece qué hacer.
//
// El servidor ya manda el porqué en `reason` (ver `lib/api/shared/propiedadRecurso.ts`), así que
// esto no adivina: traduce.

export type CausaDeFalloDeCorreccion =
  /** La sesión no viaja o no vale: 401, o 403 con `reason: 'sin_identidad'`. */
  | 'sesion'
  /** Red caída o el servidor no contestó a tiempo. Aquí SÍ toca hablar de conexión. */
  | 'red'
  /** Contestó, y mal (5xx). No es del usuario y no se arregla reintentando a ciegas. */
  | 'servidor'
  /** El recurso es de otra persona. Raro de verdad, pero no se puede confundir con lo anterior. */
  | 'ajeno'
  /** No hay forma de saberlo. Se dice así, sin inventar. */
  | 'desconocida'

export interface AvisoDeCorreccion {
  causa: CausaDeFalloDeCorreccion
  titulo: string
  /** Texto para el usuario. NUNCA nombra una causa que no esté demostrada. */
  cuerpo: string
  /** Qué botón ofrecer. `reintentar` es la salida por defecto; `entrar` manda a la sesión. */
  accion: 'reintentar' | 'entrar' | 'ninguna'
  /**
   * ¿Le decimos que sus respuestas siguen a salvo? Sí siempre que el examen SEA SUYO: se
   * guarda respuesta a respuesta por `/api/exam/answer`, así que lo que falla es la
   * corrección, no el trabajo. Decírselo es la mitad del aviso — el miedo real del opositor
   * es haber perdido una hora, y es lo primero que hay que quitarle.
   *
   * La excepción es `ajeno`: ahí el examen no es de quien pregunta, y afirmarle que «sus»
   * respuestas están guardadas sería decirle algo que no sabemos. Lo destapó el test que
   * exigía la frase en las cinco causas: la afirmación estaba escrita como constante y en un
   * caso era falsa.
   */
  respuestasASalvo: boolean
}

/**
 * Clasifica el fallo a partir de lo que el cliente HTTP sabe.
 *
 * @param status  Código HTTP, o `null` si ni siquiera hubo respuesta (red/timeout).
 * @param reason  El `reason` que manda el servidor (`sin_identidad` | `recurso_ajeno`), si vino.
 * @param tipoDeError  `'TIMEOUT' | 'NETWORK' | 'HTTP' | 'OTRO'`, tal como lo clasifica el caller.
 */
export function causaDelFallo(args: {
  status?: number | null
  reason?: string | null
  tipoDeError?: 'TIMEOUT' | 'NETWORK' | 'HTTP' | 'OTRO'
}): CausaDeFalloDeCorreccion {
  const { status = null, reason = null, tipoDeError } = args
  if (tipoDeError === 'TIMEOUT' || tipoDeError === 'NETWORK') return 'red'
  // El `reason` manda sobre el código: un 403 puede ser sesión caída o recurso ajeno, y el
  // servidor es el único que lo sabe. Sin él se cae al código, que es lo que había antes.
  if (reason === 'sin_identidad') return 'sesion'
  if (reason === 'recurso_ajeno') return 'ajeno'
  if (status === 401) return 'sesion'
  // 403 sin `reason` (cliente viejo contra servidor nuevo, o al revés): se trata como sesión
  // porque es lo que resulta ser casi siempre —195 de 195 medidas en el incidente del 07/08— y
  // porque equivocarse hacia «vuelve a entrar» no le cuesta nada a quien de verdad pidió algo
  // ajeno, mientras que equivocarse al revés deja al dueño sin salida.
  if (status === 403) return 'sesion'
  if (status !== null && status >= 500) return 'servidor'
  if (status !== null) return 'desconocida'
  return tipoDeError === undefined ? 'desconocida' : 'red'
}

const AVISOS: Record<CausaDeFalloDeCorreccion, Omit<AvisoDeCorreccion, 'causa' | 'respuestasASalvo'>> = {
  sesion: {
    titulo: 'Tu sesión ha caducado',
    cuerpo:
      'No hemos podido corregir el examen porque tu sesión ya no está activa. Tus respuestas están ' +
      'guardadas: vuelve a entrar y podrás corregirlo.',
    accion: 'entrar',
  },
  red: {
    titulo: 'No hemos podido conectar',
    cuerpo:
      'No hemos conseguido enviar el examen para corregirlo. Tus respuestas están guardadas: ' +
      'comprueba tu conexión y vuelve a intentarlo.',
    accion: 'reintentar',
  },
  servidor: {
    titulo: 'El fallo es nuestro',
    cuerpo:
      'No hemos podido corregir el examen por un error de nuestro sistema. Tus respuestas están ' +
      'guardadas y no se pierden. Inténtalo de nuevo en unos minutos.',
    accion: 'reintentar',
  },
  ajeno: {
    titulo: 'Este examen no es de esta cuenta',
    cuerpo:
      'Este examen pertenece a otra cuenta, así que no podemos corregirlo desde aquí. Si crees ' +
      'que es tuyo, entra con la cuenta con la que lo empezaste.',
    accion: 'entrar',
  },
  desconocida: {
    titulo: 'No hemos podido corregir el examen',
    cuerpo:
      'Tus respuestas están guardadas y no se pierden. Vuelve a intentarlo; si sigue sin ' +
      'funcionar, escríbenos y lo miramos.',
    accion: 'reintentar',
  },
}

export function avisoDeCorreccion(causa: CausaDeFalloDeCorreccion): AvisoDeCorreccion {
  return { causa, ...AVISOS[causa], respuestasASalvo: causa !== 'ajeno' }
}
