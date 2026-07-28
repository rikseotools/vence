/**
 * Núcleo puro: ¿esta acreditación SOSTIENE de verdad la fecha de un hito? (T-256, 28/07/2026)
 *
 * `degradar-origen-hito.cjs` cubría solo la mitad triste del problema: quitarle el sello de
 * oficial a una fecha que no consta. La otra mitad —la que cierra el hallazgo cuando la fecha
 * SÍ está publicada— era escribir `url` + `cita_literal` a mano, sin nada que impidiese pegar
 * la portada del boletín y dar el asunto por verificado. Eso es exactamente lo que el runbook
 * prohíbe: «NUNCA rellenar la cita con una URL genérica para callar el check», porque convierte
 * un dato dudoso en uno que PARECE verificado, que es peor que el problema.
 *
 * Aquí vive esa contención, en puro, para que la compartan el escritor y sus tests:
 *
 *   1. La URL tiene que apuntar a un DOCUMENTO, no a una portada ni a una sección.
 *   2. La cita tiene que **contener la fecha del hito**. Una cita que no nombra la fecha no
 *      prueba la fecha: es la diferencia entre «he mirado el boletín» y «el boletín lo dice».
 *   3. Un hito que se contradice a sí mismo (el título confiesa que es una previsión) NO se
 *      acredita: ahí lo que toca es degradar.
 *
 * Caso que lo estrenó: el examen del Cuerpo Administrativo de la Junta General del Principado
 * de Asturias (07/11/2026) estaba marcado como `registro` sin ninguna fuente, y resultó ser
 * CIERTO — lo fija el BOJG serie C núm. 116. Sin la regla 2, la misma operación habría admitido
 * una cita genérica sobre el proceso y habríamos "verificado" una fecha por casualidad.
 */

const { RE_TITULO_PREVISION } = require('./hitoOrigen.js')

const MESES = {
  1: ['enero', 'xaneiro', 'gener'],
  2: ['febrero', 'febreiro', 'febrer'],
  3: ['marzo', 'març'],
  4: ['abril'],
  5: ['mayo', 'maio', 'maig'],
  6: ['junio', 'xuño', 'juny'],
  7: ['julio', 'xullo', 'juliol'],
  8: ['agosto', 'agost'],
  9: ['septiembre', 'setiembre', 'setembro', 'setembre'],
  10: ['octubre', 'outubro'],
  11: ['noviembre', 'novembro', 'novembre'],
  12: ['diciembre', 'decembro', 'desembre'],
}

/** Rutas que son portada o sección, no documento. Es el patrón de "URL genérica". */
const RE_URL_DOCUMENTO = /\.(pdf|html?|docx?)($|\?)|\/documents?\/|\/documento|\/boletin|[0-9a-f]{8}-[0-9a-f]{4}-|\/\d{3,}/i

/** Las fechas se comparan por DÍA: la hora no dice nada aquí (columnas `date` vs `timestamptz`). */
function partesFecha(fecha) {
  const f = fecha instanceof Date ? fecha : new Date(fecha)
  if (Number.isNaN(f.getTime())) return null
  const iso = f.toISOString().slice(0, 10)
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d, iso }
}

/**
 * ¿La cita NOMBRA la fecha del hito? Acepta las formas en que los boletines la escriben:
 * "7 de noviembre de 2026", "07/11/2026", "7-11-2026", "2026-11-07" (y meses en gallego y
 * catalán, que es donde más se publica en lengua propia).
 */
function citaMencionaFecha(cita, fecha) {
  const p = partesFecha(fecha)
  if (!p || !cita) return false
  const t = String(cita).toLowerCase()
  if (t.includes(p.iso)) return true
  const dd = String(p.d).padStart(2, '0')
  const mm = String(p.m).padStart(2, '0')
  for (const sep of ['/', '-', '.']) {
    if (t.includes(`${p.d}${sep}${p.m}${sep}${p.y}`) || t.includes(`${dd}${sep}${mm}${sep}${p.y}`)) return true
  }
  for (const mes of MESES[p.m] || []) {
    // "7 de noviembre de 2026" y "7 de noviembre" (el año suele ir en la misma frase)
    const re = new RegExp(`\\b0?${p.d}\\s+(de\\s+|d[eo]\\s+)?${mes}\\b`, 'i')
    if (re.test(t)) return true
  }
  return false
}

/** ¿La URL apunta a un documento concreto y no a una portada o sección? */
function urlEsDocumento(url) {
  if (!url) return false
  let u
  try { u = new URL(String(url)) } catch { return false }
  if (!/^https?:$/.test(u.protocol)) return false
  const ruta = u.pathname.replace(/\/+$/, '')
  if (!ruta || ruta === '') return false
  return RE_URL_DOCUMENTO.test(ruta + u.search)
}

/**
 * Veredicto sobre una acreditación propuesta.
 * @returns {{ ok: boolean, motivo: string }}
 */
function validarAcreditacion({ hito, url, cita }) {
  if (!hito) return { ok: false, motivo: 'no hay hito' }
  if (RE_TITULO_PREVISION.test(hito.titulo || '')) {
    return { ok: false, motivo: 'el título confiesa que es una PREVISIÓN: esto se degrada, no se acredita' }
  }
  if (!urlEsDocumento(url)) {
    return { ok: false, motivo: 'la url no apunta a un documento (portada o sección genérica): no acredita nada' }
  }
  const texto = String(cita || '').trim()
  if (texto.length < 40) {
    return { ok: false, motivo: 'la cita literal es demasiado corta para ser una cita (mínimo 40 caracteres)' }
  }
  if (!citaMencionaFecha(texto, hito.fecha)) {
    return { ok: false, motivo: 'la cita NO menciona la fecha del hito: no prueba esa fecha' }
  }
  return { ok: true, motivo: 'la cita nombra la fecha y la url apunta al documento' }
}

module.exports = { validarAcreditacion, citaMencionaFecha, urlEsDocumento, MESES }
