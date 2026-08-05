/**
 * hooksPath.cjs — ¿el `core.hooksPath` compartido sigue apuntando a los hooks reales? (T-568)
 *
 * ## El bug que esto cierra
 *
 * `core.hooksPath` es una entrada de `.git/config` del repo COMÚN — TODOS los worktrees de la
 * flota (10+) lo comparten, porque `git worktree` no tiene una copia propia de esa clave. Cuando
 * algo lo pisa, TODA la flota pierde `pre-commit` y `pre-push` a la vez, en silencio: git no
 * encuentra hooks en el valor roto y sigue como si no hubiera ninguno — no bloquea nada, deja de
 * proteger nada. Medido en vivo el 05/08/2026 (T-568): un commit real con el valor corrupto pasó
 * sin ejecutar una sola línea de `.husky/pre-commit`.
 *
 * Causa real identificada: la librería `husky` (bin.js) toma `argv[2]` como el DIRECTORIO cuando
 * no es uno de sus subcomandos conocidos (`init`/`add`/`set`/`uninstall`/`install`) y hace
 * `git config core.hooksPath "<argv[2]>/_"` sin validar nada. Ejecutar `npx husky --version` para
 * mirar la versión instalada dispara exactamente ese camino y dejaba `core.hooksPath` en
 * `"--version/_"` — visto DOS VECES el mismo día, la segunda tras un intento previo de arreglarlo
 * a mano (ese arreglo no persiste: es una sola entrada compartida y cualquier sesión puede volver
 * a pisarla en cualquier momento).
 *
 * ## Por qué el arreglo no puede vivir DENTRO de los hooks
 *
 * Es la paradoja que bloqueó el primer intento de esta tarea: si `core.hooksPath` está corrupto,
 * git no ejecuta `.husky/pre-commit` ni `.husky/pre-push` — un self-heal escrito ahí nunca se
 * dispara cuando hace falta. Por eso este módulo lo consume `scripts/sessions/latir.cjs`, que
 * NINGÚN hook de git invoca por sí solo: lo llaman `preflight` y el CLI del backlog directamente
 * con `node`, así que corre igual con los hooks vivos o muertos.
 *
 * ## Núcleo puro
 *
 * Sin `git`, sin red, sin BD — solo la decisión. Quien lo llama (`latir.cjs`) hace las llamadas a
 * `git config` / `fs.existsSync` y le pasa lo observado.
 */

/** Valor correcto único: lo que `husky install` (bien invocado) deja siempre. */
const VALOR_CORRECTO = '.husky/_'

/**
 * ¿Hace falta arreglar `core.hooksPath`?
 *
 * @param {object} o
 * @param {string|null} o.configurado   Salida de `git config --get core.hooksPath` (null si no
 *                                       está seteado — comportamiento por defecto de git, no es
 *                                       corrupción y NO se toca).
 * @param {boolean} o.huskyDirValida    `.husky/_/pre-commit` existe de verdad en este worktree.
 *                                       Sin esto no se puede afirmar que `.husky/_` sea la
 *                                       corrección correcta — mejor no tocar nada que arreglar a
 *                                       ciegas.
 * @returns {{corrupto: boolean, motivo: string|null}}
 */
function diagnosticar({ configurado, huskyDirValida }) {
  if (!configurado) {
    return { corrupto: false, motivo: null } // sin configurar: git usa .git/hooks, no es esto
  }
  if (configurado === VALOR_CORRECTO) {
    return { corrupto: false, motivo: null }
  }
  if (!huskyDirValida) {
    // Apunta a otro sitio, pero no se puede confirmar que .husky/_ sea la respuesta correcta
    // (p.ej. un `npm install` a medias). No tocar: fail-open, igual que el resto del subsistema.
    return { corrupto: false, motivo: null }
  }
  return {
    corrupto: true,
    motivo: `core.hooksPath="${configurado}" (esperado "${VALOR_CORRECTO}") — los hooks de TODA la flota están apagados`,
  }
}

module.exports = { VALOR_CORRECTO, diagnosticar }
