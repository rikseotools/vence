// lib/observability/cuentaDeSesion.cjs — ¿de qué CUENTA de Claude Code sale este consumo?
//
// ## Por qué existe ([T-709], 08/08/2026)
//
// Hay dos cuentas y el consumo se mide por SESIÓN, no por cuenta: `npm run llm:gasto` saca
// `49d41d34 · 3.851 resp`, `51b54438 · 3.157 resp`… y con eso no se puede responder la única
// pregunta que importa —**¿a cuál le queda cuota?**— ni, por tanto, decidir a quién mover.
//
// El disparador no es la curiosidad: *«igual me quedo yo ahora sin poder terminar, y eso es un
// fallo»*. Toparse el límite semanal a media tarea no avisa; simplemente deja de funcionar.
//
// ## Las tres formas de saberlo, y por qué no son intercambiables
//
//   1. **Trabajador de la flota** → `lib/flota/cuentas.cjs` → `cuentaDe(nombre, disponibles)`.
//      Es EXACTA y **retroactiva**: el reparto es determinista por nombre, así que se puede
//      atribuir consumo de hace semanas sin haber guardado nada.
//   2. **Sesión local/tmux con `CLAUDE_CODE_OAUTH_TOKEN` en su entorno** → esa cuenta. Es el
//      mismo mecanismo de la flota, y es lo que hace que rotar un panel suelto sea posible.
//   3. **Sesión local sin ese env** → la cuenta global de `~/.claude.json` (`oauthAccount`).
//      Es la de toda la máquina: cambiarla mueve TODAS las sesiones locales a la vez.
//
// ## ⚠️ Lo que NO se puede hacer, medido antes de escribir esto
//
// **La atribución retroactiva de las sesiones locales es imposible.** De los **355 transcripts**
// de `~/.claude/projects/`, **ninguno guarda la cuenta** — solo `sessionId`, `type` y el uso de
// tokens. Así que para lo local hay que SELLAR en el momento de ingerir, y lo anterior se queda
// sin atribuir para siempre. Se marca como `desconocida` en vez de suponer la actual: dar por
// hecho que lo de la semana pasada salió de la cuenta que está puesta hoy es justo el error que
// haría inútil la medida el día que se rote.

const path = require('path')
const fs = require('fs')

/** Lo que se escribe cuando de verdad no se sabe. NUNCA se rellena con la cuenta actual. */
const DESCONOCIDA = 'desconocida'

/**
 * La cuenta declarada globalmente en la máquina (`~/.claude.json` → `oauthAccount`).
 *
 * @returns `{ email, accountUuid }` o `null` si no hay fichero/campo. Nunca lanza: esto corre
 *   dentro de un ingest y un `~/.claude.json` raro no puede tumbar la telemetría.
 */
function cuentaGlobal(home = process.env.HOME) {
  try {
    const p = path.join(home || '', '.claude.json')
    const raw = fs.readFileSync(p, 'utf8')
    const oauth = JSON.parse(raw)?.oauthAccount
    if (!oauth) return null
    const email = typeof oauth.emailAddress === 'string' ? oauth.emailAddress : null
    const accountUuid = typeof oauth.accountUuid === 'string' ? oauth.accountUuid : null
    if (!email && !accountUuid) return null
    return { email, accountUuid }
  } catch {
    return null
  }
}

/**
 * Resuelve la cuenta de una sesión. Núcleo PURO: todo lo que necesita entra por parámetro.
 *
 * @param trabajador  nombre del trabajador de la flota, o null/'' si es una sesión de persona
 * @param env         entorno de esa sesión (para `CLAUDE_CODE_OAUTH_TOKEN`)
 * @param global      lo que devuelve `cuentaGlobal()`, o null
 * @param resolverFlota  `(nombre) => 'principal'|'secundaria'|null` — se inyecta para no
 *                       acoplar este módulo al registro de la flota (que vive en otro sitio y
 *                       tiene sus propios tests).
 *
 * @returns `{ cuenta, via }` — `via` dice CÓMO se supo, que es lo que permite auditar la cifra
 *   sin volver a razonarla: `flota` (exacta), `env` (token propio), `global` (la de la máquina)
 *   o `ninguna` (no se sabe).
 */
function cuentaDeSesion({ trabajador = null, env = {}, global = null, resolverFlota = null } = {}) {
  // 1. La flota manda, y es la única exacta hacia atrás.
  if (trabajador && typeof resolverFlota === 'function') {
    const c = resolverFlota(trabajador)
    if (c) return { cuenta: c, via: 'flota' }
  }
  // 2. La cuenta EN USO la decide `CLAUDE_CODE_OAUTH_TOKEN`, que es la única variable que lee
  //    Claude Code. Es lo que hace un panel rotado, y sin mirarlo se le atribuiría el gasto a
  //    la cuenta que NO está gastando.
  //
  //    ⚠️ `CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA` es un ALMACÉN, no un indicador. Esto lo daba por
  //    equivalente y era un fallo con consecuencia inmediata: en cuanto esa variable se ponga en
  //    el perfil de la máquina —que es justo lo que hay que hacer para poder rotar— TODAS las
  //    sesiones locales se etiquetarían como «secundaria» aunque corran en la principal, y la
  //    medida por cuenta nacería mintiendo. Tener la llave de un coche no es conducirlo.
  const tok = env.CLAUDE_CODE_OAUTH_TOKEN
  if (typeof tok === 'string' && tok.trim().length >= 20) {
    // `CLAUDE_CODE_CUENTA` lo pone quien rota (es quien sabe a qué cuenta corresponde ese
    // token). Sin él no se adivina por el nombre de otra variable: se dice `principal`, que es
    // lo que significa arrancar con la credencial por defecto.
    return { cuenta: env.CLAUDE_CODE_CUENTA || 'principal', via: 'env' }
  }
  // 3. La de la máquina. Se identifica por EMAIL, que es lo que una persona reconoce.
  if (global && (global.email || global.accountUuid)) {
    return { cuenta: global.email || global.accountUuid, via: 'global' }
  }
  return { cuenta: DESCONOCIDA, via: 'ninguna' }
}

/**
 * ¿Este consumo se puede atribuir a una cuenta?
 *
 * Existe para que los paneles distingan «esta cuenta gastó poco» de «no sabemos de quién es
 * esto» — que es la confusión que convierte un contador en un adorno.
 */
function estaAtribuido(cuenta) {
  return typeof cuenta === 'string' && cuenta.length > 0 && cuenta !== DESCONOCIDA
}

module.exports = { cuentaDeSesion, cuentaGlobal, estaAtribuido, DESCONOCIDA }
