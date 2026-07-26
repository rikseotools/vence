'use strict'
//
// reanclarGuardas — NÚCLEO PURO: decide si es seguro mover una pregunta de un artículo a
// otro (`questions.primary_article_id`).
//
// POR QUÉ EXISTE (26/07/2026, T-139). Re-anclar es la remediación más frecuente del
// contenido invisible por artículo inactivo escopado, y ya se ha hecho a mano tres veces
// en un solo día (LECrim → CP, Excel 365 viejo → temario nuevo, CP → CE). Cada vez con un
// script de usar y tirar, y cada vez con el mismo riesgo silencioso:
//
//   **cambiar el ancla puede sacar la pregunta del tema donde vivía.**
//
// Una pregunta se sirve en un tema si SU ARTÍCULO está en el `topic_scope` de ese tema
// (ver CLAUDE.md, "modelo NUCLEAR"). Así que mover el ancla a un artículo que no está
// escopado en los mismos temas **no rescata la pregunta: la cambia de sitio, y puede
// dejarla huérfana**. Es el fallo perfecto: el detector `scope_phantom_article` se apaga
// (el artículo viejo deja de tener preguntas), el informe dice "rescatadas N preguntas",
// y el opositor sigue sin verlas. Este núcleo lo impide antes de escribir en la BD.
//
// Es PURO a propósito: recibe los datos ya leídos y devuelve un veredicto. Así el mismo
// juicio se puede testear con casos reales sin BD, y lo puede reutilizar cualquier script
// de remediación (que es justo lo que no pasaba con las versiones de usar y tirar).

/** Normaliza para comparar textos legales: sin acentos, sin puntuación, sin espacios. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Relación entre el texto del artículo de origen y el de destino.
 *
 * `contenido` → el texto del origen está ÍNTEGRO dentro del destino. Es el caso más
 *               seguro: el fragmento era una copia parcial del artículo padre (RD
 *               1708/2011 «2.2» dentro del art. 2).
 * `solapa`    → comparten un tramo largo pero no íntegro. Suele ser reformateo editorial.
 * `ninguno`   → no comparten texto. NO es motivo para bloquear: hay reanclas legítimas
 *               sin solapamiento (una pregunta de ESTRUCTURA de la norma que pasa al
 *               art. 0, o una glosa editorial que se lleva al artículo oficial). Pero sí
 *               es motivo para exigir que alguien haya mirado el destino.
 *
 * @param {string|null} contenidoOrigen
 * @param {string|null} contenidoDestino
 * @returns {'contenido'|'solapa'|'ninguno'}
 */
function relacionContenido(contenidoOrigen, contenidoDestino) {
  const o = normalizar(contenidoOrigen)
  const d = normalizar(contenidoDestino)
  if (!o || !d) return 'ninguno'
  if (d.includes(o)) return 'contenido'
  // Tramo del medio: evita que un encabezado común ("alosefectosdeestaley…") dé un falso
  // positivo de solapamiento. 120 caracteres normalizados son ~2 líneas de texto legal.
  if (o.length >= 200) {
    const tramo = o.slice(Math.floor(o.length * 0.25), Math.floor(o.length * 0.25) + 120)
    if (tramo.length >= 60 && d.includes(tramo)) return 'solapa'
  }
  return 'ninguno'
}

/**
 * ¿Es seguro re-anclar esta pregunta?
 *
 * @param {object} p
 * @param {{id:string, articulo:string, ley:string, contenido?:string|null}} p.origen
 * @param {{id:string, articulo:string, ley:string, contenido?:string|null, activo:boolean}} p.destino
 * @param {string[]} p.temasOrigen  claves `position_type/Tn` donde se sirve HOY el origen
 * @param {string[]} p.temasDestino claves donde se sirve el destino
 * @param {boolean} [p.permitirPerdidaTemas=false] la pérdida de temas es intencionada
 * @param {string|null} [p.motivoPerdida=null] por qué es intencionada (obligatorio si lo anterior)
 * @returns {{ok:boolean, bloqueos:string[], avisos:string[], temasPerdidos:string[],
 *            temasGanados:string[], relacion:'contenido'|'solapa'|'ninguno'}}
 */
function evaluarReancla(p) {
  const bloqueos = []
  const avisos = []
  const origen = p.origen || {}
  const destino = p.destino || {}
  const temasOrigen = Array.isArray(p.temasOrigen) ? p.temasOrigen : []
  const temasDestino = Array.isArray(p.temasDestino) ? p.temasDestino : []

  if (!destino.id) bloqueos.push('el artículo de destino no existe')
  if (destino.id && origen.id && destino.id === origen.id) bloqueos.push('origen y destino son el mismo artículo')

  // 1. Un destino inactivo NO se sirve, por muy escopado que esté: la pregunta seguiría
  //    invisible y el trabajo daría un falso "arreglado".
  if (destino.id && destino.activo === false) {
    bloqueos.push(`el destino (${destino.ley} art. ${destino.articulo}) está INACTIVO: la pregunta seguiría sin servirse`)
  }

  // 2. Un destino sin ningún topic_scope activo deja la pregunta huérfana. Es peor que el
  //    estado de partida, porque además desaparece del detector.
  if (destino.id && temasDestino.length === 0) {
    bloqueos.push(`el destino (${destino.ley} art. ${destino.articulo}) no está en ningún topic_scope activo: la pregunta quedaría huérfana`)
  }

  // 3. Temas que se pierden. A veces perder temas es LO CORRECTO (una pregunta de la CE
  //    anclada por error a un artículo del CP con el mismo número no pinta en un tema de
  //    Código Penal), pero tiene que decirse en voz alta y por escrito.
  const temasPerdidos = temasOrigen.filter((t) => !temasDestino.includes(t))
  const temasGanados = temasDestino.filter((t) => !temasOrigen.includes(t))
  if (temasPerdidos.length) {
    if (!p.permitirPerdidaTemas) {
      bloqueos.push(`la pregunta dejaría de servirse en ${temasPerdidos.length} tema(s): ${temasPerdidos.join(', ')}`)
    } else if (!String(p.motivoPerdida || '').trim()) {
      bloqueos.push('se permite perder temas pero no se ha escrito el motivo')
    } else {
      avisos.push(`pierde ${temasPerdidos.length} tema(s) A PROPÓSITO: ${p.motivoPerdida}`)
    }
  }

  // 4. Sin parentesco textual, el destino es una decisión de criterio, no una deducción.
  const relacion = relacionContenido(origen.contenido, destino.contenido)
  if (relacion === 'ninguno') {
    avisos.push('el destino NO contiene el texto del origen: el ancla se sostiene en criterio (verificar que el artículo destino explica la materia de la pregunta)')
  }

  return { ok: bloqueos.length === 0, bloqueos, avisos, temasPerdidos, temasGanados, relacion }
}

module.exports = { evaluarReancla, relacionContenido, normalizar }
