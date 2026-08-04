#!/usr/bin/env node
/**
 * canary-rol-coordinacion.cjs — el rol de la flota, ejercitado de verdad. (T-539)
 *
 * ── POR QUÉ UN CANARIO Y NO UN TEST ─────────────────────────────────────────────────────────
 * Un GRANT es una afirmación sobre PRODUCCIÓN: no se puede comprobar con un mock ni con una BD de
 * juguete, porque lo que se quiere saber es si ESTE rol, contra ESTA base, puede exactamente lo
 * que debe y nada más. Y hay que mirar las DOS mitades:
 *
 *   · que SÍ puede coordinarse — si no, un trabajador queda invisible y sin poder reclamar, que es
 *     justo el estado que [T-539] existe para impedir;
 *   · que NO puede leer negocio — un permiso de más no se nota nunca hasta que se nota.
 *
 * La segunda mitad es la que no se puede dar por supuesta leyendo el `.sql`: los privilegios se
 * heredan, se conceden por otra vía y se acumulan. Aquí se INTENTA leer `user_profiles` y se exige
 * que el motor lo rechace.
 *
 * ── NO ESCRIBE NADA QUE NO LIMPIE ───────────────────────────────────────────────────────────
 * Usa una tarea y una sesión desechables con prefijo `CANARY-`, y las borra con la credencial de
 * ADMIN (el rol de coordinación no tiene DELETE, que es justo lo que se quiere).
 *
 * Uso:
 *   VENCE_COORDINACION_URL=postgres://vence_coordinacion:…@… npm run canary:rol-coordinacion
 *
 * Sale 1 si alguna de las dos mitades falla. Pensado para correrse DESPUÉS de provisionar el rol
 * y cada vez que se toquen sus permisos.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')
const SUF = `CANARY-coord-${process.pid}`

const casos = []
function afirmar(nombre, ok, detalle = '') {
  casos.push({ nombre, ok })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`)
}

function urlAdmin() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
  } catch { return null }
}

/** ¿El motor rechazó por falta de privilegio? 42501 = insufficient_privilege. */
const esDenegado = (e) => e && (e.code === '42501' || /permission denied|permiso denegado/i.test(String(e.message)))

/** Corre algo que DEBE fallar por permisos, y afirma que falló por eso y no por otra cosa. */
async function debeDenegar(nombre, fn) {
  try {
    await fn()
    afirmar(nombre, false, 'NO fue denegado — el rol puede más de lo que debe')
  } catch (e) {
    afirmar(nombre, esDenegado(e), esDenegado(e) ? 'denegado por el motor' : `falló por otra causa: ${String(e.message).slice(0, 70)}`)
  }
}

async function main() {
  const uAdmin = urlAdmin()
  const uCoord = process.env.VENCE_COORDINACION_URL

  console.log('\nCANARIO — el rol de coordinación de la flota (T-539)')
  console.log('='.repeat(60))

  if (!uCoord) {
    console.log('\n⏭️  falta VENCE_COORDINACION_URL: el rol aún no está provisionado.')
    console.log('   Procedimiento: docs/runbooks/sistema-sesiones-paralelas.md §6.quater')
    // NO es un fallo: el canario dice «no puedo mirar», que es distinto de «está mal». Un verde
    // aquí sin credencial sería exactamente el falso verde que este repo persigue.
    return 0
  }
  if (!uAdmin) { console.log('❌ falta DATABASE_URL (admin) para preparar y limpiar'); return 1 }

  const pg = require('postgres')
  const admin = pg(uAdmin, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
  const coord = pg(uCoord, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })

  try {
    const quien = await coord`SELECT current_user AS u`
    console.log(`\nconectado como: ${quien[0].u}`)
    afirmar('conecta con su propio rol (no con el de la app)', quien[0].u === 'vence_coordinacion', quien[0].u)

    // ── MITAD 1: SÍ puede coordinarse ──────────────────────────────────────────────────────
    console.log('\n▸ lo que un trabajador DEBE poder hacer')

    await coord`INSERT INTO public.worktree_sessions (sid, worktree_path, host)
                VALUES (${SUF}, '/canary', 'canary')`
    const s = await coord`SELECT sid FROM public.worktree_sessions WHERE sid = ${SUF}`
    afirmar('latir: escribe y se ve en worktree_sessions', s.length === 1)

    await coord`UPDATE public.worktree_sessions SET last_signal_at = now() WHERE sid = ${SUF}`
    afirmar('renovar el latido', true)

    await coord`INSERT INTO public.backlog_tasks (id, title, status, priority)
                VALUES (${SUF}, 'canario del rol de coordinación', 'open', 'baja')`
    // Los tres campos del claim van JUNTOS: lo exige el CHECK `backlog_claim_coherente`, y con
    // razón — un `claimed_by` sin lease sería una tarea cogida para siempre por alguien que quizá
    // ya no existe. La primera versión de este canario ponía solo `claimed_by` y la BD la paró:
    // el canario estaba mal, no el rol.
    await coord`UPDATE public.backlog_tasks
                   SET claimed_by = ${SUF}, claimed_at = now(),
                       lease_until = now() + interval '90 minutes', status = 'in_progress'
                 WHERE id = ${SUF}`
    const t = await coord`SELECT claimed_by FROM public.backlog_tasks WHERE id = ${SUF}`
    afirmar('reclamar una tarea (INSERT + UPDATE + SELECT)', t.length === 1 && t[0].claimed_by === SUF)

    // La pregunta tiene un mínimo de 15 caracteres (`session_questions_question_check`): una
    // pregunta de dos palabras no le dice nada a quien la lee. El dato de prueba lo cumple porque
    // el canario prueba el PERMISO, no cómo saltarse las reglas de la tabla.
    await coord`INSERT INTO public.session_questions (sid, question, blocking)
                VALUES (${SUF}, 'canario del rol de coordinación: ¿puede este rol preguntar?', false)`
    afirmar('preguntar por el embudo (y su SECUENCIA concede USAGE)', true)

    await coord`INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message)
                VALUES ('fargate', 'info', 'sesion_preflight', 'sesiones', ${SUF})`
    afirmar('dejar rastro en el bus de observabilidad', true)

    // ── MITAD 2: NO puede nada más ─────────────────────────────────────────────────────────
    console.log('\n▸ lo que NO debe poder hacer (y es la mitad que no se puede leer en el .sql)')

    await debeDenegar('leer user_profiles (datos de usuarios)', () => coord`SELECT id FROM public.user_profiles LIMIT 1`)
    await debeDenegar('leer questions (el banco entero)', () => coord`SELECT id FROM public.questions LIMIT 1`)
    // OJO: las tablas de esta lista tienen que EXISTIR. La primera versión probaba contra
    // `test_sessions`, que no existe en RDS —está en CLAUDE.md pero no en la base—, y el motor
    // respondía «no existe» en vez de «denegado». Eso habría pasado por verde en un canario menos
    // estricto: por eso `debeDenegar` exige el código 42501 y no se conforma con «falló».
    await debeDenegar('leer tests (actividad de usuarios)', () => coord`SELECT id FROM public.tests LIMIT 1`)
    await debeDenegar('leer user_subscriptions (quién paga y cuánto)', () => coord`SELECT id FROM public.user_subscriptions LIMIT 1`)
    // `observable_events` es la trampa fina: necesita INSERT y NO debe poder LEER — tiene cientos
    // de miles de filas con user_id, y un SELECT de conveniencia las regalaría.
    await debeDenegar('LEER observable_events (solo puede escribir)', () => coord`SELECT id FROM public.observable_events LIMIT 1`)
    await debeDenegar('borrar una tarea', () => coord`DELETE FROM public.backlog_tasks WHERE id = ${SUF}`)
    await debeDenegar('borrar su propia sesión', () => coord`DELETE FROM public.worktree_sessions WHERE sid = ${SUF}`)
  } catch (e) {
    console.error(`\n❌ el canario no pudo completarse: ${String(e.message || e).slice(0, 200)}`)
    casos.push({ nombre: 'ejecución completa', ok: false })
  } finally {
    // La limpieza la hace el ADMIN, precisamente porque el rol de coordinación no puede borrar.
    try {
      const a = await admin`DELETE FROM public.backlog_tasks WHERE id = ${SUF} RETURNING id`
      const b = await admin`DELETE FROM public.worktree_sessions WHERE sid = ${SUF} RETURNING sid`
      const c = await admin`DELETE FROM public.session_questions WHERE sid = ${SUF} RETURNING id`
      const d = await admin`DELETE FROM public.observable_events WHERE error_message = ${SUF} RETURNING id`
      console.log(`\n🧹 limpieza (con credencial admin): ${a.length} tarea, ${b.length} sesión, ${c.length} pregunta, ${d.length} evento`)
    } catch (e) {
      console.error(`⚠️  limpieza incompleta, hazla a mano buscando «${SUF}»: ${String(e.message).slice(0, 120)}`)
    }
    try { await coord.end({ timeout: 5 }) } catch {}
    try { await admin.end({ timeout: 5 }) } catch {}
  }

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  if (fallos.length) console.log('   ' + fallos.map((f) => f.nombre).join('\n   '))
  return fallos.length ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌', e); process.exit(1) })
