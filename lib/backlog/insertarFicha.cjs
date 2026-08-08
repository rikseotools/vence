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

/**
 * Cabecera de ficha: `### [T-042] …`. Mismo formato que lee `parseBacklogMarkdown`.
 *
 * ⚠️ El `.*?` es PEREZOSO y no es un detalle de estilo: con `.*` (codicioso) se queda con el
 * ÚLTIMO `[T-nnn]` de la línea, y los títulos de aquí citan otras tareas con normalidad
 * («…la contención que [T-400] dejó solo visible»). Así, `insertarFicha` creía que la ficha de
 * T-532 era de T-400 y la rechazaba por «id_no_coincide» — o peor, en otro orden la habría dado
 * por buena con el id equivocado.
 *
 * `parseMarkdown.cjs`, que es la FUENTE ÚNICA del parseo, coge el primero (usa `exec`, que
 * devuelve la primera coincidencia). Dos lectores de la misma cabecera con criterios distintos
 * es exactamente lo que ese fichero existe para evitar; aquí se alinea con él.
 */
const RE_CABECERA = /^###\s+.*?\[(T-\d+)\]/

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

/** ¿Esta línea es un encabezado de sección (`## …`), y no una cabecera de ficha (`### …`)? */
function esSeccion(linea) {
  return /^##\s/.test(linea) && !/^###/.test(linea)
}

/**
 * Las fichas que quedaron ANTES de la primera sección, o sea fuera de todas. [T-515]
 *
 * `parseMarkdown.cjs` las sigue viendo (desde T-382 lo que manda es la CABECERA, no la posición),
 * así que no desaparecen del CLI — pero un humano que abre el fichero y baja a `## Abiertas` no
 * las encuentra. Medido el 04/08: **58 huérfanas, 27 de ellas vivas, cinco 🔴**.
 *
 * @returns [{ id, ini, fin, viva }] con los límites del bloque de cada una
 */
function huerfanas(lineas) {
  const finPreambulo = lineas.findIndex(esSeccion)
  const tope = finPreambulo < 0 ? lineas.length : finPreambulo
  const out = []
  for (let i = 0; i < tope; i++) {
    const m = RE_CABECERA.exec(lineas[i])
    if (!m) continue
    let fin = i + 1
    while (fin < tope && !RE_CABECERA.test(lineas[fin]) && !esSeccion(lineas[fin])) fin++
    out.push({ id: m[1], ini: i, fin, viva: !lineas[i].includes('✅') })
  }
  return out
}

/**
 * Devuelve las huérfanas VIVAS al final de `## Abiertas`.
 *
 * ── DOS DECISIONES QUE NO SON OBVIAS ────────────────────────────────────────────────────────
 *
 * 1. **Solo las vivas.** Las cerradas tendrían que ir a `## Hechas`, y hay TRES secciones con ese
 *    nombre en el fichero: elegir una es adivinar. El daño real es que una tarea ABIERTA no se
 *    vea al repasar el backlog; una cerrada mal colocada no le cuesta nada a nadie.
 * 2. **Al FINAL de la sección, no al principio.** Arriba es donde escriben las fichas nuevas
 *    (todas las sesiones, a la vez): meter 27 ahí garantiza chocar con quien esté creando una.
 *    Y además son tareas viejas, así que abajo es su sitio por orden.
 *
 * Se conserva el orden relativo que ya tenían. No lanza y no pierde nada: si la cuenta de fichas
 * no cuadra antes y después, devuelve el markdown INTACTO.
 */
function reubicarHuerfanas(md) {
  const lineas = String(md ?? '').split('\n')
  const previas = idsDeFichas(lineas)
  const todas = huerfanas(lineas)
  const mover = todas.filter((h) => h.viva)
  const dejadas = todas.filter((h) => !h.viva).map((h) => h.id)

  if (!mover.length) return { ok: true, md: String(md ?? ''), movidas: [], dejadas }

  const iAb = lineas.findIndex((l) => l.trim() === ENCABEZADO_ABIERTAS)
  if (iAb < 0) return { ok: false, motivo: 'sin_seccion', movidas: [], dejadas }

  // Final de la sección «## Abiertas»: la línea antes del siguiente encabezado.
  let finAbiertas = iAb + 1
  while (finAbiertas < lineas.length && !esSeccion(lineas[finAbiertas])) finAbiertas++

  // Ninguna huérfana puede caer dentro de la sección de destino: viven en el preámbulo, que va
  // antes de la PRIMERA sección. Se comprueba igual, porque si eso cambiara el splice mezclaría
  // índices ya movidos y el resultado sería basura silenciosa.
  if (mover.some((h) => h.fin > iAb)) {
    return { ok: false, motivo: 'huerfana_dentro_de_seccion', movidas: [], dejadas }
  }

  const bloques = mover.map((h) => lineas.slice(h.ini, h.fin).join('\n').replace(/\s+$/, ''))

  // Se borra de ATRÁS hacia delante para no invalidar los índices de los anteriores.
  const nuevas = [...lineas]
  const aInsertar = []
  for (const b of bloques) aInsertar.push(b, '')
  nuevas.splice(finAbiertas, 0, ...aInsertar.join('\n').split('\n'))
  for (const h of [...mover].reverse()) nuevas.splice(h.ini, h.fin - h.ini)

  const despues = idsDeFichas(nuevas)
  if (despues.length !== previas.length || previas.some((x) => !despues.includes(x))) {
    // No se intenta arreglar: se devuelve lo de antes. Perder una ficha en silencio es
    // exactamente el daño que este fichero ya ha sufrido dos veces.
    return { ok: false, motivo: 'perderia_fichas', movidas: [], dejadas }
  }

  return { ok: true, md: nuevas.join('\n'), movidas: mover.map((h) => h.id), dejadas }
}

/**
 * Validación de una ficha NUEVA, para el modelo «una ficha = un fichero» (T-532).
 *
 * Misma forma que exigía `insertarFicha` (cabecera con `RE_CABECERA`, id coincidente, no nace
 * cerrada), pero SIN el trabajo de buscar dónde insertarla en un fichero grande — con un fichero
 * por ficha no hay «dónde», solo «cuál nombre». Función pura: no toca disco, así que se puede
 * comprobar sin escribir nada y el llamador (el CLI) decide qué hacer con el resultado.
 *
 * @param {string} id            id ya reservado
 * @param {string} bloque        la ficha entera, empezando por su `### [T-nnn] …`
 * @param {boolean} yaExiste     ¿ya hay fichero para este id? (lo mira el llamador, que es quien
 *                                sabe leer disco — esto sigue siendo puro)
 * @returns {{ok: true, texto: string} | {ok: false, motivo: string, detalle: string}}
 */
function validarFichaNueva(id, bloque, yaExiste) {
  const cuerpo = String(bloque ?? '').replace(/\s+$/, '')
  const lineas = cuerpo.split('\n')

  if (!/^T-\d+$/.test(String(id ?? ''))) {
    return { ok: false, motivo: 'id_invalido', detalle: `«${id}» no tiene la forma T-nnn` }
  }
  if (!lineas.length || !lineas[0].trim()) {
    return { ok: false, motivo: 'ficha_vacia', detalle: 'no se ha recibido texto de ficha' }
  }
  const cab = RE_CABECERA.exec(lineas[0])
  if (!cab) {
    return {
      ok: false,
      motivo: 'sin_cabecera',
      detalle: `la ficha tiene que empezar por «### [${id}] …»; empieza por «${lineas[0].slice(0, 60)}»`,
    }
  }
  if (cab[1] !== id) {
    return { ok: false, motivo: 'id_no_coincide', detalle: `la cabecera dice ${cab[1]} y el id es ${id}` }
  }
  if (lineas[0].includes('✅')) {
    return { ok: false, motivo: 'nace_cerrada', detalle: 'la cabecera lleva ✅ (marca de HECHA)' }
  }
  if (yaExiste) {
    return { ok: false, motivo: 'id_duplicado', detalle: `${id} ya tiene ficha` }
  }
  return { ok: true, texto: cuerpo + '\n' }
}

module.exports = {
  insertarFicha,
  reubicarHuerfanas,
  huerfanas,
  lineaDeAbiertas,
  idsDeFichas,
  ENCABEZADO_ABIERTAS,
  validarFichaNueva,
}
