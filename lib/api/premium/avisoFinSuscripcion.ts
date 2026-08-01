// lib/api/premium/avisoFinSuscripcion.ts
//
// Campaña «tu suscripción se acaba y no se renovará» para la gente de la cuenta de cobro antigua.
// (T-448)
//
// ## Por qué NO es una copia del recordatorio de renovación
//
// `runRenewalReminderCampaign` avisa de un COBRO que viene y por eso excluye
// `cancel_at_period_end = true`. Esta avisa de lo contrario: un ACCESO que se apaga. Comparten
// cron, día y ventana, y **nunca le tocan a la misma persona el mismo día** (lo separa
// `debeAvisarFinSuscripcion`): decirle a alguien que se le va a cobrar y que se le va a apagar
// sería contradecirse en el mismo buzón.
//
// ## Dos decisiones que no son obvias
//
// 1. **Se envía con `sendEmailV2`, no con Resend en crudo.** El recordatorio viejo llama a Resend
//    directamente, así que no pasa por `canSendEmail` ni deja fila en `email_events`. Aquí sí:
//    la categoría es `soporte`, que es la única que atraviesa el botón de baja masiva ([T-369]) —
//    y buena parte de este público lo pulsó. Además el envío queda registrado, que es lo que
//    permitió cazar [T-422].
// 2. **La oferta se crea ANTES de enviar.** `asegurarOfertaHeredada` es idempotente y hasta ahora
//    solo se ejecutaba al pulsar el botón del perfil. Sin esto, el enlace del email llevaría a
//    `/premium/personal` y la persona leería «No tienes ningún precio de fidelidad activo»: el
//    peor final posible para un email que promete justo eso. Y de paso el importe del email sale
//    de su histórico REAL de Stripe, no de una tabla de precios supuesta.
import { getDb } from '@/db/client'
import { emailLogs } from '@/db/schema'
import { and, eq, gte, sql } from 'drizzle-orm'
import { newSignupAccount, resolveAccount } from '@/lib/stripe'
import { asegurarOfertaHeredada } from './ofertaHeredada'
import { getOfertaActiva, formatearImporte, ETIQUETA_INTERVALO } from './ofertas'
import { debeAvisarFinSuscripcion, debeAnularOferta, fechaLimiteRetorno, fechaLarga } from './finSuscripcion'
import { sendEmailV2 } from '@/lib/api/emails'
import { emitFireAndForget } from '@/lib/observability/emit'

const EMAIL_TYPE = 'fin_suscripcion_precio_heredado'
const CTA_URL = 'https://www.vence.es/premium/personal'

export interface CandidatoAviso {
  userId: string
  email: string
  nombre: string
  finPeriodo: string
}

export interface ResultadoCampana {
  candidatos: number
  enviados: number
  omitidos: number
  fallidos: number
  detalle: Array<{ email: string; estado: string; motivo?: string }>
}

/** Filas de un `db.execute`, venga el driver como venga. */
function filasDe(res: unknown): Record<string, unknown>[] {
  const r = (res as { rows?: unknown[] })?.rows
  return (Array.isArray(r) ? r : Array.isArray(res) ? res : []) as Record<string, unknown>[]
}

/**
 * Quién cumple HOY las tres condiciones. El filtro grueso va en SQL (una ventana ancha de días)
 * y el fino en el núcleo puro, que es donde está testeado: así el criterio no vive en dos sitios.
 */
export async function getPublicoFinSuscripcion(diasAntes = 3): Promise<CandidatoAviso[]> {
  const db = getDb()
  const cuentaNueva = newSignupAccount()
  const res = await db.execute(sql`
    SELECT s.user_id, p.email, p.full_name, p.payment_account,
           s.current_period_end, s.cancel_at_period_end
      FROM user_subscriptions s
      JOIN user_profiles p ON p.id = s.user_id
     WHERE s.cancel_at_period_end = true
       AND s.current_period_end BETWEEN now() AND now() + interval '10 days'
       AND p.email IS NOT NULL`)

  const ahora = new Date()
  return filasDe(res)
    .filter((r) =>
      debeAvisarFinSuscripcion(
        {
          enCuentaAntigua: resolveAccount(r.payment_account as string | null) !== cuentaNueva,
          seApaga: r.cancel_at_period_end === true,
          finPeriodo: r.current_period_end as string,
        },
        ahora,
        diasAntes,
      ),
    )
    .map((r) => ({
      userId: String(r.user_id),
      email: String(r.email),
      nombre: String(r.full_name || 'Usuario').split(' ')[0],
      finPeriodo: String(r.current_period_end),
    }))
}

/** ¿Ya se le avisó hace poco? Mismo mecanismo que el recordatorio hermano: `email_logs`. */
async function yaAvisado(userId: string): Promise<boolean> {
  try {
    const db = getDb()
    const previos = await db
      .select({ id: emailLogs.id })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.userId, userId),
          eq(emailLogs.emailType, EMAIL_TYPE),
          gte(emailLogs.sentAt, sql`now() - interval '10 days'`),
        ),
      )
      .limit(1)
    return previos.length > 0
  } catch {
    // Ante la duda NO se bloquea el envío: perder el aviso es peor que repetirlo, y Resend
    // deduplica por `idempotencyKey`. Mismo criterio que el recordatorio hermano.
    return false
  }
}

/**
 * Corre la campaña. `dryRun` NO crea ofertas ni envía nada: sirve para ver a quién llegaría y
 * con qué texto antes de tocar a nadie.
 */
export async function runCampanaFinSuscripcion(
  opciones: { diasAntes?: number; dryRun?: boolean } = {},
): Promise<ResultadoCampana> {
  const { diasAntes = 3, dryRun = true } = opciones
  const candidatos = await getPublicoFinSuscripcion(diasAntes)
  const r: ResultadoCampana = { candidatos: candidatos.length, enviados: 0, omitidos: 0, fallidos: 0, detalle: [] }

  for (const c of candidatos) {
    if (await yaAvisado(c.userId)) {
      r.omitidos++
      r.detalle.push({ email: c.email, estado: 'ya_avisado' })
      continue
    }

    // La oferta primero: sin ella el enlace del email lleva a una página vacía.
    let oferta = await getOfertaActiva(c.userId)
    if (!oferta && !dryRun) {
      const creada = await asegurarOfertaHeredada(c.userId)
      if (!creada.ok) {
        r.omitidos++
        r.detalle.push({ email: c.email, estado: 'sin_oferta', motivo: creada.motivo })
        continue
      }
      oferta = await getOfertaActiva(c.userId)
    }
    if (!oferta) {
      // En simulacro NO se ha creado la oferta (no se escribe nada), así que aquí solo se puede
      // decir «le llegaría, y antes habría que crearle la oferta». Contarlo además como omitido
      // —como hacía la primera versión— sumaba la misma persona dos veces y el informe decía
      // `enviaría=4 omitidos=4` sobre 4 candidatos. Un contador que se pisa a sí mismo no sirve
      // para decidir si la campaña fue bien.
      if (dryRun) {
        r.enviados++
        r.detalle.push({ email: c.email, estado: 'enviaría (creando antes su oferta)' })
      } else {
        r.omitidos++
        r.detalle.push({ email: c.email, estado: 'sin_oferta' })
      }
      continue
    }

    if (dryRun) {
      r.enviados++
      r.detalle.push({ email: c.email, estado: 'enviaria', motivo: `${formatearImporte(oferta.importeCentimos)} ${ETIQUETA_INTERVALO[oferta.intervalo]}` })
      continue
    }

    const envio = await sendEmailV2({
      userId: c.userId,
      emailType: EMAIL_TYPE,
      // Determinista por (persona + fin de periodo): un reintento del cron no manda dos correos,
      // pero si su fecha cambiara (reactivó y volvió a cancelar) el aviso nuevo SÍ sale.
      idempotencyKey: `fin-susc:${c.userId}:${c.finPeriodo}`,
      customData: {
        to: c.email,
        userName: c.nombre,
        fechaFin: fechaLarga(c.finPeriodo),
        importe: formatearImporte(oferta.importeCentimos),
        periodicidad: ETIQUETA_INTERVALO[oferta.intervalo],
        ctaUrl: CTA_URL,
      },
    })

    if (envio.success) {
      r.enviados++
      r.detalle.push({ email: c.email, estado: 'enviado' })
      try {
        await getDb().insert(emailLogs).values({
          userId: c.userId,
          emailType: EMAIL_TYPE,
          subject: `Tu Premium termina el ${fechaLarga(c.finPeriodo)}`,
          status: 'sent',
        })
      } catch { /* el log no puede tumbar una campaña que ya envió */ }
    } else if ('cancelled' in envio && envio.cancelled) {
      r.omitidos++
      r.detalle.push({ email: c.email, estado: 'preferencias', motivo: envio.reason })
    } else {
      r.fallidos++
      r.detalle.push({ email: c.email, estado: 'fallo', motivo: 'error' in envio ? envio.error : 'desconocido' })
    }
  }

  // Mismo punto ciego que vigila el recordatorio hermano: había gente a la que avisar y no salió
  // ni un correo. El heartbeat no lo ve (el cron sí disparó).
  if (!dryRun && r.candidatos > 0 && r.enviados === 0) {
    emitFireAndForget({
      source: 'vercel',
      severity: 'error',
      eventType: 'fin_suscripcion_aviso_zero_sent',
      endpoint: '/api/cron/renewal-reminders',
      errorMessage: `${r.candidatos} suscripción(es) se apagan en ${diasAntes} días y 0 avisos enviados (omitidos:${r.omitidos}, fallidos:${r.fallidos})`,
      metadata: { candidatos: r.candidatos, omitidos: r.omitidos, fallidos: r.fallidos },
    })
  }
  return r
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EL BARRIDO QUE HACE VERDAD EL AVISO (T-448)
//
// El email dice «si no lo haces, lo perderás». Eso solo es cierto si alguien se lo quita, y
// **no puede depender de que una persona se acuerde** — es la misma lección que hizo nacer
// `pause --tras-deploy` en el backlog: una condición que vive en la cabeza de alguien no es una
// condición. Corre en el mismo cron diario y usa `debeAnularOferta`, la MISMA frontera que se le
// prometió: ni un día antes.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface ResultadoAnulacion {
  candidatas: number
  anuladas: number
  abortado: boolean
  detalle: Array<{ email: string; finPeriodo: string; limite: string }>
}

/** Tope de seguridad: anular en masa no es un trámite, es señal de que el criterio se rompió. */
const TOPE_ANULACION = 50

export async function anularOfertasCaducadas(
  opciones: { dryRun?: boolean } = {},
): Promise<ResultadoAnulacion> {
  const { dryRun = true } = opciones
  const db = getDb()
  // Su última suscripción de la cuenta antigua fija la fecha desde la que cuenta el mes.
  const res = await db.execute(sql`
    SELECT o.id, p.email, max(s.current_period_end) AS fin
      FROM user_price_offers o
      JOIN user_profiles p ON p.id = o.user_id
      LEFT JOIN user_subscriptions s ON s.user_id = o.user_id
     WHERE o.redeemed_at IS NULL AND o.revoked_at IS NULL
     GROUP BY o.id, p.email`)

  const ahora = new Date()
  const caducadas = filasDe(res).filter((r) => debeAnularOferta(r.fin as string | null, ahora))
  const r: ResultadoAnulacion = {
    candidatas: caducadas.length,
    anuladas: 0,
    abortado: false,
    detalle: caducadas.map((x) => ({
      email: String(x.email),
      finPeriodo: String(x.fin).slice(0, 10),
      limite: fechaLarga(fechaLimiteRetorno(x.fin as string)),
    })),
  }

  if (caducadas.length > TOPE_ANULACION) {
    r.abortado = true
    emitFireAndForget({
      source: 'vercel',
      severity: 'error',
      eventType: 'anulacion_precio_fidelidad_abortada',
      endpoint: '/api/cron/renewal-reminders',
      errorMessage: `${caducadas.length} ofertas a anular de golpe (tope ${TOPE_ANULACION}): NO se ha tocado ninguna`,
      metadata: { candidatas: caducadas.length, tope: TOPE_ANULACION },
    })
    return r
  }

  if (dryRun) return r

  for (const c of caducadas) {
    await db.execute(sql`UPDATE user_price_offers SET revoked_at = now() WHERE id = ${c.id} AND revoked_at IS NULL`)
    r.anuladas++
  }
  if (r.anuladas > 0) {
    emitFireAndForget({
      source: 'vercel',
      severity: 'info',
      eventType: 'precio_fidelidad_anulado',
      endpoint: '/api/cron/renewal-reminders',
      metadata: { anuladas: r.anuladas },
    })
  }
  return r
}
