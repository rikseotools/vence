'use strict'
/**
 * Los HECHOS de git sobre una ficha del backlog. Aquí no se decide nada: se pregunta al repositorio
 * y se contesta con datos. La decisión vive en `fichaHuerfana.cjs` y el formato, en el CLI.
 *
 * ## Por qué esto es un módulo aparte y no cuatro funciones dentro de `scripts/backlog.cjs` (T-427)
 *
 * El 29/07 se construyó la decisión pura y se testeó bien. Dos días después, el incidente que tenía
 * que cazar pasó igual y el `sync` lo anunció como sano. **El núcleo puro acertaba con los datos que
 * le daban; los datos estaban mal.** Nadie lo vio porque la parte que habla con git vivía dentro de
 * un CLI que arranca conectándose a la BD, así que no había forma de testearla — y lo no testeable
 * se convierte en el sitio donde se esconden los fallos.
 *
 * Con el `cwd` y el `ref` inyectados, un test puede montar un repositorio de mentira que reproduzca
 * el incidente EXACTO (un worktree nacido antes de que existiera la ficha ajena, la ficha pusheada
 * después por otra sesión, y un commit que la borra) y ejercitar estas mismas funciones.
 *
 * ## La regla de fondo
 *
 * La prueba de que una ficha existió NO está en mi rama: está en `origin/main`, que es lo único que
 * comparten las 2-10 sesiones. Un worktree nace de `origin/main` en un instante T0 y no alcanza nada
 * de lo que se pushee después — es decir, es ciego precisamente para las fichas AJENAS, que son las
 * que este detector protege.
 */

const { execFileSync } = require('child_process')
const path = require('path')

const MD_REL_POR_DEFECTO = path.join('docs', 'roadmap', 'tareas-pendientes.md')
const REF_POR_DEFECTO = 'origin/main'

/** Marca con la que se busca la ficha. Es la cabecera, no el id suelto: `T-418` sale citado en mil sitios. */
const marcaDe = (id) => `### [${id}]`

/**
 * git de SOLO LECTURA. Devuelve el stdout recortado, o `null` si git no pudo contestar.
 *
 * `null` es «no lo sé», y no se confunde con `''` («contestó y no hay nada»). Esa diferencia es la
 * que permite decir `no_verificable` en vez de dar un verde inventado.
 */
function gitOut(args, { cwd, timeout = 15_000, maxBuffer = MAX_BUFFER } = {}) {
  try {
    return execFileSync('git', args,
      { cwd, env: envSinGit(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout, maxBuffer })
      .trim()
  } catch {
    return null
  }
}

/**
 * El entorno SIN variables `GIT_*`, y es una condición de corrección, no una manía.
 *
 * Estas funciones prometen contestar sobre el repositorio del `cwd` que se les pasa. Pero
 * `GIT_DIR`, `GIT_WORK_TREE` y `GIT_INDEX_FILE` **le ganan al `cwd`**, y git las exporta a todos
 * sus hooks: cualquier cosa lanzada desde un `pre-commit`/`pre-push` (o desde un script que a su
 * vez corra dentro de uno) hablaría con OTRO repositorio mientras cree que habla con el del `cwd`.
 * Sin esto, la respuesta sería incorrecta sin dar ningún síntoma — que es la peor clase de fallo y
 * justo la que este módulo existe para eliminar.
 *
 * Se descubrió por la vía dolorosa: la suite de este módulo, ejecutada por el `pre-commit`, acabó
 * commiteando sus repositorios de prueba sobre la rama del worktree real.
 */
function envSinGit() {
  const env = { ...process.env }
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k]
  return env
}

/**
 * 64 MB, y NO es un número al azar: el markdown del backlog pesa **2,2 MB** con 415 fichas y crece
 * cada día. El `maxBuffer` por defecto de `execFileSync` es 1 MB, así que `git show` reventaba con
 * ENOBUFS, `gitOut` devolvía `null` y —antes de arreglarlo— eso se leía como «la ficha no está en
 * origin»: el detector acusaba de BORRADA a la primera ficha huérfana que se le puso delante
 * (T-431, capturado al correr el `sync` de verdad; los tests pasaban porque su repo de prueba tiene
 * un markdown de tres líneas).
 *
 * Un detector que grita en falso se ignora en una semana y entonces ya no protege de nada — que es
 * literalmente lo que mide `npm run sesiones:friccion`. Por eso hay DOS defensas: este techo, y que
 * `hechosDeOrigin` se niegue a contestar cuando no ha podido leer el fichero.
 */
const MAX_BUFFER = 64 * 1024 * 1024

/**
 * ¿La ficha ESTUVO alguna vez en el markdown de MI rama?
 *
 * Sirve para cazar la regresión local (me la llevé yo por delante y aún no lo he pusheado), pero
 * **no puede descartar nada**: ver arriba. Por eso el clasificador nunca da un verde con solo esto.
 *
 * FAIL-OPEN a `false`: si git no puede contestar, lo que NO se puede hacer es inventarse una
 * regresión y mandar a alguien a buscar una ficha que nunca existió.
 */
function estuvoEnElHistorialLocal(id, { cwd, mdRel = MD_REL_POR_DEFECTO } = {}) {
  const out = gitOut(['log', '--format=%h', '-S', marcaDe(id), '--', mdRel], { cwd })
  return out !== null && out.length > 0
}

/**
 * Lo que `origin/main` —y NO mi rama— puede contestar sobre una ficha.
 *
 * @returns {{consultable: boolean, estaAhora: boolean, estuvo: boolean}}
 *   `consultable:false` cuando no hay ref de origin (clon sin remoto, repo recién creado) o git no
 *   contesta. Ahí se dice «no lo sé», nunca «está bien».
 */
function hechosDeOrigin(id, { cwd, mdRel = MD_REL_POR_DEFECTO, ref = REF_POR_DEFECTO } = {}) {
  const noSe = { consultable: false, estaAhora: false, estuvo: false }
  if (!gitOut(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd })) return noSe
  const marca = marcaDe(id)
  const md = gitOut(['show', `${ref}:${mdRel}`], { cwd })
  const historial = gitOut(['log', '--format=%h', '-S', marca, ref, '--', mdRel], { cwd })
  // Si no se pudo LEER el fichero en esa ref, no se contesta. Es el fallo que se coló en el primer
  // estreno: `md === null` se trataba como «no contiene la ficha», y de ahí sale una acusación de
  // borrado con el fichero delante. La asimetría es deliberada — decir «no lo sé» cuesta una
  // comprobación manual; decir «te la han borrado» cuando no es verdad cuesta la credibilidad del
  // aviso, y un aviso desacreditado no vuelve.
  if (md === null) return noSe
  if (historial === null) return noSe
  return {
    consultable: true,
    estaAhora: (md || '').includes(marca),
    estuvo: (historial || '').length > 0,
  }
}

/**
 * El commit que se llevó la ficha por delante: el último de `ref` que cambió su número de
 * ocurrencias. Se nombra en el aviso porque «recupérala» sin decir de dónde obliga a investigar
 * antes de poder arreglar, y esto se lee a las 2 de la mañana resolviendo un conflicto.
 */
function commitQueLaQuito(id, { cwd, mdRel = MD_REL_POR_DEFECTO, ref = REF_POR_DEFECTO } = {}) {
  return gitOut(['log', '-1', '--format=%h %an — %s', '-S', marcaDe(id), ref, '--', mdRel], { cwd })
    || null
}

/**
 * Refresca la ref compartida antes de opinar. Sin esto, una ficha borrada hace diez minutos se ve
 * «todavía presente» y el aviso llega tarde.
 *
 * Best-effort y con techo de tiempo: que no haya red no puede dejar colgado al que lo llama, y el
 * caso se degrada solo hacia `desactualizada`/`no_verificable`, que son avisos honestos.
 * @returns {boolean} si se pudo refrescar (informativo; nadie debe ramificar en esto para decidir).
 */
function refrescarOrigin({ cwd, remoto = 'origin', rama = 'main', timeout = 20_000 } = {}) {
  return gitOut(['fetch', '--quiet', remoto, rama], { cwd, timeout }) !== null
}

module.exports = {
  gitOut,
  estuvoEnElHistorialLocal,
  hechosDeOrigin,
  commitQueLaQuito,
  refrescarOrigin,
  marcaDe,
  MD_REL_POR_DEFECTO,
  REF_POR_DEFECTO,
}
