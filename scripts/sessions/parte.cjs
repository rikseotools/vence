#!/usr/bin/env node
/**
 * parte.cjs — UNA pantalla con lo que hace cada sesión, quién está parado y qué te espera.
 * (T-494, 02/08/2026)
 *
 * Nace de una frase de Manuel (02/08): *«un resumen muy corto de lo que va haciendo cada sesión,
 * para ver si están paradas»*. Los datos ya existían repartidos en tres sitios; lo que no existía
 * era la respuesta a **«¿quién está parado?»**, que no vive en ninguna tabla: es el cruce de
 * `backlog_tasks` (quién tiene qué) con `worktree_sessions` (quién da señal). `list` pintaba la
 * tarea como cogida, `latidos` pintaba la sesión como dormida, y había que atar los cabos a ojo.
 *
 * **Solo LEE.** No reparte ni manda: el claim ya reparte, es atómico y no se olvida — un
 * supervisor que redistribuyera metería una opinión y un punto único de fallo donde hoy hay una
 * regla.
 *
 * **Sin LLM.** Los hechos son deterministas (quién calla, desde cuándo, qué espera); el resumen en
 * prosa lo pone quien lo lea.
 *
 *   npm run parte           # el parte
 *   npm run parte -- --json # para encadenarlo
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '../..')
const JSON_OUT = process.argv.includes('--json')

const { cruzarTrabajo, sesionesOciosas, veredicto, evidenciaSesiones, diagnosticoEvidencia } = require(path.join(REPO, 'lib', 'sessions', 'parte.cjs'))
const PREG = require(path.join(REPO, 'lib', 'backlog', 'preguntas.cjs'))
const { clasificarSenal } = require(path.join(REPO, 'lib', 'sessions', 'latido.js'))
const { ratioEscape, escapesSinBloqueo, diagnostico, EVENT_TYPE } = require(path.join(REPO, 'lib', 'observability', 'friccionSesiones.cjs'))
const { isAwaitingVerification } = require(path.join(REPO, 'lib', 'backlog', 'claimGate.cjs'))
const REV = require(path.join(REPO, 'lib', 'backlog', 'revision.cjs'))

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

async function main() {
  const u = url()
  if (!u) { console.error('❌ sin DATABASE_URL'); return 1 }
  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 15 })

  let tareas, sesiones, preguntas, friccion, listas, preflights, entregadas
  try {
    tareas = await sql`
      SELECT id, title, claimed_by, claimed_at, lease_until
        FROM public.backlog_tasks WHERE status = 'in_progress' AND claimed_by IS NOT NULL`
    sesiones = await sql`
      SELECT sid, slug, host, rol, last_signal_at, last_command FROM public.worktree_sessions`
    // Fail-open por pieza: si el embudo aún no existe (migración sin aplicar), el resto del parte
    // sigue sirviendo. Un parte que se cae entero porque falta una tabla no se usa.
    preguntas = await sql`
      SELECT id, sid, task_id, question, blocking, asked_at, status
        FROM public.session_questions WHERE status = 'open'`.catch(() => [])
    listas = await sql`
      SELECT id, title, resume_check, wake_on_deploy_sha, snooze_until,
             review_requested_at, review_note, review_requested_by,
             reviewed_at, reviewed_by, review_verdict
        FROM public.backlog_tasks WHERE status <> 'done' AND resume_check IS NOT NULL`.catch(() => [])
    friccion = await sql`
      SELECT metadata->>'clase' AS clase, metadata->>'guard' AS guard, metadata->>'sid' AS sid
        FROM public.observable_events
       WHERE event_type = ${EVENT_TYPE} AND ts > now() - interval '7 days'`.catch(() => [])
    // Entregadas y esperando revisión (T-539). Consulta propia porque una entrega NO tiene por
    // qué haber pasado por `pause`, así que no aparece en `listas` (que exige resume_check).
    entregadas = await sql`
      SELECT id, title, review_requested_at, review_note, review_requested_by,
      reviewed_at, reviewed_by, review_verdict
        FROM public.backlog_tasks
       WHERE status <> 'done' AND review_requested_at IS NOT NULL
       ORDER BY review_requested_at`.catch(() => [])
    // Evidencia por sesión (T-539): sin esto el parte no distingue una sesión sana de una que
    // trabaja a ciegas. Fail-open por pieza, como el embudo: si aún no hay preflights, el resto
    // del parte sigue sirviendo.
    preflights = await sql`
      SELECT DISTINCT ON (metadata->>'sid')
             metadata->>'sid' AS sid, metadata->>'veredicto' AS veredicto, ts
        FROM public.observable_events
       WHERE event_type = 'sesion_preflight' AND ts > now() - interval '1 day'
       ORDER BY metadata->>'sid', ts DESC`.catch(() => [])
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }

  const ahora = new Date()
  const { trabajando, paradas } = cruzarTrabajo(tareas, sesiones, { ahora })
  const ociosas = sesionesOciosas(tareas, sesiones, { ahora })
  const conSenal = sesiones.filter((s) => clasificarSenal(s.last_signal_at, ahora).estado !== 'sin_senales').length
  const v = veredicto({ paradas, trabajando, preguntas, sesionesConSenal: conSenal })
  const paraVerificar = (listas || []).filter((t) => isAwaitingVerification(t, ahora))

  if (JSON_OUT) {
    console.log(JSON.stringify({
      veredicto: v, trabajando, paradas, ociosas, preguntas, paraVerificar, entregadas,
      evidencia: evidenciaSesiones(sesiones, preflights, { ahora }),
    }, null, 1))
    return paradas.length ? 3 : 0
  }

  console.log(`\n${v.icono}  ${v.frase}\n`)

  // 1. EL EMBUDO PRIMERO: es lo único que depende de Manuel y lo único cuyo coste corre mientras
  //    nadie lo lee.
  for (const l of PREG.formatearEmbudo(preguntas, { ahora })) console.log(l)
  if (preguntas.length) console.log('')

  // Entregadas: van pegadas al embudo porque desde el punto de vista de Manuel son lo mismo
  // —trabajo parado esperando que él mire— con la diferencia de que aquí YA hay entregable.
  // Dos cajones, no uno (T-486): la que nadie ha mirado pide REVISOR; la que ya tiene veredicto
  // pide DECISIÓN. Mezclarlas escondía el resultado de la revisión entre las que seguían en cola.
  const conVeredicto = (entregadas || []).filter((r) => REV.esperaDecision(r))
  const sinMirar = (entregadas || []).filter((r) => REV.esperaRevision(r))
  if (conVeredicto.length) {
    console.log(`⚖️  ${conVeredicto.length} YA REVISADA(S) — hay veredicto y falta tu decisión:`)
    for (const r of conVeredicto) console.log(REV.lineaRevisada(r, ahora))
    console.log('')
  }
  if (sinMirar.length) {
    console.log(`🙋 ${sinMirar.length} ENTREGADA(S) — hechas y esperando que las revises:`)
    for (const r of sinMirar) console.log(REV.lineaRevision(r, ahora))
    console.log('')
  }

  if (paradas.length) {
    console.log(`🟠 ${paradas.length} TAREA(S) SIN SEÑAL DE SU SESIÓN:`)
    for (const p of paradas) {
      console.log(`   ${p.id}  ${String(p.title).slice(0, 62)}`)
      console.log(`      ${String(p.sid).slice(0, 12)}…${p.slug ? ` · ${p.slug}` : ''}${p.host ? ` @${p.host}` : ''} — ${p.detalle}`)
    }
    console.log('')
  }

  if (trabajando.length) {
    console.log(`🟢 ${trabajando.length} TRABAJANDO AHORA:`)
    for (const t of trabajando) {
      console.log(`   ${t.id}  ${String(t.title).slice(0, 62)}`)
      console.log(`      ${t.slug || String(t.sid).slice(0, 12) + '…'}${t.host ? ` @${t.host}` : ''} · señal ${t.antiguedad}`)
    }
    console.log('')
  }

  if (ociosas.length) {
    console.log(`⚪ ${ociosas.length} sesión(es) vivas SIN tarea cogida: ${ociosas.map((o) => o.slug || String(o.sid).slice(0, 8)).join(', ')}\n`)
  }

  if (paraVerificar.length) {
    console.log(`⏰ ${paraVerificar.length} LISTA(S) PARA VERIFICAR (se cierran en minutos):`)
    for (const t of paraVerificar.slice(0, 8)) console.log(`   ${t.id}  ${String(t.title).slice(0, 66)}`)
    console.log('')
  }

  // 1.bis. ¿ES DE FIAR LO QUE ACABO DE PINTAR? (T-539, pieza 3 de la flota)
  //    Una sesión que no alcanza la BD de coordinación no sale peor en este parte: sale MENOS,
  //    porque ni siquiera late — y los guardarraíles que dependen de esa BD la dejan pasar sin
  //    comprobar nada. Aquí se cruza el `rol` del latido con el veredicto del preflight para
  //    separar «verde porque lo comprobé» de «verde porque estoy ciego».
  //    Solo se pinta lo ANORMAL: que una persona no haya hecho preflight es lo normal, y un aviso
  //    que ladra a todo el mundo se deja de mirar en una tarde (la lección del 31/07).
  const avisos = evidenciaSesiones(sesiones, preflights, { ahora })
    .map(diagnosticoEvidencia)
    .filter(Boolean)
  if (avisos.length) {
    console.log('🔎 SESIONES QUE TRABAJAN SIN EVIDENCIA:')
    for (const a of avisos) console.log(`   ${a}`)
    console.log('')
  }

  // 2. LA SALUD DEL PROPIO ANDAMIAJE. No es cuántas veces bloquea un guardarraíl —eso solo dice
  //    que trabaja— sino cuántas se RODEA: es el indicador adelantado de que va a dejar de servir.
  const ratios = ratioEscape((friccion || []).filter((f) => f.clase && f.guard))
  const malos = ratios.filter((r) => r.veredicto === 'erosion' || r.veredicto === 'muerto')
  if (malos.length) {
    console.log('🧯 GUARDARRAÍLES QUE SE ESTÁN RODEANDO (7 días):')
    // El desglose de PREVENTIVOS va pegado al ratio a propósito (T-496): sin él, un 67% se lee
    // como «el guardarraíl estorba» y se relaja el criterio, cuando lo que puede estar pasando es
    // que el escape se haya vuelto un prefijo. Los dos arreglos son opuestos.
    const prev = new Map(escapesSinBloqueo(friccion || []).map((x) => [x.guard, x]))
    for (const g of malos) {
      console.log(`   ${diagnostico(g)}`)
      const p = prev.get(g.guard)
      if (p && p.preventivos) {
        console.log(`      ↳ ${p.preventivos} de ${p.escapes} escapes NO respondían a ningún bloqueo: el escape se usa de prefijo, no por estorbo`)
      }
    }
    console.log('')
  }

  // Exit code para poder encadenarlo: 3 = hay algo parado.
  return paradas.length ? 3 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌ parte:', e.message); process.exit(1) })
