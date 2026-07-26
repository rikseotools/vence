'use strict'
//
// spanishNumber — NÚCLEO PURO Y ÚNICO para convertir números de artículo escritos en
// letra ("Artículo primero", "ciento ochenta y siete bis") a dígitos.
//
// POR QUÉ VIVE AQUÍ Y EN JS PLANO (26/07/2026, T-132). Esta lógica estaba **copiada en
// cuatro sitios**: `lib/boeScrapingUtils.ts` (el original), dos scripts sueltos de la raíz
// y hasta su propio test, que empieza diciendo *"Copia de la función spanishTextToNumber
// del scraper"*. Copiar un parser es garantizar que las copias se separen: la del scraper
// llegaba solo hasta "trescientos", y por eso la Ley Orgánica 6/1985 del Poder Judicial
// —cuyos **713 de 713** bloques de artículo van en palabras y llegan a "setecientos
// trece"— quedaba entera fuera de cualquier auditoría contra el BOE. Peor: el barrido
// informaba "0 hallazgos" sin haber comprobado nada, que es un falso verde.
//
// Va en JS plano y no en TS para que puedan requerirlo TAMBIÉN los scripts `.cjs`
// (`boeBloqueVigente.js`, los auditores), que no pueden importar un `.ts`.
//
// Cubre 1-999, de sobra para el corpus (el artículo más alto, en LECrim, no llega a 1.000).

const ORDINALS = {
  primero: 1, primera: 1, segundo: 2, segunda: 2, tercero: 3, tercera: 3,
  cuarto: 4, cuarta: 4, quinto: 5, quinta: 5, sexto: 6, sexta: 6,
  'séptimo': 7, septimo: 7, 'séptima': 7, septima: 7, octavo: 8, octava: 8,
  noveno: 9, novena: 9, 'décimo': 10, decimo: 10,
}
const UNITS = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 }
const TEENS = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  'dieciséis': 16, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
}
const TWENTIES = {
  veinte: 20, veintiuno: 21, veintiuna: 21, 'veintidós': 22, veintidos: 22,
  'veintitrés': 23, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  'veintiséis': 26, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const TENS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
// Hasta 900: lo que le faltaba a la copia del scraper y dejaba ciega a la LOPJ.
const HUNDREDS = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
}
const RE_HUNDREDS = new RegExp('^(' + Object.keys(HUNDREDS).join('|') + ')(?:\\s+(.+))?$', 'i')

function convertPart(str) {
  str = String(str || '').toLowerCase().trim()
  if (ORDINALS[str]) return ORDINALS[str]
  if (UNITS[str]) return UNITS[str]
  if (TEENS[str]) return TEENS[str]
  if (TWENTIES[str]) return TWENTIES[str]
  if (TENS[str]) return TENS[str]
  const comp = str.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(\w+)$/i)
  if (comp) {
    const t = TENS[comp[1].toLowerCase()] || 0
    const u = UNITS[comp[2].toLowerCase()] || 0
    if (t && u) return t + u
  }
  if (HUNDREDS[str]) return HUNDREDS[str]
  return null
}

/**
 * "primero" → "1" · "ciento ochenta y siete bis" → "187 bis" · null si no es número.
 * Conserva el sufijo (bis, ter, quater…) porque `articles.article_number` lo guarda.
 *
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
function spanishTextToNumber(text) {
  if (!text) return null
  text = String(text).replace(/\.+$/, '').trim()
  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i)
  const mainText = (suffixMatch ? suffixMatch[1] : text).trim()
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : ''
  const normalized = mainText.toLowerCase().trim()

  const direct = convertPart(normalized)
  if (direct !== null) return suffix ? `${direct} ${suffix}` : String(direct)

  const h = normalized.match(RE_HUNDREDS)
  if (h) {
    const base = HUNDREDS[h[1].toLowerCase()] || 0
    if (h[2]) {
      const rest = convertPart(h[2])
      if (rest !== null) return suffix ? `${base + rest} ${suffix}` : String(base + rest)
      return null // "doscientos y pico" no es un número: mejor null que inventar
    }
    return suffix ? `${base} ${suffix}` : String(base)
  }
  return null
}

module.exports = { spanishTextToNumber, ORDINALS, UNITS, TEENS, TWENTIES, TENS, HUNDREDS }
