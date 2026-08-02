#!/usr/bin/env npx tsx
/**
 * cerrar-feedback.ts — responde o cierra UN feedback por `/api/v2/feedback/respond`, que es el
 * único camino que además de tocar la BD manda el email y la campana.
 *
 * ## Los dos modos, y por qué el silencioso es un modo y no un olvido
 *
 *   · **con mensaje** (`--mensaje f.txt`): responde, cierra y notifica. El flujo normal.
 *   · **silencioso** (`--silencioso`): cierra SIN escribir. El endpoint, sin `message`, no manda
 *     nada — es exactamente lo que hace falta cuando la persona ya no espera respuesta (un
 *     «gracias, lo pruebo» al final del hilo). Escribirle otra vez para decirle lo que ya sabe
 *     no es amabilidad, es ruido.
 *
 * Nace del cierre del hilo `6df1e69a` (31/07/2026): el usuario cerró con una cortesía y el hilo
 * se quedó `waiting_admin`, es decir, contando como pendiente en la cola de todos. Hasta ahora
 * eso se cerraba con un UPDATE a mano, que es justo lo que el manual prohíbe.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/impugnaciones/cerrar-feedback.ts <feedback_id> \
 *     [--mensaje <fichero.txt> | --silencioso] [--estado resolved|closed] [--aplicar]
 */
import { readFileSync } from 'fs'
import { config } from 'dotenv'
import { identidadDeAdmin, ADMIN_POR_DEFECTO } from './lib/admin-token'
import { comprobarReserva, anunciar } from './lib/comprobar-reserva'

config({ path: '.env.local' })

const BASE = process.env.DISPUTE_BASE_URL || 'https://www.vence.es'
const ADMIN = process.env.DISPUTE_ADMIN_EMAIL || ADMIN_POR_DEFECTO

/** Reparte argv. Pura y exportada: la decisión «silencioso vs con mensaje» se puede testear. */
export function parsearArgs(argv: string[]) {
  const valor = (f: string) => {
    const i = argv.indexOf(f)
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
  }
  const posicionales = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')))
  return {
    feedbackId: posicionales[0] || null,
    mensajeFichero: valor('--mensaje'),
    silencioso: argv.includes('--silencioso'),
    estado: valor('--estado') || 'resolved',
    // Escape de la puerta de reserva (T-474), con motivo obligatorio para poder revisarlo después.
    igualmente: valor('--igualmente'),
    aplicar: argv.includes('--aplicar'),
  }
}

async function main() {
  const a = parsearArgs(process.argv.slice(2))
  if (!a.feedbackId || (!a.mensajeFichero && !a.silencioso)) {
    console.error('uso: cerrar-feedback.ts <feedback_id> [--mensaje <f.txt> | --silencioso] [--aplicar]')
    process.exit(1)
  }
  if (a.mensajeFichero && a.silencioso) {
    console.error('--mensaje y --silencioso son excluyentes: o se le escribe o no')
    process.exit(1)
  }

  const cuerpo: Record<string, unknown> = { feedbackId: a.feedbackId, finalStatus: a.estado }
  if (a.mensajeFichero) cuerpo.message = readFileSync(a.mensajeFichero, 'utf8').trim()

  console.log(`\n── feedback ${a.feedbackId} → ${a.estado}${a.silencioso ? ' (SILENCIOSO: no se le escribe)' : ''}`)
  console.log(`   endpoint: ${BASE}/api/v2/feedback/respond · admin: ${ADMIN}`)
  if (cuerpo.message) console.log('\n' + String(cuerpo.message).split('\n').map((l) => '   │ ' + l).join('\n'))

  // Puerta de reserva (T-474): mismo criterio y mismo módulo que el cierre de impugnaciones.
  // El feedback lo necesita MÁS: era donde peor estaba (52 % de los cerrados en 14 días no había
  // pasado por reserva, frente al 17 % de las impugnaciones).
  const veredicto = await comprobarReserva({ tabla: 'user_feedback', id: a.feedbackId, igualmente: a.igualmente })
  const sePuede = anunciar(veredicto, { aplicar: a.aplicar })

  if (!a.aplicar) {
    console.log(sePuede ? '\n(dry-run — repite con --aplicar)\n' : '\n(dry-run — con --aplicar esto se habría abortado)\n')
    return
  }
  if (!sePuede) process.exit(1)

  // `adminUserId` va en el CUERPO (a diferencia de dispute/resolve, que lo saca del token).
  const { token, userId } = await identidadDeAdmin({ base: BASE, admin: ADMIN })
  const res = await fetch(`${BASE}/api/v2/feedback/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...cuerpo, adminUserId: userId }),
  })
  const out = await res.json().catch(() => ({}))
  console.log(`\nHTTP ${res.status}:`, JSON.stringify(out, null, 2))
  if (!out?.success) process.exitCode = 1
  else if (a.silencioso) console.log('\n✅ cerrado en silencio (sin email ni campana, a propósito)')
  else console.log(out.emailSent ? '\n✅ respondido y email enviado' : `\n⚠️ respondido pero SIN email: ${out.emailError || out.emailSkipReason || '?'}`)
}

if (process.argv[1]?.endsWith('cerrar-feedback.ts')) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
