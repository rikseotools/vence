#!/usr/bin/env npx tsx
/**
 * sim-slot-dispositivo.ts — el slot de un aparato inactivo deja de bloquear a los 7 días.
 * (04/08/2026, sale de [T-418])
 *
 * ── POR QUÉ UNA SIMULACIÓN Y NO SOLO TESTS ──────────────────────────────────────────────────
 * La regla vive DENTRO de una función de PostgreSQL (`register_device`), así que un test de
 * JavaScript no puede verla: mockearía justo lo que hay que comprobar. Esto la EJECUTA contra la
 * base de datos real con un usuario efímero que se borra solo, y afirma las dos direcciones —que
 * el slot muerto libera y que el vivo sigue bloqueando—, porque una comprobación que solo mira
 * el caso bueno no distingue «funciona» de «ya no bloquea nada».
 *
 * Uso: npx tsx --env-file=.env.local scripts/sim/sim-slot-dispositivo.ts
 */
import { config } from 'dotenv'
import postgres from 'postgres'
import { randomUUID } from 'crypto'

config({ path: '.env.local' })

const sql = postgres(String(process.env.DATABASE_URL).replace(/[?&]sslmode=[^&]*/, ''), {
  ssl: { rejectUnauthorized: false },
  max: 1,
})

type Registro = { allowed: boolean; device_count: number; max_devices: number; existing_devices: string }

const registrar = async (userId: string, deviceId: string, label: string, huella: string | null = null) =>
  (await sql`SELECT * FROM register_device(${userId}::uuid, ${deviceId}, ${label}, ${huella})`)[0] as Registro

const casos: Array<{ nombre: string; ok: boolean; detalle: string }> = []
function afirmar(nombre: string, ok: boolean, detalle = '') {
  casos.push({ nombre, ok, detalle })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? ' — ' + detalle : ''}`)
}

async function main() {
  const userId = randomUUID()
  console.log('🔬 sim-slot-dispositivo · usuario efímero', userId.slice(0, 8))

  try {
    await sql`
      INSERT INTO user_profiles (id, email, plan_type)
      VALUES (${userId}::uuid, ${'sim-slot-' + userId.slice(0, 8) + '@vence.test'}, 'premium')`

    // 1) Dos aparatos, los dos recién usados: el tercero se rechaza. Es el comportamiento que NO
    //    debe cambiar — si esto deja de bloquear, el límite habría desaparecido sin avisar.
    await registrar(userId, 'dev-portatil', 'Chrome / Windows')
    await registrar(userId, 'dev-movil', 'Chrome / Android')
    const tercero = await registrar(userId, 'dev-tablet', 'Safari / iPad')
    afirmar('con dos aparatos VIVOS, el tercero se rechaza', tercero.allowed === false,
      `count=${tercero.device_count} · dice: "${tercero.existing_devices}"`)

    // 2) El portátil deja de usarse hace 10 días → su plaza se libera, y el tablet entra.
    await sql`
      UPDATE user_devices SET last_seen_at = now() - interval '10 days'
      WHERE user_id = ${userId}::uuid AND device_id = 'dev-portatil'`
    const conSlotLibre = await registrar(userId, 'dev-tablet', 'Safari / iPad')
    afirmar('un aparato sin usar hace 10 días deja de ocupar plaza', conSlotLibre.allowed === true,
      `count=${conSlotLibre.device_count}`)

    // 3) …y la FILA del portátil sigue ahí. Es la prueba de qué cuentas comparten aparato y la
    //    leen el barrido de fraude, el cupo compartido y el anti-autoreferido, con ventana de 30
    //    días. Borrarla a los 7 les recortaría la ventana sin que nadie lo pidiera.
    const [{ n }] = await sql`
      SELECT count(*)::int n FROM user_devices WHERE user_id = ${userId}::uuid AND device_id = 'dev-portatil'`
    afirmar('la fila del aparato inactivo NO se borra (el antifraude sigue viéndola)', n === 1)

    // 4) La frontera, por el lado de dentro: a los 6 días TODAVÍA ocupa plaza.
    await sql`
      UPDATE user_devices SET last_seen_at = now() - interval '6 days'
      WHERE user_id = ${userId}::uuid AND device_id = 'dev-portatil'`
    const enFrontera = await registrar(userId, 'dev-cuarto', 'Firefox / Linux')
    afirmar('a los 6 días todavía ocupa plaza (la frontera no se pasa de generosa)',
      enFrontera.allowed === false, `count=${enFrontera.device_count}`)

    // 5) El mensaje solo nombra a los que de verdad bloquean: decirle a alguien que desconecte un
    //    aparato que ya no le ocupa plaza es mandarle a hacer algo que no sirve de nada.
    await sql`
      UPDATE user_devices SET last_seen_at = now() - interval '30 days'
      WHERE user_id = ${userId}::uuid AND device_id = 'dev-portatil'`
    await sql`
      UPDATE user_devices SET last_seen_at = now()
      WHERE user_id = ${userId}::uuid AND device_id IN ('dev-movil', 'dev-tablet')`
    const mensaje = await registrar(userId, 'dev-quinto', 'Edge / Windows')
    afirmar('el aviso NO nombra el aparato que ya no ocupa plaza',
      mensaje.allowed === false && !mensaje.existing_devices.includes('Chrome / Windows'),
      `dice: "${mensaje.existing_devices}"`)
  } finally {
    // El usuario efímero se limpia SIEMPRE, también si algo revienta a media simulación.
    await sql`DELETE FROM user_devices WHERE user_id = ${userId}::uuid`
    await sql`DELETE FROM user_profiles WHERE id = ${userId}::uuid`
    await sql.end()
  }

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  if (fallos.length) process.exit(1)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
