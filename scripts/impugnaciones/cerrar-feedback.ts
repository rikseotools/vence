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
import { comprobarVivo, anunciarVivo } from './lib/puerta-vivo'
const { exigirPersona } = require('../../lib/sessions/aprobacion.cjs')

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
    // Escape de la puerta de «está vivo» (T-678): exige contar CÓMO se comprobó.
    vivoIgualmente: valor('--vivo-igualmente'),
    aplicar: argv.includes('--aplicar'),
  }
}

async function main() {
  const a = parsearArgs(process.argv.slice(2))
  // Lo que sale hacia una persona lo aprueba una persona (T-486): esto le escribe por correo a
  // quien mandó el feedback. Un trabajador autónomo deja el borrador, no lo envía.
  if (!exigirPersona('feedback')) process.exit(4)
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
  const sePuedeReserva = anunciar(veredicto, { aplicar: a.aplicar })

  // Puerta de «ESTÁ VIVO» (T-678). Aquí es donde salió el correo que la motiva: a Esther se le
  // dijo «ya está corregido» con el arreglo en `main` y sin desplegar. Se comprueba también en
  // dry-run — enterarte después de redactar y aprobar no sirve de nada.
  const sePuedeVivo = cuerpo.message
    ? anunciarVivo(await comprobarVivo(a.feedbackId!, String(cuerpo.message)), { igualmente: a.vivoIgualmente })
    : true

  const sePuede = sePuedeReserva && sePuedeVivo

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
  // Cerrar RETIRA el borrador del embudo (T-486). Mismo criterio que el gemelo de impugnaciones,
  // importado y no copiado: si se copia, el día que cambie uno se queda atrás y vuelve la señal
  // fantasma que el 06/08 tuvo a Manuel con 15 borradores de casos ya enviados.
  if (out?.success) await retirarBorradorDelEmbudo(a.feedbackId, 'feedback contestado')
}


/** Gemelo del de `cerrar.ts`: el criterio vive en lib/sessions/retirarBorrador.cjs, no aquí. */
async function retirarBorradorDelEmbudo(casoId: string, motivo: string): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) return
  let sql: any = null
  try {
    const postgres = (await import('postgres')).default
    sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retirarBorradoresDe } = require('../../lib/sessions/retirarBorrador.cjs')
    const n = await retirarBorradoresDe(sql, casoId, motivo)
    if (n > 0) console.log(`   🧹 ${n} borrador(es) retirados del embudo: ya no hacen falta`)
  } catch { /* el cierre ya está hecho: esto nunca puede tumbarlo */ } finally {
    try { await sql?.end({ timeout: 5 }) } catch {}
  }
}

if (process.argv[1]?.endsWith('cerrar-feedback.ts')) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
