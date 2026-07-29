'use strict'
/**
 * Reparte el contenido de un tema en PARTES descargables por separado.
 *
 * ## Por qué existe (T-273)
 *
 * Hay temas de **651 páginas**. Un PDF así pesa, tarda en abrir en el móvil y no hay quien lo
 * navegue — es mal material de estudio aunque la infraestructura lo aguantara. Y los que ni siquiera
 * caben devuelven hoy un **413** y dejan al opositor sin nada: medido, `auxiliar-administrativo-estado`
 * tema 109 lo intentó 5 veces en 30 días.
 *
 * ## La regla que decide el diseño: se parte por ESTRUCTURA, nunca por páginas
 *
 * Cortar en la página 100 cae a mitad de un artículo, y en contenido legal eso no vale para nada.
 * El corte natural es el **bloque de contenido** (una ley, o un contenedor como «Excel 365»), que
 * además es por donde el opositor navega: *«Parte 2 de 4 — Ley 39/2015 (arts. 1-53)»* es una unidad
 * con sentido propio; *«parte 2»* no.
 *
 * ## Dos niveles, porque un bloque puede pasarse él solo
 *
 * Medido en el tema 29 de `auxiliar-administrativo-diputacion-segovia` (el de 651 páginas,
 * 1.337.214 caracteres en 7 bloques): el mayor —Excel 365— son **410.592 caracteres él solo**, por
 * encima del techo. Así que:
 *   1. se agrupan bloques consecutivos mientras quepan;
 *   2. si un bloque NO cabe ni solo, se parte por **rangos de artículos consecutivos**, que sigue
 *      siendo un corte estructural y etiquetable («arts. 1-12»).
 *
 * ## Por qué el techo es `PDF_MAX_CHARS` y no un número nuevo
 *
 * Ese límite ya existe y ya significa «esto cabe en una generación síncrona». Reutilizarlo ata el
 * troceado a la restricción real en vez de inventar una constante que nadie sabría recalibrar.
 *
 * ## Estabilidad de las fronteras (esto NO es un detalle de implementación)
 *
 * La caché de PDFs es **content-addressed**. Si se partiera por páginas, cualquier cambio de
 * contenido movería todos los cortes e invalidaría la caché entera. Partiendo por bloque, un cambio
 * dentro de un bloque solo altera la parte que lo contiene: quien consuma esto debe cachear cada
 * parte por el hash de SU propio contenido, nunca por «parte 3».
 */

/** Suma de caracteres de los artículos de un bloque. */
function charsDeBloque(bloque) {
  return (bloque?.articles || []).reduce((n, a) => n + (a?.content ? String(a.content).length : 0), 0)
}

/** Etiqueta legible de un bloque, con el rango de artículos si está partido. */
function etiqueta(nombre, articulos, partido) {
  if (!partido || !articulos?.length) return nombre
  const nums = articulos.map(a => a?.article_number).filter(x => x != null)
  if (!nums.length) return nombre
  const primero = nums[0], ultimo = nums[nums.length - 1]
  return primero === ultimo ? `${nombre} (art. ${primero})` : `${nombre} (arts. ${primero}-${ultimo})`
}

/**
 * Parte UN bloque que no cabe entero, en tramos consecutivos de artículos.
 * Nunca parte un artículo por la mitad: si uno solo ya excede el techo, va en su propio tramo —
 * mejor una parte grande que un artículo cortado, que es justo lo que no sirve para estudiar.
 */
function partirBloque(bloque, maxChars) {
  const arts = bloque.articles || []
  const tramos = []
  let actual = [], acum = 0
  for (const a of arts) {
    const n = a?.content ? String(a.content).length : 0
    if (actual.length && acum + n > maxChars) { tramos.push(actual); actual = []; acum = 0 }
    actual.push(a); acum += n
  }
  if (actual.length) tramos.push(actual)
  return tramos
}

/**
 * Planifica las partes de un tema.
 *
 * @param {{laws?: Array<{law?: {short_name?: string, name?: string}, articles?: Array<{article_number?: string|number, content?: string|null}>}>}} content
 * @param {number} maxChars techo por parte (usar `PDF_MAX_CHARS`)
 * @returns {{total: number, partes: Array<{indice: number, total: number, etiqueta: string, chars: number, laws: any[]}>}}
 */
function planPartes(content, maxChars) {
  const bloques = (content?.laws || []).filter(Boolean)
  const techo = Number.isFinite(maxChars) && maxChars > 0 ? maxChars : Infinity

  // 1) Cada bloque, entero o troceado si no cabe ni solo.
  const unidades = []
  for (const b of bloques) {
    const nombre = b?.law?.short_name || b?.law?.name || 'Contenido'
    const chars = charsDeBloque(b)
    if (chars <= techo) {
      unidades.push({ nombre, chars, laws: [b], etiqueta: nombre })
      continue
    }
    const tramos = partirBloque(b, techo)
    for (const arts of tramos) {
      const sub = { ...b, articles: arts }
      unidades.push({
        nombre,
        chars: charsDeBloque(sub),
        laws: [sub],
        etiqueta: etiqueta(nombre, arts, tramos.length > 1),
      })
    }
  }

  // 2) Agrupar unidades consecutivas mientras quepan. En ORDEN del documento: reordenar rompería
  //    la lógica del temario, que es lo que hace navegable la parte.
  const partes = []
  let acum = null
  for (const u of unidades) {
    if (acum && acum.chars + u.chars <= techo) {
      acum.chars += u.chars
      acum.laws.push(...u.laws)
      acum.etiquetas.push(u.etiqueta)
      continue
    }
    if (acum) partes.push(acum)
    acum = { chars: u.chars, laws: [...u.laws], etiquetas: [u.etiqueta] }
  }
  if (acum) partes.push(acum)

  const total = partes.length
  return {
    total,
    partes: partes.map((p, i) => ({
      indice: i + 1,
      total,
      // Con un solo bloque, la etiqueta es él. Con varios, se nombran los dos primeros y se resume
      // el resto: un título con siete nombres encadenados no lo lee nadie.
      etiqueta: p.etiquetas.length <= 2
        ? p.etiquetas.join(' + ')
        : `${p.etiquetas.slice(0, 2).join(' + ')} y ${p.etiquetas.length - 2} más`,
      chars: p.chars,
      laws: p.laws,
    })),
  }
}

/** ¿Hace falta trocear? Un tema que cabe entero NO debe presentarse en partes. */
function necesitaPartes(content, maxChars) {
  return planPartes(content, maxChars).total > 1
}

module.exports = { planPartes, necesitaPartes, charsDeBloque, partirBloque, etiqueta }
