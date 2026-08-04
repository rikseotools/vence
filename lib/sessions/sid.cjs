// lib/sessions/sid.cjs — quién soy: el session-id, resuelto de UNA sola forma. (T-407, 31/07/2026)
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
// Todo el reparto de trabajo entre sesiones cuelga de este identificador: el claim del backlog y
// su lease, la cola de impugnaciones, el guardarraíl de push, el latido y el mapa de solape. Si
// dos herramientas del MISMO worktree resuelven identidades distintas, ese andamiaje entero
// empieza a mentir sin romperse — que es la peor forma de fallar.
//
// Y estaba pasando. El 31/07 lo reportó una sesión: el dossier de una impugnación la avisaba de
// que la tarea la tenía «otra sesión» siendo **ella misma**. Al mirarlo había **SEIS copias** de
// esta función con **DOS reglas distintas**:
//
//   · fichero primero  → backlog.cjs · backlog-push-guard.cjs · cola.cjs · latir.cjs · deploy-marcar.cjs
//   · SOLO la variable → revisar-impugnacion.cjs · revisar-feedback.cjs
//
// Así que en un worktree con `.session-id` (los crea `crear-worktree.sh`, o sea TODOS los creados
// con el tooling), `cola.cjs` reclamaba con el id del fichero y `revisar-impugnacion.cjs`
// comparaba contra el de la variable de entorno: el mismo trabajo, dos identidades, y un aviso de
// colisión contra uno mismo. Cosmético en ese aviso concreto; **no** cosmético en lo demás — un
// claim tomado bajo una identidad no se puede soltar con la otra.
//
// ── EL ORDEN, Y POR QUÉ ES ESE ───────────────────────────────────────────────────────────────
//   1. `--sid <x>` en la línea de órdenes — lo explícito manda siempre.
//   2. `.session-id` del directorio actual, y si no, el del repo.
//   3. `CLAUDE_CODE_SESSION_ID`.
//
// El FICHERO gana a la variable a propósito: el fichero es del WORKTREE (lo escribe
// `crear-worktree.sh` al crear la sesión y describe dónde estás trabajando), mientras que la
// variable la pone el entorno del proceso y puede venir heredada de otra parte. Ante la duda, la
// identidad la manda el sitio donde está el trabajo.
//
// `.cjs` como el resto del andamiaje: lo requieren scripts de node pelado (incluido un hook de
// husky), así que no puede ser TypeScript ni tener una copia que se desincronice.
//
// ── LA MÁQUINA, Y POR QUÉ NO SE METE DENTRO DEL SID EXISTENTE (T-484, 02/08/2026) ────────────
// Con sesiones en servidores remotos (Koigrid) además del portátil, «quién soy» deja de bastar:
// hace falta «quién soy Y DÓNDE». Dos worktrees en `/app/vence` de dos contenedores distintos no
// comparten absolutamente nada, y el andamiaje los veía como el mismo sitio.
//
// Pero el sid de las sesiones YA VIVAS no se reescribe, a propósito: un claim tomado bajo una
// identidad no se puede soltar con otra, que es exactamente la avería que costó [T-407]. Así que
// la máquina viaja **al lado** del sid (`resolverSid().host`) y solo se estampa en los sid que
// NACEN a partir de ahora (`nuevoSid`). Lo viejo sigue funcionando igual; lo nuevo es único por
// construcción.

const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * En qué MÁQUINA corre esta sesión. (T-484)
 *
 * `VENCE_SESSION_HOST` manda sobre el hostname porque en un contenedor el hostname es un hash que
 * cambia en cada arranque: sin poder fijarlo, un trabajador de la flota sería una máquina distinta
 * cada vez que se reinicia y el mapa de sesiones se llenaría de fantasmas.
 *
 * Se normaliza a nombre CORTO y minúsculas para que `koigrid-w1` y `koigrid-w1.local` no pasen por
 * dos máquinas — un comparador que se cree eso bloquearía commits por un sufijo de DNS.
 *
 * @returns {string|null} `null` si no se puede saber. **No** se inventa un valor por defecto:
 *   quien compare tiene que poder distinguir «otra máquina» de «no lo sé» (misma regla que la
 *   huella de [T-400] y que `clasificarRun` de [T-404]).
 */
/** Nombre corto y en minúsculas, o `null`. Una SOLA normalización para todo el que compare. */
function normalizarHost(v) {
  if (!v) return null
  const n = String(v).trim().toLowerCase().split('.')[0]
  return n || null
}

function maquina(opts = {}) {
  const env = opts.env || process.env
  if (env.VENCE_SESSION_HOST) return normalizarHost(env.VENCE_SESSION_HOST)
  // `hostname` es el punto de inyección de `os.hostname()`: si lo pasan, manda — incluso si viene
  // vacío. Caer al hostname real cuando el inyectado dice «nada» haría que el caso «no se puede
  // saber» fuese intesteable, y ese es justo el estado que hay que poder afirmar.
  const dado = 'hostname' in opts
    ? (typeof opts.hostname === 'function' ? opts.hostname() : opts.hostname)
    : (() => { try { return os.hostname() } catch { return null } })()
  return normalizarHost(dado)
}

/**
 * ¿Son la MISMA máquina? `true` / `false` / **`null` = no se puede afirmar**. (T-484)
 *
 * Vive aquí, y no en quien la usa, porque la usan dos cosas con consecuencias opuestas —el guard
 * del índice (ante la duda, bloquea) y el detector de identidad compartida (ante la duda, calla)—
 * y **dos comparadores del mismo hecho con criterios distintos no protegen: se contradicen**. Es
 * la lección de los cinco escritores de `seguimiento_url` de [T-130] y de los seis resolvedores de
 * sid de [T-407]. Lo que cada quien decide con el `null` es suyo; el hecho es uno solo.
 */
function mismaMaquina(a, b) {
  const x = normalizarHost(a)
  const y = normalizarHost(b)
  if (!x || !y) return null
  return x === y
}

/**
 * Un session-id NUEVO, único por construcción. (T-484)
 *
 * Existe para que haya **una sola forma** de acuñar identidad: lo usa `crear-worktree.sh` y lo
 * tiene que usar el arranque de cualquier trabajador remoto. Si el contenedor se inventa la suya,
 * volvemos a tener dos reglas para lo mismo — que es como nacieron los cinco escritores de
 * `seguimiento_url` de [T-130] y las seis copias de este mismo resolvedor en [T-407].
 *
 * ⚠️ **El sid se acuña al ARRANCAR la sesión, nunca se hornea en una imagen.** N contenedores
 * clonados de una imagen con `.session-id` dentro comparten identidad, y entonces comparten claim:
 * uno suelta la tarea de otro creyéndola suya. Que eso no dependa de recordarlo es el trabajo del
 * latido, que lo detecta y lo canta (`scripts/sessions/latir.cjs`).
 */
function nuevoSid(slug, opts = {}) {
  const base = String(slug || 'sesion').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'sesion'
  const azar = opts.azar || (() => require('crypto').randomBytes(3).toString('hex'))
  const host = 'host' in opts ? opts.host : maquina(opts)
  return [base, host, azar()].filter(Boolean).join('-')
}

/**
 * Resuelve el session-id.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.argv]  argumentos donde buscar `--sid` (por defecto, los del proceso)
 * @param {string}   [opts.cwd]   directorio actual
 * @param {string}   [opts.repo]  raíz del repo (para el `.session-id` compartido)
 * @param {object}   [opts.env]   entorno
 * @returns {{ sid: string|null, origen: 'flag'|'fichero'|'entorno'|null, base: string, host: string|null }}
 *   `origen` no es adorno: cuando dos herramientas discrepan, saber de DÓNDE sacó cada una su
 *   identidad es la diferencia entre arreglarlo en un minuto y volver a dudar. `host` es lo mismo
 *   una capa más arriba: con sesiones remotas, dos identidades iguales en máquinas distintas y dos
 *   rutas iguales en máquinas distintas son cosas MUY diferentes, y sin este dato no se distinguen.
 */
function resolverSid(opts = {}) {
  const argv = opts.argv || process.argv
  const cwd = opts.cwd || process.cwd()
  const repo = opts.repo || path.resolve(__dirname, '../..')
  const env = opts.env || process.env
  const leer = opts.leerFichero || ((p) => fs.readFileSync(p, 'utf8'))

  const host = maquina(opts)

  const i = argv.indexOf('--sid')
  if (i >= 0 && argv[i + 1] && !String(argv[i + 1]).startsWith('--')) {
    return { sid: String(argv[i + 1]).trim(), origen: 'flag', base: cwd, host }
  }
  for (const base of [cwd, repo]) {
    try {
      const v = String(leer(path.join(base, '.session-id'))).trim()
      if (v) return { sid: v, origen: 'fichero', base, host }
    } catch { /* no hay fichero ahí */ }
  }
  const e = env.CLAUDE_CODE_SESSION_ID
  if (e && String(e).trim()) return { sid: String(e).trim(), origen: 'entorno', base: cwd, host }
  return { sid: null, origen: null, base: cwd, host }
}

/** Atajo para quien solo quiere el id. */
function sid(opts = {}) {
  return resolverSid(opts).sid
}

// ── QUÉ SOY: persona o trabajador autónomo (T-539, 04/08/2026) ──────────────────────────────
// Este módulo ya contesta «quién soy» (sid) y «dónde» (host). Falta el tercer dato, y es el que
// decide cómo tiene que fallar el andamiaje.
//
// Todo este repo hace **fail-open** a propósito: si la telemetría no responde, no se le bloquea el
// commit a nadie. Es la regla correcta para una PERSONA — la avería de un sistema de observación
// no puede parar el trabajo de quien está delante y puede juzgar.
//
// Para un TRABAJADOR AUTÓNOMO, ese mismo fail-open significa «trabaja sin supervisión y sin que
// nadie te vea», que es justo lo contrario de lo que hace falta. Medido el 04/08 en un clon sin
// `.env.local` (la condición NORMAL de un worktree de agente, que no hereda un fichero ignorado):
// tres protecciones apagadas, el latido sin escribir —o sea, sesión invisible para el reparto— y
// el sistema diciendo que todo iba bien.
//
// El rol va aquí, y no en un módulo nuevo, por lo mismo que la máquina: es identidad. Un tercer
// sitio donde preguntar «qué soy» sería la cuarta copia de la pregunta que costó T-407.
//
// Por defecto PERSONA: un valor que se olvida tiene que caer del lado de no cambiar nada.

// ── CÓMO SE ESCRIBE UN SID EN PANTALLA (T-538, 04/08/2026) ──────────────────────────────────
// Un sid entero (`imp-04ago-c-fedora-eca3f1`) no cabe bien en una tabla, así que once sitios lo
// recortaban a mano — unos a 8 caracteres, otros a 12. Y ahí estaba el fallo: la forma canónica
// de `nuevoSid` es `<nombre>-<máquina>-<azar>`, donde **lo distintivo va al principio y lo
// prescindible al final**; recortar por longitud fija corta justo por donde no es.
//
// Medido el 04/08 con cinco sesiones abiertas el mismo día (`imp-04ago-b`, `-c`, `-d`, `-e`,
// `-g`): a 8 caracteres las cinco se escriben **igual**, `imp-04ag`. La cola marcaba con un
// candado seis casos ajenos y, junto al candado, el nombre que quien miraba reconocía como suyo.
// El icono distinguía; el texto —que es lo que se lee— decía lo contrario. Ocho filas ajenas
// leídas como propias en una sola sesión, y hubo que ir tres veces a la base de datos para saber
// de quién era cada cosa.
//
// La regla, por tanto: **nunca se abrevia por longitud, se abrevia por segmento**. Se tira la
// máquina y el azar, que no identifican nada para un humano, y se conserva el nombre entero. Y si
// el sid no tiene esta forma (uno antiguo, un UUID de `CLAUDE_CODE_SESSION_ID`), **no se toca**:
// más vale una línea larga que una abreviatura que colisiona.

/** El sufijo que `nuevoSid` añade: 6 hex de azar, precedido del nombre de máquina. */
const RE_AZAR = /^[0-9a-f]{6}$/

/**
 * El sid tal y como se le enseña a una persona: sin máquina ni azar, con el nombre intacto.
 *
 *   sidCorto('imp-04ago-c-fedora-eca3f1')  → 'imp-04ago-c'
 *   sidCorto('t486-flota-fedora-aead7f')   → 't486-flota'
 *   sidCorto('550e8400-e29b-41d4-…')       → sin tocar (no es de los nuestros)
 *
 * @param {string|null|undefined} valor
 * @returns {string} nunca `undefined`; `'?'` si no hay sid.
 */
function sidCorto(valor) {
  const s = String(valor ?? '').trim()
  if (!s) return '?'
  const partes = s.split('-')
  // <nombre…>-<máquina>-<azar>: hacen falta al menos tres, y el último tiene que ser el azar.
  if (partes.length >= 3 && RE_AZAR.test(partes[partes.length - 1])) {
    const nombre = partes.slice(0, -2).join('-')
    if (nombre) return nombre
  }
  return s
}

const ROLES = ['persona', 'trabajador']

/**
 * ¿Esta sesión es una persona o un trabajador autónomo?
 *
 * `VENCE_SESSION_ROLE=trabajador` lo declara el entorno que ARRANCA al trabajador (el contenedor,
 * la rutina, el agente), no el propio trabajador: si se lo pudiera poner él, no sería una garantía.
 * Cualquier valor desconocido se trata como persona y NO se inventa nada.
 */
function rol(opts = {}) {
  return rolDeclarado(opts) || 'persona'
}

/**
 * Lo que la sesión DECLARA, distinguiendo «no lo ha dicho» de «ha dicho persona». (T-539)
 *
 * `rol()` no sirve para persistir: devuelve 'persona' tanto si se declaró como si no, y quien
 * guarda ese valor no puede saber si es una afirmación o un valor por defecto.
 *
 * Y la diferencia costó una medida real. En la primera vuelta del piloto, el trabajador declaró su
 * rol en el comando del preflight (`VENCE_SESSION_ROLE=trabajador npm run sesion:preflight`) pero
 * no en los siguientes (`node scripts/backlog.cjs …`), que laten igual. Como el latido guardaba
 * `rol()`, cada comando normal lo **degradaba a persona en silencio** — su fila acabó en `NULL`
 * teniendo un preflight que decía «trabajador», y con ella se apagó la alarma del parte, que es
 * justo lo que existe para verlo.
 *
 * @returns 'persona' | 'trabajador' | null  (null = no declarado)
 */
function rolDeclarado(opts = {}) {
  const v = String((opts.env || process.env).VENCE_SESSION_ROLE || '').trim().toLowerCase()
  return ROLES.includes(v) ? v : null
}

/** Atajo legible para los guardarraíles, que es donde se usa. */
const esTrabajador = (opts = {}) => rol(opts) === 'trabajador'

// ── DÓNDE DEBERÍA ESTAR TRABAJANDO (T-539) ──────────────────────────────────────────────────
// La identidad de este repo la manda el SITIO: `resolverSid` prefiere el `.session-id` del
// directorio actual. Es lo correcto para una persona —el fichero describe dónde estás trabajando—
// y tiene una consecuencia incómoda para un proceso autónomo: **si acaba en el árbol de otra
// sesión, adopta su identidad y se vuelve indistinguible de ella**.
//
// No es teórico. Lo reportó el trabajador en la 1ª vuelta del piloto: *«hice cd a mi worktree y la
// llamada siguiente ya estaba de vuelta en el otro. Es peligroso, no solo incómodo: un comando que
// yo creía ejecutando en mi worktree se habría ejecutado en el directorio de otra sesión»*. Tuvo
// que prefijar unas veinte llamadas con `cd` para evitarlo.
//
// Y por eso NO se puede detectar con lo que ya hay: el sid, el latido y la huella se derivan todos
// del directorio, así que al mudarse cambian con él y todo vuelve a cuadrar. Hace falta un ancla
// que sobreviva al cambio de directorio, y la única es el ENTORNO DEL PROCESO.
//
// `VENCE_SESSION_HOME` lo declara quien ARRANCA al trabajador (el contenedor, la rutina, el
// lanzador de la flota), igual que el rol: si se lo pusiera él mismo desde dentro no sería un
// ancla, sería otra cosa más que se mueve con él. Sin la variable, esto no opina — una persona no
// tiene por qué declarar dónde trabaja.

/** El árbol en el que esta sesión DEBERÍA estar trabajando, si alguien lo declaró. */
function hogar(opts = {}) {
  const v = String((opts.env || process.env).VENCE_SESSION_HOME || '').trim()
  return v ? v.replace(/\/+$/, '') : null
}

module.exports = {
  resolverSid, sid, sidCorto, maquina, nuevoSid, mismaMaquina,
  rol, rolDeclarado, esTrabajador, hogar, ROLES,
}
