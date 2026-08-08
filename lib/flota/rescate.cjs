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
      'ROBUSTEZ_GUARD_SKIP=1 CONTEXTO_GUARD_SKIP="rescate de trabajo varado en la máquina de un trabajador" '
    : ''

  return [
    `cd ${arbol} 2>/dev/null || exit 90`,
    // ── SI EL TRABAJADOR ESTÁ COMMITEANDO, NO SE LE TOCA ───────────────────────────────────
    // El rescate hace `git add -A && git commit`, y eso choca con un commit en curso: el 06/08
    // reventó con «Unable to create index.lock: File exists» mientras w1 tenía un `git commit`
    // vivo. Forzar ahí es lo peor que puede hacer un rescate — puede dejar el índice a medias del
    // que SÍ estaba trabajando. Un `index.lock` NO es basura por defecto: primero se mira si hay
    // un git vivo, y si lo hay se sale sin tocar nada (el siguiente pase lo recogerá).
    'if [ -f .git/index.lock ] || [ -f "$(git rev-parse --git-dir)/index.lock" ] 2>/dev/null; then ' +
      'pgrep -u "$(id -u)" -f "^git " >/dev/null && { echo OCUPADO; exit 0; }; fi',
    'SUCIO=$(git status --porcelain | wc -l)',
    // ── SE MIRAN TODAS LAS RAMAS, NO SOLO `HEAD` ──────────────────────────────────────────
    // La primera versión miraba `HEAD --not --remotes`, y el 05/08 dio «nada que salvar» en las
    // cuatro máquinas del VPS **teniendo 22 commits sin empujar**: los trabajadores entregan en
    // una rama por tarea (`flota/T-525-…`, `sesion/w3`…) y luego vuelven a `main`, así que lo
    // entregado nunca es `HEAD`. El rescate miraba justo donde no estaba el trabajo.
    // Lo que hay que proteger es el commit que no está en NINGÚN remoto, esté en la rama que esté.
    'FUERA=$(git rev-list --count --branches --not --remotes 2>/dev/null || echo 0)',
    '[ "$SUCIO" = "0" ] && [ "$FUERA" = "0" ] && echo NADA && exit 0',
    `if [ "$SUCIO" != "0" ]; then git add -A && git commit -q --no-verify -m "${mensaje}"; fi`,
    // ── LA REFERENCIA ES NUEVA CADA VEZ, Y ESO ES EL DISEÑO ────────────────────────────────
    // Empujar a `sesion/<w>` falló con `non-fast-forward` en cuanto una rama ya había divergido
    // (l6, 05/08). Y la salida cómoda —`--force`— es exactamente lo que un rescate NO puede
    // hacer: destruiría lo que hubiera en el remoto, o sea justo lo que venía a proteger.
    // Una referencia nueva no puede chocar con nada, y como lleva el SHA dentro, rescatar dos
    // veces la misma rama escribe la MISMA ref: idempotente sin comprobar nada.
    'for R in $(git for-each-ref --format="%(refname:short)" refs/heads); do ' +
      'N=$(git rev-list --count "$R" --not --remotes 2>/dev/null || echo 0); ' +
      '[ "$N" = "0" ] && continue; ' +
      // El nombre de la rama va dentro para que se sepa QUÉ se rescató sin abrir el commit; las
      // barras se aplanan porque `rescate/w1-flota/T-1` y `rescate/w1-flota` no pueden coexistir.
      `RAMA=rescate/${trabajador}-$(echo "$R" | tr '/' '-')-$(git rev-parse --short "$R"); ` +
      'echo RAMA=$RAMA; ' +
      // ── Y DE QUÉ RAMA VIENE, para poder empujarla desde OTRA máquina si hiciera falta (T-628) ─
      // El 06/08 este `git push` fallaba siempre en el VPS (sin credenciales de git, medido: 11
      // ramas atrapadas, una con un bug de producción); desde el 08/08 SÍ tiene con qué empujar
      // (T-486/T-628, ver `maquinas.cjs`: `tieneCredencialesGit:true`, medido en vivo), así que
      // `necesitaSegundaFase` ya no dispara aquí. El mecanismo del par se conserva a propósito
      // para cualquier máquina que SÍ carezca de credenciales (o vuelva a carecer de ellas): el
      // portátil necesita saber QUÉ ref traerse y CON QUÉ NOMBRE dejarla — y ese nombre tiene
      // que ser el MISMO, no uno recalculado allí: dos generadores del mismo nombre divergen
      // (T-130). Por eso se emite el par, y el namer sigue siendo este único.
      'echo ORIGEN=$R\\|$RAMA; ' +
      `${escapes}git push -q origin "$R:refs/heads/$RAMA" 2>&1 | tail -2; ` +
    'done',
    // El veredicto no se saca del código de salida del push (el `| tail` lo enmascara) sino de
    // volver a preguntar qué queda fuera de los remotos. Si algún push falló, esto no da 0.
    'echo SALVADO=$(git rev-list --count --branches --not --remotes)',
  ].join('; ')
}

/**
 * Lee la salida del rescate. Existe para que `flota.cjs` y la simulación entiendan lo MISMO —
 * hoy cada uno la parsea con su propia expresión regular, que es como divergen dos lectores.
 *
 * @param {string} salida
 * @returns {{ocupado:boolean, nada:boolean, salvado:number|null, pares:Array<{origen:string,destino:string}>}}
 *   · `salvado` = commits que SIGUEN fuera de todo remoto tras intentarlo. 0 = todo a salvo.
 *     `null` = el rescate no llegó a decirlo (se cortó antes).
 */
function parsearRescate(salida) {
  const t = String(salida || '')
  const m = t.match(/^SALVADO=(\d+)$/m)
  return {
    ocupado: /^OCUPADO$/m.test(t),
    nada: /^NADA$/m.test(t),
    salvado: m ? Number(m[1]) : null,
    pares: [...t.matchAll(/^ORIGEN=(.+?)\|(.+)$/gm)].map((x) => ({ origen: x[1].trim(), destino: x[2].trim() })),
  }
}

/**
 * ¿Hay que rematar el rescate DESDE OTRO SITIO? (T-628)
 *
 * El rescate corre en la máquina del trabajador y empuja desde allí. En el VPS ese push falla
 * siempre —sin credenciales de git— así que el trabajo queda identificado y quieto. El portátil
 * es el único sitio con las DOS mitades (acceso SSH a la máquina y credenciales del repo), así
 * que remata: se trae las refs y las empuja con el nombre que ya calculó el rescate.
 *
 * ⚠️ **Se mira `tieneCredencialesGit`, NUNCA `.local`.** Antes miraba `.local` — "¿quien llama
 * está en la misma máquina que el trabajador?" — y no "¿esta máquina tiene con qué empujar?".
 * Coinciden en el portátil (quien llama SIEMPRE tiene sus credenciales), pero NO en el VPS: el
 * supervisor systemd corre con `VENCE_FLOTA_AQUI=flota-1` (T-617), así que para él
 * `maquinaDe('w1').local` da `true` — y con el criterio viejo eso bastaba para decir "no hace
 * falta, su propio push vale", cuando ese push NUNCA vale en esa máquina. Medido: con ese mismo
 * `VENCE_FLOTA_AQUI` (el de producción), `necesitaSegundaFase` devolvía `hace_falta:false` con
 * 2 commits confirmados fuera de todo remoto. `tieneCredencialesGit` es una propiedad DE LA
 * MÁQUINA (`lib/flota/maquinas.cjs`), no de quien pregunta, así que no depende de quién llama.
 *
 * @param {{tieneCredencialesGit?:boolean}} maquina  el objeto que devuelve `MAQ.maquinaDe(w)`
 * @param {{salvado:number|null, pares:Array}} parsed
 */
function necesitaSegundaFase(maquina, parsed) {
  if (!maquina) return { hace_falta: false, motivo: 'máquina no declarada' }
  if (maquina.tieneCredencialesGit) return { hace_falta: false, motivo: 'esta máquina sí tiene credenciales: su propio push es el bueno' }
  if (!parsed || !parsed.pares || !parsed.pares.length) return { hace_falta: false, motivo: 'no hay ramas que rescatar' }
  if (parsed.salvado === 0) return { hace_falta: false, motivo: 'el rescate ya las empujó (la máquina sí tenía credenciales)' }
  return {
    hace_falta: true,
    motivo: `${parsed.pares.length} rama(s) identificadas y ${parsed.salvado === null ? 'sin confirmar' : parsed.salvado} commit(s) aún fuera de todo remoto`,
  }
}

module.exports = { ordenRescate, parsearRescate, necesitaSegundaFase }
