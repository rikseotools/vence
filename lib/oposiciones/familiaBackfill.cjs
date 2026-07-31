// lib/oposiciones/familiaBackfill.cjs
//
// Regla de escritura del backfill de `oposiciones.familia`. Vive aparte del script
// para poder probarla: es la que decide qué NO se toca.

/**
 * ¿Escribir `nueva` encima de `actual` sería DEGRADAR?
 *
 * `otros` no es un veredicto: es el comodín del clasificador para lo que no sabe
 * encajar. Así que una pasada completa nunca puede devolver a `otros` una fila que
 * ya tiene familia concreta — eso borra correcciones hechas a mano, y a un humano
 * que arregló una fila no se le pisa con un "no sé".
 *
 * Medido el 31/07/2026 (T-377): sin esta regla, la pasada completa habría degradado
 * 6 filas (social→otros ×3, sanidad→otros, administracion_general→otros, tecnica→otros).
 *
 * Ojo con el caso que SÍ pasa: `null → otros` no es degradar (no había nada que perder).
 *
 * @param {string|null|undefined} actual familia guardada hoy
 * @param {string} nueva familia que propone el clasificador
 * @returns {boolean}
 */
function degradaFamilia(actual, nueva) {
  return nueva === 'otros' && !!actual && actual !== 'otros'
}

module.exports = { degradaFamilia }
