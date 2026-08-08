// lib/flota/sesionClaude.cjs — la CONVERSACIÓN de un trabajador sobrevive a su turno. (T-486, 06/08)
//
// ── POR QUÉ EXISTE, Y POR QUÉ NO ESTABA ─────────────────────────────────────────────────────
// Pregunta de Manuel: *«un `claude -p` no tiene prompts ¿por qué usamos eso? ¿no sería mejor
// usarlo con prompt, y el supervisor revisa las conversaciones y hace de filtro hacia mí?»*.
//
// El modo de un solo tiro se eligió por una razón REAL y medida (05/08): **el TUI interactivo
// ignora `CLAUDE_CODE_OAUTH_TOKEN`** y se queda en «Select login method», así que un trabajador
// con TUI latía y parecía vivo sin poder hacer nada. Eso era cierto — pero la conclusión se pasó
// de ancha: se descartó el TUI y de paso se dio por perdida la CONVERSACIÓN PERSISTENTE, que en
// modo `-p` funciona perfectamente.
//
// Comprobado en w3 el 06/08, ejecutándolo (no leyendo documentación):
//   turno 1:  claude -p --session-id <uuid>  «recuerda 4417»            → OK
//   turno 2:  claude -p --resume    <uuid>   «¿qué número te dije?»     → 4417
// Proceso distinto, turno distinto, y se acuerda. Y el transcript queda en disco
// (`~/.claude/projects/<proyecto>/<uuid>.jsonl`, legible y estructurado), que es la otra mitad de
// la pregunta: el supervisor PUEDE leer lo que hablaron.
//
// Lo que esto cambia, y no es poco: cada turno dejaba de cero — volver a orientarse en el repo,
// releer el andamiaje, reconstruir el contexto de la tarea. Ese arranque se pagaba entero cada
// vez. Con `--resume` se paga una vez.
//
// ── LO QUE **NO** SE DECIDE AQUÍ ────────────────────────────────────────────────────────────
// Cuándo empezar conversación nueva. Da la gana de poner un umbral de tamaño, pero no hay ningún
// número medido todavía: Claude Code compacta solo, así que una sesión larga no revienta, solo se
// vuelve cara. Se expone el TAMAÑO para poder calibrarlo con datos reales y se deja el reinicio
// EXPLÍCITO (`--fresco`). Inventarse el umbral hoy es exactamente lo que esta casa llama una
// cifra sin medir.
'use strict'
const path = require('path')

/** Dónde vive el identificador de la conversación de un trabajador. Junto a su `.env`/`.encargo`. */
function ficheroSesion(ficheroEntorno) {
  return String(ficheroEntorno).replace(/\.env$/, '.session')
}

/**
 * Qué banderas de `claude` tocan para este turno. PURA — el efecto (leer/escribir el fichero) lo
 * pone quien llama, así que la decisión se puede probar sin máquina ni disco.
 *
 * @param {{sesionPrevia:string|null, fresco?:boolean, nuevoId:string}} p
 *   `sesionPrevia`  el uuid guardado, si lo hay
 *   `fresco`        arrancar conversación nueva a propósito
 *   `nuevoId`       uuid a estrenar (se inyecta: `crypto.randomUUID()` no es determinista)
 * @returns {{flags:string[], id:string, continua:boolean}}
 */
function banderasSesion({ sesionPrevia, fresco = false, nuevoId }) {
  if (!fresco && sesionPrevia) {
    return { flags: ['--resume', sesionPrevia], id: sesionPrevia, continua: true }
  }
  return { flags: ['--session-id', nuevoId], id: nuevoId, continua: false }
}

/**
 * Dónde deja Claude Code el transcript de esa conversación.
 *
 * El nombre del directorio es la ruta del proyecto con las barras cambiadas por guiones — es la
 * convención del propio Claude Code, verificada en w3:
 *   /home/flota/vence-sessions/w3  →  -home-flota-vence-sessions-w3
 */
function rutaTranscript({ home, arbol, id }) {
  const proyecto = String(arbol).replace(/\/+$/, '').replace(/\//g, '-')
  return path.posix.join(home, '.claude', 'projects', proyecto, `${id}.jsonl`)
}

/** Línea para el panel: que se VEA si el trabajador sigue su conversación o empezó de cero. */
function lineaSesion({ continua, id, tamanoBytes = null }) {
  const corto = String(id).slice(0, 8)
  const peso = tamanoBytes == null ? '' : ` · ${(tamanoBytes / 1024).toFixed(0)} KB de conversación`
  return continua
    ? `🧠 sigue su conversación (${corto}${peso}) — no arranca de cero`
    : `🆕 conversación nueva (${corto}) — arranca de cero`
}

/**
 * Resume el CAMPO más informativo del `input` de una herramienta, para no imprimir el JSON
 * entero. Cada herramienta tiene su propio campo "principal" — se prueban en orden y se usa el
 * primero que aparezca; si ninguno encaja, se cae al JSON completo (mejor eso que nada).
 */
function resumenInput(input) {
  if (!input || typeof input !== 'object') return ''
  const campo = input.command ?? input.file_path ?? input.pattern ?? input.query ?? input.prompt ?? input.description
  const texto = typeof campo === 'string' ? campo : JSON.stringify(input)
  return String(texto).replace(/\s+/g, ' ').trim().slice(0, 100)
}

/**
 * Qué está haciendo un trabajador AHORA MISMO, leído de su propio transcript. (T-653, 07/08)
 *
 * ── POR QUÉ HACÍA FALTA ─────────────────────────────────────────────────────────────────────
 * El panel de la flota sabe CUÁNTO lleva un turno (`hace 137 min`) pero no distingue trabajando
 * de atascado — y esa distinción es justo la que decide si hay que esperar o intervenir. El dato
 * YA EXISTE: el transcript de la conversación (`rutaTranscript`) se escribe EN VIVO mientras el
 * turno corre, línea a línea, una por cada mensaje del modelo o resultado de herramienta. Lo
 * único que faltaba era leer su ÚLTIMA entrada, no solo su tamaño.
 *
 * ── POR QUÉ SE BUSCA HACIA ATRÁS, Y POR QUÉ SE IGNORAN LOS ERRORES DE PARSEO ────────────────
 * Quien llama pasa normalmente un TAIL (los últimos N bytes de un fichero que puede pesar
 * decenas de MB — leerlo entero por SSH en cada pasada del panel sería carísimo). Un tail corta
 * el fichero a medias, así que la PRIMERA línea del trozo casi siempre viene truncada por el
 * principio: no es un error del transcript, es el precio de no leerlo entero. Se busca la última
 * línea ASSISTANT con un bloque `tool_use` recorriendo de atrás hacia adelante, y cualquier línea
 * que no parsee (la truncada, o basura de por medio) se salta sin más — no se declara `null` solo
 * porque la PRIMERA línea del tail esté rota.
 *
 * Solo se mira `tool_use`: un mensaje de puro texto ("aquí está mi plan...") no dice qué está
 * EJECUTANDO ahora mismo, que es la pregunta que esto contesta. Encontrar únicamente texto (sin
 * ninguna herramienta) en todo el tramo leído es indistinguible de "no hay nada que contar" —
 * ambos devuelven `null`, y quien llama decide qué hacer con eso (nada, normalmente).
 *
 * @param {string} textoTail
 * @returns {string|null} p.ej. "Bash: npx tsc --noEmit -p . 2>&1 | tail -60", o null si no hay
 *   ninguna acción de herramienta legible en el tramo pasado.
 */
function resumenActividad(textoTail) {
  const lineas = String(textoTail || '').split('\n').filter(Boolean)
  for (let i = lineas.length - 1; i >= 0; i--) {
    let d
    try { d = JSON.parse(lineas[i]) } catch { continue }
    if (!d || d.type !== 'assistant') continue
    const bloques = d.message && Array.isArray(d.message.content) ? d.message.content : []
    const usos = bloques.filter((b) => b && b.type === 'tool_use')
    if (!usos.length) continue
    const u = usos[usos.length - 1]
    const resumen = resumenInput(u.input)
    return resumen ? `${u.name}: ${resumen}` : String(u.name)
  }
  return null
}

module.exports = { ficheroSesion, banderasSesion, rutaTranscript, lineaSesion, resumenActividad }
