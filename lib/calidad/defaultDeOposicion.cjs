// lib/calidad/defaultDeOposicion.cjs — un valor POR DEFECTO que es una oposición REAL. (T-541)
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
//
// Este defecto ha mordido CINCO veces, siempre igual y siempre en silencio:
//
//   · 18/06/2026  el modal «Descarga el temario en PDF» mandaba a registrarse a
//                 `oposicion=auxiliar_enfermeria_osakidetza` desde OCHO oposiciones (caso Alicia).
//   · 13/07/2026  `ExamReviewLayout` tenía el slug de la flagship como default y «Volver a Tests»
//                 sacaba de su oposición a todo el que no fuera del Estado (flor/MariSol).
//   ·             `TemaTestPage` cae a `auxiliar_administrativo_estado` si nadie le pasa el
//                 `position_type`: sirve el temario de OTRA oposición sin fallar.
//   · 04/08/2026  `TopicContentView` (default `administrativo-estado`) y `TestPageWrapper` /
//                 `TestLayout` (vía `resolveOposicionSlugForNav`, que solo conoce el catálogo
//                 estático): cuatro enlaces sacaban al usuario de su oposición personalizada.
//
// El patrón es siempre el mismo y por eso se puede vigilar: **el valor por defecto es una
// oposición REAL**. Quien olvida pasar el suyo no recibe un error ni una pantalla rota — recibe
// la oposición de otro, que carga perfectamente. No falla: teletransporta. Y como no falla, se
// descubre cuando lo cuenta un usuario, semanas después.
//
// ── LA REGLA, Y DÓNDE NO APLICA ─────────────────────────────────────────────────────────────
//
// Un componente COMPARTIDO (`components/**`) sirve a todas las oposiciones, así que no puede
// tener ninguna por defecto: o se la pasan, o no hay valor.
//
// En `app/<slug>/**` el default SÍ es legítimo **si coincide con su propia carpeta**: son clones
// por oposición y ahí el default es «la mía». Lo que no vale es que el default nombre a OTRA
// —que es como se coló el caso Alicia— ni que un tercero importe ese clon y se apoye en su
// default (para eso está el `basePath` explícito que exige el guardarraíl de personalizada).
//
// Núcleo puro: no lee ficheros ni conoce el catálogo. Se le pasan el contenido y la lista de
// identificadores reales, para poder probarlo sin BD y sin el config de 11.000 líneas.

/** Defaults de parámetro/prop en el fichero: `nombre = 'valor'`. */
const RE_DEFAULT = /([A-Za-z_$][\w$]*)\s*=\s*['"`]([a-z0-9_-]{6,})['"`]/g

/**
 * Busca defaults cuyo valor sea un identificador de oposición real.
 *
 * @param {string} contenido        código del fichero
 * @param {Set<string>} identificadores  slugs y position_types reales
 * @param {string|null} propia      identificador de la oposición dueña del fichero (si el fichero
 *                                  vive en `app/<slug>/…`): ese valor NO se marca.
 * @returns {Array<{prop: string, valor: string, linea: number}>}
 */
function defaultsDeOposicion(contenido, identificadores, propia = null) {
  const salida = []
  const lineas = String(contenido || '').split('\n')
  for (let i = 0; i < lineas.length; i++) {
    // Un comentario no construye ningún enlace: describe el problema, a veces para avisar de él.
    const linea = lineas[i]
    if (/^\s*(\/\/|\*|\/\*)/.test(linea)) continue
    RE_DEFAULT.lastIndex = 0
    let m
    while ((m = RE_DEFAULT.exec(linea)) !== null) {
      const [, prop, valor] = m
      if (!identificadores.has(valor)) continue
      if (propia && (valor === propia || valor === propia.replace(/-/g, '_'))) continue
      salida.push({ prop, valor, linea: i + 1 })
    }
  }
  return salida
}

module.exports = { defaultsDeOposicion }
