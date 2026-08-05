#!/usr/bin/env node
// scripts/backlog-push-guard.cjs — bridge del guardrail de push (lo invoca .husky/pre-push).
//
// Reúne los inputs reales (commits que se empujan + rama + leases en RDS), llama a la lógica
// PURA de lib/backlog/pushGuard.cjs y decide si el push sigue. Ver ese fichero para la regla.
//
// Filosofía de fallo:
//   · FAIL-CLOSED en la única cosa que este guard existe para cazar: empujar un commit que
//     menciona un T-NNN vivo que no tienes → bloquea (exit 1).
//   · FAIL-OPEN ante problemas de INFRA (sin DATABASE_URL, BD caída, sin red): avisa y deja
//     pasar (exit 0). Bloquear pushes porque la BD está caída sería peor que el fallo que evita.
//   · Cortocircuito: si ningún commit menciona un T-NNN, ni se conecta a la BD (push normal
//     no paga peaje).
//
// Escape hatch: BACKLOG_GUARD_SKIP="por qué" (rehacer historia, hotfix sin ficha). Pide un
// MOTIVO desde T-497: con un «1» se convertía en prefijo — 13 de 23 escapes medidos NO respondían
// a ningún bloqueo de esa sesión, y este apaga el guard ENTERO para todos los ficheros del push.
// El session-id se resuelve igual que scripts/backlog.cjs: --sid > .session-id > CLAUDE_CODE_SESSION_ID.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const {
  clasificarMenciones, evaluatePush, parseGitLog, GIT_LOG_FORMAT, fichaAusenteEnPush, MD_BACKLOG,
} = require('../lib/backlog/pushGuard.cjs')
// El criterio de qué vale como escape es COMPARTIDO con el resto de guardarraíles (T-497): vive
// junto a la medida en el núcleo de fricción, para que no diverjan.
const { evaluarEscape } = require('../lib/observability/friccionSesiones.cjs')

/** Registrar el roce sin bloquear NUNCA: detached y sin esperar (T-423). */
function friccion(clase, guard, detalle) {
  try {
    const a = ['--clase', clase, '--guard', guard]
    if (detalle) a.push('--detalle', String(detalle).slice(0, 200))
    require('child_process').spawn(process.execPath, [path.join(REPO, 'scripts', 'friccion-emitir.cjs'), ...a],
      { detached: true, stdio: 'ignore' }).unref()
  } catch { /* la telemetría nunca estorba a un push */ }
}

const REPO = path.join(__dirname, '..')

// Misma identidad que `backlog.cjs`, resuelta por el MISMO módulo (T-407): si el guard y el
// claim discreparan, el guard bloquearía a la sesión por su propia tarea.
const { resolverSid, rol } = require('../lib/sessions/sid.cjs')
const { cegueraBloquea, mensajeCeguera } = require('../lib/sessions/preflight.cjs')

/**
 * Fail-open para una persona, fail-CLOSED para un trabajador autónomo (T-539). El criterio es
 * compartido con los demás guardarraíles; aquí solo se imprime y se cuenta.
 */
function sinRedEsBloqueante(detalle) {
  if (!cegueraBloquea(rol())) return false
  console.error(mensajeCeguera('backlog-push-guard', detalle))
  friccion('guard_bloqueo', 'backlog-push', `ciego: ${detalle}`.slice(0, 180))
  return true
}
function readSessionId() { return resolverSid({ repo: REPO }).sid }

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

function git(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim() } catch { return '' }
}

/**
 * Commits que se van a empujar (los que están en HEAD y NO en origin/main), con el ASUNTO y el
 * CUERPO SEPARADOS — el guard necesita distinguirlos para saber qué declara el push y qué solo
 * cita (T-403). Antes se concatenaba todo en un churro (`%B`) y esa diferencia se perdía.
 *
 * El formato y su parser viven JUNTOS en el núcleo puro: aquí solo se pide y se pasa.
 */
function collectPushCommits() {
  const raw = git(['log', 'origin/main..HEAD', GIT_LOG_FORMAT]) ||
    git(['log', '-20', GIT_LOG_FORMAT])  // fallback si no hay upstream resuelto
  return parseGitLog(raw)
}

/**
 * Ficheros que toca el push. `null` = no se pudo determinar (sin upstream, git mudo): quien
 * decide trata ese `null` como "no sé", nunca como "no toca nada" — un desconocido no puede
 * relajar el guard.
 */
function collectChangedFiles() {
  const out = git(['diff', '--name-only', 'origin/main...HEAD'])
  if (!out) return null
  const files = out.split('\n').map((l) => l.trim()).filter(Boolean)
  return files.length ? files : null
}

async function main() {
  // ── EL ESCAPE CUESTA UN MOTIVO (T-497) ─────────────────────────────────────────────────────
  // Mismo fallo y mismo arreglo que su hermano del índice compartido (T-496), y aquí con más
  // volumen: **13 de 23 escapes NUNCA respondieron a un bloqueo de esa sesión**, o sea que más de
  // la mitad no eran rodeos sino un `=1` arrastrado en el comando. Y este apaga el guard ENTERO
  // para todos los ficheros del push, incluido el que existe para el olvido de reclamar.
  //
  // Un valor que no vale NO bloquea nada nuevo: el guard se limita a evaluarse, y un push que no
  // menciona ninguna tarea viva pasa igual (ni siquiera se conecta a la BD).
  const esc = evaluarEscape(process.env.BACKLOG_GUARD_SKIP)
  if (esc.usa && esc.permitido) {
    console.log(`⏭️  backlog-push-guard saltado: ${esc.motivo}`)
    // Deja constancia (T-423): lo que mata a un guardarraíl no es que bloquee, es que se rodee
    // de forma sistemática sin que nadie lo mida. El escape se emite como `warn` a propósito.
    friccion('guard_escape', 'backlog-push', esc.motivo)
    return 0
  }
  if (esc.usa && !esc.permitido) {
    console.log(`⚠️  BACKLOG_GUARD_SKIP ignorado — ${esc.problema}`)
    console.log('    BACKLOG_GUARD_SKIP="rehago historia; la ficha ya está cerrada" git push …')
    console.log('    (no se bloquea nada por esto: se comprueban las menciones como siempre)')
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const { referencedIds, mencionSolo } = clasificarMenciones({ commits: collectPushCommits(), branch })
  if (referencedIds.length === 0) return 0  // push normal: sin peaje

  const sid = readSessionId()
  const url = getUrl()
  if (!url) {
    // Fail-open para una PERSONA (está delante y puede juzgar); fail-CLOSED para un trabajador
    // autónomo, que si no puede comprobar el claim empujaría trabajo declarando tareas que quizá
    // tiene otra sesión, sin nadie mirando (T-539).
    if (sinRedEsBloqueante(`no puedo verificar el claim de ${referencedIds.join(', ')}`)) return 1
    console.log(`⚠️  backlog-push-guard: sin DATABASE_URL — no puedo verificar el claim de ${referencedIds.join(', ')}. Push permitido (fail-open).`)
    return 0
  }

  let tasksById = new Map()
  try {
    const postgres = require('postgres')
    const s = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 15 })
    try {
      const rows = await s`
        SELECT id, status, claimed_by, lease_until, snoozed_by, snooze_until, wake_on_deploy_sha
          FROM public.backlog_tasks WHERE id IN ${s(referencedIds)}`
      for (const r of rows) tasksById.set(r.id, r)
    } finally { await s.end({ timeout: 5 }) }
  } catch (e) {
    if (sinRedEsBloqueante(`no pude leer backlog_tasks (${e.message})`)) return 1
    console.log(`⚠️  backlog-push-guard: no pude leer backlog_tasks (${e.message}). Push permitido (fail-open).`)
    return 0
  }

  if (!sid) {
    // Hay ids que verificar pero no sé quién soy → no puedo afirmar que los tienes. Aviso fuerte
    // pero NO bloqueo (un hook sin sesión no debe cerrar el paso a un humano en su terminal).
    console.log(`⚠️  backlog-push-guard: sin session-id y el push menciona ${referencedIds.join(', ')}. No verifico claim. Crea .session-id o exporta CLAUDE_CODE_SESSION_ID.`)
    return 0
  }

  const { allowed, violations, notices } = evaluatePush({
    referencedIds, tasksById, sid, mencionSolo, changedFiles: collectChangedFiles(),
  })
  // Los avisos se imprimen SIEMPRE, pase o no: una excepción silenciosa es una excepción que
  // nadie revisa. Que se vea por qué el guard dejó pasar algo que antes bloqueaba.
  for (const n of notices || []) console.log(`ℹ️  backlog-push-guard: ${n.id} — ${n.reason}`)

  // ¿Alguna de MIS tareas se va a publicar sin ficha en el markdown? (T-443). Nunca bloquea —ver
  // `fichaAusenteEnPush`— y por eso corre pase lo que pase con el resto del guard.
  const mdHeadContent = git(['show', `HEAD:${MD_BACKLOG}`])
  const sinFicha = fichaAusenteEnPush({ referencedIds, tasksById, sid, mdHeadContent })
  for (const id of sinFicha) {
    console.error(`🟠 backlog-push-guard: ${id} — la reclamas y este push la menciona, pero su ficha`)
    console.error(`   no está en ${MD_BACKLOG} (ni en el markdown que vas a publicar).`)
    console.error(`   Si ya la escribiste y no aparece, es EXACTAMENTE el fallo de [T-435]: revisa`)
    console.error(`   \`git log -S'### [${id}]' -- ${MD_BACKLOG}\` antes de asumir que está a salvo.`)
  }
  if (sinFicha.length) friccion('guard_aviso', 'backlog-push', sinFicha.join(','))

  if (allowed) return 0

  console.error('\n❌ PUSH BLOQUEADO por el guardrail del backlog — commits que mencionan una tarea que NO tienes reclamada:\n')
  for (const v of violations) console.error(`   · ${v.id}: ${v.reason}`)
  friccion('guard_bloqueo', 'backlog-push', violations.map((v) => v.id).join(','))
  console.error('\n   Reclama la tarea (o coordina si la tiene otra sesión) y reintenta.')
  console.error('   Si solo la CITAS como contexto, basta con que no salga en el ASUNTO: los ids del')
  console.error('   cuerpo no exigen claim cuando el asunto ya declara la tarea que trabajas (T-403).')
  console.error('   Y si es legítimo (rehacer historia), di POR QUÉ — queda registrado:')
  console.error('     BACKLOG_GUARD_SKIP="…tu motivo…" git push …\n')
  return 1
}

main().then((code) => process.exit(code)).catch((e) => {
  // Cualquier error inesperado del propio guard: fail-open (no romper el push por un bug del hook).
  console.log(`⚠️  backlog-push-guard error inesperado (${e.message}). Push permitido (fail-open).`)
  process.exit(0)
})
