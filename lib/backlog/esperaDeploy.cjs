// lib/backlog/esperaDeploy.cjs — ¿este sha puede desplegarse ALGÚN día? (T-620)
//
// ── EL DEFECTO ───────────────────────────────────────────────────────────────────────────────
// `pause --tras-deploy <sha>` guarda el sha y `deployed` despierta la tarea cuando ese commit
// está CONTENIDO en el desplegado (`git merge-base --is-ancestor`). La comprobación es correcta
// y el fallo está antes: **nadie mira si el sha puede llegar a estar contenido en algo**. Si no
// puede, la espera es imposible y la tarea se duerme para siempre, sin error y sin rastro —
// `list` la enseña como «esperando deploy», que es indistinguible de una espera legítima.
//
// ── DOS FORMAS DE LLEGAR AHÍ, LAS DOS MEDIDAS EL 06/08/2026 ─────────────────────────────────
//  1. **Commit de RAMA.** Al rescatar `flota/w3` a `main`, sus tareas esperaban `2fefc60e` y
//     `cdc323e6`, commits que solo existían en la rama. Al traer el trabajo con cherry-pick los
//     shas cambian, así que el original no llegará nunca. Tres tareas (T-159, T-270, T-319)
//     habrían quedado dormidas indefinidamente; se repuntaron a mano al darse cuenta.
//  2. **Sha REESCRITO por un rebase posterior** — y esta es la traicionera, porque la comete
//     quien hace todo bien: se pausa con el sha recién commiteado, luego el push se rechaza por
//     no-ff, se rebasa, y el rebase le da un sha NUEVO al mismo trabajo. El viejo ya no existe
//     en ninguna rama. Pasó con [T-609] en la misma sesión que escribió esto (`313355c09` →
//     `6bf2ffd17`), o sea que conocer el defecto no basta para esquivarlo.
//
// ── POR QUÉ SE DECIDE AQUÍ Y NO AL DESPERTAR ────────────────────────────────────────────────
// Se podría intentar adivinar en `deployed` («¿habrá un commit equivalente?»), pero eso es
// comparar parches y ya sabemos cómo acaba: `git cherry` da falsos positivos en cuanto alguien
// reescribe el contenido. El principio de la casa es **impedir en el punto de ESCRITURA**: aquí
// se sabe con certeza si el sha es alcanzable, y quien pausa está delante para corregirlo.

/**
 * Clasifica un sha de espera a partir de hechos que ya midió quien llama (esta función no toca
 * git: así se testea sin repositorio y el criterio vive en UN sitio).
 *
 * @param {{enOriginMain?:boolean, enHead?:boolean, existe?:boolean}} hechos
 *   · `existe`       — git reconoce el objeto. `false` = sha inventado o commit purgado.
 *   · `enOriginMain` — alcanzable desde `origin/main` (ya publicado).
 *   · `enHead`       — alcanzable desde el HEAD local (commiteado, pendiente de pushear).
 *
 * @returns {{estado:'desplegable'|'sin_pushear'|'inalcanzable'|'desconocido', bloquea:boolean, motivo:string}}
 *   · `desplegable`  — está en `origin/main`: el próximo deploy lo sube. Caso normal.
 *   · `sin_pushear`  — está en tu HEAD pero no publicado. **No bloquea**: pausar antes de
 *                      pushear es un orden legítimo y muy común. Avisa, porque si ese push
 *                      acaba en rebase el sha cambiará (la forma 2 de arriba).
 *   · `inalcanzable` — ni publicado ni en tu HEAD: la espera NO se puede satisfacer. Bloquea.
 *   · `desconocido`  — git no pudo contestar. **No bloquea**: fail-open, como el resto del
 *                      andamiaje, porque aquí no hay nada irreversible que proteger — lo peor
 *                      que pasa es que la tarea espere, que es lo que ya hacía.
 */
function clasificarShaEspera({ enOriginMain, enHead, existe } = {}) {
  if (existe === false) {
    return {
      estado: 'inalcanzable',
      bloquea: true,
      motivo: 'git no reconoce ese commit: o está mal escrito, o se purgó al reescribir la historia',
    }
  }
  if (enOriginMain === true) {
    return { estado: 'desplegable', bloquea: false, motivo: 'publicado en origin/main: el próximo deploy lo sube' }
  }
  if (enHead === true) {
    return {
      estado: 'sin_pushear',
      bloquea: false,
      motivo: 'commiteado pero SIN pushear todavía: acuérdate de publicarlo, y si el push acaba en rebase el sha cambiará y habrá que repuntar la espera',
    }
  }
  if (enOriginMain === false && enHead === false) {
    return {
      estado: 'inalcanzable',
      bloquea: true,
      motivo: 'ese commit no está en origin/main NI en tu rama: vive solo en otra rama, o lo reescribió un rebase. La espera no se puede cumplir y la tarea se dormiría para siempre',
    }
  }
  return { estado: 'desconocido', bloquea: false, motivo: 'no se ha podido comprobar el sha contra git' }
}

module.exports = { clasificarShaEspera }
