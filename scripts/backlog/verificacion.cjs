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
const { exigeVerificacion } = require('../../lib/backlog/verificacionGate.cjs')
const { clasificarMenciones } = require('../../lib/backlog/pushGuard.cjs')

const REPO = path.resolve(__dirname, '../..')
const HEALTH = {
  frontend: 'https://www.vence.es/api/health',
  backend: 'https://api.vence.es/health',
}
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
function commitsDe(id, limite = 60) {
  const RS = '\x1e'
  const FS = '\x1f'
  const raw = git(['log', '--grep', `\\b${id}\\b`, '-E', `-${limite}`, `--format=${RS}%H${FS}%s${FS}%b`])
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
function importadoEn(fichero, profundidad = 3, vistos = new Set()) {
  if (profundidad <= 0 || vistos.has(fichero)) return []
  vistos.add(fichero)
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

async function shaVivo(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const j = await r.json()
    return typeof j?.deploy === 'string' ? j.deploy : null
  } catch { return null }
}

/** ¿El sha vivo CONTIENE todos los commits de la tarea? `null` si no se puede saber. */
function contenidos(shaVivo, commits) {
  if (!shaVivo || !commits.length) return null
  if (!git(['cat-file', '-t', shaVivo])) return null   // el sha vivo no está en el repo local
  for (const c of commits) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', c, shaVivo], { cwd: REPO, stdio: 'ignore' })
    } catch { return false }
  }
  return true
}

/**
 * Veredicto para una tarea. `{ exige, motivo, superficies, servidos, commits }`.
 * @param opciones.shas  inyectable (la medición reutiliza una sola lectura para 40 tareas)
 */
async function analizar(id, { shas = null } = {}) {
  const commits = commitsDe(id)
  if (!commits.length) {
    return { exige: false, motivo: 'ningún commit menciona esta tarea todavía', superficies: [], servidos: [], commits: [] }
  }
  const tocaDeps = packageTocaDependencias(commits)
  const cambios = ficherosDe(commits)
    .filter((f) => f !== 'package.json' || tocaDeps)
    .map((f) => ({ fichero: f, importadoEn: f === 'package.json' ? ['frontend'] : importadoEn(f) }))
  const vivos = shas || { frontend: await shaVivo(HEALTH.frontend), backend: await shaVivo(HEALTH.backend) }
  const desplegado = {
    frontend: contenidos(vivos.frontend, commits),
    backend: contenidos(vivos.backend, commits),
  }
  return { ...exigeVerificacion(cambios, desplegado), commits, desplegado, vivos }
}

module.exports = { analizar, commitsDe, ficherosDe, importadoEn, tokenDeImport, patronImport, packageTocaDependencias, contenidos, shaVivo, HEALTH }

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
