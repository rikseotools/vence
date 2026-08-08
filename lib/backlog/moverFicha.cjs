// lib/backlog/moverFicha.cjs — mover una ficha CERRADA de «## Abiertas» a «## Hechas». [T-387]
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
//
// `done` cierra el ESTADO en Postgres (atómico, de fiar) y hasta hoy dejaba el CONTENIDO — el
// markdown — en manos de quien acababa de cerrar la tarea: «AHORA mueve su entrada a Hechas»,
// y cada sesión lo hacía con su propio `sed`/sesión de editor/script de usar y tirar. Medido el
// 31/07: **91 commits en un solo día** sobre este fichero, y en UNA sola sesión hicieron falta
// CUATRO scripts ad-hoc para editarlo — uno se llevó por delante la cabecera `## Hechas` entera
// (lo cazó el guardarraíl de CI, no el diseño). El fichero real tiene además fichas ya movidas
// A MANO con la cabecera mal formada — `✅ ✅ 🟠 [HECHA 31/07]` (T-442, doble marca) es el rastro
// de exactamente este problema, no un caso aislado.
//
// Esto reemplaza ese paso manual por una función PURA (sin tocar disco: el llamante decide
// cuándo escribir, con `escrituraSegura.cjs`) que:
//   1. localiza el bloque de la ficha en CUALQUIER sección (no asume que vive en «## Abiertas»:
//      una huérfana, o una ya movida a mano, también tienen que poder cerrarse limpio),
//   2. aplica la marca `✅ [HECHA dd/mm]` a la cabecera de forma determinista,
//   3. la reubica al principio de la sección `## Hechas` (la PRIMERA del fichero: hay tres y
//      elegir es adivinar — ver `insertarFicha.cjs`; se documenta la elección para que sea
//      SIEMPRE la misma, no una moneda al aire cada vez),
//   4. nunca pierde una ficha: el recuento de ids antes/después tiene que cuadrar, o se aborta
//      y se devuelve el markdown intacto (mismo criterio que `insertarFicha`/`reubicarHuerfanas`).
//
// ── QUÉ NO HACE ─────────────────────────────────────────────────────────────────────────────
//
// No decide el ESTADO (eso lo dice `backlog_tasks`, ya resuelto). No toca el texto del CUERPO de
// la ficha (solo la línea de cabecera). No resuelve conflictos de `git`: dos sesiones cerrando
// fichas DISTINTAS en el mismo instante siguen pudiendo chocar al fusionar — eso es la Fase 2 de
// [T-387] (una ficha por fichero), no ésta.

/** Misma cabecera que `insertarFicha.cjs` / `parseMarkdown.cjs`: primer `[T-nnn]` de la línea. */
const RE_CABECERA = /^###\s+.*?\[(T-\d+)\]/

const EMOJIS_PRIORIDAD = ['🔴', '🟠', '🟡', '🟢']

/** Encabezados de sección reconocidos como «hay que buscar aquí». `##` que no sea `###`. */
function esSeccion(linea) {
  return /^##\s/.test(linea) && !/^###/.test(linea)
}

function idsDeFichas(lineas) {
  const out = []
  for (const l of lineas) {
    const m = RE_CABECERA.exec(l)
    if (m) out.push(m[1])
  }
  return out
}

/**
 * Límites `[ini, fin)` del bloque de la ficha `id`, en TODO el fichero (no solo el preámbulo).
 * `fin` es exclusivo: la línea del siguiente encabezado (`###` o `##`), o el fin de fichero.
 *
 * @returns {ini, fin} o null si no se encuentra
 */
function bloqueDeFicha(lineas, id) {
  const marca = `[${id}]`
  for (let i = 0; i < lineas.length; i++) {
    const m = RE_CABECERA.exec(lineas[i])
    if (!m || m[1] !== id) continue
    if (!lineas[i].includes(marca)) continue // guarda extra: el id capturado debe aparecer literal
    let fin = i + 1
    while (fin < lineas.length && !RE_CABECERA.test(lineas[fin]) && !esSeccion(lineas[fin])) fin++
    return { ini: i, fin }
  }
  return null
}

/**
 * Aplica la marca de cierre a una línea de cabecera.
 *
 * Reconoce el ÚNICO patrón de estado que llevan las fichas vivas: `[ABIERTO dd/mm]` o
 * `[ABIERTO dd/mm/aaaa]` (medido contra el fichero real: es el único que aparece). Si la
 * cabecera no lleva esa etiqueta, se REHÚSA en vez de adivinar — mangling silencioso es
 * exactamente el daño que esto viene a evitar.
 *
 * El emoji de prioridad, si lo hay, se CONSERVA (mayoría medida en el fichero real: 65 cierres
 * lo conservan frente a los que lo quitan) — es información de triaje retrospectivo, no ruido.
 *
 * `### [T-042] 🟠 [ABIERTO 31/07] Título` → `### [T-042] ✅ 🟠 [HECHA 07/08] Título`
 *
 * @returns {ok:true, linea} o {ok:false, motivo}
 */
// Flag `u` OBLIGATORIA: los emojis de prioridad son pares subrogados (fuera del BMP) y sin `u`
// una clase de caracteres los parte en dos unidades UTF-16 sueltas — el grupo opcional deja de
// casar el emoji entero y la marca sale mal formada. Costó una ronda de tests fallidos verlo.
const RE_ESTADO_ABIERTO = /^(###\s+\[T-\d+\]\s*)((?:[🔴🟠🟡🟢]\s+)?)\[ABIERTO\s+\d{2}\/\d{2}(?:\/\d{4})?\]/u

function aplicarMarcaHecha(linea, fecha) {
  if (/✅/.test(linea)) return { ok: false, motivo: 'ya_cerrada' }
  if (!RE_ESTADO_ABIERTO.test(linea)) return { ok: false, motivo: 'formato_no_reconocido' }
  // El ✅ va DELANTE del emoji de prioridad (convención mayoritaria medida en el fichero real:
  // `✅ 🟠 [HECHA …]`), no donde caiga el `replace` de la etiqueta — un simple sustituir-en-sitio
  // deja `🟠 ✅ [HECHA …]`, que es la forma MINORITARIA y la que un lector tiene que desambiguar.
  const nueva = linea.replace(RE_ESTADO_ABIERTO, (_m, prefijo, emoji) => `${prefijo}✅ ${emoji}[HECHA ${fecha}]`)
  return { ok: true, linea: nueva }
}

/**
 * Índice de la PRIMERA línea `## Hechas` del fichero — la elección determinista (ver cabecera
 * del fichero: hay tres, y hace falta fijar SIEMPRE la misma para que dos llamadas no se
 * repartan las fichas entre secciones distintas al azar).
 */
function primeraSeccionHechas(lineas) {
  return lineas.findIndex((l) => l.trim() === '## Hechas')
}

/**
 * Mueve la ficha `id` a la sección `## Hechas`, marcándola cerrada.
 *
 * No lanza: cualquier fallo vuelve como `{ok:false, motivo, detalle}` y el llamante decide qué
 * hacer (típicamente: avisar y dejar el paso manual como red de seguridad — no bloquear `done`
 * por un problema de formato en el markdown, que es bookkeeping secundario del estado en BD).
 *
 * @param md  contenido actual del fichero
 * @param id  el T-nnn a cerrar
 * @param fecha  fecha a escribir en la marca, formato `dd/mm` (el llamante decide el reloj —
 *               este módulo no toca `Date` para seguir siendo puro y testeable sin mockear tiempo)
 */
function moverAHechas(md, id, fecha) {
  if (!/^T-\d+$/.test(String(id ?? ''))) {
    return { ok: false, motivo: 'id_invalido', detalle: `«${id}» no tiene la forma T-nnn` }
  }
  if (!/^\d{2}\/\d{2}(\/\d{4})?$/.test(String(fecha ?? ''))) {
    return { ok: false, motivo: 'fecha_invalida', detalle: `«${fecha}» no tiene forma dd/mm` }
  }

  const lineas = String(md ?? '').split('\n')
  const previas = idsDeFichas(lineas)

  const bloque = bloqueDeFicha(lineas, id)
  if (!bloque) return { ok: false, motivo: 'no_encontrada', detalle: `${id} no tiene ficha en el fichero` }

  const marcado = aplicarMarcaHecha(lineas[bloque.ini], fecha)
  if (!marcado.ok) return { ok: false, motivo: marcado.motivo, detalle: `cabecera: «${lineas[bloque.ini].slice(0, 90)}»` }

  const iHechas = primeraSeccionHechas(lineas)
  if (iHechas < 0) return { ok: false, motivo: 'sin_seccion_hechas', detalle: 'no hay ninguna línea «## Hechas»' }

  // El bloque a mover, ya con la cabecera marcada.
  const cuerpo = [marcado.linea, ...lineas.slice(bloque.ini + 1, bloque.fin)]
  while (cuerpo.length && cuerpo[cuerpo.length - 1].trim() === '') cuerpo.pop()

  // Se construye el resultado quitando primero el bloque viejo y recalculando dónde cae
  // `## Hechas` en el array YA SIN el bloque (si la ficha vivía ANTES de esa sección, el índice
  // se desplaza; si vivía DESPUÉS, no cambia). Evita el bug clásico de índices que se invalidan
  // al mezclar un borrado y una inserción sobre los mismos offsets.
  const sinBloque = [...lineas.slice(0, bloque.ini), ...lineas.slice(bloque.fin)]
  const iHechasTrasBorrar = sinBloque.findIndex((l) => l.trim() === '## Hechas')
  if (iHechasTrasBorrar < 0) {
    // No debería poder pasar (la sección no está DENTRO del bloque que se borra: una ficha no
    // puede contener un encabezado `##` de sección, `bloqueDeFicha` para ahí). Guarda defensiva.
    return { ok: false, motivo: 'seccion_hechas_desaparecida_al_mover', detalle: id }
  }

  const nuevas = [...sinBloque]
  nuevas.splice(iHechasTrasBorrar + 1, 0, '', ...cuerpo, '')

  const despues = idsDeFichas(nuevas)
  if (despues.length !== previas.length || previas.some((x) => !despues.includes(x))) {
    return { ok: false, motivo: 'perderia_fichas', detalle: `antes ${previas.length}, después ${despues.length}` }
  }

  return { ok: true, md: nuevas.join('\n') }
}

/** Encabezado bajo el que va una ficha reabierta. Igual que `insertarFicha.cjs` — misma sección. */
const ENCABEZADO_ABIERTAS = '## Abiertas'

/**
 * La operación INVERSA de `aplicarMarcaHecha`, para `reopen` (T-387 — mismo hueco, mismo remedio:
 * `reopen` también dejaba «AHORA devuélvela tú a Abiertas» en manos de la sesión).
 *
 * No intenta reconstruir la fecha de apertura ORIGINAL (no hay una fuente fiable en la cabecera:
 * a veces lleva `[HECHA dd/mm · ABIERTO dd/mm]`, a veces no) — reabrir se trata como lo que es,
 * un evento nuevo, con la fecha de HOY. `[T-042] ✅ 🟠 [HECHA 07/08] Título` → `[T-042] 🟠 [ABIERTO 07/08] Título`.
 */
function aplicarMarcaAbierta(linea, fecha) {
  const re = /✅\s*((?:[🔴🟠🟡🟢]\s+)?)\[HECHA[^\]]*\]/u
  const m = re.exec(linea)
  if (!m) return { ok: false, motivo: 'formato_no_reconocido' }
  const emoji = m[1]
  const nueva = linea.replace(re, `${emoji}[ABIERTO ${fecha}]`)
  return { ok: true, linea: nueva }
}

/**
 * Mueve la ficha `id` de vuelta a «## Abiertas», reabriéndola. Espejo de `moverAHechas`: mismas
 * garantías (no pierde fichas, no lanza, cabecera reconocida o se rehúsa).
 */
function moverAAbiertas(md, id, fecha) {
  if (!/^T-\d+$/.test(String(id ?? ''))) {
    return { ok: false, motivo: 'id_invalido', detalle: `«${id}» no tiene la forma T-nnn` }
  }
  if (!/^\d{2}\/\d{2}(\/\d{4})?$/.test(String(fecha ?? ''))) {
    return { ok: false, motivo: 'fecha_invalida', detalle: `«${fecha}» no tiene forma dd/mm` }
  }

  const lineas = String(md ?? '').split('\n')
  const previas = idsDeFichas(lineas)

  const bloque = bloqueDeFicha(lineas, id)
  if (!bloque) return { ok: false, motivo: 'no_encontrada', detalle: `${id} no tiene ficha en el fichero` }

  const marcado = aplicarMarcaAbierta(lineas[bloque.ini], fecha)
  if (!marcado.ok) return { ok: false, motivo: marcado.motivo, detalle: `cabecera: «${lineas[bloque.ini].slice(0, 90)}»` }

  const iAbiertas = lineas.findIndex((l) => l.trim() === ENCABEZADO_ABIERTAS)
  if (iAbiertas < 0) return { ok: false, motivo: 'sin_seccion_abiertas', detalle: 'no hay ninguna línea «## Abiertas»' }
  if (bloque.ini === iAbiertas || (bloque.ini < iAbiertas && bloque.fin > iAbiertas)) {
    // No debería poder pasar: una ficha no contiene un encabezado `##` dentro de su bloque.
    return { ok: false, motivo: 'seccion_dentro_del_bloque', detalle: id }
  }

  const cuerpo = [marcado.linea, ...lineas.slice(bloque.ini + 1, bloque.fin)]
  while (cuerpo.length && cuerpo[cuerpo.length - 1].trim() === '') cuerpo.pop()

  const sinBloque = [...lineas.slice(0, bloque.ini), ...lineas.slice(bloque.fin)]
  const iAbiertasTrasBorrar = sinBloque.findIndex((l) => l.trim() === ENCABEZADO_ABIERTAS)
  if (iAbiertasTrasBorrar < 0) {
    return { ok: false, motivo: 'seccion_abiertas_desaparecida_al_mover', detalle: id }
  }

  const nuevas = [...sinBloque]
  nuevas.splice(iAbiertasTrasBorrar + 1, 0, '', ...cuerpo, '')

  const despues = idsDeFichas(nuevas)
  if (despues.length !== previas.length || previas.some((x) => !despues.includes(x))) {
    return { ok: false, motivo: 'perderia_fichas', detalle: `antes ${previas.length}, después ${despues.length}` }
  }

  return { ok: true, md: nuevas.join('\n') }
}

module.exports = {
  RE_CABECERA,
  EMOJIS_PRIORIDAD,
  idsDeFichas,
  bloqueDeFicha,
  aplicarMarcaHecha,
  aplicarMarcaAbierta,
  primeraSeccionHechas,
  moverAHechas,
  moverAAbiertas,
}
