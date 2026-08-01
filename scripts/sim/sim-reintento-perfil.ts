/**
 * scripts/sim/sim-reintento-perfil.ts — SIMULACIÓN del reintento de resolución de perfil (T-434),
 * contra la BASE DE DATOS REAL.
 *
 * ## Qué prueba, y por qué los unitarios no bastan
 *
 * El núcleo puro (`lib/auth/reintentoPerfil.ts`) decide CUÁNDO reintentar y se prueba con 15
 * unitarios sin tocar nada. Lo que no se puede probar así es lo que ocurre **contra Postgres**:
 *
 *   · que resolver a un usuario YA existente devuelva su id y no cree un segundo perfil
 *     —el peor fallo posible aquí: «un usuario hereda los datos de otro»—;
 *   · que **varias pestañas a la vez** del mismo usuario roto acaben con UN solo perfil. Esto es
 *     nuevo con T-434: antes la resolución ocurría una vez por sesión, ahora puede ocurrir en
 *     paralelo. Quien lo corta es el índice único sobre `lower(email)`, y la prueba de que el
 *     código trata bien el 23505 resultante SOLO existe si se ejerce de verdad.
 *
 * ## No deja basura
 *
 * Crea perfiles efímeros con un prefijo reconocible y los borra al terminar, pase lo que pase
 * (incluido si un caso falla). Al final comprueba que no queda ninguno y lo dice.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sim/sim-reintento-perfil.ts
 */
import { Client } from 'pg'
import { decidirReintentoPerfil, CAMPO_REINTENTO, VENTANA_REINTENTO_S } from '../../lib/auth/reintentoPerfil'
import { resolverPerfilPorEmail } from '../../lib/auth/resolveAppUser'

const MARCA = `sim-t434-${Date.now()}`
const AHORA = Math.floor(Date.now() / 1000)

let fallos = 0
function comprobar(nombre: string, ok: boolean, detalle: string) {
  if (!ok) fallos++
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}`)
  console.log(`      ${detalle}`)
}

async function main() {
  const url = process.env.DATABASE_URL!
  const c = new Client({ connectionString: url.split('?')[0], ssl: { rejectUnauthorized: false } })
  await c.connect()

  const emails: string[] = []
  const nuevo = (n: string) => {
    const e = `${MARCA}-${n}@example.invalid`
    emails.push(e)
    return e
  }

  console.log(`\n══ SIMULACIÓN del reintento de perfil (T-434) ${'═'.repeat(28)}`)
  console.log(`   contra la BD real · marca de limpieza: ${MARCA}\n`)

  try {
    // ── 1. Usuario NUEVO: la sesión trae email y no hay perfil → se crea ──────────────────
    console.log('1) Alta nueva: hay email y no hay perfil')
    const e1 = nuevo('alta')
    const d1 = decidirReintentoPerfil({ email: e1 }, AHORA)
    const r1 = await resolverPerfilPorEmail(e1, 'Sim Alta')
    const fila1 = await c.query('select id from user_profiles where lower(email)=$1', [e1])
    comprobar(
      'se decide reintentar y se crea UN perfil',
      d1.accion === 'reintentar' && r1.motivo === 'creado' && !!r1.id && fila1.rows.length === 1 && fila1.rows[0].id === r1.id,
      `decision=${d1.accion} motivo=${r1.motivo} filas=${fila1.rows.length}`,
    )

    // ── 2. EL CASO DE LOS 235: perfil que YA existe y sesión sin resolver → se cura ───────
    console.log('\n2) Usuario ya roto: su perfil existe y la sesión no lo tiene (los 235)')
    const d2 = decidirReintentoPerfil({ email: e1 }, AHORA)
    const r2 = await resolverPerfilPorEmail(e1, 'Sim Alta')
    const fila2 = await c.query('select count(*)::int n from user_profiles where lower(email)=$1', [e1])
    comprobar(
      'devuelve SU id existente y NO crea un segundo perfil',
      d2.accion === 'reintentar' && r2.motivo === 'existia' && r2.id === r1.id && fila2.rows[0].n === 1,
      `motivo=${r2.motivo} mismo_id=${r2.id === r1.id} perfiles=${fila2.rows[0].n}`,
    )

    // ── 3. Insensible a mayúsculas: la misma persona escrita distinto es la misma ─────────
    console.log('\n3) El mismo email en MAYÚSCULAS es la misma persona')
    const r3 = await resolverPerfilPorEmail(e1.toUpperCase(), 'Sim Alta')
    const fila3 = await c.query('select count(*)::int n from user_profiles where lower(email)=$1', [e1])
    comprobar(
      'devuelve el mismo id y sigue habiendo UN perfil',
      r3.id === r1.id && fila3.rows[0].n === 1,
      `motivo=${r3.motivo} mismo_id=${r3.id === r1.id} perfiles=${fila3.rows[0].n}`,
    )

    // ── 4. LA CARRERA: varias pestañas del mismo usuario roto, a la vez ───────────────────
    //    Es lo que T-434 estrena y lo único que no se puede probar sin concurrencia real.
    console.log('\n4) CARRERA: 6 peticiones simultáneas para un email que no existe')
    const e4 = nuevo('carrera')
    const carrera = await Promise.all(
      Array.from({ length: 6 }, () => resolverPerfilPorEmail(e4, 'Sim Carrera')),
    )
    const filas4 = await c.query('select count(*)::int n from user_profiles where lower(email)=$1', [e4])
    const ids = new Set(carrera.map((r) => r.id))
    const motivos = carrera.map((r) => r.motivo)
    comprobar(
      'queda UN solo perfil y las 6 devuelven el MISMO id',
      filas4.rows[0].n === 1 && ids.size === 1 && !ids.has(null),
      `perfiles=${filas4.rows[0].n} ids_distintos=${ids.size} motivos=${JSON.stringify(motivos)}`,
    )
    comprobar(
      'ninguna se salda con error (el 23505 de las perdedoras se trata como «otro lo creó»)',
      carrera.every((r) => r.motivo === 'creado' || r.motivo === 'creado_por_otro' || r.motivo === 'existia'),
      `motivos=${JSON.stringify(motivos)}`,
    )

    // ── 5. La ventana: tras un intento, no se insiste en la siguiente carga ───────────────
    console.log('\n5) La ventana entre reintentos')
    const enEspera = decidirReintentoPerfil({ email: nuevo('espera'), [CAMPO_REINTENTO]: AHORA - 5 }, AHORA)
    const yaToca = decidirReintentoPerfil({ email: 'x@y.com', [CAMPO_REINTENTO]: AHORA - VENTANA_REINTENTO_S }, AHORA)
    comprobar(
      'recién intentado espera; pasada la ventana vuelve a intentarlo',
      enEspera.accion === 'en_espera' && yaToca.accion === 'reintentar',
      `recien=${enEspera.accion} pasada=${yaToca.accion}`,
    )

    // ── 6. Sin email no se inventa nada ──────────────────────────────────────────────────
    console.log('\n6) Sesión sin email')
    const sinEmail = decidirReintentoPerfil({ sub: 'google-123' } as never, AHORA)
    const rSin = await resolverPerfilPorEmail(null)
    comprobar(
      'se distingue de un fallo y no toca la base de datos',
      sinEmail.accion === 'sin_email' && rSin.motivo === 'sin_email' && rSin.id === null,
      `decision=${sinEmail.accion} motivo=${rSin.motivo}`,
    )

    // ── 7. El usuario sano no paga nada ──────────────────────────────────────────────────
    console.log('\n7) Usuario sano (el 99,9% del tráfico)')
    const sano = decidirReintentoPerfil({ appUserId: r1.id!, email: e1 }, AHORA)
    comprobar(
      'no se consulta la base de datos siquiera',
      sano.accion === 'ya_resuelto',
      `decision=${sano.accion}`,
    )
  } finally {
    // Limpieza pase lo que pase.
    const del = await c.query('delete from user_profiles where lower(email) like $1 returning id', [`${MARCA}%`])
    const quedan = await c.query('select count(*)::int n from user_profiles where lower(email) like $1', [`${MARCA}%`])
    console.log(`\n🧹 limpieza: ${del.rowCount} perfil(es) efímero(s) borrado(s), quedan ${quedan.rows[0].n}`)
    if (quedan.rows[0].n !== 0) fallos++
    await c.end()
  }

  console.log(`\n${'═'.repeat(72)}`)
  console.log(fallos === 0 ? '✅ SIMULACIÓN VERDE\n' : `❌ ${fallos} comprobación(es) FALLIDA(s)\n`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('❌ la simulación reventó:', e)
  process.exit(1)
})
