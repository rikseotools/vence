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
// Escape hatch: BACKLOG_GUARD_SKIP=1 (para casos legítimos: rehacer historia, hotfix sin ficha).
// El session-id se resuelve igual que scripts/backlog.cjs: --sid > .session-id > CLAUDE_CODE_SESSION_ID.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { extractTaskIds, evaluatePush } = require('../lib/backlog/pushGuard.cjs')

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
const { resolverSid } = require('../lib/sessions/sid.cjs')
function readSessionId() { return resolverSid({ repo: REPO }).sid }

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

function git(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim() } catch { return '' }
}

/** Commits que se van a empujar: los que están en HEAD y NO en origin/main. Su texto + la rama. */
function collectPushText() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  // %B = cuerpo completo del mensaje; el rango excluye lo ya publicado en origin/main.
  const msgs = git(['log', 'origin/main..HEAD', '--format=%B']) ||
    git(['log', '-20', '--format=%B'])  // fallback si no hay upstream resuelto
  return `${branch}\n${msgs}`
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
  if (process.env.BACKLOG_GUARD_SKIP === '1') {
    console.log('⏭️  backlog-push-guard saltado (BACKLOG_GUARD_SKIP=1)')
    // Deja constancia (T-423): lo que mata a un guardarraíl no es que bloquee, es que se rodee
    // de forma sistemática sin que nadie lo mida. El escape se emite como `warn` a propósito.
    friccion('guard_escape', 'backlog-push')
    return 0
  }

  const referencedIds = extractTaskIds(collectPushText())
  if (referencedIds.length === 0) return 0  // push normal: sin peaje

  const sid = readSessionId()
  const url = getUrl()
  if (!url) {
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
    referencedIds, tasksById, sid, changedFiles: collectChangedFiles(),
  })
  // Los avisos se imprimen SIEMPRE, pase o no: una excepción silenciosa es una excepción que
  // nadie revisa. Que se vea por qué el guard dejó pasar algo que antes bloqueaba.
  for (const n of notices || []) console.log(`ℹ️  backlog-push-guard: ${n.id} — ${n.reason}`)
  if (allowed) return 0

  console.error('\n❌ PUSH BLOQUEADO por el guardrail del backlog — commits que mencionan una tarea que NO tienes reclamada:\n')
  for (const v of violations) console.error(`   · ${v.id}: ${v.reason}`)
  friccion('guard_bloqueo', 'backlog-push', violations.map((v) => v.id).join(','))
  console.error('\n   Reclama la tarea (o coordina si la tiene otra sesión) y reintenta.')
  console.error('   Si es legítimo (rehacer historia, mención suelta): BACKLOG_GUARD_SKIP=1 git push …\n')
  return 1
}

main().then((code) => process.exit(code)).catch((e) => {
  // Cualquier error inesperado del propio guard: fail-open (no romper el push por un bug del hook).
  console.log(`⚠️  backlog-push-guard error inesperado (${e.message}). Push permitido (fail-open).`)
  process.exit(0)
})
