/**
 * ¿Esto es una pared del portal disfrazada de documento?
 *
 * Vivía dentro de `backend/scripts/clonar-documento.ts`, exportada «para testearla» — y nadie la
 * testeaba, porque el jest del backend tiene `rootDir: src` y jamás miró ahí. Se mueve aquí para que
 * la cubran tests de verdad; el script la importa.
 *
 * Guarda el corpus de la peor forma de basura: la que **tiene pinta de prueba**. Un captcha o un menú
 * clonados con su hash, su `curado` y su cita mienten mejor que un hueco vacío.
 */

/**
 * Marcadores de navegación de una SEDE ELECTRÓNICA. Son la señal de la pared, y se midió (27/07) que
 * son la ÚNICA que discrimina de verdad:
 *
 *   muestra                              nav   dispositivos ('acuerda', 'artículo', 'anexo I'…)
 *   pared de sede.madrid.es (11.306 ch)   3     4
 *   BOE real (policía municipal)          0     1
 *   BOA real (Aragón, 39.708 ch)          0     5
 *   BOCM real (Alcalá)                    0     2
 *
 * La lección está en la segunda columna: la hipótesis inicial —«es pared si NO habla como una norma»—
 * era **falsa y peligrosa**. La pared de una sede lista trámites, así que dice «acuerda», «artículo» y
 * «anexo I» MÁS veces que el propio BOE; usar eso como exención la habría blindado para siempre. Los
 * documentos reales, en cambio, no traen ni uno de estos marcadores de navegación: nacen de un
 * boletín, no de un portal.
 */
const NAV_SEDE = [
  'acceso al módulo',
  'lo más visto',
  'saltar al contenido',
  'mapa web',
  'buscador de trámites',
  'conozca la sede',
  'portal de transparencia',
  'búsqueda avanzada',
]

/** Cuántos marcadores hacen falta. Con 2 el margen es amplio: la pared medida tenía 3, los reales 0. */
const NAV_MINIMO = 2

/**
 * @returns el motivo si es una pared (para que el clonador lo DIGA), o `null` si parece un documento.
 */
export function esParedDelPortal(texto: string): string | null {
  const t = texto.slice(0, 4000).toLowerCase()
  if (/captcha|are you a robot|you are a bot|verifique que no es un robot/.test(t)) return 'captcha / anti-bot'
  if (/acceso denegado|access denied|forbidden|403 error/.test(t)) return 'acceso denegado'
  if (/demasiadas (peticiones|solicitudes)|too many requests|rate limit/.test(t)) return 'rate limit'

  // El chrome de un portal PEQUEÑO (el DOCM sin /portaldocm/ daba justo esto).
  if (texto.length < 4000 && /b[úu]squeda avanzada|mapa web|pol[íi]tica de cookies/.test(t)
      && !/resoluci[óo]n|decreto|orden|convoca|plazas/.test(t)) return 'chrome del portal (sin norma)'

  // El chrome de una sede GRANDE. Sin límite de tamaño y sin exención por vocabulario normativo:
  // las dos guardas de la regla anterior son justo las que dejaron pasar los 11 KB de sede.madrid.es
  // el 27/07 — se coló en el corpus como `oep_decreto` y hubo que borrarlo a mano.
  // Se mira el texto ENTERO, no los primeros 4.000: la navegación de una sede se reparte por toda la
  // página (cabecera, columna lateral, pie) y recortar se dejaba fuera media señal.
  const completo = texto.toLowerCase()
  const nav = NAV_SEDE.filter((m) => completo.includes(m))
  if (nav.length >= NAV_MINIMO) {
    return `chrome de sede electrónica (${nav.length} marcadores de navegación: ${nav.slice(0, 3).join(', ')})`
  }

  return null
}

export const _testing = { NAV_SEDE, NAV_MINIMO }
