/**
 * La ORDEN del rescate de un trabajador de la flota, en un solo sitio.
 *
 * Vivía incrustada dentro de `scripts/flota/flota.cjs`, y sus pruebas la comprobaban leyendo el
 * TEXTO de ese fichero con expresiones regulares (`expect(bloque).toMatch(/git push/)`). Eso
 * demuestra que la orden MENCIONA `git push`; no demuestra que rescate nada. Para poder ejecutarla
 * de verdad contra repos reales hace falta poder pedirla sin arrancar el supervisor entero — y si
 * la simulación la reconstruyera a mano estaría probando una COPIA, que es como divergen dos
 * escritores del mismo hecho.
 *
 * Aquí no se decide nada ni se toca nada: se devuelve una cadena. Quien la ejecuta es el
 * supervisor (en la máquina del trabajador) o la simulación (en un repo desechable).
 */

/**
 * @param {object} o
 * @param {string} o.arbol        Ruta del worktree del trabajador.
 * @param {string} o.trabajador   Nombre del trabajador (`w1`, `l3`…). Va dentro de la rama.
 * @param {boolean} [o.conGuardas] Añadir los escapes de los push-guards (false en simulación:
 *                                 un repo desechable no tiene hooks, y meterlos ahí escondería
 *                                 que en producción SÍ se están saltando).
 * @returns {string} orden de shell, para `bash -lc`.
 */
function ordenRescate({ arbol, trabajador, conGuardas = true }) {
  if (!arbol || !trabajador) throw new Error('ordenRescate: hacen falta arbol y trabajador')

  // ── POR QUÉ ESTO SÍ SE PUEDE AUTOMATIZAR, Y `reset --hard` NO ────────────────────────────
  // Rescatar es puramente ADITIVO: commit en su propia rama y push. En el peor caso deja un
  // commit de más, que se descarta leyéndolo. Lo que destruye es lo contrario.
  //
  // `--no-verify` a propósito: un commit de rescate no INTRODUCE trabajo, lo CONSERVA. Las
  // comprobaciones tienen que pasar cuando alguien lleve eso a `main`, no para impedir que se
  // guarde. Sin esto el rescate moriría en el mismo `pre-commit` que ya bloqueó al trabajador.
  const mensaje = [
    'wip: trabajo puesto a salvo por el supervisor de la flota',
    '',
    'Su turno termino sin commitear esto. Se conserva TAL CUAL, sin revisar ni',
    'completar: rescatar no es aprobar. Quien retome la tarea decide que hacer.',
    '',
    'Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>',
  ].join('\n')

  const escapes = conGuardas
    ? 'BACKLOG_GUARD_SKIP="rescate del supervisor: pone a salvo lo que un trabajador dejo sin ' +
      'empujar, en una referencia NUEVA; no se esta trabajando ninguna tarea" ' +
      'ROBUSTEZ_GUARD_SKIP=1 CONTEXTO_GUARD_SKIP=1 '
    : ''

  return [
    `cd ${arbol} 2>/dev/null || exit 90`,
    'SUCIO=$(git status --porcelain | wc -l)',
    // Lo que hay que proteger es el commit que no está en NINGÚN remoto, no el que va por delante
    // de `origin/main`: los trabajadores trabajan en su propia rama.
    'FUERA=$(git rev-list --count HEAD --not --remotes 2>/dev/null || echo 0)',
    '[ "$SUCIO" = "0" ] && [ "$FUERA" = "0" ] && echo NADA && exit 0',
    `if [ "$SUCIO" != "0" ]; then git add -A && git commit -q --no-verify -m "${mensaje}"; fi`,
    // ── LA REFERENCIA ES NUEVA CADA VEZ, Y ESO ES EL DISEÑO ────────────────────────────────
    // Empujar a `sesion/<w>` falló con `non-fast-forward` en cuanto una rama ya había divergido
    // (l6, 05/08). Y la salida cómoda —`--force`— es exactamente lo que un rescate NO puede
    // hacer: destruiría lo que hubiera en el remoto, o sea justo lo que venía a proteger.
    // Una referencia nueva no puede chocar con nada, y como lleva el SHA dentro, rescatar dos
    // veces el mismo commit escribe la MISMA ref: idempotente sin comprobar nada.
    `RAMA=rescate/${trabajador}-$(git rev-parse --short HEAD)`,
    'echo RAMA=$RAMA',
    `${escapes}git push -q origin HEAD:refs/heads/$RAMA 2>&1 | tail -2`,
    // El veredicto no se saca del código de salida del push (el `| tail` lo enmascara) sino de
    // volver a preguntar qué queda fuera de los remotos. Si el push falló, esto no da 0.
    'echo SALVADO=$(git rev-list --count HEAD --not --remotes)',
  ].join('; ')
}

module.exports = { ordenRescate }
