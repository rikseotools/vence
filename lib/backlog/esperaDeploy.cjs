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

// ── LA PREGUNTA HERMANA: ¿y el TRABAJO de la tarea, está en main? (T-735) ────────────────────
//
// `clasificarShaEspera` (arriba) mira el sha que se ESPERA. Esta mira los commits que la tarea
// DECLARA. Son cosas distintas y confundirlas es justo lo que costó una tarde entera el 08/08:
// una ficha llevaba `✅ DESPLEGADO 50e50e08 — falta SOLO verificar`, `50e50e08` **sí** estaba en
// `origin/main` (era un merge real de esa tarde) y aun así ninguno de los commits de la tarea
// iba dentro. El marcador registra CUÁNDO se desplegó, no QUÉ.
//
// Consecuencia medida ese día sobre las 57 tareas vivas con un pendiente escrito: **5** no tenían
// NI UN commit declarante en `origin/main` (T-328, T-352, T-381, T-411, T-562), más otras dos
// (T-600, T-635) encontradas y fusionadas el mismo día. Siete en una jornada. Y no es un fallo
// silencioso benigno: se corrió el canario de T-381 y salió **rojo**, así que parecía que el
// arreglo no servía; T-352 llevaba 7 días sin emitir su evento y parecía roto. En los dos casos
// el código simplemente no estaba. Quien coge una de estas mide producción, no encuentra nada, y
// no puede distinguir «el arreglo falla» de «el arreglo no existe aquí».
//
// La prueba de que el fallo se tapa a sí mismo: entre los commits de T-328 hay uno titulado
// `docs(T-328): corrige el 'DESPLEGADO 50e50e08' falso…`. Alguien ya lo había descubierto y
// escrito — y esa corrección también vivía fuera de `main`, así que era invisible.
//
// ── POR QUÉ `sin_pushear` NO BLOQUEA AQUÍ TAMPOCO ───────────────────────────────────────────
// Pausar justo después de commitear y antes de pushear es un orden legítimo y común, y la
// función de arriba ya lo declara así. Si esta bloqueara ese mismo caso, las dos puertas del
// mismo comando se contradirían — que es exactamente el modo de fallo de [T-375]: dos criterios
// distintos sobre el mismo recurso no protegen, se estorban, y se aprende a apagar el guard
// entero. Solo bloquea el caso que NO se puede satisfacer esperando: el trabajo vive únicamente
// en otra rama.

/**
 * ¿El trabajo que declara esta tarea ha llegado a `origin/main`?
 *
 * Pura como su hermana: los hechos los mide quien llama (con `commitsDe()` de
 * `scripts/backlog/verificacion.cjs`, que ya distingue DECLARAR de CITAR — [T-403]).
 *
 * @param {{declarantes?:number, enMain?:number, enHead?:number, gitDisponible?:boolean}} hechos
 *   · `declarantes`   — cuántos commits llevan esta tarea en su ASUNTO.
 *   · `enMain`        — cuántos de ésos son alcanzables desde `origin/main`.
 *   · `enHead`        — cuántos son alcanzables desde el HEAD local.
 *   · `gitDisponible` — `false` si no se pudo preguntar a git.
 *
 * @returns {{estado:'en_main'|'sin_pushear'|'sin_fusionar'|'sin_commits'|'desconocido', bloquea:boolean, motivo:string}}
 *   · `en_main`      — hay trabajo publicado: la espera de deploy significa algo.
 *   · `sin_pushear`  — commiteado y sin publicar. **No bloquea** (ver arriba), avisa.
 *   · `sin_fusionar` — vive SOLO en otra rama. **Bloquea**: la tarea se anunciaría como «lista
 *                      para verificar» sin nada que verificar.
 *   · `sin_commits`  — ningún commit la declara. **No bloquea**: media ficha de este repo es
 *                      documentación, tooling o barridos de datos que no se despliegan, y
 *                      exigirles commits sería un sello (mismo criterio que `verificacionGate`).
 *   · `desconocido`  — git no contestó. **No bloquea**: fail-open, como el resto del andamiaje.
 */
function clasificarTrabajoEnMain({ declarantes, enMain, enHead, gitDisponible } = {}) {
  if (gitDisponible === false || !Number.isFinite(declarantes)) {
    return { estado: 'desconocido', bloquea: false, motivo: 'no se ha podido preguntar a git por los commits de la tarea' }
  }
  if (declarantes === 0) {
    return { estado: 'sin_commits', bloquea: false, motivo: 'ningún commit declara esta tarea en su asunto: no hay código que esperar' }
  }
  if (Number.isFinite(enMain) && enMain > 0) {
    return { estado: 'en_main', bloquea: false, motivo: 'hay trabajo publicado en origin/main: el deploy lo subirá' }
  }
  if (Number.isFinite(enHead) && enHead > 0) {
    return {
      estado: 'sin_pushear',
      bloquea: false,
      motivo: 'sus commits están en tu rama pero NO en origin/main: acuérdate de pushear, o la tarea esperará un deploy que no la incluye',
    }
  }
  return {
    estado: 'sin_fusionar',
    bloquea: true,
    motivo: 'ninguno de sus commits está en origin/main ni en tu rama: el trabajo vive solo en otra rama, así que ningún deploy puede incluirlo',
  }
}

module.exports = { clasificarShaEspera, clasificarTrabajoEnMain }
