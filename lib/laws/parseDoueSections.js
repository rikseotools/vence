/**
 * lib/laws/parseDoueSections.js — NÚCLEO PURO: estructura (capítulos) de una norma EUROPEA
 * a partir del texto del documento que el BOE publica como espejo del DOUE.
 *
 * ## Por qué existe (30/07/2026)
 *
 * `parseBoeSections` lee el ÍNDICE de la API de legislación consolidada del BOE, que solo
 * cubre derecho español: con un id `DOUE-L-…` responde «Identificador no válido». Por eso
 * las normas europeas se quedaron fuera del poblador de secciones ([T-228]) y siguen
 * sirviéndose como una lista plana de artículos.
 *
 * La que más pesa es el **RGPD**: 99 artículos, 222 preguntas y presencia en **49 temas de
 * 49 oposiciones distintas**. Sin capítulos, el botón «📚 Títulos» del configurador no
 * aparece y no se puede montar un test de, por ejemplo, solo los derechos del interesado.
 * Salió al atender a un usuario premium que pedía exactamente eso: estudiar por partes.
 *
 * La vía es el documento del BOE (`/buscar/doc.php?id=DOUE-L-…`), que trae el texto íntegro
 * con sus rúbricas. Aquí solo vive el PARSEO; la red la hace el llamante, igual que en el
 * módulo hermano.
 *
 * ## Lo que este parser NO da por hecho
 *
 * El aviso de [T-228] es que estos documentos pueden traer el ÍNDICE repetido antes del
 * cuerpo (pasa con el de los Tratados, que además junta TUE y TFUE). Un índice delante
 * emparejaría cada capítulo con un artículo que no le toca. Por eso:
 *
 *  - los artículos iniciales tienen que ser **estrictamente crecientes**; si no, se
 *    devuelve `motivo:'orden_no_creciente'` y no se inventa nada;
 *  - un número de capítulo **repetido** invalida el resultado (`'capitulo_duplicado'`), que
 *    es la firma de un índice duplicado;
 *  - el cierre de cada capítulo lo marca el siguiente, y el último lo cierra el mayor
 *    artículo visto. Nunca se extrapola más allá del texto.
 *
 * Y la estructura de una norma es contenido legal: esto propone, no publica. Quien aplique
 * debe validar los rangos contra los artículos que existen de verdad (`validarSecciones`).
 */

const ROMANO_RE = '[IVXLCDM]+'

/** Un capítulo que abre sección. Se exige la línea COMPLETA para no casar una cita. */
const RE_CAPITULO = new RegExp(`^CAP[IÍ]TULO\\s+(${ROMANO_RE})\\.?$`, 'i')

/** Cabecera de artículo. El DOUE numera «Artículo 5» sin punto ni sufijos de letra. */
const RE_ARTICULO = /^Art[íi]culo\s+(\d+)\b/i

/**
 * @param {string[]} lineas  texto del documento, ya sin etiquetas, una línea por párrafo
 * @returns {{tipo:'capitulo', secciones:{num:string,rubrica:string|null,from:number,to:number}[], motivo?:string}}
 */
function parseDoueSections(lineas) {
  const limpias = (lineas || []).map((l) => String(l || '').trim()).filter(Boolean)

  const capitulos = [] // { num, rubrica, from }
  let abierto = null
  let maxArticulo = 0

  for (const linea of limpias) {
    const mc = linea.match(RE_CAPITULO)
    if (mc) {
      abierto = { num: mc[1].toUpperCase(), rubrica: null, from: null }
      capitulos.push(abierto)
      continue
    }

    const ma = linea.match(RE_ARTICULO)
    if (ma) {
      const n = Number(ma[1])
      if (n > maxArticulo) maxArticulo = n
      if (abierto && abierto.from === null) abierto.from = n
      continue
    }

    // Entre el encabezado del capítulo y su primer artículo va su rúbrica (la materia).
    // Se coge la primera línea con aspecto de título, no cualquier texto suelto.
    if (abierto && abierto.from === null && abierto.rubrica === null) {
      if (linea.length >= 3 && linea.length <= 200) abierto.rubrica = linea
    }
  }

  // Un capítulo SIN artículos detrás no aporta rango y se descarta sin más. Esto no es una
  // concesión: es el caso normal de los ANEXOS, que en los reglamentos europeos traen su
  // propia numeración de capítulos y se organizan por apartados, no por artículos. El
  // Reglamento 852/2004 tiene capítulos I-V en el articulado y otros I-VII en los anexos;
  // tratar aquello como «documento duplicado» dejaba fuera una norma perfectamente
  // estructurada. Un índice repetido delante del cuerpo cae aquí también, y por el mismo
  // motivo: sus capítulos no llevan artículos detrás.
  const conArticulos = capitulos.filter((c) => c.from !== null)
  if (!conArticulos.length) return { tipo: 'capitulo', secciones: [], motivo: 'sin_capitulos' }

  // Lo que sí es señal de documento mal emparejado: el MISMO capítulo apareciendo dos veces
  // CON artículos. Pasa cuando el índice de cabecera enumera también los artículos, o
  // cuando el documento junta dos normas (el caso TUE+TFUE que avisa [T-228]). Ahí no se
  // adivina cuál es el bueno: se rechaza entero.
  const numeros = conArticulos.map((c) => c.num)
  if (new Set(numeros).size !== numeros.length) {
    return { tipo: 'capitulo', secciones: [], motivo: 'capitulo_duplicado' }
  }

  // Los inicios tienen que avanzar. Si retroceden, el emparejamiento capítulo→artículo está
  // desalineado (típico del índice delante) y cualquier rango sería inventado.
  for (let i = 1; i < conArticulos.length; i++) {
    if (conArticulos[i].from <= conArticulos[i - 1].from) {
      return { tipo: 'capitulo', secciones: [], motivo: 'orden_no_creciente' }
    }
  }

  const secciones = conArticulos.map((c, i) => ({
    num: c.num,
    rubrica: c.rubrica,
    from: c.from,
    // Cierra el siguiente capítulo; el último, el artículo más alto que aparece en el texto.
    to: i + 1 < conArticulos.length ? conArticulos[i + 1].from - 1 : maxArticulo,
  }))

  return { tipo: 'capitulo', secciones }
}

/** Texto plano por líneas a partir del HTML del documento del BOE. */
function lineasDesdeHtml(html) {
  const sinEtiquetas = String(html || '').replace(/<[^>]+>/g, '\n')
  // ⚠️ SIN la bandera `i` en las vocales acentuadas: con ella, `&iacute;` casaba también
  // `&Iacute;` y devolvía «CAPíTULO» en minúscula, con lo que la línea dejaba de reconocerse
  // como encabezado de capítulo y la ley entera salía «sin_capitulos».
  const conEntidades = sinEtiquetas
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#\d+;/g, ' ')
  return conEntidades.split('\n').map((l) => l.trim()).filter(Boolean)
}

/** ¿Es un id de documento europeo publicado por el BOE? */
function esIdDoue(url) {
  return (String(url || '').match(/DOUE-[A-Z]-\d{4}-\d+/) || [])[0] || null
}

module.exports = { parseDoueSections, lineasDesdeHtml, esIdDoue, RE_CAPITULO, RE_ARTICULO }
