// lib/db/rlsSelectBlocked.cjs — T-574
//
// EL BUG QUE ESTO ARREGLA: una tabla con RLS activado y CERO políticas no lanza error al
// hacer SELECT — el motor filtra en silencio y devuelve 0 filas, siempre, sin importar
// cuántas haya en realidad. `SELECT 1 FROM tabla LIMIT 1` "no lanza" es exactamente el
// aspecto que tiene un GRANT bloqueado por RLS, y el que tiene una tabla vacía de verdad:
// desde fuera son indistinguibles con una prueba que solo mira "¿lanzó error?".
//
// Medido en producción (05/08): `test_questions` y `tests` — dos de las tablas que el
// canario `scripts/canary-rol-lector.cjs` afirma como "✅ lee" — tienen RLS activo y CERO
// políticas, y devuelven 0 filas siempre para `vence_lector` aunque la tabla tenga datos.
// El canario daba 19/19 verde con dos de sus comprobaciones completamente rotas.
//
// La única forma de distinguir "vacía de verdad" de "bloqueada en silencio" sin depender
// de que la tabla tenga filas ahora mismo es mirar el CATÁLOGO: `pg_class.relrowsecurity`
// + `pg_policies`, que son legibles por cualquier rol (privilegio por defecto de Postgres
// sobre las vistas del catálogo, confirmado: `vence_lector` las lee sin GRANT explícito).

/**
 * ¿Bloquearía RLS un SELECT de `rol` sobre esta tabla?
 *
 * @param {boolean} rowsecurity  `pg_class.relrowsecurity` de la tabla
 * @param {Array<{cmd: string, roles: string[]}>} policies  filas de `pg_policies` para esa tabla
 * @param {string} rol  rol con el que se conecta (`current_user`)
 * @returns {boolean} true si el SELECT quedaría filtrado a 0 filas por falta de política
 */
function seleccionBloqueadaPorRls(rowsecurity, policies, rol) {
  if (!rowsecurity) return false
  const aplica = (p) =>
    (p.cmd === 'SELECT' || p.cmd === 'ALL') &&
    Array.isArray(p.roles) &&
    (p.roles.includes('public') || p.roles.includes(rol))
  return !(policies || []).some(aplica)
}

module.exports = { seleccionBloqueadaPorRls }
