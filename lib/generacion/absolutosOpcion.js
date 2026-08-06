'use strict'
//
// Marcadores de ABSOLUTO en el TEXTO DE LAS OPCIONES (tell de FORMA de lote, T-150).
//
// Distinto de `overclaimExplicacion.js`: aquel vigila el RAZONAMIENTO de la
// explicación contra el ARTÍCULO (¿el redactor afirma un absoluto que la ley no
// dice?). Aquí no se compara nada contra la ley — se mira solo qué OPCIÓN lleva
// el marcador. El defecto que esto caza es de LOTE, no de contenido: si el
// marcador vive SOLO en distractores y nunca en la clave, la clave se delata por
// ser la única opción "matizada", sin que haga falta abrir el artículo.
//
// Medido en `gen_atc_t208_2026-07-26_s26c`: absolutos en 10/16 preguntas, y en 9
// de esas 10 SOLO en distractores («únicamente», «exclusivamente», «solo»,
// «siempre», «en exclusiva», «libremente decida»). La única clave con un
// absoluto lo tenía porque la LEY lo dice («en ningún caso», art. 136.3 LGT) —
// razón de más para no comparar contra el artículo aquí: ese caso es exactamente
// el que debe seguir contando como "la clave SÍ tiene marcador" y no disparar el
// aviso, y el criterio "¿aparece en la clave?" ya lo resuelve sin mirar la ley.
//
// GOTCHA (encontrado escribiendo los tests de este mismo módulo): `\b` en JS
// solo reconoce como "carácter de palabra" [A-Za-z0-9_] — una vocal acentuada
// como "ú" cuenta como NO-palabra, igual que un espacio. `\búnicamente\b` no
// cruza esa frontera nunca (los dos lados de la `\b` inicial son "no-palabra") y
// el marcador MÁS citado en el caso real quedaba mudo. Se evita normalizando el
// texto (quitar tildes) ANTES de mirar los marcadores, igual que `palabras()` en
// `simularBatch.js` — así los marcadores se escriben en ASCII y `\b` funciona.

/** Minúsculas y sin tildes (mismo criterio que `palabras()` de simularBatch.js). */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const MARCADORES = [
  /\bunicamente\b/,
  /\bexclusivamente\b/,
  /\ben exclusiva\b/,
  /\bsolo\b/,
  /\bsiempre\b(?!\s+que\b)/,
  /\ben ningun caso\b/,
  /\ben todo caso\b/,
  /\ben cualquier caso\b/,
  /\ben todos los casos\b/,
  /\bnunca\b/,
  /\bjamas\b/,
  /\bsin excepcion(?:es)?\b/,
  /\blibremente\b/,
]

/** ¿El texto de una opción lleva algún marcador de absoluto? */
function tieneAbsoluto(texto) {
  const t = normalizar(texto)
  return MARCADORES.some((re) => re.test(t))
}

module.exports = { MARCADORES, tieneAbsoluto, normalizar }
