/**
 * comprobar-reserva.ts — la puerta de T-474 conectada a la BD, compartida por los DOS cierres.
 *
 * `cerrar.ts` (impugnaciones) y `cerrar-feedback.ts` la llaman igual. Está en un solo sitio a
 * propósito: dos puertas al mismo recurso con criterios distintos no protegen, se contradicen —
 * que es exactamente el defecto que este trabajo arregla en `cola.cjs list`.
 *
 * El JUICIO es puro y vive en `lib/impugnaciones/puertaCierre.cjs`; aquí solo está el IO: leer la
 * fila, leer los latidos, imprimir y contar la fricción.
 *
 * **Fail-open** (principio 9): si no hay BD, o la consulta falla, o no se puede resolver el id de
 * sesión, se avisa y se deja pasar. Una avería de la observabilidad no puede impedir contestarle
 * a un usuario que lleva horas esperando.
 */
import { join } from 'path'
import { createRequire } from 'module'

const REPO = join(__dirname, '..', '..', '..')
// Emisor ÚNICO (T-542). Antes aquí vivía una copia privada del `spawn`; era una de las cinco que
// llevaron a que la sexta puerta —la de temario— naciera sin emitir nada.
const { emitirFriccion } = createRequire(__filename)(join(REPO, 'lib/sessions/friccion.cjs'))

export type Veredicto = { permitido: boolean; clase: string; motivo: string; comando?: string }

/** Cuenta el roce en el bus de fricción (`npm run sesiones:friccion`). Best-effort absoluto. */
function friccion(clase: 'guard_bloqueo' | 'guard_escape', detalle: string) {
  emitirFriccion({ clase, guard: 'cierre-cola', detalle })
}

/**
 * ¿Puede esta sesión cerrar esta fila?
 *
 * @param tabla       'question_disputes' | 'psychometric_question_disputes' | 'user_feedback'
 * @param id          id de la fila
 * @param igualmente  motivo declarado para saltarse la puerta (`--igualmente "…"`)
 */
export async function comprobarReserva(opts: {
  tabla: string
  id: string
  igualmente?: string | null
}): Promise<Veredicto> {
  const { tabla, id, igualmente } = opts
  const url = process.env.DATABASE_URL
  if (!url) {
    return { permitido: true, clase: 'sin_bd', motivo: 'sin DATABASE_URL: no se puede comprobar la reserva' }
  }
  const { puedeCerrar, comandoParaSatisfacer } = await import(join(REPO, 'lib', 'impugnaciones', 'puertaCierre.cjs'))
  const { resolverSid } = await import(join(REPO, 'lib', 'sessions', 'sid.cjs'))
  const sid = resolverSid({ repo: REPO }).sid

  let sql: any
  let fila: any = null
  let sesiones: any[] = []
  try {
    const postgres = (await import('postgres')).default
    sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 })
    const filas = await sql.unsafe(`SELECT claimed_by, claimed_at FROM public.${tabla} WHERE id = $1`, [id])
    fila = filas[0] || null
    sesiones = await sql`SELECT sid, last_signal_at FROM public.worktree_sessions`
  } catch (e: any) {
    return { permitido: true, clase: 'sin_bd', motivo: `no se pudo comprobar la reserva (${String(e.message).slice(0, 80)})` }
  } finally {
    await sql?.end?.().catch(() => {})
  }
  if (!fila) {
    // Que la fila no exista es problema de otro paso (el cierre fallará con su propio mensaje).
    return { permitido: true, clase: 'sin_fila', motivo: 'la fila no está en esa tabla' }
  }

  const v: Veredicto = puedeCerrar({
    claimedBy: fila.claimed_by,
    claimedAt: fila.claimed_at,
    sesiones,
    sid,
    igualmente,
  })
  if (!v.permitido) v.comando = v.comando || comandoParaSatisfacer(id)
  return v
}

/** Imprime el veredicto y cuenta la fricción. Devuelve si se puede seguir. */
export function anunciar(v: Veredicto, opts: { aplicar: boolean }): boolean {
  if (v.clase === 'escape') {
    console.log(`\n⚠️  PUERTA DE RESERVA RODEADA con --igualmente: «${v.motivo}»`)
    console.log('   (queda contado en el bus de fricción; si esto se repite, la puerta estorba y hay que revisarla)')
    if (opts.aplicar) friccion('guard_escape', v.motivo)
    return true
  }
  if (v.permitido) {
    if (v.clase !== 'tuya') console.log(`\nℹ️  reserva no comprobada: ${v.motivo}`)
    return true
  }
  console.log(`\n⛔ NO LA TIENES RESERVADA — ${v.motivo}`)
  if (v.clase === 'ajena') {
    console.log('   Otra sesión está trabajando este caso AHORA. Si cierras, le llega un segundo correo al usuario')
    console.log('   y el trabajo de la otra sesión se tira. Habla con ella o coge otro caso:')
    console.log('     node scripts/impugnaciones/cola.cjs next')
  } else {
    console.log('   Cerrar sin reservar es lo que provoca la colisión: mientras lo trabajabas, la cola le estaba')
    console.log('   ofreciendo este mismo caso a las demás sesiones. Resérvalo y repite:')
    console.log(`     ${v.comando}`)
  }
  console.log('   Escape (queda registrado): repite añadiendo  --igualmente "<motivo>"')
  if (opts.aplicar) friccion('guard_bloqueo', `${v.clase}: ${v.motivo}`)
  return false
}
