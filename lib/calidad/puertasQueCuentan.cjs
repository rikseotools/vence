// lib/calidad/puertasQueCuentan.cjs — una puerta que bloquea tiene que CONTARSE. (T-542)
//
// ── QUÉ PROBLEMA RESUELVE ────────────────────────────────────────────────────────────────────
// El 04/08/2026 la puerta de temario (T-518) nació bloqueando de verdad y **sin emitir nada** al
// bus de fricción. Imprimía «queda contado» y no contaba. No se detectó ni en review ni en CI:
// nueve guardarraíles emitían, ella no, y nada relacionaba «bloquear» con «reportar».
//
// La causa de fondo no fue el despiste: era que **cada guardarraíl se escribía su propio emisor**
// (cinco copias privadas del mismo `spawn`). Cuando la única forma de emitir es copiar código de
// otro fichero, tarde o temprano alguien no lo copia. Con `lib/sessions/friccion.cjs` ya hay un
// emisor único; este núcleo es lo que impide que la próxima puerta vuelva a nacer muda.
//
// ── POR QUÉ IMPORTA QUE UNA PUERTA CUENTE ────────────────────────────────────────────────────
// De la cabecera de `friccionSesiones.cjs` (T-423): *«la señal que más importa es el ESCAPE, no
// el bloqueo — un guardarraíl que se salta de forma sistemática está muerto y nadie se ha
// enterado»*. Una puerta que no emite es invisible para ese indicador: puede llevar muerta desde
// el día uno, dando la lata sin proteger, y solo se sabría por casualidad.
//
// ── CÓMO SE DETECTA (por comportamiento, no por mención) ─────────────────────────────────────
// Igual que `lib/admin/toolWriters.ts` detecta escritores por su patrón de escritura real y no
// porque alguien nombre la tabla:
//   · Es PUERTA  → el módulo imprime un rechazo (🛑 / ⛔ / «no se puede cerrar») **y** devuelve
//                  `false` en alguna rama. Anunciar sin poder negar no es una puerta.
//   · CUENTA     → usa `emitirFriccion` del emisor único.
// Un fichero que solo MENCIONA la fricción en un comentario no cuenta como que cuenta — que es
// exactamente el fallo original: el texto afirmaba contar y el código no lo hacía.

/** Marcas de que el módulo comunica un rechazo al usuario. */
const MARCAS_DE_RECHAZO = [/🛑/, /⛔/, /\bNO se puede\b/i, /no se puede cerrar/i]

/** La única forma legítima de emitir. Comentarios aparte: se mira la LLAMADA. */
const LLAMADA_AL_EMISOR = /\bemitirFriccion\s*\(/

/** El `spawn` directo del script emisor: la copia privada que ya no debe crecer. */
const COPIA_PRIVADA = /friccion-emitir\.cjs/

/** Quita comentarios de línea y de bloque para no confundir prosa con código. */
function soloCodigo(fuente) {
  return String(fuente || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/^\s*\*.*$/gm, ' ')
}

/**
 * ¿Este módulo es una PUERTA? Bloquea de verdad: comunica un rechazo y puede devolver `false`.
 * @param {string} fuente
 */
function esPuerta(fuente) {
  const codigo = soloCodigo(fuente)
  const rechaza = MARCAS_DE_RECHAZO.some((r) => r.test(codigo))
  const puedeNegar = /return\s+false\b/.test(codigo)
  return rechaza && puedeNegar
}

/** ¿Cuenta su fricción llamando al emisor único? */
function cuenta(fuente) {
  return LLAMADA_AL_EMISOR.test(soloCodigo(fuente))
}

/** ¿Se ha escrito su propia copia del emisor en vez de usar el compartido? */
function tieneCopiaPrivada(fuente) {
  return COPIA_PRIVADA.test(soloCodigo(fuente))
}

/**
 * Clasifica un conjunto de módulos.
 *
 * @param {Array<{ruta: string, fuente: string}>} modulos
 * @returns {{mudas: string[], conCopiaPropia: string[], puertas: string[]}}
 *   · `mudas`          → puertas que bloquean y NO cuentan. Es el defecto: CI en rojo.
 *   · `conCopiaPropia` → módulos que llaman al script emisor por su cuenta. Deuda con trinquete.
 */
function clasificarPuertas(modulos) {
  const mudas = []
  const conCopiaPropia = []
  const puertas = []
  for (const { ruta, fuente } of modulos || []) {
    if (tieneCopiaPrivada(fuente)) conCopiaPropia.push(ruta)
    if (!esPuerta(fuente)) continue
    puertas.push(ruta)
    // Una puerta con copia privada SÍ cuenta (mal, pero cuenta): la deuda la lleva el trinquete,
    // no este check. Aquí solo se caza la que no cuenta de ninguna forma.
    if (!cuenta(fuente) && !tieneCopiaPrivada(fuente)) mudas.push(ruta)
  }
  return { mudas, conCopiaPropia, puertas }
}

module.exports = { clasificarPuertas, esPuerta, cuenta, tieneCopiaPrivada, soloCodigo }
