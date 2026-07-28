// lib/exam/reloj.ts
//
// Reloj y navegación del MODO EXAMEN. Lógica PURA (sin React, sin DOM) para poder testearla
// aislada: el resto del modo examen es un componente grande y estas reglas —qué tiempo queda,
// cuándo avisar, a qué pregunta saltar— son justo las que no pueden fallar en mitad de un examen.
//
// Nace del feedback de Manolo (premium, Diputación de Córdoba, 28/07/2026):
//   «me gustaría acceder directamente a las que voy dejando en blanco una vez que haya dado la
//    primera vuelta sin tener que ir ascendiendo. Por otro lado, ¿se puede ir viendo el tiempo que
//    va quedando? el reloj se queda arriba y una vez que pasas de la primera pregunta dejas de verlo»
//
// Las dos cosas eran ciertas: el reloj vivía en un bloque estático arriba del todo y las 50
// preguntas son una lista larga sin forma de saltar a las que faltan.
//
// DECISIÓN IMPORTANTE sobre "el tiempo que queda": nuestros exámenes de tema **no tienen límite
// oficial**. El cronómetro solo sumaba. Inventarse una duración y presentarla como la del examen
// real sería mentir al opositor, así que la cuenta atrás va contra un **objetivo del propio
// usuario** (editable, con un defecto de 1 minuto por pregunta) y en la UI se llama "objetivo",
// nunca "tiempo oficial". Si algún día tenemos la duración real por convocatoria, este mismo
// módulo la acepta sin cambios: solo cambia de dónde sale `objetivoSeg`.

/** Segundos → "m:ss" (o "h:mm:ss" si pasa de la hora). Formato ÚNICO del modo examen. */
export function formatearTiempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos || 0))
  const horas = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (horas > 0) return `${horas}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Minutos por pregunta del objetivo por defecto. Ritmo de examen habitual, no dato oficial. */
export const MINUTOS_POR_PREGUNTA_DEFECTO = 1

/** Límites del objetivo editable: ni 0 (cuenta atrás inútil) ni valores absurdos. */
export const OBJETIVO_MIN_MINUTOS = 1
export const OBJETIVO_MAX_MINUTOS = 600

/** Objetivo por defecto en segundos para un examen de N preguntas. */
export function objetivoPorDefectoSeg(totalPreguntas: number): number {
  const n = Math.max(1, Math.floor(totalPreguntas || 0))
  return n * MINUTOS_POR_PREGUNTA_DEFECTO * 60
}

/** Encaja un objetivo (en minutos) dentro de los límites. Tolera basura (NaN, negativos, texto). */
export function clampObjetivoMinutos(minutos: unknown, porDefecto: number): number {
  // `null`/`''` se descartan ANTES de convertir: `Number(null)` y `Number('')` son 0, así que un
  // valor AUSENTE (localStorage vacío o borrado) acabaría encajado en el mínimo —1 minuto para un
  // examen de 50 preguntas— en vez de caer al objetivo por defecto. Ausente ≠ cero.
  if (minutos === null || minutos === undefined || minutos === '') return porDefecto
  const n = typeof minutos === 'number' ? minutos : Number(minutos)
  if (!Number.isFinite(n)) return porDefecto
  return Math.min(OBJETIVO_MAX_MINUTOS, Math.max(OBJETIVO_MIN_MINUTOS, Math.round(n)))
}

/**
 * Tiempo que queda para el objetivo. Puede ser NEGATIVO a propósito: pasarse del objetivo no
 * detiene nada (no es un examen con corte), pero el usuario debe VERLO. Devolver 0 escondería
 * justo el dato que le interesa a quien entrena ritmo.
 */
export function tiempoRestanteSeg(objetivoSeg: number, transcurridoSeg: number): number {
  return Math.floor((objetivoSeg || 0) - Math.max(0, transcurridoSeg || 0))
}

export type EstadoReloj = 'normal' | 'aviso' | 'agotado'

/**
 * Estado del reloj para el color. `aviso` en el último 10 % del objetivo (mínimo 60 s, para que
 * en exámenes cortos el aviso siga siendo útil); `agotado` al pasarse.
 */
export function estadoReloj(objetivoSeg: number, transcurridoSeg: number): EstadoReloj {
  const restante = tiempoRestanteSeg(objetivoSeg, transcurridoSeg)
  if (restante <= 0) return 'agotado'
  const umbral = Math.max(60, Math.floor((objetivoSeg || 0) * 0.1))
  return restante <= umbral ? 'aviso' : 'normal'
}

/**
 * Índice de la siguiente pregunta SIN responder, empezando DESPUÉS de `desde` y dando la vuelta
 * al llegar al final. Devuelve `null` si no queda ninguna en blanco.
 *
 * La vuelta es lo que hace útil el botón: el usuario lo pulsa al final de la primera pasada, que
 * es justo cuando las que faltan quedaron ARRIBA. Sin dar la vuelta, el botón no haría nada
 * precisamente en el momento en que se necesita — que es el caso que reportó Manolo.
 */
export function siguienteEnBlanco(
  respuestas: Record<number, string | undefined | null> | Array<string | undefined | null>,
  total: number,
  desde: number,
): number | null {
  const n = Math.max(0, Math.floor(total || 0))
  if (n === 0) return null
  const respondida = (i: number) => {
    const v = Array.isArray(respuestas) ? respuestas[i] : respuestas?.[i]
    return typeof v === 'string' && v.trim() !== ''
  }
  const inicio = Number.isFinite(desde) ? Math.floor(desde) : -1
  for (let paso = 1; paso <= n; paso++) {
    const i = (((inicio + paso) % n) + n) % n
    if (!respondida(i)) return i
  }
  return null
}

/**
 * Igual que `siguienteEnBlanco` pero hacia ATRÁS: la anterior sin responder, dando la vuelta
 * por el final. Con un solo sentido, pasarse de la que buscabas obligaba a dar la vuelta
 * entera al examen para volver a ella.
 */
export function anteriorEnBlanco(
  respuestas: Record<number, string | undefined | null> | Array<string | undefined | null>,
  total: number,
  desde: number,
): number | null {
  const n = Math.max(0, Math.floor(total || 0))
  if (n === 0) return null
  const respondida = (i: number) => {
    const v = Array.isArray(respuestas) ? respuestas[i] : respuestas?.[i]
    return typeof v === 'string' && v.trim() !== ''
  }
  const inicio = Number.isFinite(desde) ? Math.floor(desde) : 0
  for (let paso = 1; paso <= n; paso++) {
    const i = (((inicio - paso) % n) + n) % n
    if (!respondida(i)) return i
  }
  return null
}

/**
 * Índice de la pregunta que el usuario está MIRANDO (la más centrada en pantalla), o `null` si
 * no hay ninguna medible.
 *
 * Es el punto de partida natural de "siguiente/anterior en blanco": el cursor tiene que ser
 * dónde estás, no la última que tocaste. Lo cazó la simulación (28/07): en un examen recién
 * abierto, sin nada respondido, el cursor valía -1 y el primer "›" mandaba a la pregunta 1 —
 * o sea, de vuelta al principio del examen.
 */
export function indiceMasCentrado(
  elementos: Array<{ index: number; top: number; height: number }>,
  altoViewport: number,
): number | null {
  if (!elementos.length || !Number.isFinite(altoViewport) || altoViewport <= 0) return null
  const centro = altoViewport / 2
  let mejor: { index: number; d: number } | null = null
  for (const e of elementos) {
    if (!Number.isFinite(e.top) || !Number.isFinite(e.height)) continue
    const d = Math.abs(e.top + e.height / 2 - centro)
    if (!mejor || d < mejor.d) mejor = { index: e.index, d }
  }
  return mejor ? mejor.index : null
}

/** Cuántas quedan en blanco (para el contador de la barra). */
export function cuantasEnBlanco(
  respuestas: Record<number, string | undefined | null> | Array<string | undefined | null>,
  total: number,
): number {
  const n = Math.max(0, Math.floor(total || 0))
  let faltan = 0
  for (let i = 0; i < n; i++) {
    const v = Array.isArray(respuestas) ? respuestas[i] : respuestas?.[i]
    if (!(typeof v === 'string' && v.trim() !== '')) faltan++
  }
  return faltan
}
