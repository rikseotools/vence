/**
 * Detección de "CITA TRUNCADA" en preguntas IA-generadas.
 *
 * Modo de fallo (§2.2 del manual `generar-preguntas-con-ia.md`): la opción
 * correcta ES cita literal del artículo, pero está cortada JUSTO ANTES de la
 * cláusula que condiciona su alcance, convirtiendo en incondicional lo que la
 * ley matiza. Un check de subcadena a secas no lo ve.
 *
 * Caso que lo motivó (piloto ISD, batch `gen_isd_2026-07-20`, art. 3.1.c de la
 * Ley 29/1987): la cita paraba antes de «salvo los supuestos expresamente
 * regulados en el artículo 16.2, a), de la Ley del IRPF».
 *
 * Dos matices aprendidos a base de falsos positivos (batch
 * `gen_patrimonio_2026-07-20`), ambos cubiertos por los tests:
 *
 *  1. **Puntuación**: los `content` importados del BOE/BOC a veces pierden el
 *     punto final de un apartado. Eso NO es drift → la comparación de
 *     literalidad ignora `.,;:` (Ley 19/1991 art. 4.Cuatro).
 *  2. **Frontera de frase**: si la cita termina en punto, lo que viene después
 *     es una regla NUEVA, no una condición de lo citado. Sin este matiz,
 *     "cuando"/"no obstante" disparan en cualquier párrafo siguiente
 *     (Ley 19/1991 art. 5.Uno).
 */

const norm = (t) => String(t).replace(/[«»""'']/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

/** Igual que `norm` pero ignorando puntuación (para comparar literalidad). */
const strip = (t) => norm(t).replace(/[.,;:]/g, '')

/**
 * Cláusulas que, si siguen inmediatamente a la cita **dentro de la misma
 * frase**, alteran su alcance. Deliberadamente NO incluye "cuando" ni
 * "no obstante": son demasiado frecuentes como arranque de frase nueva.
 */
const CONTINUA = /^\s*[,;]\s*(salvo|excepto|sin perjuicio|siempre que|a menos que|así como|o aquellos|además de|junto con|y otras)/i

/**
 * @param {string} articulo Texto completo del artículo (`articles.content`).
 * @param {string} cita     Texto de la opción marcada como correcta.
 * @returns {{estado:'NO_LITERAL'|'TRUNCADA'|'OK', cola?:string}}
 */
function analizarCita(articulo, cita) {
  const artS = strip(articulo)
  const citaS = strip(cita)
  if (!citaS || artS.indexOf(citaS) < 0) return { estado: 'NO_LITERAL' }

  // El truncamiento se evalúa sobre el texto ORIGINAL (con puntuación), para
  // poder distinguir "…, salvo X" (condiciona) de "…. Cuando X" (frase nueva).
  const art = norm(articulo)
  const nc = norm(cita)
  const idx = art.indexOf(nc)
  if (idx < 0) return { estado: 'OK' } // literal salvo puntuación; nada que medir

  const cola = art.slice(idx + nc.length)
  if (/^\s*[.]/.test(cola)) return { estado: 'OK' } // frontera de frase
  if (CONTINUA.test(cola)) return { estado: 'TRUNCADA', cola: cola.trim().slice(0, 60) }
  return { estado: 'OK' }
}

module.exports = { analizarCita, norm, strip, CONTINUA }
