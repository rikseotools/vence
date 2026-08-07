#!/usr/bin/env node
/**
 * sim-embudo-fantasma.cjs — el aviso «este caso ya se cerró», contra la BD real. (T-614)
 *
 * ── QUÉ PRUEBA, Y POR QUÉ NO BASTAN LOS UNIT ────────────────────────────────────────────────
 * Los unit de `borradorAbierto.test.js` comprueban la DECISIÓN (`marcarCasosCerrados`) con
 * estados inventados a mano. Lo que no pueden comprobar es el CICLO — que una fila real del
 * embudo, citando un caso REAL cerrado en `question_disputes`, se marque; y sobre todo que el
 * viaje a la BD sobreviva al ROL restringido de un trabajador de la flota. Esta ficha nació
 * precisamente de un desajuste ENTRE DOS TABLAS que un unit no ve (misma lección que
 * `sim:espera-revision`), y se le sumó el 06/08 un SEGUNDO desajuste, este entre CÓDIGO Y
 * PERMISO: la consulta que resuelve el estado unía `question_disputes` +
 * `psychometric_question_disputes` + `user_feedback` en un solo `UNION ALL`, y bajo
 * `vence_coordinacion` (el rol de un trabajador) esa última tabla no tiene GRANT (T-581, es
 * negocio con PII) — así que la consulta ENTERA fallaba, el fail-open se comía el error, y el
 * aviso de T-614 no se disparaba NUNCA para ningún trabajador, sin decir por qué.
 *
 * Esta simulación corre con la conexión REAL de un trabajador (`DATABASE_URL`, no
 * `VENCE_LECTOR_URL` ni una credencial de superusuario) para que ese permiso denegado ocurra DE
 * VERDAD, igual que le pasaría a cualquier trabajador de la flota en producción — y confirma que
 * el aviso sigue funcionando a pesar de él.
 *
 * NO se insertan casos falsos en `question_disputes`/`psychometric_question_disputes` (el rol
 * del trabajador no tiene INSERT ahí — y tampoco debería). En su lugar se toma prestado UN caso
 * real ya cerrado y UNO real que sigue abierto, tal cual están hoy en la BD, y se prueban las dos
 * direcciones: que el cerrado SÍ avise y que el abierto NO. `session_questions` sí admite
 * INSERT/UPDATE al rol de coordinación (T-539), así que la fila del embudo es real de principio a
 * fin; se retira (`status='withdrawn'`) al terminar, nunca se borra (el rol no tiene DELETE).
 *
 * Uso:  npm run sim:embudo-fantasma
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const BORRAB = require(path.join(REPO, 'lib', 'impugnaciones', 'borradorAbierto.cjs'))

const casos = []
function afirmar(nombre, ok, detalle = '') {
  casos.push({ nombre, ok })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`)
}

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
  } catch { return null }
}

const CERRADOS_SQL = ["'resolved'", "'rejected'", "'closed'", "'dismissed'", "'completed'"].join(',')
const ABIERTOS_SQL = ["'pending'", "'appealed'"].join(',')

async function main() {
  const u = url()
  if (!u) { console.log('⏭️  sin DATABASE_URL'); return 0 }
  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })

  console.log('\nSIMULACIÓN — el embudo avisa cuando el caso que cita ya se cerró (T-614)')
  console.log('='.repeat(74))

  const idsPropios = []
  try {
    console.log('\n▸ 0. la conexión es la de un TRABAJADOR real, no una de superusuario')
    let permisoDenegadoReal = false
    try {
      await sql`SELECT status FROM public.user_feedback LIMIT 1`
    } catch (e) { permisoDenegadoReal = /permission denied/i.test(String(e.message || '')) }
    afirmar('user_feedback SIGUE sin GRANT bajo esta conexión (si esto falla, la simulación ya no reproduce el defecto real)',
      permisoDenegadoReal)

    console.log('\n▸ 1. tomar prestados un caso REAL cerrado y uno REAL abierto (no se inventan filas)')
    const [cerrado] = await sql.unsafe(
      `SELECT left(id::text, 8) AS clave, status::text AS status FROM public.question_disputes
        WHERE status IN (${CERRADOS_SQL}) ORDER BY updated_at DESC NULLS LAST LIMIT 1`)
    const [abierto] = await sql.unsafe(
      `SELECT left(id::text, 8) AS clave, status::text AS status FROM public.question_disputes
        WHERE status IN (${ABIERTOS_SQL}) ORDER BY created_at DESC LIMIT 1`)
    afirmar('hay al menos un caso cerrado con el que probar', Boolean(cerrado), cerrado ? `${cerrado.clave} (${cerrado.status})` : 'ninguno')
    afirmar('hay al menos un caso abierto con el que probar (control negativo)', Boolean(abierto), abierto ? `${abierto.clave} (${abierto.status})` : 'ninguno')
    if (!cerrado || !abierto) { throw new Error('sin datos suficientes para la simulación (no es un fallo del código)') }

    console.log('\n▸ 2. insertar DOS filas reales del embudo, citando cada caso en la prosa (nunca en draft_target)')
    const [fCerrado] = await sql`
      INSERT INTO public.session_questions (sid, kind, status, question, context)
      VALUES ('SIM-embudo-fantasma-614', 'pregunta', 'open',
              'simulación T-614: ¿aprovecho el analisis de este caso para otra cosa?',
              ${'¿apruebo lo relacionado con ' + cerrado.clave + '? (fila desechable de sim-embudo-fantasma)'})
      RETURNING id`
    const [fAbierto] = await sql`
      INSERT INTO public.session_questions (sid, kind, status, question, context)
      VALUES ('SIM-embudo-fantasma-614', 'pregunta', 'open',
              'simulación T-614: control negativo, este caso sigue vivo',
              ${'sobre ' + abierto.clave + ' (fila desechable de sim-embudo-fantasma)'})
      RETURNING id`
    idsPropios.push(fCerrado.id, fAbierto.id)
    afirmar('las dos filas quedan insertadas', Boolean(fCerrado?.id) && Boolean(fAbierto?.id))

    console.log('\n▸ 3. el pipeline REAL (clavesDeCasos → estadosDeCasos → marcarCasosCerrados)')
    const filas = await sql`SELECT id, sid, kind, question, context, draft_target FROM public.session_questions WHERE id = ANY(${idsPropios})`
    const claves = BORRAB.clavesDeCasos(filas)
    afirmar('detecta las dos claves citadas en la prosa', claves.includes(cerrado.clave) && claves.includes(abierto.clave))

    const estados = await BORRAB.estadosDeCasos(sql, claves)
    // Con la conexión real de un trabajador, este es el punto exacto donde el UNION ALL viejo
    // habría devuelto [] (permission denied entero) y todo lo de abajo habría fallado en cascada.
    afirmar('estadosDeCasos SÍ trae el estado del caso cerrado a pesar del permiso denegado en user_feedback',
      estados.some((e) => e.clave === cerrado.clave))

    const marcadas = BORRAB.marcarCasosCerrados(filas, estados)
    const filaCerrada = marcadas.find((f) => f.id === fCerrado.id)
    const filaAbierta = marcadas.find((f) => f.id === fAbierto.id)
    afirmar('la fila que cita el caso CERRADO queda marcada', (filaCerrada?.casosCerrados || []).some((c) => c.clave === cerrado.clave))
    afirmar('la fila que cita el caso ABIERTO NO queda marcada (no se inventa un cierre)', (filaAbierta?.casosCerrados || []).length === 0)

    const aviso = BORRAB.avisoCasoCerrado(filaCerrada.casosCerrados)
    afirmar('el aviso se puede imprimir y nombra el caso', typeof aviso === 'string' && aviso.includes(cerrado.clave))

    console.log('\n▸ 4. exactamente el código que corren backlog.cjs y flota.cjs, no una copia')
    // Import dinámico de la función real usada en producción, para no volver a duplicar el SQL
    // aquí (que es justo el error que esta ficha corrige).
    delete require.cache[require.resolve(path.join(REPO, 'lib', 'impugnaciones', 'borradorAbierto.cjs'))]
    afirmar('estadosDeCasos vive en un único módulo (no hay una copia en backlog.cjs/flota.cjs)',
      !fs.readFileSync(path.join(REPO, 'scripts', 'backlog.cjs'), 'utf8').includes('UNION ALL')
      && !fs.readFileSync(path.join(REPO, 'scripts', 'flota', 'flota.cjs'), 'utf8').includes('UNION ALL'))

  } catch (e) {
    console.error(`\n❌ la simulación no pudo completarse: ${String(e.message || e).slice(0, 300)}`)
    casos.push({ nombre: 'ejecución completa', ok: false })
  } finally {
    if (idsPropios.length) {
      const r = await sql`UPDATE public.session_questions SET status = 'withdrawn', withdrawn_reason = 'fila desechable de sim-embudo-fantasma' WHERE id = ANY(${idsPropios}) RETURNING id`
      console.log(`\n🧹 ${r.length} fila(s) desechable(s) retirada(s) (el rol no tiene DELETE — se marcan withdrawn)`)
    }
    try { await sql.end({ timeout: 5 }) } catch {}
  }

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  if (fallos.length) console.log('   ' + fallos.map((f) => f.nombre).join('\n   '))
  return fallos.length ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌', e); process.exit(1) })
