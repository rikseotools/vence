// lib/referrals/notify.ts — Notificación al embajador de que ha GANADO dinero (email transaccional).
// El "badge" del icono 🎁 es server-side (getUnseenEarningsCount, vía reward_earnings). Este módulo es
// el empujón PROACTIVO por email. Vale para las 3 fuentes (referido/bug/ugc) — la MISMA vía, porque un
// bonus por feedback también es un ingreso nuevo. Best-effort: NUNCA lanza (no rompe pago ni creación).

import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'

const REASON: Record<string, string> = {
  referido: 'un usuario al que recomendaste Vence se ha hecho premium',
  bug: 'tu aviso de un fallo nos ha ayudado a mejorar la plataforma',
  ugc: 'tu opinión sobre Vence',
}

/** Envía al embajador un email avisando de que ha ganado dinero. Best-effort. */
export async function notifyEarning(
  userId: string | undefined | null,
  opts: { source: string; amount: number },
): Promise<void> {
  try {
    if (!userId || !process.env.RESEND_API_KEY || !(opts.amount > 0)) return
    const db = getReadDb()
    const res = await db.execute(sql`select email, full_name from user_profiles where id = ${userId} limit 1`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])
    const email = rows[0]?.email as string | undefined
    if (!email) return
    const name = String(rows[0]?.full_name || '').trim().split(' ')[0] || 'Embajador'
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'
    const reason = REASON[opts.source] || 'tu participación en el programa de embajadores'
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || 'Vence'} <${process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'}>`,
      to: email,
      subject: `🎁 ¡Has ganado ${opts.amount} € con Vence!`,
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.5">
  <h2 style="color:#2563eb;margin:0 0 12px">¡Enhorabuena, ${name}! 🎉</h2>
  <p style="margin:0 0 12px">Has ganado <strong>${opts.amount} €</strong> porque ${reason}.</p>
  <p style="margin:0 0 16px">Tu saldo se acumula y lo cobras cuando quieras en una <strong>tarjeta regalo de Amazon.es</strong>.</p>
  <p style="margin:0 0 20px"><a href="${site}/embajadores" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Ver mis recompensas</a></p>
  <p style="color:#6b7280;font-size:13px;margin:0">Gracias por ayudar a que más gente apruebe su oposición. 💙</p>
</div>`,
    })
    console.log(`🎁 [referrals] email de ganancia enviado (${opts.source} ${opts.amount}€)`)
  } catch (e) {
    console.warn('⚠️ [referrals] notifyEarning falló (best-effort):', (e as Error)?.message)
  }
}
