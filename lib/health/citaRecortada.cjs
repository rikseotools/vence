'use strict'
/**
 * Una cita de blockquote puede ser LITERAL y estar mal.
 *
 * El criterio de literalidad de la casa (`citaNoLiteral`, en el validador de impugnaciones) responde
 * a «¿este texto está en el artículo?». Esta función responde a la otra mitad: «¿está ENTERO lo que
 * hacía falta?». Son preguntas distintas y la segunda no la cubría nadie.
 *
 * ## Los tres modos, cada uno pagado por separado (T-409, 02-03/08/2026)
 *
 * 1. **Por el FINAL** — la cita se corta a mitad de frase y a veces deja fuera justo la palabra que
 *    decide la respuesta: «diez días» sin «naturales», «responderán de forma solidaria» sin su
 *    condicional. Lo señaló la re-verificación independiente 5 veces antes de existir el control; al
 *    añadirlo aparecieron 7 más que nadie había mirado.
 * 2. **Por el PRINCIPIO** — arranca a mitad de oración y pierde el sujeto y el verbo: «propuestas al
 *    empresario…» por «Los trabajadores tendrán derecho a efectuar propuestas al empresario…». El
 *    control del final no lo veía: son extremos distintos del mismo defecto, y el gate escrito a
 *    partir de UN caso solo cubre ese caso.
 * 3. **Por quedarse EN LA PUERTA** — acaba en dos puntos, justo antes de la enumeración que prueba
 *    la clave: «…adoptará las medidas necesarias con el fin de que:». Formalmente cierra, y por eso
 *    el gate lo daba por bueno EXPLÍCITAMENTE. Medido: 12 de 256 citas estaban así.
 *
 * Y un cuarto que no es de recorte sino de honestidad: el **punto final AÑADIDO**, donde el artículo
 * tenía una coma y seguía con una salvedad. Formalmente cerrada, materialmente cortada.
 *
 * ## La regla que generaliza
 *
 * Comprobar la FORMA del recorte no dice nada si esa forma la produce el propio recortador. Por eso
 * todo lo que se puede, se comprueba **contra el artículo** y no contra el aspecto de la cita.
 *
 * Ninguno BLOQUEA: hay recortes legítimos —un encabezado que sí contiene la respuesta, una cita que
 * empieza en minúscula por diseño—. Avisan, que es lo que corresponde a un criterio con excepciones.
 */

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim()

/**
 * @param {string} citaTexto  el texto del blockquote
 * @param {string} articulo   el contenido íntegro del artículo vinculado
 * @returns {Array<{modo: string, detalle: string}>} avisos; vacío si la cita está bien recortada
 */
function diagnosticaRecorte(citaTexto, articulo) {
  const avisos = []
  const t = String(citaTexto || '').trim()
  if (!t) return avisos

  // 1. Por el final: no cierra la frase.
  if (!/[.:»"]$/.test(t)) avisos.push({ modo: 'no_cierra', detalle: '…' + t.slice(-70) })

  // 2. Por el principio: arranca en minúscula, o sea a mitad de oración.
  if (/^[a-záéíóúñ]/.test(t)) avisos.push({ modo: 'arranca_en_minuscula', detalle: t.slice(0, 70) + '…' })

  const art = norm(articulo)
  const cuerpo = norm(t.replace(/[.:»"]$/, ''))
  const pos = art.indexOf(cuerpo)

  // 3. Se queda en la puerta: dos puntos con la enumeración detrás, fuera de la cita.
  if (/:$/.test(t) && pos >= 0) {
    const cola = art.slice(pos + cuerpo.length + 1, pos + cuerpo.length + 80)
    if (/\b[a-z]\)/.test(cola)) {
      avisos.push({ modo: 'enumeracion_fuera', detalle: `deja fuera: "${cola.trim()}…" — ¿sostiene la clave?` })
    }
  }

  // 4. Punto AÑADIDO: el texto acaba en cierre pero el artículo continuaba la frase.
  //    Se exige un mínimo de longitud para no opinar sobre fragmentos ambiguos.
  if (pos >= 0 && cuerpo.length > 30 && /[.:»"]$/.test(t)) {
    const siguiente = art.slice(pos + cuerpo.length, pos + cuerpo.length + 1)
    if (siguiente && !/[.:»")\]]/.test(siguiente)) {
      avisos.push({
        modo: 'cierre_anadido',
        detalle: `el signo final es AÑADIDO; en el artículo sigue: "${art.slice(pos + cuerpo.length, pos + cuerpo.length + 60)}…"`,
      })
    }
  }

  return avisos
}

module.exports = { diagnosticaRecorte }
