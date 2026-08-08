#!/usr/bin/env node
/**
 * verificacion.cjs — I/O del escalón medible del `done` (Fase 1 de T-392).
 *
 * Reúne los hechos que el núcleo puro (`lib/backlog/verificacionGate.cjs`) necesita para decidir
 * si una tarea se puede cerrar o si su código todavía no está vivo:
 *
 *   · qué ficheros tocaron los commits que MENCIONAN esa tarea,
 *   · cuáles de ellos llegan al usuario solo tras un deploy (derivado de quién los importa),
 *   · si el `sha` vivo de esa superficie ya los incluye.
 *
 *   node scripts/backlog/verificacion.cjs T-392            informe de una tarea
 *   node scripts/backlog/verificacion.cjs T-392 --json
 *
 * Se importa desde `backlog.cjs done`. Fail-open en todo: si no se puede averiguar el sha vivo,
 * no se bloquea a nadie — se dice y se sigue.
 */
const path = require('path')
const { execFileSync } = require('child_process')
const { exigeVerificacion, commitsPorSuperficie } = require('../../lib/backlog/verificacionGate.cjs')
const { clasificarMenciones } = require('../../lib/backlog/pushGuard.cjs')
// El sha vivo sale del módulo CANÓNICO, no de una copia local (T-459). Este fichero tenía la suya
// —mismos endpoints, distinto timeout y distinto trato del `!r.ok`—, y dos lectores de «qué está
// desplegado» que no coinciden es el modo de fallo silencioso que ese módulo dice evitar en su
// propia cabecera: uno diría «ya está vivo» y el otro «todavía no».
const { shaVivo, shaVivoEstable, ENDPOINTS } = require('../../lib/deploy/shaVivo.cjs')

const REPO = path.resolve(__dirname, '../..')
/** @deprecated se conserva el nombre por los llamadores; la fuente es `ENDPOINTS`. */
const HEALTH = ENDPOINTS
/** Dónde vive el código que SÍ se sirve: si algo de aquí importa un fichero, ese fichero viaja. */
const DIRS_SERVIDOS = { frontend: ['app', 'components', 'contexts', 'hooks'], backend: ['backend/src'] }

function git(args, cwd = REPO) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).trim() } catch { return '' }
}

/**
 * Commits que **DECLARAN** la tarea, no los que la citan.
 *
 * Reutiliza el criterio de [T-403] (`clasificarMenciones`): un id que solo sale en el CUERPO de
 * un commit cuyo asunto ya declara otra tarea es una CITA. Sin esto, el gate hereda el trabajo
 * ajeno — medido al estrenarlo: T-431 salía «toca backend» por `alert-rules.ts`, un fichero que
 * nunca tocó; venía del commit de OTRA sesión que la citaba de pasada. Habría mandado a esperar
 * un deploy que no tenía nada que ver con ella.
 */
/**
 * @param {{todasLasRamas?:boolean}} [opts]
 *   `todasLasRamas` añade `--all`. Por defecto NO, que es lo que quiere el gate de `done`: allí
 *   la pregunta es «¿lo que voy a cerrar está vivo?» y un commit de otra rama no cuenta.
 *   Lo pide [T-735], donde la pregunta es la contraria — «¿existe este trabajo en ALGUNA rama y
 *   sigue sin llegar a main?» — y sin `--all` un commit que vive fuera es indistinguible de no
 *   existir, que es justo el caso que hay que cazar. Se añade como opción, y no se copia la
 *   función, para que DECLARAR vs CITAR ([T-403]) siga decidiéndose en un solo sitio.
 */
function commitsDe(id, limite = 60, { todasLasRamas = false } = {}) {
  const RS = '\x1e'
  const FS = '\x1f'
  const raw = git(['log', ...(todasLasRamas ? ['--all'] : []), '--grep', `\\b${id}\\b`, '-E', `-${limite}`, `--format=${RS}%H${FS}%s${FS}%b`])
  const out = []
  for (const bloque of raw.split(RS)) {
    if (!bloque.trim()) continue
    const [sha, subject, body] = bloque.split(FS)
    if (!/^[0-9a-f]{7,40}$/.test((sha || '').trim())) continue
    const { referencedIds, mencionSolo } = clasificarMenciones({ commits: [{ subject: subject || '', body: body || '' }] })
    if (referencedIds.includes(id) && !mencionSolo.includes(id)) out.push(sha.trim())
  }
  return out
}

/**
 * Hechos que necesita `clasificarTrabajoEnMain` ([T-735]): ¿cuántos commits DECLARAN esta tarea,
 * y cuántos han llegado a `origin/main` / a tu HEAD?
 *
 * Vive aquí —y no en cada llamante— porque `pause --tras-deploy` y `list` hacen la MISMA
 * pregunta: dos recolecciones separadas divergirían y volveríamos a tener dos criterios sobre el
 * mismo hecho, que es el modo de fallo de [T-375]. La DECISIÓN sigue siendo pura y vive en
 * `lib/backlog/esperaDeploy.cjs`; aquí solo se mide.
 *
 * Fail-open: si git no contesta devuelve `{gitDisponible:false}` y el clasificador no bloquea.
 */
function trabajoEnMain(id) {
  try {
    const shas = commitsDe(id, 60, { todasLasRamas: true }) || []
    const dentroDe = (sha, ref) => {
      try { execFileSync('git', ['merge-base', '--is-ancestor', sha, ref], { cwd: REPO, stdio: 'ignore' }); return true }
      catch { return false }
    }
    return {
      gitDisponible: true,
      declarantes: shas.length,
      enMain: shas.filter((c) => dentroDe(c, 'origin/main')).length,
      enHead: shas.filter((c) => dentroDe(c, 'HEAD')).length,
    }
  } catch {
    return { gitDisponible: false }
  }
}

function ficherosDe(commits) {
  const fs = new Set()
  for (const c of commits) {
    for (const f of git(['show', '--name-only', '--format=', c]).split('\n')) {
      const t = f.trim()
      if (t) fs.add(t)
    }
  }
  return [...fs]
}

/**
 * ¿Desde qué superficies se importa este fichero? DERIVADO, no declarado (principio del sistema
 * de sesiones: una intención anotada se pudre; el estado observado no).
 *
 * **El token es la RUTA, no el nombre del módulo**, y esa diferencia lo es todo: al estrenar
 * esto con el nombre suelto, `pushGuard` salía «servido por backend» y `toolRegistry` «por
 * frontend» —ninguno de los dos lo está— porque un nombre corto aparece en comentarios y en
 * módulos intermedios de nombre genérico, y la recursión lo propagaba. Medido: 3 de 3 tareas de
 * tooling daban falso positivo, o sea que el gate habría sido puro ruido justo en las tareas más
 * frecuentes. Con `sessions/trabajoHuerfano` en vez de `trabajoHuerfano`, cero.
 */
/**
 * Ficheros que son superficie servida POR CONVENCIÓN del framework, sin que nadie los importe.
 *
 * El hueco que cierra (T-678, 07/08/2026): a una `app/**​/page.js` **no la importa nadie** — la
 * sirve Next por su ruta —, así que `importadoEn` devolvía `[]` y el verificador la daba por NO
 * servida. Consecuencia: un arreglo que solo toca páginas o rutas de API se leía como «no hace
 * falta desplegar para verificarlo», que es exactamente lo contrario de la verdad. Se descubrió
 * porque la puerta nueva de «está vivo» no bloqueó un mensaje que sí debía bloquear: los dos
 * ficheros del arreglo eran `app/test/aleatorio-examen/page.js` y un componente `.js`.
 */
function servidoPorConvencion(fichero) {
  if (/^app\/api\/.+\/route\.[jt]sx?$/.test(fichero)) return ['frontend']
  if (/^app\/.+\/(page|layout|template|loading|error|not-found)\.[jt]sx?$/.test(fichero)) return ['frontend']
  if (/^app\/(page|layout)\.[jt]sx?$/.test(fichero)) return ['frontend']
  if (/^middleware\.[jt]s$/.test(fichero)) return ['frontend']
  return []
}

function importadoEn(fichero, profundidad = 3, vistos = new Set()) {
  if (profundidad <= 0 || vistos.has(fichero)) return []
  vistos.add(fichero)
  const porConvencion = servidoPorConvencion(fichero)
  if (porConvencion.length) return porConvencion
  const token = tokenDeImport(fichero)
  if (!token) return []
  const supers = new Set()
  for (const [sup, dirs] of Object.entries(DIRS_SERVIDOS)) {
    if (git(['grep', '-lE', patronImport(token), '--', ...dirs])) supers.add(sup)
  }
  if (supers.size) return [...supers]
  // Nadie servido lo importa: ¿lo importa otro módulo de `lib/` que sí lo esté?
  const intermedios = git(['grep', '-lE', patronImport(token), '--', 'lib']).split('\n').filter((f) => f && f !== fichero).slice(0, 8)
  for (const m of intermedios) for (const s of importadoEn(m, profundidad - 1, vistos)) supers.add(s)
  return [...supers]
}

/**
 * Solo cuentan las líneas con FORMA de import (`from '…'`, `require('…')`, `import('…')`).
 * Una MENCIÓN en un comentario no hace que un módulo viaje, y este repo comenta mucho: `pushGuard`
 * salía «servido» porque `lib/convocatoria/estadoCoherencia.ts` —que sí se sirve— lo nombra en una
 * nota de diseño. Tres líneas de comentario mandando a esperar un deploy.
 */
function patronImport(token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `(from|require\\(|import\\()[^\n]{0,40}${esc}`
}

/** `lib/sessions/trabajoHuerfano.cjs` → `sessions/trabajoHuerfano`: como se escribe en un import. */
function tokenDeImport(fichero) {
  const sinExt = String(fichero).replace(/\.(ts|tsx|js|jsx|cjs|mjs)$/, '')
  const partes = sinExt.split('/')
  if (partes.length < 2) return null           // suelto en la raíz: no hay ruta que anclar
  return partes.slice(-2).join('/')
}

/**
 * `package.json` merece caso aparte: cambiar una DEPENDENCIA sí exige deploy (viaja en la
 * imagen), pero añadir un script de npm no llega a ningún usuario. Sin esta distinción, toda
 * tarea que registre un comando nuevo arrastraría una espera de deploy que no significa nada.
 */
function packageTocaDependencias(commits) {
  for (const c of commits) {
    const diff = git(['show', c, '--', 'package.json'])
    for (const linea of diff.split('\n')) {
      if (!/^[+-]/.test(linea) || /^[+-]{3}/.test(linea)) continue
      if (/^[+-]\s*"[^"]+":\s*"[\^~>=<]*\d/.test(linea)) return true   // "next": "15.3.3"
    }
  }
  return false
}

/** ¿El sha vivo CONTIENE todos estos commits? `null` si no se puede saber. */
function contenidos(shaVivo, commits) {
  if (!shaVivo || !commits || !commits.length) return null
  if (!git(['cat-file', '-t', shaVivo])) return null   // el sha vivo no está en el repo local
  for (const c of commits) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', c, shaVivo], { cwd: REPO, stdio: 'ignore' })
    } catch { return false }
  }
  return true
}

/** Los commits de la lista que el sha vivo todavía NO incluye (para poder nombrarlos). */
function noContenidos(shaVivo, commits) {
  if (!shaVivo || !commits || !commits.length) return []
  if (!git(['cat-file', '-t', shaVivo])) return []
  return commits.filter((c) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', c, shaVivo], { cwd: REPO, stdio: 'ignore' })
      return false
    } catch { return true }
  })
}

/**
 * Veredicto para una tarea. `{ exige, motivo, superficies, servidos, commits }`.
 * @param opciones.shas  inyectable (la medición reutiliza una sola lectura para 40 tareas)
 */
async function analizar(id, { shas = null, detectarRollout = true } = {}) {
  const commits = commitsDe(id)
  if (!commits.length) {
    return { exige: false, motivo: 'ningún commit menciona esta tarea todavía', superficies: [], servidos: [], commits: [] }
  }
  const tocaDeps = packageTocaDependencias(commits)
  // El `importadoEn` de un fichero es caro (varios `git grep`) y se repite entre commits: se
  // calcula UNA vez por fichero y se reparte.
  const cache = new Map()
  const clasificar = (f) => {
    if (!cache.has(f)) cache.set(f, f === 'package.json' ? ['frontend'] : importadoEn(f))
    return cache.get(f)
  }
  const relevante = (f) => f !== 'package.json' || tocaDeps

  // Por COMMIT, no en un montón: es lo que permite preguntar por los commits que tocan cada
  // superficie en vez de por todos (T-459).
  const porCommit = commits.map((sha) => ({
    sha,
    cambios: ficherosDe([sha]).filter(relevante).map((f) => ({ fichero: f, importadoEn: clasificar(f), sha })),
  }))
  const cambios = porCommit.flatMap((c) => c.cambios)
  const grupos = commitsPorSuperficie(porCommit)

  const vivos = shas || { frontend: await shaVivo('frontend'), backend: await shaVivo('backend') }
  const desplegado = {
    frontend: contenidos(vivos.frontend, grupos.frontend),
    backend: contenidos(vivos.backend, grupos.backend),
  }

  // ── ¿O es que hay un ROLLOUT en curso? ────────────────────────────────────────────────────
  // Solo se comprueba cuando íbamos a BLOQUEAR: en el caso normal no cuesta nada, y es el único
  // caso en que la respuesta cambia algo. Si las lecturas no coinciden, el balanceador está
  // repartiendo entre la revisión vieja y la nueva y el veredicto sería una moneda al aire → se
  // degrada a «no lo sé», que ya es fail-open, y se DICE.
  const rollout = []
  if (detectarRollout && !shas) {
    for (const sup of ['frontend', 'backend']) {
      if (desplegado[sup] !== false) continue
      const { estable, vistos } = await shaVivoEstable(sup, { intentos: 3, pausaMs: 400 })
      if (!estable) { rollout.push(sup); desplegado[sup] = null; if (vistos.length) vivos[sup] = vistos[vistos.length - 1] }
    }
  }

  const pendientes = [
    ...noContenidos(vivos.frontend, grupos.frontend),
    ...noContenidos(vivos.backend, grupos.backend),
  ]
  const veredicto = exigeVerificacion(cambios, desplegado, { commitsPendientes: pendientes })
  if (rollout.length && !veredicto.exige) {
    veredicto.motivo = `hay un DEPLOY EN CURSO de ${rollout.join(' y ')} (el /health contesta shas distintos): no se puede afirmar qué está vivo — no se bloquea`
  }
  return { ...veredicto, commits, desplegado, vivos, rollout, grupos }
}

module.exports = { analizar, commitsDe, trabajoEnMain, ficherosDe, importadoEn, servidoPorConvencion, tokenDeImport, patronImport, packageTocaDependencias, contenidos, noContenidos, shaVivo, HEALTH }

if (require.main === module) {
  const id = process.argv[2]
  if (!/^T-\d{3}$/.test(id || '')) { console.error('Uso: verificacion.cjs T-NNN [--json]'); process.exit(2) }
  analizar(id).then((r) => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); return }
    console.log(`\n${id} — ${r.exige ? '⛔ NO se puede cerrar todavía' : '✅ se puede cerrar'}`)
    console.log(`   ${r.motivo}`)
    console.log(`   ${r.commits.length} commit(s) · ${r.servidos.length} fichero(s) servido(s)`)
    for (const s of r.servidos.slice(0, 8)) console.log(`      [${s.superficie}] ${s.fichero}`)
    if (r.servidos.length > 8) console.log(`      …y ${r.servidos.length - 8} más`)
  }).catch((e) => { console.log(`⚠️  ${String(e.message || e).slice(0, 120)} (fail-open)`); process.exit(0) })
}
