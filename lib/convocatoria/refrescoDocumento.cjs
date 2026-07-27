/**
 * ¿Debe un re-clonado REEMPLAZAR el texto que ya hay en el corpus?
 *
 * NÚCLEO PURO. Nace de un falso verde con daño medido (27/07): `ensure_convocatoria_documento`
 * enriquece "sin pisar" — `extracted_text = COALESCE(NULLIF(extracted_text,''), nuevo)` — así que un
 * documento que YA tiene texto nunca lo mejora. La política es correcta (un re-clonado que devuelve el
 * menú del portal no debe destruir un texto bueno), pero `clonar-documento.ts` imprimía
 * «✅ clonado y CURADO: 3 KB» igualmente, sin haber cambiado nada.
 *
 * El daño: el 17/07 una sesión clonó el txt.php del BOE del Ayuntamiento de Madrid —que SÍ trae la
 * ficha de análisis con «Turno libre: … 561 plazas»— vio el ✅, y firmó en `convocatoria_verification`
 * que «561 PROBADO … clonada además la versión txt.php, que sí trae la ficha». En BD seguía el texto
 * viejo de 1.864 caracteres sin el 561. La verificación quedó en verde apoyada en una prueba que no
 * existía; lo destapó el detector `plazas_afirmadas_sin_documento` diez días después.
 *
 * Decidir esto es lo único que tiene criterio, así que vive aparte y se testea sin BD ni red.
 */

/** Un texto sensiblemente más largo suele ser "el documento entero" frente a "un trozo". */
const MEJORA_MINIMA = 1.15

/**
 * @param {string|null|undefined} actual   texto que hay en BD
 * @param {string|null|undefined} nuevo    texto recién extraído de la fuente
 * @param {{forzar?: boolean}} [opts]      `forzar`: el operador lo pide explícitamente
 * @returns {{accion:'insertar'|'reemplazar'|'conservar', motivo:string}}
 */
function decidirRefresco(actual, nuevo, opts = {}) {
  const a = (actual || '').trim()
  const n = (nuevo || '').trim()

  if (!n) return { accion: 'conservar', motivo: 'la extracción nueva vino vacía: no se toca nada' }
  if (!a) return { accion: 'insertar', motivo: 'no había texto en el corpus' }
  if (a === n) return { accion: 'conservar', motivo: 'el texto es idéntico al que ya estaba' }

  if (opts.forzar) {
    return {
      accion: 'reemplazar',
      motivo: `reemplazo forzado por el operador (${a.length} → ${n.length} caracteres)`,
    }
  }

  // Sin --forzar solo se reemplaza cuando la mejora es evidente: el texto nuevo CONTIENE al viejo
  // (es el mismo documento con más cuerpo — el caso de la ficha de análisis del BOE) o lo supera
  // holgadamente. Un texto nuevo MÁS CORTO es la firma de haber capturado el menú del portal, y ese
  // es justo el accidente que la política "no pisar" existe para evitar.
  if (n.includes(a)) {
    return {
      accion: 'reemplazar',
      motivo: `el texto nuevo contiene al anterior y lo amplía (${a.length} → ${n.length} caracteres)`,
    }
  }
  if (n.length >= a.length * MEJORA_MINIMA) {
    return {
      accion: 'reemplazar',
      motivo: `el texto nuevo es sustancialmente más completo (${a.length} → ${n.length} caracteres)`,
    }
  }
  return {
    accion: 'conservar',
    motivo:
      `ya había texto y el nuevo NO es mejor (${a.length} → ${n.length} caracteres): ` +
      'podría ser el menú del portal en vez del documento. Usa --refrescar-texto si de verdad quieres reemplazarlo',
  }
}

module.exports = { decidirRefresco, MEJORA_MINIMA }
