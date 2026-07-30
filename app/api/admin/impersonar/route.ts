// app/api/admin/impersonar/route.ts — T-289: ver la app como la ve un usuario concreto.
//
// POST   { userId, motivo? }  → acuña la sesión suplantada (cookie) y responde a dónde ir.
// DELETE                      → sale de la suplantación (borra la cookie).
//
// Las tres salvaguardas viven fuera de este fichero a propósito:
//   - **solo lectura** → en `verifyAuth`, el paso por el que pasan TODAS las APIs;
//   - **caducidad**    → en el propio token (30 min) y en el `maxAge` de la cookie;
//   - **auditoría**    → `observable_events`, que es donde ya miramos todo lo demás.
// Aquí solo se decide QUIÉN puede y se acuña.
//
// La cookie que se escribe es la MISMA de Auth.js: por eso la app entera —páginas, APIs,
// caché por usuario, badges— responde como le responde a esa persona. Es la diferencia con
// una pantalla de admin que imita la del usuario: aquella diverge con el tiempo (ya nos pasó
// con la tarjeta del vale), esta no puede divergir porque es la de verdad.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { encode } from 'next-auth/jwt'
import { sessionCookieNameFor } from '@/lib/sim/session'
import { isAdminEmail } from '@/lib/auth/adminEmails'
import { emitFireAndForget } from '@/lib/observability/emit'
import {
  decidirImpersonacion,
  payloadSesionImpersonada,
  TTL_IMPERSONACION_SEG,
} from '@/lib/admin/impersonacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const adminEmail = auth.user?.email ?? null

  const body = await request.json().catch(() => ({}))
  const objetivoUserId = String(body?.userId || '')
  const motivo = String(body?.motivo || '').trim() || null

  // Datos del objetivo: hacen falta para acuñar (email) y para decidir (¿es admin?).
  const db = getAdminDb()
  const res = await db.execute(
    sql`select email, full_name, plan_type from user_profiles where id = ${objetivoUserId} limit 1`,
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])
  const objetivoEmail: string | null = filas[0]?.email ?? null

  const decision = decidirImpersonacion({
    adminEmail,
    esAdmin: true, // ya lo garantizó requireAdmin
    objetivoUserId,
    objetivoEmail,
    objetivoEsAdmin: objetivoEmail ? isAdminEmail(objetivoEmail) : false,
  })
  if (!decision.ok) {
    emitFireAndForget({
      source: 'vercel',
      severity: 'warn',
      eventType: 'impersonacion_rechazada',
      endpoint: '/api/admin/impersonar',
      metadata: { admin: adminEmail, objetivo: objetivoUserId, motivo: decision.motivo },
    })
    return NextResponse.json(
      { error: decision.mensaje, motivo: decision.motivo },
      { status: decision.motivo === 'no_admin' ? 403 : 400 },
    )
  }
  if (!filas.length || !objetivoEmail) {
    return NextResponse.json({ error: 'usuario no encontrado' }, { status: 404 })
  }

  const secret = process.env.AUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'AUTH_SECRET no configurado' }, { status: 503 })
  }

  const host = request.headers.get('host') || 'www.vence.es'
  const cookieName = sessionCookieNameFor(host.split(':')[0])
  const nowSec = Math.floor(Date.now() / 1000)
  const token = payloadSesionImpersonada({
    objetivoUserId,
    objetivoEmail,
    adminEmail: adminEmail!,
    nowSec,
  })
  // El SALT del cifrado es el nombre real de la cookie en ese host: si no coincide con el
  // que espera la app, la sesión no se descifra y el navegador se queda deslogueado.
  const value = await encode({ token, secret, salt: cookieName, maxAge: TTL_IMPERSONACION_SEG })

  // AUDITORÍA. Entrar en la cuenta de una persona sin dejar rastro no es aceptable ni para
  // nosotros ni de cara al RGPD. Va antes de responder para que quede aunque el admin cierre.
  emitFireAndForget({
    source: 'vercel',
    severity: 'warn', // `warn` a propósito: no es un error, pero SÍ tiene que verse.
    eventType: 'impersonacion_iniciada',
    endpoint: '/api/admin/impersonar',
    userId: objetivoUserId,
    metadata: {
      admin: adminEmail,
      objetivoEmail,
      objetivoPlan: filas[0]?.plan_type ?? null,
      motivo,
      ttlSeg: TTL_IMPERSONACION_SEG,
      ip: request.headers.get('x-forwarded-for') || null,
    },
  })

  const respuesta = NextResponse.json({
    ok: true,
    verASu: { userId: objetivoUserId, email: objetivoEmail, nombre: filas[0]?.full_name ?? null },
    caducaEn: TTL_IMPERSONACION_SEG,
    ir: '/perfil',
  })
  respuesta.cookies.set(cookieName, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieName.startsWith('__Secure-'),
    path: '/',
    maxAge: TTL_IMPERSONACION_SEG,
  })
  return respuesta
}

async function _DELETE(request: NextRequest): Promise<NextResponse> {
  // Salir NO exige ser admin: si por lo que sea la sesión quedó suplantada, cualquiera tiene
  // que poder deshacerla. Borra la cookie y devuelve al login normal.
  const host = request.headers.get('host') || 'www.vence.es'
  const cookieName = sessionCookieNameFor(host.split(':')[0])
  emitFireAndForget({
    source: 'vercel',
    severity: 'info',
    eventType: 'impersonacion_terminada',
    endpoint: '/api/admin/impersonar',
  })
  const respuesta = NextResponse.json({ ok: true })
  respuesta.cookies.set(cookieName, '', { httpOnly: true, path: '/', maxAge: 0 })
  return respuesta
}

export const POST = withErrorLogging('/api/admin/impersonar', _POST)
export const DELETE = withErrorLogging('/api/admin/impersonar#salir', _DELETE)
export { _POST, _DELETE }
