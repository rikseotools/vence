/**
 * ¿Puede `deploy-cuando-verde.sh` hacer `git reset --hard origin/main` en este árbol?
 *
 * ## El hueco que cierra (T-443 punto 6)
 *
 * El lanzador resetea el árbol desde el que corre **en cada vuelta** (hasta 12), porque
 * despliega exactamente el SHA cuyo CI ha verificado. Ya tenía dos protecciones:
 *
 *   1. `guardia_worktree` — avisa a QUIEN LANZA si lo hace desde su worktree de trabajo.
 *   2. se niega a correr con el árbol **SUCIO** (ficheros trackeados sin commitear).
 *
 * Ninguna de las dos cubre el caso que destruyó trabajo dos veces el 05/08/2026: un árbol
 * **limpio** con **commits locales que aún no están en `origin/main`**. `git status` sale
 * impecable, el lanzador resetea, y esos commits desaparecen de la rama en silencio (quedan
 * en el reflog, pero solo los recupera quien sepa que los ha perdido). Con 2-10 sesiones
 * compartiendo el checkout principal basta con **commitear mientras alguien despliega**, que
 * es la situación normal. La segunda vez fue el lanzador de OTRA sesión, arrancado 97 s antes.
 *
 * Es distinto del árbol sucio y por eso la guarda de arriba no lo veía: allí el trabajo aún
 * no es un commit; aquí YA es un commit y se pierde igual. Y es peor, porque el commit da
 * sensación de estar a salvo.
 *
 * ## Por qué BLOQUEA (y no avisa, como el guard de código suprimido)
 *
 * La regla de la casa es no bloquear lo que se dispara a menudo y casi siempre es legítimo
 * (T-375: un guardarraíl que se salta siempre se acaba saltando siempre). Aquí es al revés:
 * la condición es **rara** (el checkout principal normalmente está en `origin/main`), la
 * consecuencia es **destrucción irreversible-en-la-práctica** de trabajo ajeno, y se satisface
 * con UN comando (`git push`) o cambiando de árbol. Mismo criterio que el guard del índice
 * compartido de T-415, que sí bloquea por las mismas tres razones.
 *
 * ## Escape
 *
 * `DEPLOY_RESET_OK="<motivo>"`, con MOTIVO obligatorio — igual que `INDICE_COMPARTIDO_OK` y
 * `BACKLOG_GUARD_SKIP` desde T-496/T-497: un `=1` se convierte en un prefijo que se copia de
 * un comando a otro y deja de ser una decisión.
 */

/** Un motivo de escape que no dice nada no es un motivo. */
function motivoValido(motivo) {
  const m = String(motivo || '').trim()
  if (m.length < 6) return false
  return !/^(1|true|si|sí|ok|ya|yes|x)$/i.test(m)
}

/**
 * Decide si se puede resetear.
 *
 * @param {object} e
 * @param {number|null} e.commitsPorDelante  commits de HEAD que NO están en origin/main
 *                                           (`git rev-list --count origin/main..HEAD`).
 *                                           `null` = no se pudo medir.
 * @param {string[]} [e.resumenCommits]      líneas «sha asunto» para enseñar cuáles son.
 * @param {string} [e.escape]                valor de DEPLOY_RESET_OK.
 * @returns {{permite:boolean, motivo:string, mensaje:string, escapeUsado:boolean}}
 */
function puedeResetear({ commitsPorDelante, resumenCommits = [], escape = '' } = {}) {
  // No se pudo medir: NO se opina. Es un `git rev-list` local, así que si falla el problema
  // es otro; bloquear aquí pararía deploys por una avería que no tiene que ver con esto.
  if (commitsPorDelante == null || Number.isNaN(commitsPorDelante)) {
    return {
      permite: true,
      motivo: 'sin_medir',
      escapeUsado: false,
      mensaje: '⚠️  no se pudo comprobar si hay commits sin empujar (sigo, pero míralo)',
    }
  }

  if (commitsPorDelante <= 0) {
    return { permite: true, motivo: 'limpio', escapeUsado: false, mensaje: '' }
  }

  const lista = resumenCommits.length
    ? '\n' + resumenCommits.map((l) => `     · ${l}`).join('\n')
    : ''
  const cuerpo =
    `❌ este árbol tiene ${commitsPorDelante} commit(s) que NO están en origin/main, y ` +
    `'git reset --hard origin/main' se los llevaría por delante EN SILENCIO ` +
    `(el árbol está limpio, así que la guarda de "árbol sucio" no los ve).${lista}\n` +
    `   → si son tuyos:      git push origin HEAD:main   (y relanza)\n` +
    `   → si NO son tuyos:   otra sesión está trabajando aquí. Despliega desde otro árbol.\n` +
    `   → si aun así procede: DEPLOY_RESET_OK="por qué" ${'bash scripts/deploy-cuando-verde.sh …'}`

  if (motivoValido(escape)) {
    return {
      permite: true,
      motivo: 'escape',
      escapeUsado: true,
      mensaje:
        `⚠️  DEPLOY_RESET_OK usado: "${String(escape).trim()}" — se descartan ` +
        `${commitsPorDelante} commit(s) locales a propósito.`,
    }
  }

  if (String(escape || '').trim()) {
    return {
      permite: false,
      motivo: 'escape_sin_motivo',
      escapeUsado: false,
      mensaje:
        `${cuerpo}\n\n   (DEPLOY_RESET_OK necesita un MOTIVO de verdad, no "${String(escape).trim()}")`,
    }
  }

  return { permite: false, motivo: 'commits_sin_empujar', escapeUsado: false, mensaje: cuerpo }
}

module.exports = { puedeResetear, motivoValido }
