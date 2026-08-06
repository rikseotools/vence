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

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // EL OTRO ESCALÓN: «entregada → REVISADA» (T-486, 06/08)
    //
    // Los tramos 1-6 prueban la entrega. Lo que sigue prueba el desenlace, que se estrenó el
    // 06/08 y llegó con dos fallos que ningún unit podía ver porque viven en el SQL y en el
    // proceso: `revisado` no soltaba el claim (T-244 y T-397 quedaron con lease vivo de un
    // trabajador muerto: ni `reap` las siega ni `claim` las da), y la puerta atómica del claim
    // seguía leyendo solo `review_requested_at`, así que una devuelta con problemas exigía
    // `--force` para hacer justo lo que su veredicto pedía.
    // ═══════════════════════════════════════════════════════════════════════════════════════

    console.log('\n▸ 7. revisar: escribe el veredicto y TAMBIÉN suelta el claim')
    cli(['claim', ID], SID_A)
    cli(['revision', ID, '--entrega', ENTREGA], SID_A)
    // EL REVISOR LA COGE ANTES DE MIRARLA, que es el camino real: una entregada bloquea el claim,
    // así que quien la revisa entra con --force. Sin este paso el claim ya estaba suelto y la
    // comprobación de «revisar la suelta» pasaba SIN EJERCITAR NADA — un verde por la razón
    // equivocada, que es el modo de fallo contra el que avisa el tramo 3 de esta misma simulación.
    // Se descubrió al reparar el residuo en producción: el UPDATE real chocó con el CHECK
    // `backlog_claim_coherente` (el triplete claimed_by/claimed_at/lease_until va junto) y esta
    // simulación no lo había visto porque nunca llegó a soltar un claim de verdad.
    const cogeRevisor = cli(['claim', ID, '--force', '--motivo', 'la cojo para revisarla'], SID_B)
    afirmar('el revisor la coge para mirarla (--force: una entregada no se entrega sola)',
      cogeRevisor.code === 0, `exit=${cogeRevisor.code}`)
    const propia = cli(['revisado', ID, '--veredicto', 'ok', '--hallazgos', 'leí el diff entero y reproduje la causa contra el BOE'], SID_A)
    afirmar('nadie revisa lo suyo: quien la entregó no puede firmarla', propia.code === 3, `exit=${propia.code}`)
    const corto = cli(['revisado', ID, '--veredicto', 'problemas', '--hallazgos', 'está mal'], SID_B)
    afirmar('un veredicto sin hallazgos es un sello, no una revisión', corto.code === 2, `exit=${corto.code}`)
    const rev = cli(['revisado', ID, '--veredicto', 'ok', '--hallazgos', 'leí el diff entero y reproduje la causa contra el BOE antes de firmarlo'], SID_B)
    afirmar('con veredicto y hallazgos sale bien', rev.code === 0, `exit=${rev.code}`)
    const r7 = await sql`
      SELECT claimed_by, claimed_at, lease_until, review_verdict, reviewed_by,
             (reviewed_at IS NOT NULL) AS mirada
        FROM public.backlog_tasks WHERE id = ${ID}`
    afirmar('queda el veredicto y quién lo firmó', r7[0].review_verdict === 'ok' && r7[0].reviewed_by === SID_B && r7[0].mirada)
    // ÉSTE es el fallo medido el 06/08: sin esto la tarea queda inalcanzable para todos.
    afirmar('y SUELTA el claim: revisar también es soltarla',
      r7[0].claimed_by === null && r7[0].lease_until === null && r7[0].claimed_at === null,
      `claimed_by=${r7[0].claimed_by} claimed_at=${r7[0].claimed_at}`)

    console.log('\n▸ 8. revisada SIN problemas: no es más trabajo, es una decisión de una persona')
    const trasOk = cli(['claim', ID], SID_A)
    afirmar('no se entrega', trasOk.code !== 0, `exit=${trasOk.code}`)
    afirmar('y el motivo es el REAL (falta mergear, no falta revisor)',
      /mergee/i.test(trasOk.salida) && !/esperando revisi[óo]n humana/i.test(trasOk.salida))

    console.log('\n▸ 9. revisada CON problemas: vuelve al pool y quien la coja recibe el veredicto')
    cli(['wake', ID], SID_A)
    cli(['claim', ID], SID_A)
    cli(['revision', ID, '--entrega', ENTREGA], SID_A)
    const HALL = 'la cifra «canarios 19/19» era un falso verde: RLS activo sin política devuelve 0 filas sin error'
    const malo = cli(['revisado', ID, '--veredicto', 'problemas', '--hallazgos', HALL], SID_B)
    afirmar('el veredicto negativo se escribe', malo.code === 0, `exit=${malo.code}`)
    // La puerta ATÓMICA (SQL) tiene que estar de acuerdo con el núcleo puro: si solo se hubiera
    // arreglado claimGate, esto seguiría fallando y el gate solo explicaría un fallo que ocurre.
    const retoma = cli(['claim', ID], SID_A)
    afirmar('se puede retomar SIN --force: su propio veredicto lo pide', retoma.code === 0, `exit=${retoma.code}`)
    afirmar('y al cogerla se le enseña lo que encontraron', /falso verde/.test(retoma.salida))
    const r9 = await sql`
      SELECT (review_requested_at IS NOT NULL) AS pedida, (reviewed_at IS NOT NULL) AS mirada,
             review_verdict, progress_note, claimed_by
        FROM public.backlog_tasks WHERE id = ${ID}`
    afirmar('sale del circuito de revisión: vuelve a estar en curso',
      r9[0].pedida === false && r9[0].mirada === false && r9[0].review_verdict === null)
    afirmar('pero el veredicto NO se tira: baja a progress_note', /falso verde/.test(r9[0].progress_note || ''))
    afirmar('y la tarea es de quien la retomó', r9[0].claimed_by === SID_A)

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
