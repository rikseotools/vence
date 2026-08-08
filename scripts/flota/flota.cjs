#!/usr/bin/env node
/**
 * flota.cjs — gobernar la flota desde el portátil, sin entrar en ningún servidor. (T-486)
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
 * Los trabajadores ya se sincronizan solos con las sesiones locales (claim, latido, embudo,
 * entregas viven en RDS). Lo que faltaba era lo de arriba: **arrancarlos, darles trabajo y saber
 * cómo van sin abrir una terminal por máquina**. Sin esto, «tengo una flota» significa en la
 * práctica «tengo que entrar por SSH a cada sitio», que es exactamente lo que se quería evitar.
 *
 * Se apoya en lo que ya hay y no duplica nada:
 *   · quién está vivo  → `worktree_sessions` (lo escribe el latido, escritor único)
 *   · qué hace cada uno → `backlog_tasks` (el claim)
 *   · qué te pregunta   → `session_questions` (el embudo de T-493)
 *   · qué te entrega    → la quinta espera de T-539
 * Lo único propio es el cruce con lo ESPERADO (`lib/flota/maquinas.cjs`), que es lo que permite
 * decir «falta w2» en vez de enseñar solo lo que hay.
 *
 * Uso:
 *   npm run flota                       # estado: quién vive, qué hace, qué falta
 *   npm run flota -- encargar w1        # le manda su encargo (elige tarea apta si no se dice)
 *   npm run flota -- encargar w1 --tarea T-451
 *   npm run flota -- arrancar w2        # levantar uno parado
 *   npm run flota -- parar w2
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const os = require('os')

const REPO = path.resolve(__dirname, '..', '..')
const MAQ = require(path.join(REPO, 'lib', 'flota', 'maquinas.cjs'))
const ENC = require(path.join(REPO, 'lib', 'flota', 'encargo.cjs'))
// Al nivel del módulo, con sus hermanos: lo usan `repartir` (para EMITIR el dato de la pasada)
// y `bucle` (para leerlo). Vivía dentro de `bucle`, así que las llamadas de `repartir`
// reventaban con «BUC is not defined» — y no lo vio ningún test, porque todos miran el TEXTO
// del fichero y ninguno ejecutaba el comando (T-693).
const BUC = require(path.join(REPO, 'lib', 'flota', 'bucle.cjs'))
const { sidCorto } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
const AUT = require(path.join(REPO, 'lib', 'flota', 'autenticacion.cjs'))
const ACTU = require(path.join(REPO, 'lib', 'flota', 'actualizacion.cjs'))
const RESC = require(path.join(REPO, 'lib', 'flota', 'rescate.cjs'))
// La conversación de un trabajador sobrevive a su turno (T-486): --session-id / --resume.
const SES = require(path.join(REPO, 'lib', 'flota', 'sesionClaude.cjs'))
const crypto = require('crypto')
// El cruce tarea↔señal ya lo resuelve el parte: se REUSA, no se copia (T-130).
const PARTE = require(path.join(REPO, 'lib', 'sessions', 'parte.cjs'))
const PROD = require(path.join(REPO, 'lib', 'sessions', 'productividad.cjs'))
// Quién espera revisor y quién espera decisión lo decide UN sitio (T-486): si el supervisor lo
// dedujera por su cuenta de las columnas, `flota` y `backlog list` acabarían contando distinto.
const REV = require(path.join(REPO, 'lib', 'backlog', 'revision.cjs'))
const SALUD = require(path.join(REPO, 'lib', 'flota', 'saludMaquina.cjs'))
const BORRAB = require(path.join(REPO, 'lib', 'impugnaciones', 'borradorAbierto.cjs'))

// Margen para comprobar que un encargo arrancó de verdad tras el `send-keys` (T-642). Corto a
// propósito: solo tiene que distinguir "murió al instante" (cuota agotada, credencial mala) de
// "sigue vivo" — no esperar a que el turno TERMINE.
const VERIFICACION_ARRANQUE_S = 3

/**
 * Anota las filas del embudo con los casos que citan y ya están cerrados. (T-614)
 *
 * El criterio entero vive en `borradorAbierto.cjs` — aquí solo el viaje a la BD, igual que en
 * `backlog.cjs`. **Fail-open**: si la consulta falla, se devuelven las filas tal cual; el panel de
 * la flota tiene que salir aunque la anotación no se pueda calcular.
 */
async function marcarCasosCerradosEnEmbudo(sql, filas) {
  try {
    const claves = BORRAB.clavesDeCasos(filas)
    if (!claves.length) return filas
    const estados = await BORRAB.estadosDeCasos(sql, claves)
    return BORRAB.marcarCasosCerrados(filas, estados)
  } catch { return filas }
}

let cmd = process.argv[2] || 'estado'
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

/**
 * Ejecuta algo en la máquina de un trabajador. Sin secretos en la línea de órdenes.
 *
 * El portátil es una máquina más (`local: true`): se ejecuta aquí mismo, sin SSH. Es lo que
 * permite que el supervisor sea UN solo punto de entrada para todo — que es lo que quita las
 * pantallas múltiples. El resto del código no distingue: pide «haz esto en la máquina de w1» y ya.
 */
function enMaquina(trabajador, orden, { entrada = null } = {}) {
  const m = MAQ.maquinaDe(trabajador)
  if (!m) throw new Error(`el trabajador "${trabajador}" no está declarado en ninguna máquina (lib/flota/maquinas.cjs)`)
  const opciones = { encoding: 'utf8', input: entrada || undefined, timeout: 120_000 }
  if (m.local) return execFileSync('bash', ['-c', orden], opciones)
  // Desde el VPS, el portátil es «remoto» y no declara host: sin esto se construiría un `ssh` sin
  // destino y el error diría cualquier cosa menos lo que pasa (T-617).
  const noLlego = MAQ.inalcanzable(m)
  if (noLlego) throw new Error(noLlego)
  // ── REINTENTO ANTE UN CORTE TRANSITORIO (T-486, 06/08) ────────────────────────────────
  // `sshd` cierra conexiones cuando le llegan en ráfaga (MaxStartups por defecto 10:30:100), y
  // el supervisor abre varias seguidas: sondear el clon, leer la sesión, medir el transcript,
  // escribir el encargo. Medido hoy: un encargo a w3 murió con «Connection closed by … port 22»
  // teniendo el VPS ocioso, sin fail2ban y con 5,9 GB libres — no era la máquina, era el ritmo.
  //
  // Importa más de lo que parece porque el bucle continuo hará esto cada pasada por cada
  // trabajador: sin reintento, un corte de un segundo se convierte en una pasada perdida, y una
  // pasada perdida es media hora de flota parada. Espera creciente para no empeorar la ráfaga.
  let ultimo = null
  for (let intento = 0; intento < 3; intento++) {
    if (intento > 0) execFileSync('sleep', [String(intento * 3)])
    try {
      return execFileSync('ssh', ['-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=10',
        '-i', m.llave, `${m.usuario}@${m.host}`, orden], opciones)
    } catch (e) {
      ultimo = e
      // Solo se reintenta lo TRANSITORIO. Un comando que falla de verdad (exit != 255) tiene que
      // fallar a la primera: repetirlo tres veces lo ejecutaría tres veces, y aquí se escriben
      // ficheros de encargo y se mandan turnos.
      const transitorio = e.status === 255 || /Connection (closed|reset)|kex_exchange|Broken pipe/i.test(String(e.stderr || e.message || ''))
      if (!transitorio) throw e
    }
  }
  throw ultimo
}

/**
 * ¿Está viva la SESIÓN de un trabajador, aunque no esté latiendo?
 *
 * El latido va dentro de los comandos del andamiaje, así que un trabajador ENTRE TAREAS no late —
 * y a los 15 minutos el panel lo daba por caído estando perfectamente. «Libre» y «muerto» piden
 * cosas opuestas: al primero se le manda trabajo, al segundo se le levanta.
 *
 * La sesión de tmux es la verdad: si existe, hay a quién mandarle un encargo.
 *
 * ⚠️ DEVUELVE `null` CUANDO NO SE PUDO PREGUNTAR, y eso no es un detalle (T-642, 07/08). La
 * versión anterior hacía `try { has-session } catch { return false }`, así que **un ssh que se
 * cae daba exactamente la misma respuesta que una sesión que no existe**. Con eso, la reanimación
 * automática de más abajo mataría y recrearía sesiones sanas cada vez que la red hiciera un
 * hipo — el remedio peor que la enfermedad. Se pregunta de forma que el comando SIEMPRE salga
 * bien y sea su SALIDA la que responde: vacío = no se pudo preguntar.
 */
function sesionViva(trabajador) {
  const m = MAQ.maquinaDe(trabajador)
  const como = m && m.local ? '' : 'sudo -u flota '
  try {
    const r = enMaquina(trabajador,
      `${como}sh -c 'tmux -L ${trabajador} has-session -t ${trabajador} 2>/dev/null && echo SI || echo NO'`).trim()
    if (r.endsWith('SI')) return true
    if (r.endsWith('NO')) return false
    return null
  } catch { return null }
}

/**
 * Lo último que escribió el turno de un trabajador en su log. Cadena vacía si no se puede leer.
 *
 * ⚠️ EXISTE PORQUE SE LEÍA EN EL HOME EQUIVOCADO, y eso dejaba MUDA la guarda de cuota (T-642,
 * 07/08). Los tres sitios que miraban el log lo hacían con `~/flota-<w>.log` **sin** el `sudo -u
 * flota`: en el VPS el supervisor entra como `root`, así que `~` es `/root` y ahí no hay ningún
 * log. El `tail` fallaba en silencio (`|| true`), devolvía cadena vacía, y `AUT.clasificar('')`
 * decía «no hay problema» — o sea que la comprobación de cuota de [T-617] **nunca podía dispararse
 * en el VPS**, que es la única máquina donde importa. Medido en vivo: `w3`, con el mensaje
 * «You've hit your weekly limit» escrito en su log, recibió encargo igual.
 *
 * El log lo ESCRIBE `mandarEncargo` dentro de un `sudo -u flota sh -c`, donde `~` sí es el de
 * `flota`. Se lee igual que se escribe: es la misma ruta o no es la misma cosa.
 */
function logDelTurno(trabajador) {
  const m = MAQ.maquinaDe(trabajador)
  const como = m && m.local ? '' : 'sudo -u flota '
  try {
    return enMaquina(trabajador, `${como}sh -c 'tail -c 4000 ~/flota-${trabajador}.log 2>/dev/null || true'`)
  } catch { return '' }
}

/**
 * ¿Cuántos turnos (`claude -p`) hay VIVOS para este trabajador en su máquina?
 *
 * Es la señal que manda sobre el panel, porque es la única que ve un turno HUÉRFANO: cuando el
 * OOM se lleva el servidor de tmux, el `claude -p` de dentro sobrevive y sigue escribiendo en el
 * worktree aunque su sesión ya no exista (T-642, 07/08). Se busca por la primera línea del
 * encargo (`Eres w1,`), que es lo único que identifica al trabajador dentro de la línea de
 * órdenes — el binario es el mismo para los cuatro.
 *
 * Devuelve 0 si no se puede preguntar: aquí el fail-open es el correcto, porque el número solo
 * se usa para NO dar trabajo, y quedarse sin poder repartir por un ssh caído sería peor. Las
 * otras dos puertas (`puedeRecibir` y el arranque comprobado) siguen delante.
 */
function turnosVivosDe(trabajador) {
  const w = String(trabajador || '')
  if (!w) return 0
  // ⚠️ EL PATRÓN NO PUEDE COINCIDIR CONSIGO MISMO. `pgrep -f 'Eres w1,'` corre dentro de un
  // `bash -c` cuya línea de órdenes CONTIENE ese texto, así que se cuenta a sí mismo y devuelve
  // siempre ≥1: estrenado así, el reparto se paró entero diciendo que los cuatro trabajadores
  // tenían un turno vivo cuando solo lo tenía uno. Medido en la máquina: patrón directo → 2,
  // con el corchete → 1, turnos reales → 1. El truco del corchete hace que el texto del comando
  // (`Eres [w]1,`) NO case con la expresión que busca (`Eres w1,`), que es lo mismo que se hace
  // de toda la vida con `ps | grep [p]atron`.
  //
  // Ningún test de texto podía cazar esto: la función era correcta y el sistema estaba mintiendo.
  const patron = `Eres [${w[0]}]${w.slice(1)},`
  try {
    const n = enMaquina(trabajador, `pgrep -fc '${patron}' 2>/dev/null || true`).trim()
    return Number(n) || 0
  } catch { return 0 }
}

/** Qué está ejecutando el panel de un trabajador. Cadena vacía si no se puede ver (≠ «nada»). */
function comandoDelPanel(trabajador) {
  const m = MAQ.maquinaDe(trabajador)
  const como = m && m.local ? '' : 'sudo -u flota '
  try {
    return enMaquina(trabajador,
      `${como}tmux -L ${trabajador} list-panes -t ${trabajador} -F '#{pane_current_command}' 2>/dev/null | head -1`).trim()
  } catch { return '' }
}

/**
 * Mide la máquina donde trabaja un trabajador: memoria, carga, CPU ociosa y builds simultáneos.
 *
 * Una sola conexión por máquina (no por trabajador): lo que se mide es el HOST. Devuelve `null` si
 * no se puede leer — sin dato no se inventa un veredicto, igual que el resto del andamiaje.
 *
 * El juicio NO vive aquí: lo pone `lib/flota/saludMaquina.cjs`, que es puro y testeable sin ssh.
 */
function medirMaquina(trabajador) {
  // `free -b` en bytes (sin locale que meta comas), loadavg del kernel, núcleos, y los builds:
  // procesos `node` cuyo padre es `npm` — que es la firma de un jest/tsc/next lanzado por el
  // trabajador, y no del propio Claude Code (que también es node, pero no cuelga de npm).
  const orden = [
    "awk '/MemTotal|MemAvailable|SwapTotal/{printf \"%s %d\\n\", $1, $2}' /proc/meminfo",
    "awk '{print \"load1\", $1}' /proc/loadavg",
    "printf 'nucleos %s\\n' $(nproc)",
    "awk '/^cpu /{idle=$5; tot=0; for(i=2;i<=NF;i++) tot+=$i; printf \"idlepct %d\\n\", (idle*100)/tot}' /proc/stat",
    // BUILDS = procesos `node` GRANDES, no «node hijo de npm».
    // La primera versión seguía la cadena de padres (node cuyo ppid es un npm) y contaba CERO en
    // una máquina que tenía cuatro builds de 1,2-1,6 GB: el padre `npm` ya no siempre está, o su
    // `comm` no dice «npm». Lo que importa no es quién lo lanzó sino cuánto pesa — y el corte lo
    // da la medición real: los builds ocupaban 1.213-1.574 MB y los Claude Code 81-330 MB, así
    // que 500 MB separa las dos poblaciones sin ambigüedad.
    "ps -eo comm=,rss= | awk '$1==\"node\" && $2>512000 {n++} END{printf \"builds %d\\n\", n+0}'",
    "printf 'espera_io %s\\n' \"$(ps -eo stat --no-headers | grep -c '^D' || echo 0)\"",
  ].join('; ')
  let salida
  try {
    salida = enMaquina(trabajador, `sh -c ${citar(orden)}`)
  } catch { return null }

  const num = (clave) => {
    const m = new RegExp(`${clave}[: ]+(\\d+)`).exec(salida)
    return m ? Number(m[1]) : null
  }
  const kbAMb = (kb) => (kb == null ? null : Math.round(kb / 1024))
  const memTotalMb = kbAMb(num('MemTotal'))
  const memDisponibleMb = kbAMb(num('MemAvailable'))
  if (memTotalMb == null || memDisponibleMb == null) return null

  const load1Match = /load1 ([\d.]+)/.exec(salida)
  return {
    memTotalMb,
    memDisponibleMb,
    swapTotalMb: kbAMb(num('SwapTotal')) ?? 0,
    load1: load1Match ? Number(load1Match[1]) : 0,
    nucleos: num('nucleos') || 1,
    cpuOciosaPct: num('idlepct') ?? 100,
    buildsNode: num('builds') ?? 0,
    turnosEnEsperaIo: num('espera_io') ?? null,
  }
}

/**
 * Envuelve un script para que el shell de la máquina lo pase INTACTO a `bash -c`.
 *
 * Con comillas dobles (`JSON.stringify`) el shell de fuera expande los `$(…)` ANTES de que el
 * script llegue a su sitio: la sonda del clon acabó ejecutando `git rev-parse` en el directorio
 * equivocado y reportando «no hay repo» de una máquina que lo tenía (05/08). En comillas simples
 * no se expande nada.
 */
const citar = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

/**
 * Deja el clon del trabajador al día ANTES de darle trabajo. Si no puede, NO se le da. (T-486)
 *
 * ── POR QUÉ ES UNA PUERTA Y NO UN AVISO ─────────────────────────────────────────────────────
 * Un clon viejo no es «una versión anterior»: trae **los guardarraíles de su fecha**, que son lo
 * único que hace segura a la flota. Medido el 05/08 — `w1` llevaba 30 commits de retraso, así que
 * no tenía el canario con el que habría comprobado su propio permiso, ni el comando `revision` que
 * su situación pedía, y se quedó una hora parado preguntando algo que su repo ya sabía responder.
 *
 * Falla CERRADO, como manda [T-539] para un autónomo: si no se puede comprobar, no se encarga.
 * Y nunca a la brava — un clon con cambios sin commitear puede ser el único rastro de un trabajo
 * ([T-431]): se rehúsa y se dice qué hay, que tirarlo lo decide una persona.
 */
function ponerAlDia(trabajador, { emitir = null, reanuda = false } = {}) {
  const como = MAQ.maquinaDe(trabajador)?.local ? '' : 'sudo -u flota '
  const arbol = MAQ.arbolDe(trabajador)
  let salida = ''
  try {
    salida = enMaquina(trabajador, `${como}bash -lc ${citar(ACTU.SONDA_GIT(arbol))}`)
  } catch (e) { salida = String((e && e.stdout) || '') }
  const v = ACTU.evaluarClon(ACTU.leerSonda(salida), { reanuda })

  let commits = null
  if (v.hayQueActualizar) {
    try {
      const orden = v.volverAMain ? ACTU.ORDEN_A_MAIN(arbol, trabajador) : ACTU.ORDEN_ACTUALIZAR(arbol)
      commits = `ahora en ${enMaquina(trabajador, `${como}bash -lc ${citar(orden)}`).trim()}`
    } catch (e) {
      // Se creía que se podía avanzar y el pull falló: eso ya no es «atrasado», es no saber.
      const fallo = { estado: 'sin_red', puedeEncargar: false, hayQueActualizar: false,
        motivo: `el pull falló: ${String((e && e.message) || e).slice(0, 120)}` }
      if (emitir) emitir(fallo)
      return { ...fallo, linea: ACTU.diagnostico(trabajador, fallo) }
    }
  }
  if (emitir) emitir(v)
  return { ...v, linea: ACTU.diagnostico(trabajador, v, { commits }) }
}

/**
 * Manda un encargo a un trabajador. **Única puerta**: `encargar` y `repartir` pasan por aquí.
 *
 * Estaba escrito dos veces —una por comando— y así es como una de las dos se queda sin el
 * guardarraíl que se añade a la otra ([T-130]). El paso por el clon al día va DENTRO, no en cada
 * llamador, por el mismo motivo: un guardarraíl que hay que acordarse de invocar no es un
 * guardarraíl (§8, «impedir en el punto de escritura»).
 *
 * El encargo va a un FICHERO en la máquina y se lanza con `claude -p "$(cat …)"`.
 *
 * Por qué no al TUI interactivo: `CLAUDE_CODE_OAUTH_TOKEN` autentica `claude -p` pero el TUI lo
 * IGNORA y se queda en la pantalla de login (medido el 05/08 con un token válido). Y por qué por
 * fichero y no como argumento: el encargo es multilínea y acabaría roto por las comillas, además
 * de quedar visible en `ps` para cualquier usuario de la máquina.
 *
 * ── POR QUÉ `bypassPermissions` Y POR QUÉ ES DEFENDIBLE AQUÍ ────────────────────────────────
 * Un trabajador autónomo no tiene a quién pedirle permiso: con el modo por defecto se queda
 * preguntando «¿puedo ejecutar claim?» a una terminal que nadie mira, que es como pasó la primera
 * vez. La contención NO es el diálogo de permisos, son las credenciales: esta máquina tiene el rol
 * `vence_coordinacion` (4 tablas, ninguna de negocio, ningún DELETE) y el de lectura (sin
 * identificadores directos, sin escritura), no tiene claves de AWS ni de Stripe, y no puede
 * desplegar.
 *
 * ⚠️ Riesgo residual conocido y NO cerrado: el clon del repo tiene escritura sobre `main`. Mientras
 * eso siga así, lo que impide un push indebido es el push-guard y el encargo, no el permiso.
 *
 * Todo se hace COMO el usuario del trabajador: su tmux, su fichero de encargo, su log. Claude Code
 * se niega a trabajar sin supervisión con privilegios de root (y hace bien). En el portátil ya
 * eres tú: ni sudo ni chown.
 */
function mandarEncargo(trabajador, texto, { alDia = null, turno = null, fresco = false } = {}) {
  // ¿Está libre AHORA? El claim tarda minutos en aparecer desde que se manda el encargo, y en esa
  // ventana el trabajador es invisible para el reparto. La verdad la tiene su panel.
  const ocupacion = ENC.puedeRecibir(comandoDelPanel(trabajador))
  if (!ocupacion.libre) return { ok: false, ocupado: true, motivo: ocupacion.motivo }
  // Y aunque su panel diga que está libre: si queda un `claude -p` suyo VIVO, está trabajando.
  // El panel puede ser una sesión recién creada mientras el turno anterior sigue corriendo
  // huérfano —lo que pasa cuando el OOM se lleva el tmux y no al proceso—, y mandarle otro
  // encargo pone dos turnos a escribir en el mismo worktree (T-642).
  const vivos = turnosVivosDe(trabajador)
  if (vivos > 0) return { ok: false, ocupado: true, motivo: `ya tiene ${vivos} turno(s) vivo(s) (huérfano: su sesión murió y el proceso siguió)` }

  // ── SIN CUOTA NO SE MANDA NADA, VENGA POR DONDE VENGA (T-642, 07/08) ──────────────────────
  // La comprobación de cuota agotada de [T-617] vivía SOLO en el camino de «retomar su tarea».
  // Medido al estrenar la reanimación de sesiones: `w3` —cuya cuenta está seca hasta las 23:00—
  // recibió un encargo NUEVO por el camino de reparto, que no pasa por ahí, y habría seguido
  // recibiéndolo cada 5 minutos durante catorce horas: asignado sobre el papel, sin producir
  // nada, y con la tarea de revisión retenida por un trabajador que no puede trabajarla.
  //
  // Va AQUÍ, en la única puerta por la que sale todo encargo, que es donde el resto del sistema
  // pone sus impedimentos (principio 8: impedir en el punto de escritura). El CRITERIO no se
  // duplica —lo pone `AUT.clasificar`, el mismo de T-617—: lo que se añade es un segundo
  // llamador, no una segunda regla. Y se lee del log del turno ANTERIOR, sin gastar la cuota que
  // justamente no queda.
  const salidaPrevia = logDelTurno(trabajador)
  const auth = AUT.clasificar(salidaPrevia)
  if (auth.estado === 'cuota_agotada') {
    return { ok: false, sinCuota: true, motivo: auth.detalle }
  }

  const al = alDia || ponerAlDia(trabajador)
  if (al.linea) console.log(`   ${al.linea}`)
  if (!al.puedeEncargar) return { ok: false, al }
  // Un turno nuevo no recuerda nada del anterior: si dejó trabajo a medias hay que DECÍRSELO,
  // o lo normal es que empiece de cero encima de la única copia que existe.
  if (al.estado === 'a_medias') texto += '\n' + ENC.avisoTrabajoAMedias(al.motivo)

  const m = MAQ.maquinaDe(trabajador)
  const env = ficheroEntorno(trabajador)
  const enc = ficheroEncargo(trabajador)
  const como = m.local ? '' : 'sudo -u flota '
  const dueno = m.local ? '' : `&& chown flota ${enc} `

  // ── LA CONVERSACIÓN SOBREVIVE AL TURNO (T-486, 06/08) ────────────────────────────────
  // Antes cada encargo era un `claude -p` virgen: el trabajador volvía a orientarse en el repo
  // y a reconstruir el contexto CADA VEZ, y ese arranque se pagaba entero. Con `--resume` se
  // paga una vez. Verificado ejecutándolo en w3: turno 1 «recuerda 4417» → turno 2, proceso
  // distinto, «4417». El modo de un solo tiro venía de que el TUI ignora el token OAuth —
  // cierto, pero eso no obligaba a tirar también la conversación.
  const fSesion = SES.ficheroSesion(env)
  let previa = null
  try { previa = enMaquina(trabajador, `cat ${fSesion} 2>/dev/null || true`).trim() || null } catch {}
  const ses = SES.banderasSesion({ sesionPrevia: previa, fresco, nuevoId: crypto.randomUUID() })
  let peso = null
  if (ses.continua) {
    try {
      const t = enMaquina(trabajador,
        `stat -c %s ${SES.rutaTranscript({ home: `/home/flota`, arbol: MAQ.arbolDe(trabajador).replace('~flota', '/home/flota'), id: ses.id })} 2>/dev/null || true`).trim()
      peso = t ? Number(t) : null
    } catch {}
  }
  console.log(`   ${SES.lineaSesion({ continua: ses.continua, id: ses.id, tamanoBytes: peso })}`)

  // ── EL LOG ES DE **ESTE** TURNO (T-486, 06/08) ────────────────────────────────────────
  // Orden de Manuel: «borra los logs de los trabajadores de ayer para no liar». Se rota AQUÍ y
  // no con un borrado a mano por una razón medida: al ir a hacerlo, los cuatro trabajadores
  // estaban escribiendo (`tee -a` con el descriptor abierto), y truncar un fichero en ese estado
  // lo deja corrupto — el arranque del turno es el único instante en que nadie escribe.
  //
  // El turno anterior no se destruye, se aparta a `.anterior`: sirve para comparar dos turnos
  // seguidos cuando algo va mal. Y la memoria completa ya no vive aquí de todos modos — vive en
  // el transcript de la conversación, que ahora persiste entre turnos.
  const log = `~/flota-${trabajador}.log`
  try { enMaquina(trabajador, `${como}sh -c 'mv -f ${log} ${log}.anterior 2>/dev/null || true'`) } catch {}

  enMaquina(trabajador,
    `umask 077 && mkdir -p "$(dirname ${enc})" && cat > ${enc} ${dueno}&& ` +
    `${como}sh -c 'printf %s ${ses.id} > ${fSesion}' && ` +
    `${como}tmux -L ${trabajador} send-keys -t ${trabajador} 'set -a; . ${env}; set +a; ` +
    `"\${CLAUDE_BIN:-claude}" -p "$(cat ${enc})" ${ses.flags.join(' ')} --permission-mode bypassPermissions 2>&1 | tee -a ~/flota-${trabajador}.log' Enter`,
    { entrada: texto })

  // ── ¿ARRANCÓ DE VERDAD? (T-642, 07/08) ────────────────────────────────────────────────
  // `send-keys` solo confirma que las teclas se escribieron, no que el comando siguiera vivo.
  // Medido: con la cuota semanal agotada, `claude -p` muere en <1s y sin esto se declaraba
  // {ok:true} igual — el vigía cantó "↻ w1 retoma T-548" cada 5 min durante 3h sin que nadie
  // llegara a trabajar. El margen es corto a propósito: basta para distinguir "murió al
  // instante" de "sigue vivo"; no para esperar a que el turno TERMINE (eso puede tardar horas).
  try { execFileSync('sleep', [String(VERIFICACION_ARRANQUE_S)]) } catch {}
  const tras = ENC.arrancoDeVerdad(comandoDelPanel(trabajador))
  if (tras.arranco === false) {
    const salida = logDelTurno(trabajador)
    const auth = AUT.clasificar(salida)
    const motivo = auth.estado !== 'desconocido' ? auth.detalle : tras.motivo
    return { ok: false, arranque: false, motivo }
  }
  // arranco === null (no se pudo ver el panel): no se declara fallo sobre algo que no se pudo
  // comprobar — se sigue como si hubiera arrancado, igual que antes de este cambio.

  // El rastro lo deja la PUERTA, no el llamador. Puesto en cada sitio que manda, se olvida en uno
  // — y de hecho se olvidó en `repartir` al primer intento, así que la serie nacía incompleta.
  if (turno) turno()
  return { ok: true, al }
}

/**
 * Por qué `mandarEncargo` devolvió `{ok:false}`, en una frase — sea cual sea la FORMA del
 * fallo (T-642). Antes cada llamador leía `r.ocupado ? r.motivo : r.al.estado` a mano, así que
 * al añadir una tercera forma (`arranque:false`, sin `al`) los tres sitios que no distinguían
 * `ocupado` habrían reventado leyendo `.estado` de `undefined`. UN sitio que conozca las formas.
 */
function motivoFallo(r) {
  if (r.ocupado) return r.motivo
  // Sin cuota es un «no» con fecha de caducidad, no una avería: se dice distinto para que quien
  // lea el log sepa que no hay nada que arreglar, solo que esperar (T-642).
  if (r.sinCuota) return `${r.motivo} — no se le manda nada hasta que reponga`
  if (r.arranque === false) return r.motivo
  return r.al ? r.al.estado : 'motivo desconocido'
}

/**
 * Dónde vive el fichero de entorno de un trabajador.
 *
 * Lo dice la MÁQUINA (`dirEntorno`), no si el proceso corre aquí o allí. Se deducía de `m.local`,
 * lo que era accidentalmente correcto mientras «local» solo podía significar el portátil; en
 * cuanto el supervisor puede correr en el VPS [T-617], esa deducción manda a buscar los entornos
 * de w1-w4 a `$HOME/.vence-flota` cuando están en `/etc/vence-flota`, y el supervisor no
 * encontraría el entorno de sus propios trabajadores.
 */
function ficheroEntorno(trabajador) {
  const m = MAQ.maquinaDe(trabajador)
  if (!m) throw new Error(`el trabajador "${trabajador}" no está declarado en ninguna máquina`)
  return `${m.dirEntorno}/${trabajador}.env`
}

/**
 * El fichero con el ENCARGO vivo de un trabajador. Su fecha de modificación es cuándo empezó el
 * turno actual — que es lo único con lo que el bucle puede saber si alguien lleva demasiado
 * tiempo atascado, porque el turno corre en otra máquina y no deja fila en ninguna tabla.
 *
 * Existe como helper porque se calculaba en dos sitios y el segundo (el vigilante del bucle) lo
 * llamó como función sin que la función existiera: el bucle habría reventado en su primera
 * pasada. Se encontró al ir a arrancarlo, no leyendo el código.
 */
function ficheroEncargo(trabajador) {
  return ficheroEntorno(trabajador).replace(/\.env$/, '.encargo')
}

async function main() {
  const u = url()
  if (!u) { console.error('❌ sin DATABASE_URL'); return 1 }
  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 15 })

  // Al bus, para que la serie EXISTA: cada cuánto se queda atrás la flota y cuántas veces no se le
  // puede dar trabajo. Sin esto, «el clon estaba viejo» solo se sabe cuando alguien lo mira.
  // Fail-open a propósito (§9): la telemetría no puede impedir gobernar la flota.
  const emitirClon = (trabajador, v) => sql`
    INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
    VALUES ('fargate', ${ACTU.severidad(v)}, 'flota_clon_desactualizado', 'flota', ${v.motivo},
            ${sql.json({ trabajador, maquina: MAQ.maquinaDe(trabajador)?.nombre || null, estado: v.estado })})`
    .catch(() => {})


  // ── EL TURNO DE UN TRABAJADOR, VISIBLE ────────────────────────────────────────────────────
  // Hasta aquí se observaba el ANDAMIAJE (preflight, fricción, clon al día) pero no el trabajo: el
  // turno de un `claude -p` nacía y moría dentro de un fichero de log en su máquina, sin cruzar a
  // ninguna parte. Nadie podía responder «¿cuánto tarda un turno?», «¿cuántos mueren a medias?»
  // ni «¿qué se le encargó y cuándo?» sin entrar por SSH a leer un `tail`.
  //
  // Un solo `event_type` con `fase` dentro, y no dos: dos tipos para el mismo hecho se vigilan con
  // dos reglas y una acaba sin nadie que la mire.
  const emitirTurno = (trabajador, fase, extra = {}) => sql`
    INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
    VALUES ('fargate', ${fase === 'muerto' ? 'warn' : 'info'}, 'flota_turno', 'flota',
            ${extra.motivo || null},
            ${sql.json({ trabajador, fase, maquina: MAQ.maquinaDe(trabajador)?.nombre || null, ...extra })})`
    .catch(() => {})

  try {
    if (cmd === 'estado') {
      // TODAS las sesiones, no solo los trabajadores: el supervisor tiene que enseñar en UNA
      // pantalla lo que está pasando, y las sesiones que abre Manuel a mano son la mitad de eso.
      // Se ven pero no se gobiernan: a la terminal de una persona no se le mandan encargos.
      const todas = await sql`
        SELECT sid, slug, host, rol, last_signal_at, last_command FROM public.worktree_sessions`
      const sesiones = todas.filter((s) => s.rol === 'trabajador')
      const tareas = await sql`
        SELECT id, title, claimed_by FROM public.backlog_tasks
         WHERE status = 'in_progress' AND claimed_by IS NOT NULL`
      // Se traen las columnas del veredicto porque hay DOS estados distintos aquí (T-486): sin
      // mirar todavía, y ya mirada con veredicto escrito. Colapsarlas anunciaba «19 esperando que
      // las revises» cuando 4 ya estaban revisadas — y el resultado de esa revisión no lo veía
      // nadie. El criterio no se re-escribe aquí: lo pone `lib/backlog/revision.cjs`.
      const entregas = await sql`
        SELECT id, title, review_requested_at, review_requested_by,
               reviewed_at, reviewed_by, review_verdict, review_findings
          FROM public.backlog_tasks
         WHERE review_requested_at IS NOT NULL AND status <> 'done'`
      // `context` viaja SIEMPRE con `question` (T-614): es donde el trabajador pega su análisis y,
      // por tanto, donde acaban los ids de las impugnaciones en las filas de prosa. Traer media
      // fila no da error — simplemente hace que el aviso de «ese caso ya está cerrado» no salte,
      // que es la forma silenciosa de fallar que ya costó T-486 con review_requested_at/reviewed_at.
      const preguntas = await sql`
        SELECT id, sid, question, context, kind, draft_target FROM public.session_questions WHERE status = 'open'
         ORDER BY (kind = 'borrador') DESC, asked_at`.catch(() => [])
      const preguntasMarcadas = await marcarCasosCerradosEnEmbudo(sql, preguntas)

      const filas = MAQ.comparar(sesiones)
      // Mismo criterio que el reparto, y por la misma razón (T-667): con dos filas de sesión del
      // mismo trabajador —lo normal en cuanto se reinstala o se recrea su worktree— un Map a pelo
      // se queda con una arbitraria, y entonces **el panel enseña la tarea de otro sid**: o dice
      // «sin tarea» a quien la tiene cogida, o al revés. Lo resuelve `maquinas.cjs`.
      const porSid = new Map([...MAQ.sesionVigente(sesiones)].map(([slug, s]) => [slug, s.sid]))
      const tareaDe = (slug) => tareas.find((t) => t.claimed_by === porSid.get(slug))

      console.log('\nFLOTA')
      console.log('='.repeat(60))

      // ── LA MÁQUINA, NO SOLO EL TRABAJADOR ([T-677]) ─────────────────────────────────
      // Se vigilaba si el trabajador puede autenticarse, si su clon está al día, si produce y si
      // su turno arranca — y nunca el SITIO donde trabaja. Medido el 07/08 en `flota-1`: cuatro
      // trabajadores en verde y «ejecutando» sobre una máquina con el 9 % de memoria disponible,
      // carga 19,7 en 4 núcleos y la CPU 97,7 % ociosa, o sea los cuatro turnos esperando disco.
      // Un trabajador sano en una máquina ahogada no avanza, y eso no lo dice ninguna otra señal.
      const saludPorMaquina = new Map()
      for (const f of filas) {
        const maq = MAQ.maquinaDe(f.trabajador)
        const clave = maq ? maq.nombre : f.trabajador
        if (saludPorMaquina.has(clave)) continue
        const medida = medirMaquina(f.trabajador)
        if (!medida) continue
        saludPorMaquina.set(clave, { medida, veredicto: SALUD.clasificarMaquina(medida) })
      }
      for (const [maquina, { medida, veredicto }] of saludPorMaquina) {
        if (veredicto.estado === 'ok') continue
        const icono = veredicto.estado === 'ahogada' ? '🔴' : '🟠'
        console.log(`  ${icono} MÁQUINA ${maquina}: ${veredicto.estado.toUpperCase()}`)
        for (const m of veredicto.motivos) console.log(`       · ${m}`)
        if (veredicto.estado === 'ahogada') {
          console.log('       → los turnos no avanzan aunque el panel los pinte «ejecutando»')
        }
        // Rastro para la alerta proactiva: sin esto solo lo ve quien mira el panel.
        try {
          await sql`
            INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
            VALUES ('fargate', ${veredicto.estado === 'ahogada' ? 'error' : 'warn'},
                    'flota_maquina_salud', 'flota',
                    ${`máquina ${maquina} ${veredicto.estado}: ${veredicto.motivos[0] ?? ''}`},
                    ${sql.json({ maquina, estado: veredicto.estado, motivos: veredicto.motivos, ...veredicto.señales, medida })})`
        } catch { /* la telemetría nunca puede parar al supervisor */ }
      }
      // ── LA PREGUNTA QUE EL LATIDO NO CONTESTA: ¿HAY ALGUIEN EJECUTANDO? ─────────────
      // El latido demuestra que un comando del andamiaje corrió; el claim, que alguien cogió la
      // tarea. Ninguno de los dos dice si AHORA MISMO hay un proceso trabajando. Medido el 05/08:
      // el panel decía «✅ toda la flota viva y trabajando» con los cuatro 🟢 y sus tareas… y el
      // VPS estaba a **carga 0,05 con CERO procesos de Claude**. Los turnos habían terminado
      // solos y las tareas se quedaron cogidas por nadie.
      //
      // Un trabajador con tarea cogida y sin proceso es el estado PEOR de todos: bloquea la tarea
      // para los demás y no avanza. Se pinta aparte porque se arregla distinto — no hay que
      // levantarlo (su tmux vive), hay que volver a lanzarle el turno.
      const abandonadas = []
      for (const f of filas) {
        // ⚠️ «No se pudo ver» NO es «está ejecutando». `comandoDelPanel` devuelve cadena vacía
        // cuando no hay sesión de tmux —o no se puede alcanzar la máquina—, y leer eso como
        // «ocupado» pintaba de verde a un trabajador que NO EXISTE: pasó con w3 y w4 el 05/08,
        // declarados en el registro y nunca arrancados, saliendo «🟢 ejecutando». Es el mismo
        // verde falso que este repo persigue en el contenido, aquí en el panel que lo vigila.
        const comando = comandoDelPanel(f.trabajador)
        const ejecutando = comando !== '' && ENC.puedeRecibir(comando).libre === false
        // Un trabajador callado PERO con sesión viva está LIBRE, no caído. Confundirlos manda a
        // levantar lo que solo hacía falta encargar.
        const libre = !ejecutando && sesionViva(f.trabajador)
        const t = tareaDe(f.trabajador)
        const abandonada = !!t && !ejecutando
        if (abandonada) abandonadas.push({ trabajador: f.trabajador, tarea: t })
        const icono = abandonada ? '🟠' : ejecutando ? '🟢' : libre ? '🔵' : '🔴'
        const cuando = f.antiguedadMin == null ? 'sin señal nunca'
          : f.antiguedadMin < 1 ? 'ahora mismo' : `hace ${f.antiguedadMin} min`
        // El cruce que faltaba ([T-677]): el semáforo mira si hay PROCESO y la antigüedad del
        // latido se imprimía AL LADO, sin juntarse nunca. Un proceso vivo con el latido congelado
        // es un turno que no progresa — medido: `w1` con 8,5 h sin latir y un `claude -p` de
        // 2 h 31 min que no terminaba, pintado en verde todo el rato.
        const atascado = SALUD.turnoSinProgreso({ ejecutando, latidoMin: f.antiguedadMin, turnoMin: null })
        console.log(`  ${atascado.sospechoso ? '🟠' : icono} ${f.trabajador.padEnd(4)} ${f.maquina.padEnd(9)} ${cuando}${ejecutando ? '  · ejecutando' : ''}`)
        if (atascado.sospechoso) {
          console.log(`       ⚠️ ${atascado.motivo}`)
          try {
            await sql`
              INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
              VALUES ('fargate', 'warn', 'flota_turno_sin_progreso', 'flota',
                      ${`${f.trabajador}: ${atascado.motivo}`},
                      ${sql.json({ trabajador: f.trabajador, maquina: f.maquina, latidoMin: f.antiguedadMin, tarea: t ? t.id : null })})`
          } catch { /* la telemetría nunca puede parar al supervisor */ }
        }
        console.log(`       ${abandonada ? `⚠️ ${t.id} COGIDA Y SIN PROCESO — su turno terminó (relánzalo: flota -- encargar ${f.trabajador} --tarea ${t.id})`
          : t ? `${t.id} — ${String(t.title).slice(0, 60)}`
          : libre ? 'LIBRE, esperando encargo (npm run flota -- repartir)'
          : 'SIN TAREA (dale una: flota -- encargar ' + f.trabajador + ')'}`)
      }

      // ── TUS SESIONES ────────────────────────────────────────────────────────────────
      // Las que tienes abiertas en pantalla. No se gobiernan desde aquí —son tuyas— pero salen,
      // porque «una sola pantalla» no puede significar «la mitad de lo que pasa».
      const ahora = new Date()
      const personas = todas.filter((s) => s.rol !== 'trabajador')
      // ⚠️ El cruce recibe TODAS las sesiones, no solo las tuyas. Pasarle solo las personas hacía
      // que cualquier tarea de un trabajador se leyera como «esa sesión nunca ha dado señal»,
      // porque su sesión simplemente no estaba en la lista. Medido el 05/08: el panel decía
      // «✅ toda la flota viva y trabajando» y, cuatro líneas más arriba, marcaba las CUATRO
      // tareas de esos mismos trabajadores como paradas. Cuatro falsos de cuatro: una alarma que
      // acierta cero veces se deja de leer, y entonces tampoco se ve la que sí importa.
      const { trabajando, paradas } = PARTE.cruzarTrabajo(tareas, todas, { ahora })
      const sidsTrabajadores = new Set(sesiones.map((s) => s.sid))
      // Lo de un trabajador ya lo cuenta el bloque de la flota, arriba, con su estado real. Aquí
      // solo lo TUYO, que es lo que el encabezado promete.
      const paradasTuyas = paradas.filter((p) => !sidsTrabajadores.has(p.sid))
      const vivasPersonas = personas.filter((s) => {
        const min = (ahora.getTime() - new Date(s.last_signal_at).getTime()) / 60000
        return min <= 45
      })
      if (vivasPersonas.length) {
        console.log(`\n👤 ${vivasPersonas.length} SESIÓN(ES) TUYAS (no se les manda trabajo: son tuyas)`)
        for (const p of vivasPersonas) {
          const t = tareas.find((x) => x.claimed_by === p.sid)
          const min = Math.round((ahora.getTime() - new Date(p.last_signal_at).getTime()) / 60000)
          console.log(`   ${(p.slug || '?').padEnd(16)} ${min < 1 ? 'ahora mismo' : `hace ${min} min`.padEnd(12)} ${t ? `${t.id} — ${String(t.title).slice(0, 44)}` : '(sin tarea cogida)'}`)
        }
      }
      if (paradasTuyas.length) {
        console.log(`\n🟠 ${paradasTuyas.length} TAREA(S) TUYAS SIN SEÑAL DE SU SESIÓN:`)
        for (const p of paradasTuyas) console.log(`   ${p.id}  ${String(p.title).slice(0, 56)} — ${p.detalle}`)
      }

      // Lo que espera a Manuel va SIEMPRE, aunque la flota esté perfecta: es lo único cuyo coste
      // corre mientras nadie lo lee.
      const sinMirar = entregas.filter((e) => REV.esperaRevision(e))
      const conVeredicto = entregas.filter((e) => REV.esperaDecision(e))
      if (conVeredicto.length) {
        // ── SEPARADAS POR CLASE DE ESPERA (T-629) ───────────────────────────────────────────
        // Esta cola se presentaba entera como «falta tu decisión» y NO lo estaba: medido el
        // 06/08, 6 de 24 solo esperaban una tubería de git ([T-628]). Mezcladas, la cola se lee
        // entera o no se lee; separadas, la parte mecánica se vacía de una sentada.
        const RAMAS = require(path.join(REPO, 'lib', 'backlog', 'ramasDeTarea.cjs'))
        const idx = RAMAS.indiceDeRamas()
        const porClase = { criterio: [], solo_mergear: [], solo_cerrar: [] }
        for (const e of conVeredicto) {
          porClase[REV.claseDeEspera(e, RAMAS.hechosDeGit(e.id, idx)).clase].push(e)
        }
        const malas = conVeredicto.filter((e) => REV.devueltaConProblemas(e)).length
        console.log(`\n⚖️  ${conVeredicto.length} YA REVISADA(S) — hay veredicto${malas ? ` (${malas} con problemas)` : ''}`)
        if (!idx) console.log('   ⚠️  sin git a mano: no se han podido separar, van todas como «criterio»')
        const titulos = {
          criterio: '🧠 PIDEN CRITERIO (léelas)',
          solo_mergear: '🔀 SOLO FALTA MERGEAR (mecánico: hay rama sin fusionar que las declara)',
          solo_cerrar: '✅ SOLO FALTA CERRAR (ninguna rama sin fusionar las declara)',
        }
        for (const clase of ['criterio', 'solo_mergear', 'solo_cerrar']) {
          if (!porClase[clase].length) continue
          console.log(`\n   ${titulos[clase]} — ${porClase[clase].length}`)
          for (const e of porClase[clase]) console.log(REV.lineaRevisada(e))
        }
      }
      if (sinMirar.length) {
        console.log(`\n🙋 ${sinMirar.length} ENTREGADA(S) esperando que las revises:`)
        for (const e of sinMirar) console.log(`   ${e.id}  ${String(e.title).slice(0, 62)}`)
      }
      // ── BORRADORES: lo PRIMERO, porque es lo único que va a salir hacia una persona ────
      // «Siempre tengo que aprobar lo que se envía» (Manuel). Van separados de las preguntas y
      // por delante: una pregunta espera una decisión, un borrador espera un permiso, y
      // confundirlos haría que lo segundo se leyera como lo primero.
      const borradores = preguntasMarcadas.filter((p) => p.kind === 'borrador')
      const dudas = preguntasMarcadas.filter((p) => p.kind !== 'borrador')
      if (borradores.length) {
        console.log(`\n📝 ${borradores.length} BORRADOR(ES) esperando tu OK — nada de esto se ha enviado:`)
        for (const b of borradores) {
          console.log(`   #${b.id} → ${String(b.draft_target || '?').slice(0, 40)}  (${sidCorto(b.sid)})`)
          console.log(`        ${String(b.question).slice(0, 88)}`)
          const aviso = BORRAB.avisoCasoCerrado(b.casosCerrados || [])
          if (aviso) console.log(`        ${aviso}`)
        }
        console.log('   léelos enteros:  node scripts/backlog.cjs preguntas')
      }
      if (dudas.length) {
        // Las que citan un caso YA cerrado van al final y marcadas: siguen ahí (citar no es
        // trabajar, pueden estar vivas), pero no pueden encabezar la lista como si esperaran una
        // decisión fresca. El 06/08 eran 10 de 16 y tapaban lo único urgente que había debajo.
        const vivas = dudas.filter((p) => !(p.casosCerrados || []).length)
        const conCasoCerrado = dudas.filter((p) => (p.casosCerrados || []).length)
        console.log(`\n❓ ${dudas.length} PREGUNTA(S):`)
        for (const p of vivas) console.log(`   ${sidCorto(p.sid)}: ${String(p.question).slice(0, 90)}`)
        if (conCasoCerrado.length) {
          console.log(`   ── ${conCasoCerrado.length} citan un caso YA CERRADO (mira si siguen haciendo falta):`)
          for (const p of conCasoCerrado) {
            const claves = p.casosCerrados.map((c) => c.clave).join(', ')
            console.log(`   ⚠️  ${sidCorto(p.sid)}: ${String(p.question).slice(0, 74)} [${claves}]`)
          }
        }
      }
      // ── ¿PUEDEN DE VERDAD TRABAJAR? (T-486) ────────────────────────────────────────
      // El latido dice que la máquina vive; no dice nada de Claude Code. Sin esta sonda, un
      // trabajador atascado en la pantalla de login sale 🟢 y ocupa sitio en el reparto sin
      // poder hacer nada — pasó en el primer arranque real, con los dos a la vez.
      // Cuesta cuota, así que va solo con --probar… salvo que alguno esté SIN TAREA, que es
      // justo el síntoma con el que se manifiesta.
      const sospechosos = filas.filter((f) => f.estado === 'vivo' && !tareaDe(f.trabajador))
      const probar = process.argv.includes('--probar') || sospechosos.length > 0
      const malAutenticados = []
      if (probar) {
        for (const f of (process.argv.includes('--probar') ? filas.filter((x) => x.estado === 'vivo') : sospechosos)) {
          let salida = ''
          try {
            salida = enMaquina(f.trabajador,
              (MAQ.maquinaDe(f.trabajador).local ? '' : 'sudo -u flota ') +
              `bash -c "set -a; . ${ficheroEntorno(f.trabajador)}; set +a; timeout 90 claude -p ` +
              `${JSON.stringify(AUT.SONDA).replace(/"/g, '\\"')} 2>&1" || true`)
          } catch (e) { salida = String(e.message || e) }
          const v = AUT.clasificar(salida, /\bok\b/i.test(salida) ? 0 : 1)
          if (!AUT.puedeTrabajar(v)) {
            malAutenticados.push({ trabajador: f.trabajador, v })
            // Al bus, para que la serie exista y se pueda ver si esto mejora o empeora.
            await sql`
              INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
              VALUES ('fargate', ${AUT.severidad(v)}, 'flota_autenticacion', 'flota', ${v.detalle},
                      ${sql.json({ trabajador: f.trabajador, maquina: f.maquina, estado: v.estado })})`
              .catch(() => {})
          }
        }
      }
      if (malAutenticados.length) {
        console.log(`\n🔑 ${malAutenticados.length} trabajador(es) NO pueden trabajar aunque estén latiendo:`)
        for (const m of malAutenticados) console.log(`   ${AUT.diagnostico(m.trabajador, m.v)}`)
      }

      // El resumen NO puede meter en el mismo saco «no da señal» y «da señal pero no puede
      // trabajar»: se arreglan en sitios distintos (la máquina vs. la credencial), y un resumen
      // que los confunde manda a mirar donde no es.
      const sinSenal = filas.filter((f) => f.estado !== 'vivo' && !sesionViva(f.trabajador))
      const partes = []
      if (sinSenal.length) partes.push(`${sinSenal.length} sin señal`)
      if (malAutenticados.length) partes.push(`${malAutenticados.length} sin poder trabajar`)
      if (abandonadas.length) partes.push(`${abandonadas.length} con la tarea cogida y SIN PROCESO`)
      console.log(partes.length ? `\n⚠️  ${partes.join(' · ')}` : '\n✅ toda la flota viva y trabajando')
      return partes.length ? 3 : 0
    }

    if (cmd === 'encargar') {
      const w = process.argv[3]
      if (!w) { console.error('Uso: flota.cjs encargar <trabajador> [--tarea T-nnn | --impugnaciones] [--fresco]'); return 2 }

      // ── IMPUGNACIONES: analizar SÍ, enviar NO ───────────────────────────────────────────
      // No pasa por el backlog: la cola de impugnaciones tiene su propio claim atómico
      // (`cola.cjs`, FOR UPDATE SKIP LOCKED), así que N trabajadores cogen N impugnaciones
      // distintas sin coordinarse. Lo que produce es un BORRADOR que aprueba una persona.
      if (process.argv.includes('--impugnaciones')) {
        const alDia = ponerAlDia(w, { emitir: (v) => { emitirClon(w, v) } })
        const r = mandarEncargo(w, ENC.encargoImpugnacion({ trabajador: w, puedeDesplegar: MAQ.puedeDesplegar(w).puede }),
          { alDia, turno: () => emitirTurno(w, 'encargado', { tipo: 'impugnacion' }) })
        if (!r.ok) {
          console.error(`❌ ${w}: ${motivoFallo(r)}`)
          return 1
        }
        console.log(`✅ ${w} → analizar una impugnación (cogerá una libre de la cola). Dejará BORRADOR, no enviará nada.`)
        return 0
      }

      let tarea = null
      const pedida = arg('--tarea')
      if (pedida) {
        const [t] = await sql`SELECT id, title, claimed_by FROM public.backlog_tasks WHERE id = ${pedida}`
        if (!t) { console.error(`❌ ${pedida} no existe`); return 1 }
        const v = ENC.esApta(t)
        if (!v.apta) console.log(`⚠️  ${t.id} no parece apta para un trabajador (${v.motivo}) — se manda igual porque lo has pedido.`)
        tarea = t
      } else {
        // Candidatas: libres, sin espera, ordenadas como las ordena el backlog.
        const libres = await sql`
          SELECT id, title FROM public.backlog_tasks
           WHERE status = 'open' AND claimed_by IS NULL
             AND (snooze_until IS NULL OR snooze_until <= now())
             AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL
           ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, id
           LIMIT 40`
        const { tarea: elegida, descartadas } = ENC.elegir(libres)
        if (!elegida) { console.error('❌ ninguna tarea libre resultó apta'); return 1 }
        tarea = elegida
        if (descartadas.length) {
          console.log(`   (descartadas ${descartadas.length} por delante: ${descartadas.slice(0, 3).map((d) => `${d.id} — ${d.motivo}`).join(' · ')})`)
        }
      }

      // ── EL CÓDIGO PRIMERO, LUEGO EL TRABAJO ─────────────────────────────────────────────
      // Un encargo sobre código viejo es tiempo que luego hay que tirar, y peor: son los
      // guardarraíles de otra fecha protegiendo a quien nadie mira.
      //
      // ¿Es RETOMAR lo suyo o empezar algo nuevo? Cambia el veredicto sobre un árbol a medias:
      // encima de un trabajo sin terminar no se empieza otra cosa, pero seguir el propio es
      // exactamente lo que hay que poder hacer.
      const [ses] = await sql`SELECT sid FROM public.worktree_sessions WHERE slug = ${w}`
      const reanuda = !!(ses && tarea.claimed_by === ses.sid)
      const alDia = ponerAlDia(w, { emitir: (v) => { emitirClon(w, v) }, reanuda })
      const r = mandarEncargo(w, ENC.encargo({ trabajador: w, tarea, puedeDesplegar: MAQ.puedeDesplegar(w).puede }),
        // `--fresco` empieza conversación NUEVA. Existe porque una conversación larga se vuelve
        // cara y, si se tuerce, arrastra el error de turno en turno. No hay reinicio automático
        // a propósito: no tenemos aún ni un umbral MEDIDO ni un caso real que lo pida.
        { alDia, fresco: process.argv.includes('--fresco'),
          turno: () => emitirTurno(w, 'encargado', { tarea: tarea.id, tipo: 'backlog' }) })
      if (!r.ok) {
        console.error(r.ocupado
          ? `❌ ${w} ${r.motivo} — espera a que termine, o míralo con: tmux -L ${w} attach -t ${w}`
          : `❌ ${w}: ${motivoFallo(r)}`)
        return 1
      }
      console.log(`✅ encargo enviado a ${w}: ${tarea.id} — ${String(tarea.title).slice(0, 60)}`)
      console.log(`   míralo con:  npm run flota    (o tmux -L ${w} attach -t ${w} en la máquina)`)
      return 0
    }

    // ── PRODUCTIVIDAD: ¿produce, y a qué coste para Manuel? ───────────────────────────────
    // Va AQUÍ y no en un script suelto porque es la misma pregunta que el panel: cómo va la flota.
    // El ratio de escape de guardarraíles —el otro criterio declarado— ya lo mide
    // `npm run sesiones:friccion`, así que se REMITE a él en vez de calcularlo otra vez ([T-130]).
    if (cmd === 'productividad') {
      const dias = Math.max(1, Number(arg('--dias') || 7))
      const cerradas = await sql`
        SELECT id, closed_at AS done_at, claimed_by, worked_seconds, review_requested_by
          FROM public.backlog_tasks
         WHERE closed_at > now() - (${dias} || ' days')::interval`
      const entregadas = await sql`
        SELECT id, review_requested_at, review_requested_by,
        reviewed_at, reviewed_by, review_verdict
          FROM public.backlog_tasks
         WHERE review_requested_at IS NOT NULL AND status <> 'done'`
      const m = PROD.medir({ cerradas, entregadas, ahora: new Date() })

      // ── PREVISIÓN: hace falta el TAMAÑO de lo que queda y el RITMO reciente ─────────
      const [{ pendientes }] = await sql`
        SELECT count(*)::int AS pendientes FROM public.backlog_tasks WHERE status = 'open'`
      const horasVentana = Math.max(1, Number(arg('--ventana') || 6))
      const [{ entregasVentana }] = await sql`
        SELECT count(*)::int AS "entregasVentana" FROM public.backlog_tasks
         WHERE review_requested_at > now() - (${horasVentana} || ' hours')::interval
           AND review_requested_by ~ '^(w|l)[0-9]'`
      const [{ cerradasVentana }] = await sql`
        SELECT count(*)::int AS "cerradasVentana" FROM public.backlog_tasks
         WHERE closed_at > now() - (${horasVentana} || ' hours')::interval`
      const trabajadores = MAQ.trabajadoresEsperados().length
      m.pendientes = pendientes
      m.trabajadores = trabajadores
      m.prevision = PROD.prevision({ pendientes, entregasVentana, cerradasVentana, horasVentana, trabajadores })
      console.log('')
      for (const l of PROD.formatear(m, { dias })) console.log(l)
      console.log('')
      console.log('   el tercer criterio del piloto (¿se erosionan los guardarraíles?):')
      console.log('     npm run sesiones:friccion')
      // ── LA SERIE DURADERA ────────────────────────────────────────────────────────
      // El bus recibe la señal para ALERTAR, pero no sirve como historia: se poda (medido, 10,8 M
      // de filas y solo 32 días). Así que la medida se guarda también en su propia tabla, con las
      // ENTRADAS del cálculo y no solo el veredicto — si mañana se recalibran los umbrales, la
      // historia se puede volver a juzgar con el criterio nuevo.
      const [prev] = await sql`
        SELECT * FROM public.flota_productividad_historico ORDER BY medido_at DESC LIMIT 1`
      await sql`
        INSERT INTO public.flota_productividad_historico
          (horas_ventana, dias_cerradas, pendientes, trabajadores, cerradas, cerradas_flota,
           entregas_ventana, entregas_en_cola, espera_mediana_h, entregas_por_hora,
           cerradas_por_hora, manda, horas_estimadas, veredicto, razon)
        VALUES (${horasVentana}, ${dias}, ${pendientes}, ${trabajadores},
                ${m.porOrigen.trabajador + m.porOrigen.persona}, ${m.produccionFlota.entregadasYaCerradas},
                ${entregasVentana}, ${m.entregas.pendientes}, ${m.entregas.esperaMedianaH},
                ${m.prevision.hay ? m.prevision.entregasPorHora : null},
                ${m.prevision.hay ? m.prevision.cerradasPorHora : null},
                ${m.prevision.hay ? m.prevision.manda : null},
                ${m.prevision.hay ? m.prevision.horas : null},
                ${m.veredicto.color}, ${m.veredicto.razon})`.catch((e) => {
        console.log(`   (no se pudo guardar en el histórico: ${String(e.message).slice(0, 70)})`)
      })

      // ¿Mejor o peor que la anterior? Es la pregunta que motivó la tabla.
      const cmp = PROD.comparar({
        entregasPorHora: m.prevision.hay ? m.prevision.entregasPorHora : null,
        cerradasPorHora: m.prevision.hay ? m.prevision.cerradasPorHora : null,
        pendientes, entregasEnCola: m.entregas.pendientes,
        esperaMedianaH: m.entregas.esperaMedianaH,
        horasEstimadas: m.prevision.hay ? m.prevision.horas : null,
      }, prev ? {
        entregasPorHora: prev.entregas_por_hora, cerradasPorHora: prev.cerradas_por_hora,
        pendientes: prev.pendientes, entregasEnCola: prev.entregas_en_cola,
        esperaMedianaH: prev.espera_mediana_h, horasEstimadas: prev.horas_estimadas,
      } : null)
      console.log('')
      console.log('¿MEJOR O PEOR QUE LA MEDIDA ANTERIOR?')
      console.log('-'.repeat(58))
      if (!cmp.hay) console.log(`  ${cmp.motivo}`)
      else {
        const ico = { mejora: '📈', empeora: '📉', igual: '➖' }
        for (const f of cmp.filas) {
          console.log(`  ${ico[f.veredicto]} ${f.metrica.padEnd(18)} ${f.de} → ${f.a}   (${f.cambio > 0 ? '+' : ''}${Math.round(f.cambio * 100)}%)`)
        }
        console.log(`  ${ico[cmp.resumen]} en conjunto: ${cmp.resumen.toUpperCase()}` +
          (prev ? `   (frente a la medida de ${new Date(prev.medido_at).toISOString().slice(5, 16).replace('T', ' ')})` : ''))
      }

      // Al bus, para ALERTAR (la historia vive en la tabla de arriba).
      await sql`
        INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
        VALUES ('fargate', ${m.veredicto.color === 'rojo' ? 'error' : m.veredicto.color === 'ambar' ? 'warn' : 'info'},
                'flota_productividad', 'flota', ${m.veredicto.razon},
                ${sql.json({ dias, ...m.porOrigen, entregas: m.entregas, tiempo: m.tiempo })})`.catch(() => {})
      return m.veredicto.color === 'rojo' ? 3 : 0
    }

    // ── RESCATAR: poner a salvo lo que un trabajador dejó sin empujar ─────────────────────
    // La puerta del clon rehúsa darle trabajo nuevo a quien tiene cambios sin commitear, y hace
    // bien: pueden ser la única copia. Pero eso deja al trabajador ENCALLADO hasta que alguien lo
    // mira — pasó cuatro veces el 05/08 y las cuatro lo resolví a mano con los mismos tres
    // comandos. Un bloqueo que siempre se resuelve igual es trabajo que debería hacer la máquina.
    //
    // ── POR QUÉ ESTO SÍ SE PUEDE AUTOMATIZAR, Y `reset --hard` NO ──────────────────────────
    // Rescatar es **puramente aditivo**: commit en su propia rama y push. No puede perder nada —
    // en el peor caso deja un commit de más, que se descarta leyéndolo. Lo que destruye es lo
    // contrario (descartar), y eso sigue siendo de una persona.
    //
    // `--no-verify` a propósito: un commit de rescate NO introduce trabajo, lo CONSERVA. Las
    // comprobaciones tienen que pasar cuando alguien lleve eso a `main`, no para impedir que se
    // guarde. Sin esto el rescate moriría en el mismo `pre-commit` que ya bloqueó al trabajador.
    if (cmd === 'rescatar') {
      const quienes = process.argv[3] ? [process.argv[3]] : MAQ.trabajadoresEsperados().map((x) => x.trabajador)
      let n = 0
      for (const w of quienes) {
        const m = MAQ.maquinaDe(w)
        if (!m) { console.log(`   ⏭️  ${w}: no está declarado`); continue }
        const como = m.local ? '' : 'sudo -u flota '
        const arbol = MAQ.arbolDe(w)
        // La orden vive en `lib/flota/rescate.cjs` y NO se copia aquí: `npm run sim:rescate-flota`
        // la EJECUTA contra repos git desechables (rescata lo sin commitear, el commit huérfano,
        // no pisa una rama ajena divergida…). Reconstruirla a mano en la simulación probaría una
        // copia, y dos escritores del mismo hecho divergen.
        const orden = RESC.ordenRescate({ arbol, trabajador: w })
        let salida = ''
        try { salida = enMaquina(w, `${como}bash -lc ${citar(orden)}`) }
        catch (e) { salida = String((e && e.stdout) || e.message || '') }
        if (/OCUPADO/.test(salida)) {
          // No es un fallo: es un trabajador commiteando. Se recoge en el siguiente pase.
          console.log(`   ⏳ ${w}: está commiteando ahora mismo — no se le toca`); continue
        }
        if (/NADA/.test(salida)) { console.log(`   ✅ ${w}: nada que salvar`); continue }
        let ok = /SALVADO=0/.test(salida)
        // ── SEGUNDA FASE: rematar desde el PORTÁTIL lo que la máquina no pudo empujar (T-628) ──
        // En el VPS el push del rescate falla SIEMPRE —los trabajadores no tienen credenciales de
        // git— así que hasta hoy el rescate identificaba el trabajo y lo dejaba donde estaba.
        // Medido el 06/08: 11 ramas atrapadas, una con un bug de producción, y 6 tareas que el
        // panel presentaba como «esperando tu decisión» cuando solo esperaban esto.
        // El portátil es el único sitio con las DOS mitades (SSH a la máquina + credenciales del
        // repo). Se trae las refs por SSH y las empuja CON EL NOMBRE QUE YA CALCULÓ EL RESCATE:
        // recalcularlo aquí sería un segundo generador del mismo nombre, y divergen (T-130).
        const parsed = RESC.parsearRescate(salida)
        const segunda = RESC.necesitaSegundaFase(MAQ.maquinaDe(w), parsed)
        if (segunda.hace_falta) {
          console.log(`   🚚 ${w}: la máquina no pudo empujar (${segunda.motivo}) — se remata desde aquí`)
          const m2 = MAQ.maquinaDe(w)
          const remoto = `ssh://${m2.usuario}@${m2.host}${String(arbol).replace(/^~flota/, '/home/flota')}`
          const refspecs = parsed.pares.map((p) => `${p.origen}:refs/heads/${p.destino}`)
          try {
            // Se traen a un espacio propio y se empujan. `--no-verify` NO: el push-guard tiene
            // que poder opinar, y su escape se declara con motivo (queda contado en la fricción).
            const aqui = (orden) => execFileSync('bash', ['-c', orden], { cwd: REPO, encoding: 'utf8', timeout: 300000 })
            aqui(`git fetch ${citar(remoto)} ${parsed.pares.map((p) => citar(`${p.origen}:refs/remotes/rescate-vps/${p.destino}`)).join(' ')}`)
            const motivo = `rescate de ${w} (T-628): trabajo commiteado en una máquina sin credenciales de git; va a rescate/*, no a main`
            aqui(`BACKLOG_GUARD_SKIP=${citar(motivo)} git push origin ${refspecs.map((r) => citar(r)).join(' ')}`)
            ok = true
            console.log(`   ✅ ${w}: ${parsed.pares.length} rama(s) empujada(s) desde el portátil`)
          } catch (e) {
            console.log(`   ❌ ${w}: la segunda fase falló — ${String((e && e.message) || e).slice(0, 120)}`)
          }
        }
        // Un trabajador puede tener trabajo atrapado en VARIAS ramas a la vez (una por tarea
        // entregada), así que se listan todas: quedarse con la primera escondía las demás.
        const ramas = [...salida.matchAll(/^RAMA=(.+)$/gm)].map((m) => m[1].trim())
        const rama = ramas[0] || '(?)'
        console.log(ok
          ? `   💾 ${w}: ${ramas.length} rama(s) puesta(s) a salvo`
          : `   ❌ ${w}: NO se pudo poner a salvo — míralo tú (tmux -L ${w} attach -t ${w}) · ${salida.trim().slice(-120)}`)
        for (const r of ramas) console.log(`        → ${r}`)
        emitirTurno(w, ok ? 'rescatado' : 'rescate_fallido', { rama, ramas, motivo: ok ? null : 'no se pudo empujar lo que dejó sin salvar' })
        if (ok) n++
      }
      console.log(`\n${n} trabajador(es) rescatado(s).`)
      return 0
    }

    // ── VIGILAR: la flota se mantiene ocupada SOLA ────────────────────────────────────────
    // Hasta aquí el supervisor sabía repartir… pero solo cuando alguien se lo pedía. Y como el
    // turno de un `claude -p` muere al terminar, la consecuencia real era que **la flota se paraba
    // entera y nadie se enteraba hasta la siguiente vez que Manuel preguntaba** — medido el 05/08
    // más de una vez, con ocho trabajadores en pie y seis sin hacer nada.
    //
    // Un panel que hay que mirar no es vigilancia: es un panel. Esto es el bucle que faltaba.
    //
    // Lo que hace en cada vuelta, y NADA más:
    //   · a quien esté libre y vivo, le da trabajo (por el mismo `mandarEncargo`, con sus puertas)
    //   · a quien tenga tarea cogida y NINGÚN proceso, le relanza el turno con SU tarea
    // No responde preguntas, no aprueba borradores y no toca a las sesiones de Manuel: eso es de
    // una persona, y automatizarlo sería justo lo que este sistema no quiere.
    // ── ⚠️ DOS PROGRAMADORES PARA UNA SOLA FLOTA — colapsado el 06/08 (T-617) ──────────────
    // Este bucle (`vigilar`, 05/08 16:22) y `bucle` (06/08 11:35) hacían lo MISMO con criterios
    // PROPIOS: los dos decidían a quién dar trabajo y cuál, cada uno con su copia de la regla de
    // reparto por capacidad. Es el olor de los cinco escritores de `seguimiento_url` [T-130]…
    // dentro del propio supervisor, que es donde más caro sale: dos repartidores con criterios
    // distintos entregan cosas distintas según quién corra, y entonces «la flota hace lo que toca»
    // deja de ser una frase comprobable.
    //
    // Y encima el bueno era INVISIBLE: la línea de ayuda ofrecía `vigilar` y no mencionaba
    // `bucle` por ningún sitio, así que quien no leyera el código no podía saber que existía.
    //
    // Gana `bucle` porque NO reimplementa la criba: lanza `flota.cjs repartir` como hijo (un solo
    // criterio, el de `repartir`), aísla los fallos de una pasada y detecta turnos atascados.
    // `vigilar` se queda como ALIAS —no se borra el nombre— para que nadie se encuentre con que
    // su comando de siempre ya no existe.
    if (cmd === 'vigilar') {
      console.log('ℹ️  `vigilar` es ahora `bucle`: un solo programador (T-617). Sigue el mismo comando.')
      cmd = 'bucle'
    }


    // ── REPARTIR: dar trabajo a TODOS los que estén libres, de una vez ────────────────────
    // Es lo que cierra el bucle. Sin esto, «hablo solo con el supervisor» seguía significando
    // «pídele trabajo a w1, luego a w2, luego a l1»: el supervisor sabía quién estaba libre y aun
    // así había que decírselo uno a uno.
    //
    // NO reparte a las sesiones de Manuel, ni con --todos: a una terminal de una persona no se le
    // manda un encargo. Y no reparte a quien ya tiene tarea — el claim manda, no esta lista.
    if (cmd === 'repartir') {
      // ── LO REPARTIDO HACE POCO, SEGÚN LA BD ─────────────────────────────────────────────
      // El `Set` de repartidas vive en RAM y muere con el proceso, así que dos invocaciones
      // seguidas de `repartir` daban la MISMA tarea a dos trabajadores — pasó dos veces el 06/08
      // (T-038 a w3 y w4; T-533 a w2 y w3). La memoria tiene que estar donde sobreviva, y ya
      // existe: cada encargo emite un `flota_turno` con su tarea. Se lee de ahí.
      //
      // ⚠️ VIVE DENTRO DE `repartir`, y hubo que devolverlo aquí (T-617, 06/08). Un merge lo dejó
      // en el cuerpo principal del `try`, FUERA de todo `if (cmd === …)`: seguía funcionando para
      // el reparto —quedaba en ámbito— pero lanzaba su consulta en CADA invocación de `flota.cjs`
      // (`estado`, `lanzar`, `parar`…) y dejaba huérfano el comentario del comando de al lado. Es
      // sintácticamente válido, así que `node --check` y los tests pasaban: una cicatriz de merge
      // solo se ve leyendo.
      //
      // ── Y FALLA ABIERTO, COMO TODA LA TELEMETRÍA (§9) ───────────────────────────────────
      // Los EMISORES del bus ya llevaban su `.catch(() => {})`; esta LECTURA no, y eso tumbaba el
      // reparto entero. Medido al estrenar el supervisor como servicio (T-617): el rol
      // `vence_coordinacion` no tenía permiso sobre `observable_events`, así que cada pasada moría
      // con «permission denied» y la flota seguía parada — con el supervisor corriendo. Una avería
      // de la telemetría no puede impedir GOBERNAR la flota; como mucho, repetir una tarea.
      let repartidasHacePoco = new Set()
      try {
        repartidasHacePoco = new Set((await sql`
          SELECT metadata->>'tarea' AS tarea
            FROM public.observable_events
           WHERE event_type = 'flota_turno'
             AND created_at > now() - interval '25 minutes'
             AND metadata->>'fase' = 'encargado'
             AND metadata->>'tarea' IS NOT NULL`).map((r) => r.tarea))
      } catch (e) {
        console.log(`   ⚠️  sin memoria de lo repartido (${String(e.message || e).slice(0, 60)}): se reparte igual, `
          + 'con riesgo de repetir una tarea.')
      }
      if (repartidasHacePoco.size) {
        console.log(`   (${repartidasHacePoco.size} tarea(s) repartida(s) hace <25 min: no se repiten)`)
      }
      const sesiones = await sql`
        SELECT sid, slug, last_signal_at FROM public.worktree_sessions WHERE rol = 'trabajador'`
      const ocupadas = await sql`
        SELECT claimed_by FROM public.backlog_tasks WHERE status = 'in_progress' AND claimed_by IS NOT NULL`
      const conTarea = new Set(ocupadas.map((t) => t.claimed_by))
      // «Vivo» aquí es «hay sesión a la que mandarle algo», no «ha latido hace poco»: un
      // trabajador entre tareas no late y seguiría siendo un destinatario perfectamente válido.
      // …y que además RECIBAN reparto: el portátil está fuera (`reparte: false`), porque es donde
      // Manuel abre sus consolas y seis autónomos se lo dejaban parado.
      const reciben = new Set(MAQ.trabajadoresQueReciben().map((x) => x.trabajador))
      const delReparto = MAQ.comparar(sesiones).filter((f) => reciben.has(f.trabajador))

      // ── UN TRABAJADOR SIN SESIÓN SE LEVANTA; NO SE SALTA EN SILENCIO (T-642, 07/08) ──────
      // El filtro de abajo descartaba a quien no tuviera sesión de tmux **sin decir nada**, y
      // entonces la vuelta terminaba imprimiendo «todo en marcha, nada que repartir». Medido ese
      // día: `w2` y `w4` desaparecieron del mapa y estuvieron una hora sin trabajar con el
      // supervisor cantando normalidad cada cinco minutos. Un trabajador que se cae es justo lo
      // que este bucle existe para arreglar, así que el estado «no tiene sesión» tiene ACCIÓN.
      //
      // Se resucita solo cuando la máquina dice que NO la tiene (`false`). Si no se pudo
      // preguntar (`null`, típicamente un ssh caído) NO se toca nada: recrear una sesión sana
      // por un hipo de red mataría el turno que estuviera corriendo dentro.
      const sello = new Date().toISOString().slice(11, 19)
      for (const f of delReparto) {
        const viva = sesionViva(f.trabajador)
        // Solo se pregunta por el panel si HAY sesión: preguntarlo siempre gastaba un ssh por
        // trabajador y por vuelta para nada, y pasarlo vacío hacía que los cuatro salieran
        // «invisible» — ruido que yo mismo metí al estrenar esto y que se vio en la primera
        // pasada. Un aviso que sale siempre no avisa de nada.
        const p = ENC.presenciaDelPanel({
          sesionExiste: viva,
          paneCommand: viva === true ? comandoDelPanel(f.trabajador) : '',
          reparte: true,
          // Solo hace falta cuando NO hay sesión: es ahí donde vive el turno huérfano que la
          // reanimación duplicaría. Con sesión, el panel ya responde y sobra el pgrep.
          turnosVivos: viva === false ? turnosVivosDe(f.trabajador) : 0,
        })
        if (p.accion !== 'resucitar') {
          // Solo se canta la ceguera sobre la SESIÓN (no se pudo ni preguntar si existe). Que el
          // panel no se deje leer teniendo sesión ya lo dicen las puertas de `mandarEncargo`.
          if (viva === null) console.log(`   [${sello}] 👁️  ${f.trabajador}: ${p.motivo}`)
          continue
        }
        const m = MAQ.maquinaDe(f.trabajador)
        try {
          enMaquina(f.trabajador, ENC.ordenDeArranque({ trabajador: f.trabajador, systemd: !!(m && m.systemd) }))
          const ok = sesionViva(f.trabajador) === true
          console.log(`   [${sello}] ${ok ? '🫀' : '❌'} ${f.trabajador}: sin sesión → ${ok ? 'resucitado' : 'NO levanta, requiere una persona'}`)
        } catch (e) {
          // El PORQUÉ importa más que el fallo: si lo que falta es el permiso, la orden fallará
          // igual para los cuatro y para siempre, así que decirlo aquí ahorra buscarlo (T-663).
          const v = ENC.permisoDeResurreccion(e.message)
          console.log(`   [${sello}] ❌ ${f.trabajador}: sin sesión y no se pudo resucitar (${String(e.message).slice(0, 60)})`)
          if (!v.puede) console.log(`   [${sello}] 🔑 ${v.motivo}`)
        }
      }

      const vivos = delReparto
        .filter((f) => f.estado === 'vivo' || sesionViva(f.trabajador) === true)
      // ⚠️ NO es `new Map(sesiones.map(...))` (T-667). Un trabajador acumula una fila por cada
      // identidad que ha tenido, la consulta no lleva `ORDER BY`, y ese Map se queda con la última
      // que llegue: medido en el VPS, `w1` y `w2` tenían DOS filas y ganaba la del 05/08. Con el
      // sid equivocado, `conTarea.has(sid)` da false para quien SÍ tiene tarea cogida → se le
      // cuenta libre, no se le reconoce el turno muerto y no se le devuelve SU tarea. El criterio
      // —la señal de vida manda sobre la antigüedad— vive en `maquinas.cjs`, que es quien ya lo
      // usa para decidir vivo/callado: dos resoluciones distintas del mismo sid es como se llega a
      // que el panel diga una cosa y el reparto haga otra.
      const porSlug = new Map([...MAQ.sesionVigente(sesiones)].map(([slug, s]) => [slug, s.sid]))
      const libres = vivos.filter((f) => !conTarea.has(porSlug.get(f.trabajador)))

      // ── UN TURNO QUE MURIÓ CON LA TAREA COGIDA SE RETOMA CON **SU** TAREA (T-617) ────────
      // Es el fallo que más caro sale: la tarea queda bloqueada para todos —el claim la protege—
      // y nadie avanza, así que el sistema entero se para por un trabajador. Vivía SOLO en el
      // programador viejo (`vigilar`), y al colapsar los dos en uno se habría perdido en silencio;
      // lo cazaron sus propios tests de paridad, que es justo para lo que estaban.
      //
      // Va aquí, en `repartir`, y no en `bucle`: `bucle` no reimplementa nada, delega. Así el
      // comportamiento es el MISMO se llegue por el programador continuo o por un `repartir` a
      // mano — que es la razón de haber colapsado los dos.
      //
      // Se le devuelve SU tarea, nunca otra: empezar algo nuevo encima de un trabajo a medias es
      // exactamente como se pierde ese trabajo [T-577].
      const conTareaYSinProceso = []
      for (const f of vivos) {
        const sid = porSlug.get(f.trabajador)
        if (!conTarea.has(sid)) continue
        if (ENC.puedeRecibir(comandoDelPanel(f.trabajador)).libre === false) continue  // está trabajando
        const suya = ocupadas.length
          ? (await sql`
              SELECT id, title FROM public.backlog_tasks
               WHERE status = 'in_progress' AND claimed_by = ${sid} LIMIT 1`)[0]
          : null
        if (suya) conTareaYSinProceso.push({ trabajador: f.trabajador, suya })
      }
      let retomadas = 0
      let sinCuota = 0
      for (const { trabajador, suya } of conTareaYSinProceso) {
        try {
          // ── ¿MERECE LA PENA RELANZAR? (T-617, 07/08) ────────────────────────────────────
          // Un turno que murió porque se acabó la cuota va a morir EXACTAMENTE IGUAL la próxima
          // vez: el proceso ni siquiera llega a intentar el trabajo. Relanzarlo a ciegas no es
          // optimismo, es gasolina al fuego. Medido en vivo: T-548 (w1) se retomó **27 veces en
          // 3h** contra el mismo "You've hit your weekly limit", una cada ~6 min (la cadencia del
          // propio bucle), sin que ninguna avanzase nada — el turno anterior fallaba en el mismo
          // instante en que arrancaba. Se comprueba leyendo lo que el turno ANTERIOR escribió en
          // su log, SIN gastar cuota en volver a preguntarlo, que es justo lo que no queda.
          const salidaPrevia = logDelTurno(trabajador)
          const auth = AUT.clasificar(salidaPrevia)
          // El «muerto» se emite SIEMPRE, se relance o no: es un hecho del turno anterior, no una
          // promesa sobre el siguiente. Antes solo se emitía dentro del `turno` de un retomar que
          // saliera bien, así que un turno sin cuota (que aquí NO se retoma) habría dejado de
          // contar para `saludFlota` — justo la serie que hace falta para ver "algo los está
          // matando en serie (cuota…)" en el panel.
          emitirTurno(trabajador, 'muerto', { tarea: suya.id, motivo: 'turno terminado con la tarea cogida y sin proceso' })
          if (auth.estado === 'cuota_agotada') {
            emitirTurno(trabajador, 'sin_cuota', { tarea: suya.id, motivo: auth.detalle })
            console.log(`   ⏸️  ${trabajador}: ${auth.detalle} — no se relanza ${suya.id} hasta que se reponga`)
            sinCuota++
            continue
          }
          const alDia = ponerAlDia(trabajador, { emitir: (v) => { emitirClon(trabajador, v) }, reanuda: true })
          const r = mandarEncargo(trabajador,
            ENC.encargo({ trabajador, tarea: suya, puedeDesplegar: MAQ.puedeDesplegar(trabajador).puede }),
            { alDia, turno: () => {
              emitirTurno(trabajador, 'encargado', { tarea: suya.id, tipo: 'retoma' })
            } })
          if (r.ok) { console.log(`   ↻ ${trabajador} retoma ${suya.id}`); retomadas++ }
          else console.log(`   ⏭️  ${trabajador}: ${motivoFallo(r)}`)
        } catch (e) {
          console.log(`   ❌ ${trabajador}: ${String(e.message || e).slice(0, 70)}`)
        }
      }

      if (!libres.length) {
        const sufijoCuota = sinCuota ? ` · ${sinCuota} sin cuota (no relanzado(s))` : ''
        console.log((retomadas || sinCuota)
          ? `✅ ${retomadas} turno(s) retomado(s)${sufijoCuota}; nadie libre a quien dar tarea nueva.`
          : `✅ nada que repartir: ${vivos.length} trabajador(es) vivo(s), todos con tarea.`)
        // ⚠️ ESTA SALIDA TEMPRANA ERA EL AGUJERO (T-693): se iba sin decir cuántos hay ocupados, y
        // el bucle —que lo raspaba del texto— leía 0 y espaciaba hasta 60 min con los CUATRO
        // trabajando. El dato se emite ahora en TODOS los finales, no solo en el de abajo.
        console.log(BUC.lineaPasada({ repartidos: retomadas, ocupados: vivos.length }))
        return 0
      }
      const candidatas = await sql`
        SELECT id, title FROM public.backlog_tasks
         WHERE status = 'open' AND claimed_by IS NULL
           AND (snooze_until IS NULL OR snooze_until <= now())
           AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL
         ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, id
         LIMIT 120`
      const dadas = new Set()
      let n = 0
      for (const f of libres) {
        // Cada uno se lleva una DISTINTA: repartir la misma a dos es exactamente la colisión que
        // el claim evita, pero mandarles a los dos a por ella desperdicia una vuelta entera.
        // Mismo criterio que el vigía: quien puede cerrar el ciclo entero se lleva el backlog;
        // quien no, impugnaciones (análisis puro, sin deploy). Si esto no fuera igual en los dos
        // sitios, el reparto dependería de por dónde entrases — que es como una de las dos puertas
        // se queda sin lo que se añade a la otra ([T-130]).
        if (ENC.flotaCogeImpugnaciones() && !MAQ.puedeDesplegar(f.trabajador).puede) {
          try {
            const alDia = ponerAlDia(f.trabajador, { emitir: (v) => { emitirClon(f.trabajador, v) } })
            const r = mandarEncargo(f.trabajador,
              ENC.encargoImpugnacion({ trabajador: f.trabajador, puedeDesplegar: false }),
              { alDia, turno: () => emitirTurno(f.trabajador, 'encargado', { tipo: 'impugnacion' }) })
            if (r.ok) { console.log(`   ✅ ${f.trabajador.padEnd(4)} → una impugnación (no despliega: ${MAQ.puedeDesplegar(f.trabajador).porQueNo})`); n++ }
            else console.log(`   ⏭️  ${f.trabajador}: ${motivoFallo(r)}`)
          } catch (e) { console.log(`   ❌ ${f.trabajador}: ${String(e.message).slice(0, 60)}`) }
          continue
        }
        // ── PRIMERO REVISAR, LUEGO HACER (T-486, 06/08) ──────────────────────────────────
        // Las revisiones van ANTES que las tareas nuevas porque son el escalón que se atasca: dar
        // otra tarea a quien podría desatascar una entrega hace crecer la cola por los dos lados.
        // Nunca la SUYA (no se revisa lo propio) ni una ya revisada.
        const porRevisar = (await sql`
          SELECT id, title, review_note, review_requested_by
            FROM public.backlog_tasks
           WHERE review_requested_at IS NOT NULL AND reviewed_at IS NULL
             AND review_requested_by IS DISTINCT FROM ${porSlug.get(f.trabajador) || ''}
           ORDER BY review_requested_at
           LIMIT 8`).filter((t) => !dadas.has(t.id) && !repartidasHacePoco.has(t.id))[0]
        if (porRevisar) {
          dadas.add(porRevisar.id)
          try {
            const alDia = ponerAlDia(f.trabajador, { emitir: (v) => { emitirClon(f.trabajador, v) } })
            const r = mandarEncargo(f.trabajador,
              ENC.encargoRevision({ trabajador: f.trabajador, tarea: porRevisar,
                entrega: porRevisar.review_note, autor: porRevisar.review_requested_by }),
              { alDia, turno: () => emitirTurno(f.trabajador, 'encargado', { tarea: porRevisar.id, tipo: 'revision' }) })
            if (r.ok) { console.log(`   🔍 ${f.trabajador.padEnd(4)} → REVISAR ${porRevisar.id}`); n++; continue }
            dadas.delete(porRevisar.id)
          } catch (e) { dadas.delete(porRevisar.id); console.log(`   ❌ ${f.trabajador}: ${String(e.message).slice(0, 60)}`) }
        }
        const { tarea } = ENC.elegir(candidatas.filter((t) => !dadas.has(t.id) && !repartidasHacePoco.has(t.id)), { puedeDesplegar: true })
        if (!tarea) { console.log(`   ⏭️  ${f.trabajador}: no queda ninguna tarea apta libre`); continue }
        try {
          const alDia = ponerAlDia(f.trabajador, { emitir: (v) => { emitirClon(f.trabajador, v) } })
          const r = mandarEncargo(f.trabajador, ENC.encargo({ trabajador: f.trabajador, tarea, puedeDesplegar: MAQ.puedeDesplegar(f.trabajador).puede }),
            { alDia, turno: () => emitirTurno(f.trabajador, 'encargado', { tarea: tarea.id, tipo: 'backlog' }) })
          // Si no se le pudo mandar, la tarea NO se marca como dada: se la lleva el siguiente en
          // vez de quedarse sin repartir por un problema que no es suyo.
          // Si no se le pudo mandar, la tarea NO se marca como dada: se la lleva el siguiente en
          // vez de quedarse sin repartir por un problema que no es suyo.
          if (!r.ok) {
            console.log(`   ⏭️  ${f.trabajador}: ${motivoFallo(r)}`)
            continue
          }
          dadas.add(tarea.id)
          console.log(`   ✅ ${f.trabajador.padEnd(4)} → ${tarea.id}  ${String(tarea.title).slice(0, 54)}`)
          n++
        } catch (e) {
          console.log(`   ❌ ${f.trabajador}: no se le pudo mandar (${String(e.message).slice(0, 60)})`)
        }
      }
      // ── LO QUE LA FLOTA NUNCA VA A COGER ────────────────────────────────────────────────
      // La criba de `esApta` es un filtro de TEXTO y siempre tendrá falsos: [T-585] —corpus
      // documental, trabajo de contenido puro— llevaba rondas saltándose sola porque su ficha dice
      // «factura 1.691 €/90d» para justificar su prioridad, y en este repo casi toda tarea valiosa
      // se justifica así.
      //
      // Lo que hacía daño no era el falso positivo: era que **nadie podía saberlo**. Una tarea que
      // el reparto salta en cada vuelta no aparece en ningún sitio — ni como error, ni como aviso.
      // Se queda abierta para siempre y parece que nadie la ha cogido por casualidad.
      const abiertas = await sql`
        SELECT id, title FROM public.backlog_tasks
         WHERE status = 'open' AND claimed_by IS NULL
           AND (snooze_until IS NULL OR snooze_until <= now())
           AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL`
      const porMotivo = new Map()
      for (const t of abiertas) {
        const v = ENC.esApta(t, { puedeDesplegar: true })
        if (v.apta) continue
        if (!porMotivo.has(v.motivo)) porMotivo.set(v.motivo, [])
        porMotivo.get(v.motivo).push(t.id)
      }
      if (porMotivo.size) {
        const total = [...porMotivo.values()].reduce((a, b) => a + b.length, 0)
        console.log(`\n🚫 ${total} tarea(s) libres que la flota NUNCA cogerá sola:`)
        for (const [motivo, ids] of [...porMotivo].sort((a, b) => b[1].length - a[1].length)) {
          console.log(`   ${String(ids.length).padStart(3)} · ${motivo}`)
          console.log(`        ${ids.slice(0, 6).join(' ')}${ids.length > 6 ? ` …y ${ids.length - 6} más` : ''}`)
        }
        console.log('   Si alguna NO debería estar aquí, es un falso positivo de la criba:')
        console.log('   se le puede mandar igual con  npm run flota -- encargar <w> --tarea <id>')
      }

      // ── POR QUÉ SE PUBLICA CUÁNTOS ESTÁN OCUPADOS (T-642, 07/08) ────────────────────────
      // El bucle solo leía «N encargos repartidos», y con eso **cero significaba dos cosas
      // opuestas**: la flota llena (todos trabajando, hay que volver PRONTO porque un turno
      // acaba cuando quiere) o nada que repartir (ahí sí conviene espaciar). Al confundirlas,
      // la espera crecía justo cuando más ocupada estaba la flota — medido el 07/08: 5 → 8 →
      // 11 → 17 → 25 min con los tres trabajando, así que al morir sus turnos tardaban hasta
      // media hora en volver. Cuanto mejor iba todo, más tarde se enteraba de que dejó de ir.
      const ocupados = vivos.length - libres.length
      console.log(`\n${n} encargo(s) repartido(s) · ${ocupados} ocupado(s). Míralo con: npm run flota`)
      console.log(BUC.lineaPasada({ repartidos: n, ocupados }))
      return 0
    }

    // ── EL SUPERVISOR CONTINUO (T-486, 06/08) ────────────────────────────────────────────
    // Pregunta de Manuel: «¿por qué el supervisor no les da tareas continuamente? así no es
    // productivo». No existía programador ninguno: `repartir` se corría a mano, así que la flota
    // trabajaba solo mientras alguien la mirase. Esto es la otra mitad del arreglo — la primera
    // es que el encargo ahora manda ENCADENAR dentro del turno; esto arranca uno nuevo cuando
    // un trabajador termina de verdad.
    //
    // NO reimplementa el reparto: LANZA `flota.cjs repartir` como hijo. Una segunda copia de la
    // criba acabaría entregando cosas distintas según quién repartiera, que es exactamente el
    // fallo de los cinco escritores de `seguimiento_url` [T-130]. Y de regalo, aísla: si una
    // pasada revienta, el bucle sigue vivo.
    if (cmd === 'bucle') {
      const cada = Math.max(60, Number(arg('--cada') || BUC.CADA_S))
      const limiteAtasco = Math.max(10, Number(arg('--atascado') || BUC.ATASCADO_MIN))
      let pausa = cada
      let parar = false
      // Salida limpia: systemd manda SIGTERM al reiniciar, y matar el bucle en mitad de una
      // pasada dejaría un `repartir` huérfano lanzando encargos que nadie va a vigilar.
      // ── Y LA SEÑAL TIENE QUE PODER DESPERTARLO, NO SOLO MARCARLO (T-617) ────────────────
      // Poner `parar = true` no basta: el bucle pasa casi todo su tiempo DORMIDO (hasta 8-15 min
      // entre pasadas), así que la bandera no se mira hasta que se cumple la espera. Medido al
      // instalarlo como servicio: `systemctl restart` esperó los 120 s de `TimeoutStopSec` y
      // acabó mandando SIGKILL — que es justo lo que la salida limpia existía para evitar, porque
      // matar a media pasada deja un `repartir` huérfano repartiendo encargos que ya no vigila
      // nadie. La espera se guarda para poder cancelarla desde el manejador.
      let despertar = null
      for (const sig of ['SIGTERM', 'SIGINT']) {
        process.on(sig, () => { parar = true; if (despertar) despertar() })
      }
      /** Duerme `s` segundos, o menos si llega una señal. */
      const dormir = (s) => new Promise((resolve) => {
        const t = setTimeout(resolve, s * 1000)
        despertar = () => { clearTimeout(t); resolve() }
      })

      // ── UN SOLO SUPERVISOR (T-642, 07/08) ────────────────────────────────────────────────
      // Dos procesos del bucle sobre los mismos trabajadores reparten cosas distintas según
      // quién llegue antes, y no dan error: el síntoma es trabajo repetido que parece normal.
      // Pasó ese día —el servicio del VPS llevaba horas corriendo mientras se lanzaba otro desde
      // el portátil— y nada lo dijo. Se mira el RASTRO de las pasadas, que es común a todas las
      // máquinas; un `flock` habría sido local y no habría visto al de la otra.
      const yo = process.env.VENCE_FLOTA_AQUI || os.hostname()
      if (!process.argv.includes('--igualmente')) {
        let ultima = null
        try {
          // ⚠️ LA ÚLTIMA PASADA **DE OTRO**, no la última a secas. Con dos supervisores
          // alternándose, cada uno vería la SUYA como la más reciente y ninguno bloquearía —
          // medido al estrenar esto: el guard dejó arrancar un segundo bucle teniendo el
          // primero vivo. El filtro va en el WHERE, no después.
          const f = await sql`
            SELECT ts, metadata FROM public.observable_events
             WHERE event_type = 'flota_bucle_pasada'
               AND metadata->>'host' IS DISTINCT FROM ${yo}
             ORDER BY ts DESC LIMIT 1`
          if (f[0]) ultima = { host: f[0].metadata?.host, ts: f[0].ts, pausaS: f[0].metadata?.pausaS, parado: f[0].metadata?.parado }
        } catch { /* sin rastro no se puede juzgar: se sigue, como el resto del andamiaje */ }
        const otro = BUC.otroSupervisorVivo({ ultima, yo })
        if (otro.hay) {
          console.error(`\n⛔ NO ARRANCO — ${otro.motivo}.`)
          console.error('   Dos supervisores reparten cosas distintas sobre los mismos trabajadores')
          console.error('   y no da error: se ve como trabajo repetido que parece normal.')
          console.error('   Párale allí, o arranca este igualmente si sabes lo que haces:')
          console.error('     node scripts/flota/flota.cjs bucle --igualmente')
          return 1
        }
      }
      console.log(`🔁 supervisor continuo (${yo}) — pasada cada ${Math.round(cada / 60)} min · atasco a los ${limiteAtasco} min`)
      // Una máquina se mide UNA vez por pasada aunque aloje a cuatro trabajadores: lo que se
      // mide es el host, y sondearlo cuatro veces solo añade cuatro conexiones ssh.
      const medidas = new Map()
      while (!parar) {
        let repartidos = 0
        let ocupados = 0
        let motivoSalto = null
        let atascados = []

        // ── LA SALUD DE LA MÁQUINA SE MIDE AQUÍ, NO SOLO EN EL PANEL ([T-677]) ──────────────
        // La primera versión solo medía al pintar el panel, o sea **solo cuando una persona
        // ejecutaba `npm run flota` a mano**. Eso no es una alerta proactiva: es una alerta que
        // depende de que alguien pase por delante. Se vio al verificar el despliegue — el
        // servicio llevaba horas corriendo con la sonda dentro y había UN solo evento.
        // Aquí corre cada pasada (5 min por defecto), que es lo que da a las reglas material
        // periódico con el que disparar.
        for (const w of MAQ.trabajadoresQueReciben()) {
          const m = MAQ.maquinaDe(w)
          if (!m || medidas.has(m.nombre)) continue
          medidas.set(m.nombre, true) // una sola máquina por pasada, aunque tenga 4 trabajadores
          const medida = medirMaquina(w)
          if (!medida) continue
          const v = SALUD.clasificarMaquina(medida)
          if (v.estado === 'ok') continue
          console.log(`  ${v.estado === 'ahogada' ? '🔴' : '🟠'} MÁQUINA ${m.nombre}: ${v.motivos[0]}`)
          try {
            await sql`
              INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
              VALUES ('fargate', ${v.estado === 'ahogada' ? 'error' : 'warn'}, 'flota_maquina_salud', 'flota',
                      ${`máquina ${m.nombre} ${v.estado}: ${v.motivos[0] ?? ''}`},
                      ${sql.json({ maquina: m.nombre, estado: v.estado, motivos: v.motivos, ...v.señales, medida })})`
          } catch { /* la telemetría nunca puede parar al supervisor */ }
        }
        medidas.clear()

        try {
          const puede = BUC.puedeRepartir({
            hayBd: Boolean(url()),
            hayTrabajadores: MAQ.trabajadoresQueReciben().length > 0,
          })
          if (!puede.ok) {
            motivoSalto = puede.motivo
          } else {
            // Turnos abiertos demasiado tiempo. Se AVISA, no se mata: matar un turno puede tirar
            // trabajo sin commitear, y eso ya tiene ficha propia [T-577]. Caso que lo calibra:
            // el 06/08 un `git commit` de w1 llevaba 2 h con un worker de jest al 99,8% de CPU.
            const turnos = MAQ.trabajadoresQueReciben().map(({ trabajador }) => {
              try {
                const t = enMaquina(trabajador, `stat -c %Y ${ficheroEncargo(trabajador)} 2>/dev/null || true`).trim()
                return { trabajador, inicio: t ? new Date(Number(t) * 1000) : null }
              } catch { return { trabajador, inicio: null } }
            })
            atascados = BUC.turnosAtascados(turnos, { limiteMin: limiteAtasco })
            const r = execFileSync(process.execPath, [__filename, 'repartir'], { encoding: 'utf8', timeout: 600_000 })
            process.stdout.write(r)
            // El dato del ritmo YA NO se raspa de la prosa (T-693): `repartir` emite una última
            // línea marcada en todos sus finales y `leerPasada` la lee, con caída al texto viejo
            // mientras los clones se ponen al día. Antes se leía con dos regex y la frase de
            // «nada que repartir» no contenía la palabra «ocupado», así que el bucle creía que
            // nadie trabajaba y espaciaba hasta una hora con los cuatro ocupados.
            const p = BUC.leerPasada(r)
            repartidos = p.repartidos
            ocupados = p.ocupados
            if (p.fuente !== 'marca') {
              console.log(`   ⚠️ el dato de la pasada vino por «${p.fuente}», no por la marca — ¿clon sin actualizar?`)
            }
          }
        } catch (e) {
          // Una pasada que falla NO para el bucle: la flota se quedaría parada por un SSH caído.
          motivoSalto = `la pasada falló: ${String(e.message || e).slice(0, 120)}`
        }
        // ── LOS OOM DEJAN DE SER INVISIBLES (T-647) ────────────────────────────────────────
        // Se encontraron por casualidad, mirando por qué el supervisor había cambiado de PID.
        // Ahora cada pasada mira el registro del núcleo desde la anterior y lo publica como
        // cualquier otra señal, para que salga en el panel de salud y no en la terminal de quien
        // pase por allí. Solo cuenta cuando hay muertes: una señal que se emite siempre no avisa.
        try {
          const desde = Math.max(2, Math.round(pausa / 60) + 1)
          const txt = execFileSync('bash', ['-c',
            `journalctl --no-pager --since '-${desde}min' 2>/dev/null | grep 'Killed process' || true`],
          { encoding: 'utf8', timeout: 30_000 })
          const oom = BUC.muertesPorMemoria(txt)
          if (oom.muertes > 0) {
            console.log(`   💀 ${oom.muertes} proceso(s) muertos por falta de memoria: ${JSON.stringify(oom.victimas)}`)
            await sql`
              INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
              VALUES ('fargate', 'error', 'flota_sin_memoria', 'flota',
                      ${`${oom.muertes} proceso(s) matados por el kernel en los últimos ${desde} min`},
                      ${sql.json({ host: yo, ...oom })})`
          }
        } catch { /* la telemetría nunca puede parar al supervisor */ }
        pausa = BUC.siguientePausa({ repartidos, ocupados, cada, anterior: pausa, fallo: !!motivoSalto })
        console.log(BUC.resumenPasada({ repartidos, atascados, motivoSalto, pausaS: pausa }))
        // Rastro en la BD: un bucle que no deja huella es indistinguible de uno muerto, y el
        // síntoma de un supervisor muerto es justamente que NO PASA NADA.
        // ⚠️ ESTE INSERT ESCRIBÍA EN UNA COLUMNA QUE NO EXISTE, y por eso el rastro nunca existió
        // ([T-626], medido el 06/08/2026: **0 eventos `flota_bucle_pasada` en toda la historia**).
        // `observable_events` tiene `metadata`, no `event_data`; los otros CUATRO inserts de este
        // mismo fichero ya usaban la forma correcta y solo éste se escribió distinto. Como el
        // `catch` está —y debe estar— vacío, cada pasada fallaba en silencio: el fail-open de la
        // telemetría acabó ocultando que la telemetría misma estaba rota, que es justo lo que el
        // comentario de arriba dice que no puede pasar. Mismo modo de fallo que [T-615].
        try {
          await sql`
            INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
            VALUES ('fargate', ${motivoSalto ? 'warn' : 'info'}, 'flota_bucle_pasada', 'flota',
                    ${motivoSalto || null},
                    ${sql.json({ repartidos, ocupados, atascados, motivoSalto, pausaS: pausa, host: yo })})`
        } catch { /* la telemetría nunca puede parar al supervisor */ }
        if (parar) break
        await dormir(pausa)
      }
      // ── AL PARAR, SE SUELTA EL SITIO (T-642) ─────────────────────────────────────────────
      // Sin esto, el rastro del que acaba de morir sigue diciendo «estoy repartiendo» hasta que
      // caduque su ventana, y bloquea al SIGUIENTE — que es el caso normal: reiniciar el
      // servicio tras un despliegue. Medido al estrenarlo: el supervisor del VPS se quedó 7 min
      // negándose a arrancar por el rastro de un bucle ya muerto. Un cierre limpio libera al
      // instante; una muerte SUCIA (kill -9, máquina caída) no escribe nada y ahí sí manda la
      // caducidad de la ventana, que es justo para lo que está.
      try {
        await sql`
          INSERT INTO public.observable_events (source, severity, event_type, endpoint, metadata)
          VALUES ('fargate', 'info', 'flota_bucle_pasada', 'flota',
                  ${sql.json({ host: yo, parado: true, pausaS: 0 })})`
      } catch { /* la telemetría nunca puede parar al supervisor, tampoco al salir */ }
      console.log('🛑 supervisor continuo detenido')
      return 0
    }

    // ── LANZAR UN TRABAJADOR EN EL PORTÁTIL ───────────────────────────────────────────────
    // El equivalente local de `arrancar-trabajador.sh`, sin usuario nuevo ni systemd: la sesión es
    // TUYA, no del sistema. Lo que sí se conserva es lo que importa — árbol propio desde
    // origin/main, credenciales RESTRINGIDAS (no tu .env.local, que abre usuarios y pagos) y el
    // preflight como puerta: si no puede latir, no arranca.
    // (Este comentario había quedado huérfano sobre otro comando por el mismo merge — T-617.)
    if (cmd === 'lanzar') {
      const w = process.argv[3]
      if (!w) { console.error('Uso: flota.cjs lanzar <trabajador>'); return 2 }
      const m = MAQ.maquinaDe(w)
      if (!m) { console.error(`❌ ${w} no está declarado en lib/flota/maquinas.cjs`); return 1 }
      if (!m.local) {
        console.error(`❌ ${w} vive en ${MAQ.maquinaDe(w) && 'una máquina remota'}: se levanta allí con`)
        console.error('   scripts/flota/arrancar-trabajador.sh ' + w)
        return 2
      }
      // Las credenciales salen de SSM, que es donde ya viven. Así «lanzar» es un comando y no un
      // ritual de exportar variables.
      const desdeSsm = (nombre) => {
        try {
          return execFileSync('aws', ['--profile', 'vence', '--region', 'eu-west-2', 'ssm',
            'get-parameter', '--name', nombre, '--with-decryption',
            '--query', 'Parameter.Value', '--output', 'text'], { encoding: 'utf8' }).trim()
        } catch { return null }
      }
      const host = 'vence-prod.c1mkcg6astb0.eu-west-2.rds.amazonaws.com:5432/app'
      const pCoord = process.env.VENCE_COORDINACION_PASS || desdeSsm('/vence-flota/COORDINACION_DB_PASSWORD')
      const pLector = process.env.VENCE_LECTOR_PASS || desdeSsm('/vence-flota/LECTOR_DB_PASSWORD')
      if (!pCoord) { console.error('❌ no pude leer la credencial de coordinación de SSM'); return 1 }
      const urlCoord = `postgres://vence_coordinacion:${pCoord}@${host}`
      const urlLector = pLector ? `postgres://vence_lector:${pLector}@${host}` : ''

      const casa = process.env.HOME
      const wt = `${casa}/vence-sessions/${w}`
      const env = ficheroEntorno(w)
      // El checkout PRINCIPAL, preguntándoselo a git en vez de recortando rutas a mano: el
      // supervisor puede estar corriendo desde cualquier worktree, y `REPO.replace(...)` daba
      // /home/manuel — que no es un repo. Lo mismo que hace crear-worktree.sh.
      const gitCommon = execFileSync('git', ['rev-parse', '--git-common-dir'],
        { cwd: REPO, encoding: 'utf8' }).trim()
      const repo = path.resolve(REPO, gitCommon, '..')
      const token = process.env.CLAUDE_CODE_OAUTH_TOKEN || ''
      if (!token) {
        console.error('❌ falta CLAUDE_CODE_OAUTH_TOKEN en tu entorno (o expórtalo antes de lanzar).')
        return 1
      }

      console.log(`→ montando ${w} en el portátil…`)

      // ── LOS SECRETOS VAN POR STDIN, NUNCA DENTRO DEL SCRIPT ──────────────────────────────
      // La primera versión los interpolaba en el propio script de shell, y al fallar un paso bash
      // imprimió el comando entero — con las dos contraseñas dentro. Hubo que rotarlas. Un secreto
      // en la línea de órdenes se ve en `ps`; en el cuerpo de un script se ve en CUALQUIER error.
      enMaquina(w, `[ -d ${wt} ] || (cd ${repo} && scripts/worktrees/crear-worktree.sh ${w} >/dev/null 2>&1)`)

      const envWorktree = `DATABASE_URL=${urlCoord}\n` + (urlLector ? `VENCE_LECTOR_URL=${urlLector}\n` : '')
      enMaquina(w, `umask 077 && cat > ${wt}/.env.local`, { entrada: envWorktree })

      // La ruta ABSOLUTA de claude, resuelta en la máquina con un shell de LOGIN. La sesión de
      // tmux arranca un bash no interactivo que no carga el .bashrc, así que `claude` a secas no
      // está en su PATH — y el trabajador moría con «instrucción no encontrada» sin que nada más
      // fallara. Guardarla aquí vale para local y para remoto sin casos especiales.
      let claudeBin = 'claude'
      try {
        claudeBin = enMaquina(w, `bash -lc 'command -v claude'`).trim() || 'claude'
      } catch { /* si no se puede resolver, se deja el nombre y fallará de forma visible */ }

      const envTrabajador = [
        `CLAUDE_BIN=${claudeBin}`,
        `CLAUDE_CODE_OAUTH_TOKEN=${token}`,
        'VENCE_SESSION_ROLE=trabajador',
        `VENCE_SESSION_HOME=${wt}`,
        `DATABASE_URL=${urlCoord}`,
        ...(urlLector ? [`VENCE_LECTOR_URL=${urlLector}`] : []),
        '',
      ].join('\n')
      enMaquina(w, `umask 077 && mkdir -p "$(dirname ${env})" && cat > ${env} && chmod 600 ${env}`,
        { entrada: envTrabajador })

      // La PUERTA: si no puede participar del reparto, no se arranca.
      try {
        const salida = enMaquina(w, `cd ${wt} && set -a && . ${env} && set +a && npm run --silent sesion:preflight`)
        console.log('   ' + salida.trim().split('\n').pop())
      } catch (e) {
        console.error('❌ el preflight dice que no está listo — no se arranca.')
        console.error(String((e.stdout || '') + (e.stderr || '')).trim().slice(-500))
        return 1
      }
      enMaquina(w, `tmux -L ${w} has-session -t ${w} 2>/dev/null || tmux -L ${w} new-session -d -s ${w} -c ${wt} /bin/bash`)
      console.log(`✅ ${w} en marcha en el portátil (${wt})`)
      console.log(`   dale trabajo:  npm run flota -- encargar ${w}`)
      return 0
    }

    if (cmd === 'arrancar' || cmd === 'parar') {
      const w = process.argv[3]
      if (!w) { console.error(`Uso: flota.cjs ${cmd} <trabajador>`); return 2 }
      const m = MAQ.maquinaDe(w)
      if (!m) { console.error(`❌ ${w} no está declarado en ninguna máquina`); return 1 }
      if (cmd === 'parar') {
        enMaquina(w, m.local
          ? `tmux -L ${w} kill-session -t ${w} 2>/dev/null || true`
          : `systemctl stop vence-flota@${w}`)
        console.log(`✅ ${w}: parado`)
        return 0
      }
      // ── ARRANCAR TIENE QUE FUNCIONAR TAMBIÉN SOBRE UNO YA «ARRANCADO» (T-642, 07/08) ─────
      // La unidad del VPS es de un solo disparo con `RemainAfterExit`: una vez ejecutada se queda
      // `active (exited)` PARA SIEMPRE, aunque su tmux haya desaparecido. Sobre eso `systemctl
      // start` es un **no-op silencioso** — medido con `w2` y `w4`, que se dieron por arrancados
      // sin que volviera ninguna sesión mientras el comando imprimía `✅`. El comando lo decide
      // `ordenDeArranque` (puro y testeado), no una condición suelta aquí.
      enMaquina(w, ENC.ordenDeArranque({ trabajador: w, systemd: !!m.systemd }))
      // Y se COMPRUEBA, que es de lo que iba todo esto: declarar el arranque sin mirar es
      // exactamente el fallo que esta tarea existe para quitar.
      const vivaTras = sesionViva(w)
      if (vivaTras === true) { console.log(`✅ ${w}: arrancado (sesión confirmada)`); return 0 }
      if (vivaTras === null) {
        console.log(`⚠️  ${w}: orden de arranque enviada, pero NO se pudo comprobar si levantó`)
        return 0
      }
      console.error(`❌ ${w}: la orden de arranque no ha levantado su sesión — míralo a mano:`)
      console.error(`   ssh … "${m.systemd ? `systemctl status vence-flota@${w} --no-pager` : 'tmux ls'}"`)
      return 1
    }

    // `bucle` va el PRIMERO de los verbos continuos y se nombra: era el único programador bueno y
    // no aparecía en esta línea, así que nadie que no leyera el código sabía que existía — y la
    // flota se quedó siete horas parada teniéndolo escrito (T-617).
    console.error('Uso: flota.cjs [estado] | bucle [--cada 300] (el supervisor continuo; `vigilar` es su alias) | repartir | productividad [--dias 7] | rescatar [<w>] | lanzar <w> | encargar <w> [--tarea T-nnn] | arrancar <w> | parar <w>')
    return 2
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }
}

// Exports para test — SOLO lo que hace falta para ejercitar el CABLEADO real (mandarEncargo
// bloqueando de verdad, logDelTurno construyendo el comando con sudo) con `child_process`
// mockeado, en vez de testear `AUT.clasificar()` en aislamiento (T-617, revisión 07/08: esa era
// exactamente la capa que faltaba — el criterio se testeaba solo, nunca su llamador real).
// El guard de abajo es lo que lo permite: sin él, cualquier `require()` de este fichero dispara
// `main()` (conexión a RDS incluida) igual que invocarlo por CLI.
module.exports = { enMaquina, logDelTurno, mandarEncargo, comandoDelPanel, turnosVivosDe }

if (require.main === module) {
  main().then((c) => process.exit(c)).catch((e) => { console.error('❌ flota:', e.message); process.exit(1) })
}
