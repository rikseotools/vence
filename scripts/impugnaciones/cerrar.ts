#!/usr/bin/env npx tsx
/**
 * cerrar.ts — cierra UNA impugnación por el camino que exige el manual: el endpoint
 * `/api/v2/dispute/resolve` de producción, nunca un UPDATE directo.
 *
 * ## Por qué existe
 *
 * El manual (§6, §15) es tajante: cerrar con `UPDATE question_disputes` **no manda el email**
 * (el trigger que lo hacía se eliminó el 14/04/2026 porque fallaba en silencio), no concede el
 * euro de recompensa (§6.bis) y se salta la puerta de barajado (§0). Es decir, la impugnación
 * queda «cerrada» y el usuario no se entera de nada.
 *
 * Pero llamar al endpoint necesita un access token de admin, y hasta ahora eso se resolvía
 * improvisando un script suelto en cada sesión. Improvisar el camino de escritura es justo lo
 * que el registro de herramientas existe para evitar, así que queda aquí, con su firma estable.
 *
 * La identidad se acuña con el mismo `lib/sim/session` que usa la simulación: cookie de sesión
 * Auth.js → `/api/auth/token` → Bearer. El admin sale de `DISPUTE_ADMIN_EMAIL` (por defecto
 * manueltrader@gmail.com: es el que está en la whitelist del guard, no cualquier admin sirve).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/impugnaciones/cerrar.ts <dispute_id> \
 *     --estado resolved|rejected --mensaje <fichero.txt> [--psicotecnica] \
 *     [--sin-recompensa "<motivo>"] [--saltar-barajado "<motivo>"] [--aplicar]
 *
 * Sin `--aplicar` enseña lo que enviaría y no toca nada.
 */
import { readFileSync } from 'fs'
import { config } from 'dotenv'
import { tokenDeAdmin, ADMIN_POR_DEFECTO } from './lib/admin-token'

config({ path: '.env.local' })

const BASE = process.env.DISPUTE_BASE_URL || 'https://www.vence.es'
const ADMIN = process.env.DISPUTE_ADMIN_EMAIL || ADMIN_POR_DEFECTO

/** Reparte argv. Puro y exportado para poder testearlo sin red ni BD. */
export function parsearArgs(argv: string[]) {
  const valor = (f: string) => {
    const i = argv.indexOf(f)
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
  }
  const posicionales = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')))
  return {
    disputeId: posicionales[0] || null,
    estado: valor('--estado'),
    mensajeFichero: valor('--mensaje'),
    psicotecnica: argv.includes('--psicotecnica'),
    sinRecompensa: valor('--sin-recompensa'),
    saltarBarajado: valor('--saltar-barajado'),
    aplicar: argv.includes('--aplicar'),
  }
}

async function main() {
  const a = parsearArgs(process.argv.slice(2))
  if (!a.disputeId || !a.estado || !a.mensajeFichero) {
    console.error('uso: cerrar.ts <dispute_id> --estado resolved|rejected --mensaje <fichero.txt> [--aplicar]')
    process.exit(1)
  }
  if (a.estado !== 'resolved' && a.estado !== 'rejected') {
    console.error(`--estado tiene que ser resolved o rejected (llegó «${a.estado}»)`)
    process.exit(1)
  }
  const mensaje = readFileSync(a.mensajeFichero, 'utf8').trim()

  const cuerpo: Record<string, unknown> = {
    disputeId: a.disputeId,
    questionType: a.psicotecnica ? 'psychometric' : 'legislative',
    status: a.estado,
    adminResponse: mensaje,
  }
  if (a.sinRecompensa) cuerpo.skipRewardReason = a.sinRecompensa
  if (a.saltarBarajado) cuerpo.skipShuffleReason = a.saltarBarajado

  console.log(`\n── ${a.disputeId} → ${a.estado}${a.psicotecnica ? ' (psicotécnica)' : ''}`)
  console.log(`   endpoint: ${BASE}/api/v2/dispute/resolve · admin: ${ADMIN}`)
  if (a.sinRecompensa) console.log(`   sin recompensa: ${a.sinRecompensa}`)
  if (a.saltarBarajado) console.log(`   salta barajado: ${a.saltarBarajado}`)
  console.log('\n' + mensaje.split('\n').map((l) => '   │ ' + l).join('\n'))

  if (!a.aplicar) {
    console.log('\n(dry-run — repite con --aplicar para enviarlo)\n')
    return
  }

  const token = await tokenDeAdmin()
  const res = await fetch(`${BASE}/api/v2/dispute/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  })
  const out = await res.json().catch(() => ({}))
  console.log(`\nHTTP ${res.status}:`, JSON.stringify(out, null, 2))
  // El email es la mitad del trabajo: si no sale, la impugnación queda cerrada y el usuario
  // sin enterarse. Se canta en vez de dejarlo enterrado en el JSON.
  if (out?.success) {
    console.log(out.emailSent ? '\n✅ cerrada y email enviado' : `\n⚠️ cerrada pero SIN email: ${out.emailError || out.emailSkipReason || '?'}`)
  } else {
    process.exitCode = 1
  }
}

if (process.argv[1]?.endsWith('cerrar.ts')) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
