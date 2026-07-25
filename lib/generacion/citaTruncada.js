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
 * Truncamiento por la CABEZA: la cláusula condicionante va DELANTE de la cita,
 * intercalada entre comas, y la cita empieza justo después. El corte de cola no
 * lo ve porque mira lo que viene detrás.
 *
 * Caso que lo motivó (batch `gen_atc_t205_2026-07-25`, art. 63.3 LGT): el
 * artículo dice «la Administración tributaria, **salvo lo dispuesto en el
 * apartado siguiente**, aplicará el pago a la deuda más antigua» y la opción
 * arrancaba en «Aplicará el pago a la deuda más antigua», presentando como
 * incondicional una regla que cede ante el apartado 4. Subcadena literal
 * perfecta, cola limpia (un punto), sentido alterado. Lo cazó la auditoría
 * ciega; ahora lo caza la regex.
 *
 * Exige que el inciso esté CERRADO por coma justo antes de la cita: eso es lo
 * que lo distingue de una cita que simplemente empieza en mitad de una frase.
 */
const PRECEDE = /,\s*(salvo|excepto|sin perjuicio de|siempre que|a menos que)\b[^,.;]*,\s*$/i

/**
 * @param {string} articulo Texto completo del artículo (`articles.content`).
 * @param {string} cita     Texto de la opción marcada como correcta.
 * @returns {{estado:'NO_LITERAL'|'TRUNCADA'|'OK', cola?:string, lado?:'cola'|'cabeza'}}
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

  // (a) Truncamiento por la CABEZA: inciso condicionante cerrado por coma
  //     justo antes de donde arranca la cita.
  const cabeza = art.slice(0, idx)
  const mPre = cabeza.match(PRECEDE)
  if (mPre) return { estado: 'TRUNCADA', lado: 'cabeza', cola: mPre[0].trim().replace(/^,\s*/, '').replace(/,$/, '').slice(0, 60) }

  // (b) Truncamiento por la COLA: la cita corta antes de la cláusula que la condiciona.
  const cola = art.slice(idx + nc.length)
  if (/^\s*[.]/.test(cola)) return { estado: 'OK' } // frontera de frase
  if (CONTINUA.test(cola)) return { estado: 'TRUNCADA', lado: 'cola', cola: cola.trim().slice(0, 60) }
  return { estado: 'OK' }
}


/** Palabras significativas normalizadas (sin tildes, sin signos, >3 chars). */
function palabrasSignificativas(t) {
  return new Set(
    String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3),
  )
}

/**
 * ¿La cláusula que `analizarCita` señala como truncada está YA en el enunciado?
 *
 * Regla de §2.2: "cláusula ya presente en el enunciado, omitida en la opción" es
 * CONDENSACIÓN VÁLIDA, no defecto. `analizarCita` solo recibe artículo y opción, así que
 * no puede saberlo y marca TRUNCADA por la cabeza. Quien tenga el enunciado a mano —el
 * verificador de batch y el simulador pre-inserción— debe consultar esto antes de fallar.
 *
 * Sin esta salvedad se penaliza el patrón CORRECTO (poner el inciso condicionante en la
 * pregunta: "Salvo que la legislación autonómica prevea otra cosa, …") y se empuja a
 * duplicar la cláusula en las cuatro opciones, que es peor.
 *
 * Se compara por PALABRAS y no por subcadena porque el enunciado suele reformular
 * levemente el inciso; umbral alto (80%) para no absolver truncamientos reales.
 *
 * @param {string} clausula fragmento devuelto por `analizarCita` en `cola`
 * @param {string} enunciado `question_text` de la pregunta
 * @returns {boolean}
 */
function clausulaEnEnunciado(clausula, enunciado) {
  const C = palabrasSignificativas(clausula)
  if (C.size < 3) return false
  const E = palabrasSignificativas(enunciado)
  let hit = 0
  for (const w of C) if (E.has(w)) hit++
  return hit / C.size >= 0.8
}

module.exports = { analizarCita, clausulaEnEnunciado, palabrasSignificativas, norm, strip, CONTINUA, PRECEDE }
