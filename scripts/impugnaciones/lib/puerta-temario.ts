/**
 * puerta-temario.ts — la Regla previa OBLIGATORIA de epígrafes/scope, EXIGIDA en el cierre.
 *
 * ## Por qué en el cierre y no en el dossier
 *
 * El dossier ya avisaba desde el 24/07 (`scope-enforcement.cjs`, el 🛑). El 04/08/2026 ese aviso
 * salió, se leyó, y la impugnación se analizó igual: es un aviso entre otras veinte líneas, y el
 * runbook de sesiones paralelas ya tiene nombre para eso — *«un aviso impreso entre otras diez
 * líneas no es una condición»*. La condición se pone donde está la escritura irreversible: el
 * email al usuario y, si procede, el euro. Mismo sitio que la puerta de reserva (T-474).
 *
 * ## Por qué esta puerta SÍ se puede satisfacer
 *
 * El 🛑 anterior exigía poner en orden la oposición ENTERA (21 temas en el caso que lo destapó)
 * para contestar a una persona que preguntaba por un artículo. Un bloqueo así se aprende a rodear.
 * Esta exige **solo los temas que sirven la pregunta impugnada** — uno o dos, minutos de trabajo —
 * y la deuda del resto se imprime como aviso.
 *
 * Fail-open donde no se puede afirmar nada: sin oposición del usuario, sin BD o sin poder
 * localizar el tema, avisa y deja pasar.
 */
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(__filename)
const ROOT = path.join(__dirname, '..', '..', '..')
const { esQuejaDeScope } = req(path.join(ROOT, 'scripts/impugnaciones/lib/scope-enforcement.cjs'))
const { evaluarRevisionTemario } = req(path.join(ROOT, 'lib/temario/revisionEpigrafe.cjs'))
const { reunirHechos } = req(path.join(ROOT, 'scripts/temario/revisar-oposicion.cjs'))
const { pgConfig } = req(path.join(ROOT, 'lib/db/pgSsl.cjs'))
const { Client } = req('pg')

/** Motivos de impugnación que van de temario aunque el texto no diga nada. */
const TIPOS_DE_SCOPE = new Set(['tema_incorrecto'])

export type VeredictoTemario = {
  permitido: boolean
  clase: string
  bloqueos: Array<{ code: string; detalle: string; comando?: string }>
  avisos: Array<{ code: string; detalle: string }>
  positionType?: string | null
}

export async function comprobarTemario({
  disputeId,
  tabla,
  igualmente,
}: {
  disputeId: string
  tabla: string
  igualmente?: string | null
}): Promise<VeredictoTemario> {
  const vacio = { bloqueos: [], avisos: [] as Array<{ code: string; detalle: string }> }
  let c: any
  try {
    c = new Client(pgConfig())
    await c.connect()

    const [d] = (
      await c.query(
        `SELECT d.question_id, d.dispute_type, d.description, up.target_oposicion
           FROM ${tabla} d LEFT JOIN user_profiles up ON up.id = d.user_id
          WHERE d.id = $1::uuid`,
        [disputeId],
      )
    ).rows

    if (!d) return { permitido: true, clase: 'no_encontrada', ...vacio }

    const esScope = TIPOS_DE_SCOPE.has(String(d.dispute_type)) || esQuejaDeScope(String(d.description || ''))
    if (!esScope) return { permitido: true, clase: 'no_aplica', ...vacio }

    if (!d.target_oposicion) {
      return {
        permitido: true,
        clase: 'sin_oposicion',
        bloqueos: [],
        avisos: [
          {
            code: 'sin_target_oposicion',
            detalle:
              'la queja va de temario y el usuario no tiene oposición fijada: la puerta no puede comprobar nada. ' +
              'Identifica su oposición y revisa el epígrafe a mano antes de responder.',
          },
        ],
      }
    }

    const hechos = await reunirHechos(c, d.target_oposicion, d.question_id)
    const v = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: hechos.temasAfectados,
      oposicion: hechos.oposicion,
      igualmente,
    })
    return {
      permitido: v.verde,
      clase: v.clase,
      bloqueos: v.bloqueos,
      avisos: v.avisos,
      positionType: d.target_oposicion,
    }
  } catch (e: any) {
    // Sin BD no se afirma nada (principio 9: fail-open en telemetría y en comprobaciones).
    return {
      permitido: true,
      clase: 'sin_bd',
      bloqueos: [],
      avisos: [{ code: 'sin_bd', detalle: `no se ha podido comprobar el temario: ${e.message}` }],
    }
  } finally {
    try { await c?.end() } catch {}
  }
}

/** Imprime el veredicto. Devuelve si se puede seguir. */
export function anunciarTemario(v: VeredictoTemario, { aplicar }: { aplicar: boolean }): boolean {
  if (v.clase === 'no_aplica') return true

  for (const a of v.avisos) console.log(`   ⚠️  temario [${a.code}]: ${a.detalle}`)

  if (v.permitido) {
    if (v.clase === 'escape') console.log('   🚪 puerta de temario SALTADA con motivo declarado (queda contado)')
    else if (v.clase === 'verde') console.log('   ✅ temario: lo que sirve esta pregunta está verificado contra el programa oficial')
    return true
  }

  console.log('\n   🛑 PUERTA DE TEMARIO — no se puede cerrar todavía:')
  for (const b of v.bloqueos) {
    console.log(`      [${b.code}] ${b.detalle}`)
    if (b.comando) console.log(`         → ${b.comando.replace('<position_type>', v.positionType || '<position_type>')}`)
  }
  console.log('      manual: docs/runbooks/verificar-epigrafes-scope.md')
  console.log('      escape con motivo: --temario-igualmente "<por qué>"')
  if (!aplicar) console.log('      (dry-run: con --aplicar esto habría abortado)')
  return false
}
