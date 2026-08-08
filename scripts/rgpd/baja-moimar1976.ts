/**
 * Baja RGPD de moimar1976@gmail.com (feedback 069b17be) — 08/08/2026.
 *
 * Sigue `docs/maintenance/eliminacion-cuentas.md`: primero la fila en `deleted_users_log` con el
 * `deletion_reason` investigado, después el endpoint (que hace archivado legal + cascada + email
 * del Art. 12.3).
 *
 * Uso:  npx tsx --env-file=.env.local scripts/rgpd/baja-moimar1976.ts [--aplicar]
 */
import { tokenDeAdmin } from '../impugnaciones/lib/admin-token'
import { Client } from 'pg'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const APLICAR = process.argv.includes('--aplicar')
const USER_ID = '195b1996-f121-4ae1-8725-1c96bcadc23e'
const EMAIL = 'moimar1976@gmail.com'
const BASE = process.env.DISPUTE_BASE_URL || 'https://www.vence.es'

const RAZON = `MIGRACIÓN DE CUENTA: SE CAMBIÓ A OTRO CORREO Y COMPRÓ PREMIUM EN LA CUENTA NUEVA. NO ES UN ABANDONO.

=== PERFIL ===
- Moisés Martínez · moimar1976@gmail.com · Madrid
- Registro: 2026-05-29 (Auxiliar Administrativo de Madrid)
- Plan: free · sin suscripción · stripe_customer cus_Uzdv96dgvkT3IO (0 subs, 0 facturas: nunca pagó con esta cuenta)
- Antigüedad al pedir la baja: 70 días

=== CAPTACIÓN (user_acquisition, no registration_source) ===
- channel: direct · sin gclid/fbclid/utm · sin campaña de pago detrás
- última landing: /auxiliar-administrativo-madrid (07/08 17:09)
- NO viene de anuncio: la baja no es dinero de captación tirado

=== ACTIVIDAD ===
- 89 preguntas respondidas, 62 aciertos (70%)
- 6 días con actividad entre el 31/05 y el 07/08
- Última respuesta: 07/08 15:17, DOS HORAS ANTES de pedir la baja

=== COMUNICACIONES QUE LE ENVIAMOS ===
- 3 emails enviados, 1 abierto · 0 push
- Volumen bajo: no se le saturó, la baja no responde a exceso de correos

=== JOURNEY DEL DÍA (07/08/2026, reconstruido de user_interactions) ===
- 15:07-15:17 estudia con normalidad: dos tests personalizados del Tema 3 (Ley de Gobierno de Madrid)
- 17:17 entra en /perfil y de ahí a /soporte
- 17:18:22 envía la solicitud de soporte: «cambiar correo de acceso» (feedback 0fa244c2)
- 17:19 vuelve a /perfil
- 17:20:14 pasa el gate de retención («No me interesa estar al día, darme de baja»)
- 17:20:33 confirma escribiendo ELIMINAR → feedback 069b17be
- 17:20:43 cierra sesión
- 17:24:03 /auth/callback — entra con OTRA cuenta de Google
- 17:38:36 crea cuenta nueva: moimar76@hotmail.com (Moisés Martínez Martín)
- 17:45:00 COMPRA PREMIUM TRIMESTRAL en la cuenta nueva (activa hasta 2026-11-07, cuenta Nila)
- 08/08 07:09 sigue estudiando en la cuenta nueva (226 preguntas respondidas allí)

=== MOTIVO (inferido del comportamiento, no del texto del botón) ===
Quería cambiar el correo de acceso. Su cuenta entra con Google, así que el correo es el de Google
y no se puede cambiar desde Vence. Dos minutos después de preguntarlo pidió la baja, y dieciocho
minutos después se registró con otra cuenta de Google y pagó premium.

O sea: NO se va de Vence. Se muda de cuenta, y esta es la que deja atrás. La solicitud es
inequívoca (no aplica la excepción de «sigue usando la app»: esta cuenta no se ha vuelto a tocar
desde las 15:17, antes de pedir la baja).

=== HALLAZGO DE PRODUCTO ===
No existe forma de cambiar el correo de acceso, y tampoco un mensaje que lo explique. Este usuario
resolvió solo lo que quería —creando otra cuenta y pagando— pero perdió su progreso de 70 días por
el camino, y alguien menos decidido se habría ido. Un aviso en /perfil («tu acceso es con Google»)
o una vía de fusión de cuentas evitaría la baja.

=== ACCIÓN ===
Se borra ESTA cuenta (free, sin pagos). La cuenta nueva moimar76@hotmail.com, premium con
suscripción activa hasta noviembre, NO se toca.
Aprobado por Manuel el 08/08/2026.`

async function main() {
  const c = new Client(pgConfig())
  await c.connect()

  const perfil = (await c.query(
    `SELECT id, email, plan_type, created_at FROM user_profiles WHERE id=$1`, [USER_ID])).rows[0]
  if (!perfil) throw new Error('esa cuenta ya no existe')
  if (perfil.email !== EMAIL) throw new Error(`la cuenta ${USER_ID} es ${perfil.email}, no ${EMAIL}`)
  console.log(`Cuenta: ${perfil.email} · ${perfil.plan_type} · alta ${perfil.created_at.toISOString().slice(0, 10)}`)
  console.log(`deletion_reason: ${RAZON.length} caracteres\n`)

  if (!APLICAR) { console.log('(simulación: nada escrito — repite con --aplicar)'); await c.end(); return }

  const ya = (await c.query(
    `SELECT id FROM deleted_users_log WHERE original_user_id=$1`, [USER_ID])).rows[0]
  if (ya) {
    console.log('ℹ️  ya había fila en deleted_users_log — no se duplica')
  } else {
    await c.query(
      `INSERT INTO deleted_users_log (original_user_id, email, plan_type, registered_at, deleted_at, deletion_reason, requested_via)
       VALUES ($1,$2,$3,$4, now(), $5, 'feedback')`,
      [USER_ID, perfil.email, perfil.plan_type, perfil.created_at, RAZON])
    console.log('✅ registrada en deleted_users_log')
  }
  await c.end()

  const token = await tokenDeAdmin()
  const res = await fetch(`${BASE}/api/admin/delete-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId: USER_ID }),
  })
  console.log(`HTTP ${res.status}: ${await res.text()}`)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
