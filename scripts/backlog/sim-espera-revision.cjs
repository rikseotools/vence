#!/usr/bin/env node
/**
 * sim-espera-revision.cjs — el ciclo completo de la QUINTA espera, contra la BD real. (T-539)
 *
 * ── QUÉ PRUEBA, Y POR QUÉ NO BASTAN LOS UNIT ────────────────────────────────────────────────
 * Los unit comprueban la DECISIÓN (validar la entrega, la puerta del claim, la clasificación) con
 * filas inventadas. Lo que no pueden comprobar es el CICLO: que `revision` escriba de verdad y
 * suelte el claim, que la tarea desaparezca de las listas de trabajo, que `claim` la rechace de
 * verdad desde otra sesión, que `--force` la entregue dejando registro, y que `wake` la devuelva.
 *
 * Eso pasa por procesos, códigos de salida y una tabla con CHECKs — que es donde vive el fallo que
 * originó esta ficha: el trabajador tuvo que inventarse una fecha porque el comando no existía.
 *
 * Se ejecutan los binarios REALES sobre una tarea desechable que se borra al terminar.
 *
 * Uso:  npm run sim:espera-revision
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const ID = 'T-SIM539'
const SID_A = 'SIM-trabajador-539'
const SID_B = 'SIM-otra-sesion-539'
const ENTREGA = 'propuesta de recorte 25-37 verificada contra el BOC, sin aplicar nada'

const casos = []
function afirmar(nombre, ok, detalle = '') {
  casos.push({ nombre, ok })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`)
}

function cli(args, sid) {
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'backlog.cjs'), ...args, '--sid', sid], {
    cwd: REPO, encoding: 'utf8', timeout: 90_000,
  })
  return { code: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` }
}

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
  } catch { return null }
}

async function main() {
  const u = url()
  if (!u) { console.log('⏭️  sin DATABASE_URL'); return 0 }
  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })

  console.log('\nSIMULACIÓN — la quinta espera: «hecho, esperando revisión humana» (T-539)')
  console.log('='.repeat(74))

  try {
    await sql`DELETE FROM public.backlog_tasks WHERE id = ${ID}`
    await sql`
      INSERT INTO public.backlog_tasks (id, title, status, priority, effort, claimed_by, claimed_at, lease_until)
      VALUES (${ID}, 'tarea desechable de la simulación de T-539', 'in_progress', 'baja', 'rato',
              ${SID_A}, now() - interval '20 minutes', now() + interval '70 minutes')`

    console.log('\n▸ 1. la entrega es obligatoria y tiene que decir QUÉ revisar')
    const vacio = cli(['revision', ID], SID_A)
    afirmar('sin --entrega no escribe nada', vacio.code === 2, `exit=${vacio.code}`)
    const pobre = cli(['revision', ID, '--entrega', 'revisar'], SID_A)
    afirmar('«revisar» no cuela como entregable', pobre.code === 2, `exit=${pobre.code}`)
    const sigueCogida = await sql`SELECT claimed_by FROM public.backlog_tasks WHERE id = ${ID}`
    afirmar('y ninguno de los dos intentos le quitó el claim', sigueCogida[0].claimed_by === SID_A)

    console.log('\n▸ 2. entregar: escribe el estado y SUELTA el claim')
    const ok = cli(['revision', ID, '--entrega', ENTREGA], SID_A)
    afirmar('sale bien', ok.code === 0, `exit=${ok.code}`)
    const f = await sql`
      SELECT claimed_by, lease_until, status, review_note, review_requested_by,
             (review_requested_at IS NOT NULL) AS pedida, worked_seconds
        FROM public.backlog_tasks WHERE id = ${ID}`
    afirmar('queda marcada como entregada', f[0].pedida === true)
    afirmar('con el entregable y quién la dejó', f[0].review_note === ENTREGA && f[0].review_requested_by === SID_A)
    afirmar('suelta el claim (no deja un lease agonizando sobre algo terminado)',
      f[0].claimed_by === null && f[0].lease_until === null)
    // Sin esto se pierde el único dato con el que contrastar la estimación de esfuerzo (T-414).
    afirmar('acumula el tiempo trabajado antes de soltarla', Number(f[0].worked_seconds) > 0, `${f[0].worked_seconds}s`)

    console.log('\n▸ 3. nadie la coge por error mientras espera')
    // ORDEN IMPORTANTE: se prueba primero QUIEN LA ENTREGÓ y luego otra sesión, y entre medias se
    // comprueba que sigue libre. En la primera versión iban al revés y el segundo caso pasaba por
    // el motivo equivocado — la rechazaba el lease vivo que acababa de crear el primero, no la
    // espera de revisión. Un verde por la razón equivocada es peor que un rojo.
    const suya = cli(['claim', ID], SID_A)
    afirmar('quien la entregó NO puede recuperarla sin más: entregar es soltarla',
      suya.code !== 0, `exit=${suya.code}`)
    const otra = cli(['claim', ID], SID_B)
    afirmar('otra sesión tampoco puede reclamarla', otra.code !== 0, `exit=${otra.code}`)
    afirmar('y se le dice por qué', /revisi[óo]n humana/i.test(otra.salida))
    const libreAun = await sql`SELECT claimed_by FROM public.backlog_tasks WHERE id = ${ID}`
    afirmar('ningún intento fallido se la quedó a medias', libreAun[0].claimed_by === null)

    console.log('\n▸ 4. se puede forzar, pero cuesta un motivo y queda registrado')
    const forzado = cli(['claim', ID, '--force', '--motivo', 'sigo yo con la parte que no depende de la revision'], SID_B)
    afirmar('con --force sí se entrega', forzado.code === 0, `exit=${forzado.code}`)
    const ff = await sql`SELECT claimed_by, force_claim_reason FROM public.backlog_tasks WHERE id = ${ID}`
    afirmar('queda escrito quién y por qué', ff[0].claimed_by === SID_B && /sigo yo/.test(ff[0].force_claim_reason || ''))

    console.log('\n▸ 5. wake la devuelve al pool (mismo verbo que despierta las otras esperas)')
    const w = cli(['wake', ID], SID_B)
    afirmar('sale bien y lo dice', w.code === 0 && /revisi[óo]n humana/i.test(w.salida), `exit=${w.code}`)
    const tras = await sql`
      SELECT (review_requested_at IS NOT NULL) AS pedida, review_note FROM public.backlog_tasks WHERE id = ${ID}`
    afirmar('ya no espera revisión', tras[0].pedida === false && tras[0].review_note === null)

    console.log('\n▸ 6. la tabla lo hace cumplir aunque alguien no pase por el CLI')
    // Igual que el CHECK de `due_reason`: el CLI se puede saltar, la tabla no.
    let rechazado = false
    try {
      await sql`UPDATE public.backlog_tasks SET review_requested_at = now() WHERE id = ${ID}`
    } catch { rechazado = true }
    afirmar('una petición de revisión SIN entregable la rechaza la BD', rechazado)
  } catch (e) {
    console.error(`\n❌ la simulación no pudo completarse: ${String(e.message || e).slice(0, 200)}`)
    casos.push({ nombre: 'ejecución completa', ok: false })
  } finally {
    const d = await sql`DELETE FROM public.backlog_tasks WHERE id = ${ID} RETURNING id`
    console.log(`\n🧹 tarea desechable borrada: ${d.length}`)
    try { await sql.end({ timeout: 5 }) } catch {}
  }

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  if (fallos.length) console.log('   ' + fallos.map((f) => f.nombre).join('\n   '))
  return fallos.length ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌', e); process.exit(1) })
