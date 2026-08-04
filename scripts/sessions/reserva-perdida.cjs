#!/usr/bin/env node
/**
 * reserva-perdida.cjs — «lo que tenías ya no es tuyo». (T-516)
 *
 * Lo invoca el hook `UserPromptSubmit` (a través de `recordatorio-hook.cjs`), así que corre en
 * TODAS las sesiones sin que nadie se acuerde de nada. También se puede llamar a mano:
 *
 *   node scripts/sessions/reserva-perdida.cjs            # avisa si has perdido algo
 *   node scripts/sessions/reserva-perdida.cjs --estado   # además, qué tienes ahora (sin throttle)
 *
 * ── CÓMO SABE LO QUE «TENÍAS» SIN INVENTAR ESTADO NUEVO ─────────────────────────────────────
 * No hay tabla de histórico ni campo nuevo, y no hace falta: en cada pasada guarda la FOTO de lo
 * que esta sesión tiene reservado (un fichero efímero en /tmp, como el contador del recordatorio)
 * y en la siguiente compara. Si un id salió de tu foto y ahora lo tiene otro, eso es la pérdida.
 * Si el fichero se pierde, lo peor que pasa es que un aviso no llegue — nunca al revés.
 *
 * Y NO exige que los sitios que reclaman (cola.cjs, backlog.cjs, los dossieres) registren nada:
 * añadir escritores es como se desincronizan estas cosas. Aquí solo se LEE.
 *
 * ── POR QUÉ NO PUEDE COLGARSE ───────────────────────────────────────────────────────────────
 * Va dentro de un hook que corre antes de CADA mensaje del usuario. Tres frenos:
 *   · throttle (una consulta cada 90 s por sesión, no una por mensaje),
 *   · timeout duro de 2,5 s a la BD,
 *   · fail-open absoluto: ante cualquier problema, no imprime nada y sale con 0.
 * Un hook que bloquea el prompt se desactiva el primer día, y entonces no avisa de nada nunca.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const REPO = path.resolve(__dirname, '../..')
const DIR = path.join(os.tmpdir(), 'vence-reservas')
const THROTTLE_MS = 90_000
const TIMEOUT_MS = 2_500

const { diffReservas, identidadSinLatido, lineasAviso } = require(path.join(REPO, 'lib', 'sessions', 'reservaPerdida.cjs'))

function sidActual() {
  try {
    const { resolverSid } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
    return resolverSid({ repo: REPO }).sid
  } catch { return null }
}

function ficheroFoto(sid) {
  fs.mkdirSync(DIR, { recursive: true })
  return path.join(DIR, String(sid).replace(/[^a-zA-Z0-9-]/g, '_') + '.json')
}

function leerFoto(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return { ids: [], ts: 0 } }
}

/**
 * Estado actual de: lo que tengo reservado + los ids que tenía en la foto anterior.
 * Una sola consulta por cola, todas por clave primaria o por `claimed_by` (ambos indexados).
 */
async function consultar(sql, sid, idsAntes) {
  const previos = idsAntes.length ? idsAntes : ['00000000-0000-0000-0000-000000000000']
  const [tareas, feedback, disputas, psico, latido] = await Promise.all([
    sql`SELECT id::text AS id, 'backlog' AS cola, claimed_by, title AS titulo
          FROM backlog_tasks
         WHERE claimed_by = ${sid} OR id = ANY(${previos})`,
    sql`SELECT id::text AS id, 'feedback' AS cola, claimed_by, NULL AS titulo
          FROM user_feedback
         WHERE status = 'pending' AND (claimed_by = ${sid} OR id::text = ANY(${previos}))`,
    sql`SELECT id::text AS id, 'legislative' AS cola, claimed_by, NULL AS titulo
          FROM question_disputes
         WHERE status IN ('pending','appealed') AND (claimed_by = ${sid} OR id::text = ANY(${previos}))`,
    sql`SELECT id::text AS id, 'psychometric' AS cola, claimed_by, NULL AS titulo
          FROM psychometric_question_disputes
         WHERE status IN ('pending','appealed') AND (claimed_by = ${sid} OR id::text = ANY(${previos}))`,
    sql`SELECT last_signal_at FROM worktree_sessions WHERE sid = ${sid} LIMIT 1`,
  ])
  const filas = [...tareas, ...feedback, ...disputas, ...psico].map((r) => ({
    id: r.id, cola: r.cola, claimedBy: r.claimed_by, titulo: r.titulo,
  }))
  return { filas, ultimoLatido: latido[0]?.last_signal_at ?? null }
}

async function main() {
  const estado = process.argv.includes('--estado')
  const sid = sidActual()
  if (!sid) return []

  const f = ficheroFoto(sid)
  const foto = leerFoto(f)
  if (!estado && Date.now() - (foto.ts || 0) < THROTTLE_MS) return []

  let sql
  try {
    require('dotenv').config({ path: path.join(REPO, '.env.local') })
    const url = process.env.DATABASE_URL
    if (!url) return []
    sql = require('postgres')(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 3 })
  } catch { return [] }

  try {
    const { filas, ultimoLatido } = await Promise.race([
      consultar(sql, sid, foto.ids || []),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
    ])
    const { perdidas, mias } = diffReservas({ antes: foto.ids || [], ahora: filas, sid })
    const identidad = identidadSinLatido({ sid, tengoReservas: mias.length > 0, ultimoLatido })

    try { fs.writeFileSync(f, JSON.stringify({ ids: mias, ts: Date.now() })) } catch { /* sin foto: se avisa de menos */ }

    const lineas = lineasAviso({ perdidas, identidad })
    if (estado) {
      lineas.push(mias.length
        ? `📌 tuyo ahora mismo: ${mias.length} caso(s) — ${mias.join(', ')}`
        : '📌 no tienes nada reservado.')
    }
    return lineas
  } catch {
    return [] // fail-open: ni una palabra si algo va mal
  } finally {
    try { await sql.end({ timeout: 1 }) } catch { /* da igual */ }
  }
}

// Como módulo lo usa el hook; como script, imprime.
if (require.main === module) {
  main().then((l) => { if (l.length) process.stdout.write(l.join('\n') + '\n'); process.exit(0) })
        .catch(() => process.exit(0))
} else {
  module.exports = { avisos: main }
}
