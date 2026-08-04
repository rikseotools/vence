// lib/backlog/insertarFicha.cjs — colocar una ficha nueva en `tareas-pendientes.md`. [T-515]
//
// ── POR QUÉ NO SE HACE A MANO ───────────────────────────────────────────────────────────────
//
// Porque a mano se coloca mal, y no por descuido: el fichero pasa de 11.000 líneas y la frase
// `## Abiertas` aparece DENTRO del texto de varias fichas (las que hablan justamente de este
// problema). Cualquier búsqueda de esa cadena —un `index()`, un `sed`, o leer el fichero y
// pegarla «arriba del todo»— acierta la mención antes que el encabezado, y la ficha acaba en el
// preámbulo, fuera de toda sección.
//
// Ha pasado al menos dos veces, y la segunda es la que da fe de que no es cuestión de tener
// cuidado: el ancla falsa con la que tropecé el 04/08 era **un bullet de otra sesión
// documentando esa misma trampa**. Dos personas distintas, el mismo agujero, y el aviso escrito
// no lo evitó — un aviso no es un guardarraíl.
//
// ── QUÉ GARANTIZA (y qué NO) ────────────────────────────────────────────────────────────────
//
// Garantiza: se inserta bajo el encabezado REAL, el id no se duplica, la cabecera tiene la forma
// que `parseMarkdown.cjs` sabe leer, y **no desaparece ninguna ficha que ya estuviera**.
//
// NO garantiza —y conviene no creérselo— que dos sesiones no choquen en git: todas insertan en
// el mismo punto del mismo fichero, así que el conflicto sigue siendo lo normal. Lo que esto
// quita es la colocación equivocada y el id repetido, no la contención. La contención se resuelve
// al fusionar, conservando LOS DOS lados (ver `perdidaDeContexto.cjs`).

/** El encabezado bajo el que va una ficha nueva. Coincidencia EXACTA de línea, nunca `includes`. */
const ENCABEZADO_ABIERTAS = '## Abiertas'

/** Cabecera de ficha: `### [T-042] …`. Es el mismo formato que lee `parseBacklogMarkdown`. */
const RE_CABECERA = /^###\s+.*\[(T-\d+)\]/

/** Ids de todas las fichas presentes, en orden de aparición. */
function idsDeFichas(lineas) {
  const out = []
  for (const l of lineas) {
    const m = RE_CABECERA.exec(l)
    if (m) out.push(m[1])
  }
  return out
}

/**
 * Índice de la línea que ES el encabezado `## Abiertas`.
 *
 * Se compara la línea ENTERA (sin espacios de sobra) en vez de buscar la cadena dentro del
 * fichero: esa diferencia es exactamente el fallo que esto viene a impedir.
 *
 * @returns índice, o -1 si no está
 */
function lineaDeAbiertas(lineas) {
  return lineas.findIndex((l) => l.trim() === ENCABEZADO_ABIERTAS)
}

/**
 * Inserta `bloque` (el texto completo de la ficha) bajo `## Abiertas`.
 *
 * Devuelve `{ ok: true, md, linea }` o `{ ok: false, motivo, detalle }`. No lanza: el llamante
 * decide cómo contarlo, y un fallo aquí tiene que poder explicarse al usuario, no reventar.
 *
 * @param md     contenido actual del fichero
 * @param id     id ya reservado (`reserve` lo saca de la BD, que es el árbitro)
 * @param bloque la ficha entera, empezando por su `### [T-nnn] …`
 */
function insertarFicha(md, id, bloque) {
  const lineas = String(md ?? '').split('\n')
  const cuerpo = String(bloque ?? '').replace(/\s+$/, '').split('\n')

  if (!/^T-\d+$/.test(String(id ?? ''))) {
    return { ok: false, motivo: 'id_invalido', detalle: `«${id}» no tiene la forma T-nnn` }
  }
  if (!cuerpo.length || !cuerpo[0].trim()) {
    return { ok: false, motivo: 'ficha_vacia', detalle: 'no se ha recibido texto de ficha' }
  }

  const cab = RE_CABECERA.exec(cuerpo[0])
  if (!cab) {
    return {
      ok: false,
      motivo: 'sin_cabecera',
      detalle: `la ficha tiene que empezar por «### [${id}] …»; empieza por «${cuerpo[0].slice(0, 60)}»`,
    }
  }
  if (cab[1] !== id) {
    // Pegar la ficha de T-500 bajo el id T-501 desincroniza markdown y tabla en silencio, que es
    // el desastre que `sync` y su guardarraíl existen para evitar.
    return { ok: false, motivo: 'id_no_coincide', detalle: `la cabecera dice ${cab[1]} y el id es ${id}` }
  }
  if (cuerpo[0].includes('✅')) {
    // Una ficha que nace cerrada no es una ficha: o está hecha y va a «## Hechas», o está
    // abierta y no lleva la marca. El ✅ es la ÚNICA señal de cierre que se lee.
    return { ok: false, motivo: 'nace_cerrada', detalle: 'la cabecera lleva ✅ (marca de HECHA)' }
  }

  const previas = idsDeFichas(lineas)
  if (previas.includes(id)) {
    return { ok: false, motivo: 'id_duplicado', detalle: `${id} ya tiene ficha en el fichero` }
  }

  const iAb = lineaDeAbiertas(lineas)
  if (iAb < 0) {
    return { ok: false, motivo: 'sin_seccion', detalle: `no hay una línea que sea exactamente «${ENCABEZADO_ABIERTAS}»` }
  }

  const nuevas = [...lineas]
  nuevas.splice(iAb + 1, 0, '', ...cuerpo)

  // Comprobación de NO PÉRDIDA. Barata y contra el modo de fallo que de verdad duele: una ficha
  // ajena que desaparece sin que nada se ponga rojo (el guardarraíl de ids solo mira que sean
  // únicos, y un id sigue siendo único después de borrarle el cuerpo entero).
  const faltan = previas.filter((x) => !idsDeFichas(nuevas).includes(x))
  if (faltan.length) {
    return { ok: false, motivo: 'perderia_fichas', detalle: `desaparecerían: ${faltan.join(', ')}` }
  }

  return { ok: true, md: nuevas.join('\n'), linea: iAb + 2 }
}

module.exports = { insertarFicha, lineaDeAbiertas, idsDeFichas, ENCABEZADO_ABIERTAS }
