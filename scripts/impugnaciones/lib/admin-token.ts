// scripts/impugnaciones/lib/admin-token.ts
//
// Acuña el access token de admin que exigen `/api/v2/dispute/resolve` y
// `/api/v2/feedback/respond`. Vive aquí, y no dentro de cada script, porque los dos cierres
// necesitan la MISMA identidad: duplicarla es garantizar que un día divergen (una whitelist
// distinta, un TTL distinto) y que el fallo aparezca en el que menos se usa.
//
// Camino: cookie de sesión Auth.js (misma que usa `lib/sim/session`) → `/api/auth/token` →
// Bearer. El secreto NO está en `.env.local`: vive en SSM (`/vence-frontend/AUTH_SECRET`), así
// que el que llama lo pasa por entorno.
//
// GOTCHA: el admin es `manueltrader@gmail.com` por defecto porque es el que está en la
// whitelist del guard. Otro admin devuelve 403 aunque su cuenta sea de administrador.

import { Client } from 'pg'
import { mintOwnAuthCookie, sessionCookieNameFor } from '../../../lib/sim/session'

export const ADMIN_POR_DEFECTO = 'manueltrader@gmail.com'

export interface OpcionesToken {
  /** Base del entorno contra el que se cierra. Producción salvo que se diga otra cosa. */
  base?: string
  /** Email del admin. Tiene que estar en la whitelist del guard, no vale cualquiera. */
  admin?: string
}

/**
 * Igual que `tokenDeAdmin` pero devuelve también el `userId`. Lo necesita
 * `/api/v2/feedback/respond`, que además del Bearer exige `adminUserId` en el cuerpo (el de
 * impugnaciones lo saca del token). Se resuelve aquí para que ningún script lo copie a mano:
 * un uuid pegado en un script es un uuid que un día será el de otra persona.
 */
export async function identidadDeAdmin(opts: OpcionesToken = {}): Promise<{ token: string; userId: string }> {
  const token = await tokenDeAdmin(opts)
  const admin = opts.admin || process.env.DISPUTE_ADMIN_EMAIL || ADMIN_POR_DEFECTO
  const { pgConfig } = await import('../../../lib/db/pgSsl.cjs')
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  const { rows } = await c.query('select id from user_profiles where email = $1', [admin])
  await c.end()
  return { token, userId: rows[0].id }
}

export async function tokenDeAdmin(opts: OpcionesToken = {}): Promise<string> {
  const base = opts.base || process.env.DISPUTE_BASE_URL || 'https://www.vence.es'
  const admin = opts.admin || process.env.DISPUTE_ADMIN_EMAIL || ADMIN_POR_DEFECTO

  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error(
      'falta AUTH_SECRET. Sácalo de SSM:\n' +
      '  AUTH_SECRET="$(aws --profile vence --region eu-west-2 ssm get-parameter ' +
      '--name /vence-frontend/AUTH_SECRET --with-decryption --query Parameter.Value --output text)"',
    )
  }
  const host = new URL(base).hostname

  const { pgConfig } = await import('../../../lib/db/pgSsl.cjs')
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  const { rows } = await c.query('select id from user_profiles where email = $1', [admin])
  await c.end()
  if (!rows[0]) throw new Error(`no existe el usuario admin ${admin}`)

  const cookie = await mintOwnAuthCookie(
    { userId: rows[0].id, email: admin },
    secret,
    { nowSec: Math.floor(Date.now() / 1000), ttlSec: 900, host },
  )
  const res = await fetch(`${base}/api/auth/token`, {
    headers: { cookie: `${sessionCookieNameFor(host)}=${cookie}` },
  })
  const body = await res.json().catch(() => ({}))
  const token = body?.accessToken || body?.token || body?.access_token
  if (!token) {
    throw new Error(`/api/auth/token no devolvió token (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 200)}`)
  }
  return token
}
