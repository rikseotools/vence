/**
 * puerta-embudo.ts — «Manuel ya respondió, y el cierre no lo mira». (T-609, 06/08/2026)
 *
 * ## El incidente que la motiva
 *
 * Un trabajador dejó cuatro preguntas en el embudo (`session_questions`) con el borrador de
 * rechazo para las cuatro impugnaciones de Manolo (arts. 108/110/112/114 CE). A las 06:16 UTC
 * Manuel respondió «NO ENVIAR TAL CUAL» a las cuatro. A las 06:24-06:26 OTRA sesión cerró tres
 * con `--igualmente` (saltándose además la puerta de RESERVA — ver [T-609] y `puertaCierre.cjs`)
 * y mandó el texto vetado. El veredicto llevaba 8 minutos en la BD; `cerrar.ts` nunca lo miró
 * porque no consulta el embudo en absoluto.
 *
 * ## Por qué busca en `question`+`context`, no solo en `draft_target`
 *
 * La ficha original asumía `kind='borrador'` con `draft_target` apuntando al id. MEDIDO contra
 * la fila real: eran `kind='pregunta'`, `draft_target IS NULL`, con el id de la impugnación
 * dentro de la PROSA de `question`. El núcleo puro (`lib/impugnaciones/embudoVeto.cjs`) busca en
 * las tres columnas a la vez — ver su cabecera para el detalle.
 *
 * ## Por qué bloquea y no solo avisa
 *
 * `borradorAbierto.cjs` (T-588) avisa sin bloquear porque el daño de un duplicado es reescribir
 * trabajo. Aquí el daño es un correo YA vetado que sale igual — irreversible — así que esta
 * puerta sigue el mismo patrón que la de RESERVA y la de TEMARIO: bloquea, con escape propio y
 * contado (`--embudo-igualmente`).
 *
 * Fail-open donde no se puede afirmar nada (sin BD): avisa y deja pasar, igual que las otras dos
 * puertas de este cierre.
 */
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(__filename)
const ROOT = path.join(__dirname, '..', '..', '..')
const { respuestasQueVetan } = req(path.join(ROOT, 'lib/impugnaciones/embudoVeto.cjs'))
const { pgConfig } = req(path.join(ROOT, 'lib/db/pgSsl.cjs'))
const { Client } = req('pg')
// Emisor ÚNICO (T-542) — ver la cabecera de `puerta-temario.ts` para el porqué de no copiarlo.
const { emitirFriccion } = req(path.join(ROOT, 'lib/sessions/friccion.cjs'))

export type FilaVetada = { id: number; sid: string; answer: string; answered_at: string; answered_by?: string }

export type VeredictoEmbudo = {
  permitido: boolean
  clase: 'sin_bd' | 'sin_veto' | 'vetado' | 'escape'
  filas: FilaVetada[]
  motivo?: string
}

export async function comprobarEmbudo({
  disputeId,
  igualmente,
}: {
  disputeId: string
  igualmente?: string | null
}): Promise<VeredictoEmbudo> {
  let c: any
  try {
    c = new Client(pgConfig())
    await c.connect()
    // Tabla pequeña (decenas de filas, T-609 medido 06/08: 53 `answered_at IS NOT NULL` sobre 75
    // totales) — se filtra por PROSA en JS, igual que `borradorAbierto.cjs`, porque el id no vive
    // en una columna propia y un ILIKE dinámico por cada forma posible sería más frágil que traer
    // las filas y dejar que el núcleo puro decida.
    const { rows } = await c.query(
      `SELECT id, sid, question, context, draft_target, answer, answered_at, answered_by
         FROM session_questions
        WHERE answered_at IS NOT NULL`,
    )
    const vetadas = respuestasQueVetan(rows, disputeId) as FilaVetada[]
    if (!vetadas.length) return { permitido: true, clase: 'sin_veto', filas: [] }
    if (typeof igualmente === 'string' && igualmente.trim()) {
      return { permitido: true, clase: 'escape', filas: vetadas, motivo: igualmente.trim() }
    }
    return { permitido: false, clase: 'vetado', filas: vetadas }
  } catch (e: any) {
    // Fail-open (principio 9): sin BD no se puede afirmar que exista un veto, ni que no exista.
    return {
      permitido: true,
      clase: 'sin_bd',
      filas: [],
      motivo: `no se ha podido comprobar el embudo: ${e.message}`,
    }
  } finally {
    try { await c?.end() } catch {}
  }
}

/** Imprime el veredicto y CUENTA la fricción. Devuelve si se puede seguir. */
export function anunciarEmbudo(v: VeredictoEmbudo, { aplicar }: { aplicar: boolean }): boolean {
  if (v.clase === 'sin_veto') return true

  // ── SIN BD NO SE PASA, y aquí el fail-open habitual sería justo lo contrario de esta puerta ──
  // El resto del andamiaje deja pasar cuando no alcanza la BD, y está bien razonado: la avería de
  // un sistema de observación no puede parar a quien está delante. Pero esto NO observa, DECIDE si
  // sale un correo hacia una persona — y `cerrar.ts` no manda por BD, manda por HTTP contra
  // `/api/v2/dispute/resolve` con el token de admin. Verificado el 06/08 al rescatar esta ficha:
  // con `DATABASE_URL` ausente la puerta devolvía `permitido` y el envío seguía su camino, o sea
  // que el hueco que T-609 vino a cerrar seguía abierto para cualquier sesión con la BD caída.
  //
  // La asimetría que razona `embudoVeto.cjs` decide el sentido: un falso «sí» manda un correo
  // vetado (irreversible); un falso «no» cuesta un `--embudo-igualmente` con motivo, que ya existe
  // y queda contado. Mismo criterio que [T-615] (§6.ter.bis de `sistema-sesiones-paralelas.md`):
  // fail-open es para la OPERACIÓN, nunca para el VEREDICTO.
  if (v.clase === 'sin_bd') {
    console.log(`\n   🛑 PUERTA DEL EMBUDO — NO SE HA PODIDO COMPROBAR si hay un veto: ${v.motivo}`)
    console.log('      No se pasa: esta puerta decide si sale un correo hacia una persona, y el')
    console.log('      cierre no necesita la BD para enviarlo (va por HTTP). Arregla la conexión —')
    console.log('      normalmente es lanzarlo con `npx tsx --env-file=.env.local …` — o, si de')
    console.log('      verdad hay que enviar sin poder mirar: --embudo-igualmente "<por qué>"')
    if (aplicar) {
      emitirFriccion({ clase: 'guard_bloqueo', guard: 'embudo', detalle: `sin_bd: ${v.motivo || 'sin motivo legible'}` })
    }
    if (!aplicar) console.log('      (dry-run: con --aplicar esto habría abortado)')
    return false
  }

  if (v.clase === 'escape') {
    console.log('   🚪 puerta del embudo SALTADA con motivo declarado (queda contado en el bus de fricción;')
    console.log('      si esto se repite, la puerta estorba y hay que revisarla)')
    if (aplicar) emitirFriccion({ clase: 'guard_escape', guard: 'embudo', detalle: v.motivo || 'sin motivo legible' })
    return true
  }

  // vetado
  if (aplicar) {
    emitirFriccion({
      clase: 'guard_bloqueo',
      guard: 'embudo',
      detalle: `${v.filas.length} respuesta(s) del embudo vetan este envío`,
    })
  }
  console.log('\n   🛑 PUERTA DEL EMBUDO — hay una respuesta que VETA este envío, y no se ha consultado:')
  for (const f of v.filas) {
    console.log(`      #${f.id} (${f.answered_by || '?'}, ${f.answered_at}):`)
    console.log('      │ ' + String(f.answer).split('\n').join('\n      │ '))
  }
  console.log('      Léela ANTES de decidir. Si de verdad hay que enviar igual (el veto ya no aplica,')
  console.log('      se habló por otro canal…), escape con motivo: --embudo-igualmente "<por qué>"')
  if (!aplicar) console.log('      (dry-run: con --aplicar esto habría abortado)')
  return false
}
