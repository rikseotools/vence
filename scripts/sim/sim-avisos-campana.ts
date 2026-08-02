#!/usr/bin/env npx tsx
/**
 * ¿Vuelve a la campana un aviso que el usuario YA cerró? (T-480)
 *
 * Ejecuta la MISMA función que sirve el endpoint (`getOposicionAlertsFeed`) para
 * usuarios REALES que tienen avisos cerrados, y comprueba el invariante que la
 * usuaria echó en falta: **lo que cierras no vuelve**.
 *
 * Mide además el defecto ANTES del arreglo (lo que el feed viejo habría servido:
 * los 30 últimos avisos, cerrados incluidos), para que la mejora sea un número.
 *
 * Solo LEE. No escribe ni una fila.
 *
 * Uso:  npm run sim:avisos-campana
 *       npm run sim:avisos-campana -- --usuario <uuid>
 */
import postgres from 'postgres'
import { getOposicionAlertsFeed, avisoSigueEnLaCampana } from '../../lib/api/notifications/queries'

const FEED_LIMIT_VIEJO = 30

const argUsuario = (() => {
  const i = process.argv.indexOf('--usuario')
  return i > -1 ? process.argv[i + 1] : null
})()

const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false }, max: 2 })

async function main() {
  console.log('🔔 SIMULACIÓN — un aviso cerrado no vuelve a la campana\n')

  // Universo: quien tiene avisos CERRADOS es quien podía sufrir el defecto.
  const usuarios = argUsuario
    ? [{ user_id: argUsuario }]
    : await sql<{ user_id: string }[]>`
        SELECT user_id
        FROM user_oposicion_alerts
        WHERE read_at IS NOT NULL
        GROUP BY user_id
        ORDER BY count(*) DESC
        LIMIT 40`

  if (usuarios.length === 0) {
    console.log('⚠️  NO CONCLUYENTE — nadie ha cerrado ningún aviso todavía: no hay nada que comprobar.')
    await sql.end()
    process.exit(2)
  }

  let servidosAhora = 0
  let cerradosServidosAhora = 0
  let cerradosServidosAntes = 0
  let vivosPerdidosAntes = 0
  const culpables: string[] = []

  for (const { user_id } of usuarios) {
    // AHORA: la función real que usa el endpoint.
    const { data, unreadCount } = await getOposicionAlertsFeed(user_id)
    servidosAhora += data.length
    const colados = data.filter((a) => !avisoSigueEnLaCampana(a))
    cerradosServidosAhora += colados.length
    if (colados.length > 0) culpables.push(`${user_id.slice(0, 8)} (${colados.length})`)

    if (unreadCount !== data.length) {
      console.log(`   ⚠️  ${user_id.slice(0, 8)}: unreadCount=${unreadCount} pero sirve ${data.length}`)
    }

    // ANTES: los 30 últimos sin filtrar, que es lo que hacía el feed viejo.
    const viejo = await sql<{ read_at: Date | null }[]>`
      SELECT read_at FROM user_oposicion_alerts
      WHERE user_id = ${user_id} ORDER BY created_at DESC LIMIT ${FEED_LIMIT_VIEJO}`
    cerradosServidosAntes += viejo.filter((r) => r.read_at != null).length

    // Y el daño silencioso del orden equivocado: avisos VIVOS que el corte a 30
    // dejaba fuera porque los cerrados ocupaban su sitio.
    const [{ vivos }] = await sql<{ vivos: number }[]>`
      SELECT count(*)::int AS vivos FROM user_oposicion_alerts
      WHERE user_id = ${user_id} AND read_at IS NULL`
    const vivosQueLlegaban = viejo.filter((r) => r.read_at == null).length
    vivosPerdidosAntes += Math.max(0, Math.min(vivos, FEED_LIMIT_VIEJO) - vivosQueLlegaban)
  }

  console.log(`Usuarios comprobados (con avisos cerrados): ${usuarios.length}`)
  console.log(`Avisos servidos ahora por el feed real: ${servidosAhora}\n`)
  console.log(`ANTES → avisos YA CERRADOS que el feed devolvía: ${cerradosServidosAntes}`)
  if (vivosPerdidosAntes > 0) {
    console.log(`ANTES → avisos VIVOS que el corte dejaba fuera por su culpa: ${vivosPerdidosAntes}`)
  }
  console.log(`AHORA → avisos cerrados que se cuelan:            ${cerradosServidosAhora}`)

  if (cerradosServidosAhora > 0) {
    console.log(`\n❌ SIGUEN COLÁNDOSE en: ${culpables.slice(0, 10).join(', ')}`)
    await sql.end()
    process.exit(1)
  }

  console.log(
    `\n✅ VERDE — ningún aviso cerrado vuelve` +
      (cerradosServidosAntes > 0 ? ` (antes volvían ${cerradosServidosAntes}).` : '.'),
  )
  await sql.end()
  process.exit(0)
}

main().catch(async (e) => {
  console.error('💥 ERROR:', e)
  await sql.end().catch(() => {})
  process.exit(2)
})
