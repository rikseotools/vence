// lib/flota/oomCgroup.cjs — detectar OOM-kills SIN journalctl. (T-647, 08/08)
//
// ── EL HUECO QUE CIERRA, MEDIDO ─────────────────────────────────────────────────────────────
// `flota_sin_memoria` (T-647, «Capa 4») lleva CERO eventos en TODA su historia — no porque no
// haya habido OOM (el propio 07/08 tuvo 20 en 6h), sino porque su detección corre
// `journalctl ... | grep 'Killed process'` dentro del supervisor, y el supervisor corre como
// `User=flota` (`systemctl show vence-flota-supervisor -p User` → `flota`), que NO pertenece a
// `adm` ni `systemd-journal`. Reproducido: `journalctl -k --since '-24h'` da «-- No entries --» y
// journalctl imprime «Users in groups 'adm', 'systemd-journal' can see all messages» — pese a que
// `journalctl --list-boots` confirma que el registro SÍ tiene >15h de historial real. El detector
// que T-647 construyó para dejar de ser ciego era, desde el primer minuto, ciego él mismo.
//
// ── LA ALTERNATIVA, TAMBIÉN MEDIDA ──────────────────────────────────────────────────────────
// cgroup v2 expone `memory.events` con un contador `oom_kill` que escribe el KERNEL directamente,
// legible con `cat` sin pertenecer a ningún grupo especial (confirmado en `flota-1`: los cuatro
// `vence-flota@wN.service/memory.events` se leen igual que cualquier fichero de usuario). Y es
// mejor señal que journalctl, no solo una alternativa: viene YA atribuida por trabajador (una
// unidad = un cgroup = una víctima posible, sin tener que emparejar un PID con un nombre de
// proceso), es un contador entero (no texto que parsear con una regex frágil) y no depende de que
// journald retenga el histórico.
//
// ── POR QUÉ HACE FALTA GUARDAR LA LECTURA ANTERIOR ──────────────────────────────────────────
// El contador es ACUMULATIVO desde que el cgroup se creó (arranque o reinicio de la unidad) y
// vuelve a CERO si la unidad se reinicia — no es una cuenta desde el principio de los tiempos.
// Por eso esto solo puede reportar un DELTA frente a la última lectura, igual que cualquier
// contador de kernel (bytes de red, `pswpin`…): sin una lectura previa no hay nada que restar.

const fs = require('fs')
const path = require('path')

/**
 * Ruta de `memory.events` para un trabajador, dado el patrón real de `flota-1`
 * (`/system.slice/system-vence\x2dflota.slice/vence-flota@<w>.service/`). El `\x2d` es cómo
 * systemd escapa el guion del nombre de la slice al convertirlo en ruta de cgroup — no un
 * literal a mano: si el nombre de la slice cambiara, este único sitio se actualiza.
 *
 * @param {string} trabajador
 * @returns {string}
 */
function rutaMemoryEvents(trabajador) {
  return path.join(
    '/sys/fs/cgroup/system.slice/system-vence\\x2dflota.slice',
    `vence-flota@${trabajador}.service`,
    'memory.events',
  )
}

/**
 * Lee el contador `oom_kill` de un `memory.events` ya cargado en texto.
 * Separado de la lectura de fichero para poder testear con fixtures reales sin tocar disco.
 *
 * @param {string} texto contenido de `memory.events`
 * @returns {number|null} `null` si el fichero no trae la clave (formato inesperado, no cgroup v2)
 */
function leerOomKillDeTexto(texto) {
  const m = String(texto || '').match(/^oom_kill (\d+)$/m)
  return m ? Number(m[1]) : null
}

/**
 * Lee `oom_kill` de disco para un trabajador. `null` si no se puede leer (fichero ausente,
 * permiso denegado, máquina sin cgroup v2) — nunca lanza: la telemetría no puede parar al bucle.
 *
 * @param {string} trabajador
 * @param {(ruta:string)=>string} [leerFichero] inyectable para tests
 * @returns {number|null}
 */
function leerOomKill(trabajador, leerFichero = (r) => fs.readFileSync(r, 'utf8')) {
  try {
    return leerOomKillDeTexto(leerFichero(rutaMemoryEvents(trabajador)))
  } catch {
    return null
  }
}

/**
 * Compara la lectura ANTERIOR con la ACTUAL, trabajador a trabajador, y dice cuántos `oom_kill`
 * NUEVOS hay desde entonces.
 *
 * ── LAS TRES FORMAS DE «NO SE SABE», Y POR QUÉ NINGUNA CUENTA COMO CERO ─────────────────────
 * 1. Sin lectura actual (`null`): esta pasada no pudo leer el cgroup. No se afirma nada de él.
 * 2. Sin lectura anterior: es la primera vez que se ve este trabajador (o el estado se perdió).
 *    No hay base para restar — afirmarlo como delta 0 escondería un contador ya alto de fábrica.
 * 3. El contador BAJÓ respecto a la anterior: el cgroup se recreó (la unidad se reinició) entre
 *    medias. Un delta negativo no existe; tratarlo como 0 sería fingir que no pasó nada cuando lo
 *    más probable es que SÍ pasara algo (el reinicio) y su historial se perdiera con él.
 *
 * @param {Record<string, number|null>} anterior lectura de la pasada previa, por trabajador
 * @param {Record<string, number|null>} actual   lectura de esta pasada, por trabajador
 * @returns {{total:number, nuevos:Record<string,number>, reiniciados:string[]}}
 */
function deltaOomKill(anterior, actual) {
  const nuevos = {}
  const reiniciados = []
  let total = 0
  const base = anterior || {}
  for (const trabajador of Object.keys(actual || {})) {
    const a = actual[trabajador]
    if (a == null) continue
    const p = base[trabajador]
    if (p == null) continue
    if (a < p) { reiniciados.push(trabajador); continue }
    const d = a - p
    if (d > 0) { nuevos[trabajador] = d; total += d }
  }
  return { total, nuevos, reiniciados }
}

module.exports = { rutaMemoryEvents, leerOomKillDeTexto, leerOomKill, deltaOomKill }
