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
 * La impugnación puede vivir en dos tablas y el endpoint necesita saber en cuál. Eso NO se pide
 * ya por `--psicotecnica`: se mira en la BD, como hace el dossier. Ver `resolverTipo`.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/impugnaciones/cerrar.ts <dispute_id> \
 *     --estado resolved|rejected --mensaje <fichero.txt> [--psicotecnica] \
 *     [--sin-recompensa "<motivo>"] [--saltar-barajado "<motivo>"] [--aplicar]
 *
 *   CORREGIR una respuesta YA enviada (T-394) — no re-resuelve, no toca el estado y no vuelve a
 *   evaluar la recompensa; solo le escribe de nuevo y deja traza:
 *     … --correccion "<qué se corrige y por qué>" --mensaje <fichero.txt> --aplicar
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
    correccion: valor('--correccion'),
    aplicar: argv.includes('--aplicar'),
  }
}

export type TipoImpugnacion = 'legislative' | 'psychometric'

/**
 * Decide contra qué tabla se cierra, a partir de dónde EXISTE realmente la impugnación.
 *
 * Puro y exportado porque el fallo que corrige es silencioso y caro: sin `--psicotecnica`, una
 * impugnación psicotécnica se enviaba como legislativa y el endpoint contestaba
 * `404 "Impugnacion no encontrada"`. Ese texto se lee como «esa impugnación no existe» —te manda
 * a dudar del id— y no como «te falta un flag», que es lo que pasaba. Ocurrió el 31/07/2026
 * cerrando la impugnación de una serie numérica, con la respuesta ya redactada y aprobada.
 *
 * El flag se conserva, pero ya solo como declaración de intenciones: si contradice a la BD se
 * aborta en vez de mandar la petición que se sabe que va a fallar.
 */
export function resolverTipo(opts: {
  flagPsicotecnica: boolean
  enLegislativas: boolean
  enPsicotecnicas: boolean
}): { tipo: TipoImpugnacion; detectado: boolean } {
  const { flagPsicotecnica, enLegislativas, enPsicotecnicas } = opts
  if (!enLegislativas && !enPsicotecnicas) {
    throw new Error(
      'ese id no está en question_disputes ni en psychometric_question_disputes — revisa el id (no es que falte un flag)',
    )
  }
  // Dos filas con el mismo UUID en tablas distintas no debería ocurrir; si ocurre, manda lo que
  // se haya pedido a mano antes que una adivinanza.
  if (enLegislativas && enPsicotecnicas) {
    return { tipo: flagPsicotecnica ? 'psychometric' : 'legislative', detectado: false }
  }
  const real: TipoImpugnacion = enPsicotecnicas ? 'psychometric' : 'legislative'
  if (flagPsicotecnica && real === 'legislative') {
    throw new Error('pasaste --psicotecnica pero esa impugnación es legislativa: cerrarla así daría 404')
  }
  return { tipo: real, detectado: !flagPsicotecnica }
}

/**
 * Mira en las dos tablas. Si la BD no está accesible devuelve `null` y el script cae al flag
 * (comportamiento de siempre): quedarse sin poder cerrar por no poder MIRAR sería peor que el
 * defecto que esto arregla.
 */
async function dondeVive(disputeId: string): Promise<{ enLegislativas: boolean; enPsicotecnicas: boolean } | null> {
  const url = process.env.DATABASE_URL
  if (!url) return null
  let sql: any
  try {
    const postgres = (await import('postgres')).default
    sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 })
    const [leg] = await sql`SELECT 1 FROM question_disputes WHERE id = ${disputeId}`
    const [psy] = await sql`SELECT 1 FROM psychometric_question_disputes WHERE id = ${disputeId}`
    return { enLegislativas: !!leg, enPsicotecnicas: !!psy }
  } catch {
    return null
  } finally {
    await sql?.end?.().catch(() => {})
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

  const donde = await dondeVive(a.disputeId)
  let tipo: TipoImpugnacion
  let detectado = false
  if (donde) {
    ;({ tipo, detectado } = resolverTipo({ flagPsicotecnica: a.psicotecnica, ...donde }))
  } else {
    tipo = a.psicotecnica ? 'psychometric' : 'legislative'
    console.log('⚠️  BD no accesible: no se ha podido comprobar el tipo, se usa el flag.')
  }

  const cuerpo: Record<string, unknown> = {
    disputeId: a.disputeId,
    questionType: tipo,
    status: a.estado,
    adminResponse: mensaje,
  }
  if (a.sinRecompensa) cuerpo.skipRewardReason = a.sinRecompensa
  if (a.correccion) cuerpo.correccionDeRespuesta = a.correccion
  if (a.saltarBarajado) cuerpo.skipShuffleReason = a.saltarBarajado

  const etiqueta = tipo === 'psychometric' ? ' (psicotécnica)' : ''
  console.log(`\n── ${a.disputeId} → ${a.estado}${etiqueta}${detectado ? ' [tipo detectado en BD]' : ''}`)
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
