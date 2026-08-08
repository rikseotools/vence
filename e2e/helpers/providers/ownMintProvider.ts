// e2e/helpers/providers/ownMintProvider.ts — [T-713]
//
// Acuña la sesión con el MISMO camino que ya usan las simulaciones con navegador
// (`mintOwnAuthCookie` + `cookieForPlaywright`, en `lib/sim/session`): una cookie Auth.js
// firmada con `AUTH_SECRET`. Cero login manual y cero dependencia de Supabase.
//
// ── POR QUÉ HACÍA FALTA OTRO PROVEEDOR ──────────────────────────────────────
// Los dos que había se quedaron atrás del cutover:
//   · `bridge` acuña por **Supabase** (`auth.admin.generateLink` + `verifyOtp`) y confía en que
//     el bridge legacy hidrate la sesión Auth.js. Supabase quedó CONGELADO el 04/07/2026 y el
//     bridge está en drenaje: apoyar el harness ahí es apoyarlo en algo que se está apagando.
//   · `storage` exige un `captured.json` capturado A MANO. Sirve para una sesión de una persona;
//     no sirve para CI, que es donde estos tests tendrían que correr.
// Mientras tanto, `scripts/sim/*` YA acuñaban cookies Auth.js con `AUTH_SECRET` para hablar con
// producción. O sea: el camino bueno existía y el harness no lo usaba. Esto no inventa nada,
// solo conecta las dos piezas — que es justo lo que evita un tercer camino de identidad.
//
// ── LO QUE NECESITA ─────────────────────────────────────────────────────────
//   AUTH_SECRET      (SSM `/vence-frontend/AUTH_SECRET`) — firma la cookie
//   E2E_USER_ID      uuid de la cuenta con la que corre el harness
//   E2E_USER_EMAIL   opcional, solo para que el rastro sea legible
//
// La cookie lleva el claim de simulación que pone `mintOwnAuthCookie`, así que el tráfico del
// harness queda distinguible del de una persona real y no ensucia las métricas.

import type { Page } from '@playwright/test'
import type { SessionProvider } from '../sessionProvider'
import { mintOwnAuthCookie, cookieForPlaywright } from '../../../lib/sim/session'

export const ownMintProvider: SessionProvider = {
  name: 'own-mint',
  async authenticate(page: Page, { baseURL }) {
    const secret = process.env.AUTH_SECRET
    const userId = process.env.E2E_USER_ID
    if (!secret || !userId) {
      throw new Error(
        '[e2e] ownMintProvider necesita AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET) y ' +
          'E2E_USER_ID. Sin eso no puede firmar la cookie de sesión.',
      )
    }

    const host = new URL(baseURL).hostname
    const cookie = await mintOwnAuthCookie(
      { userId, email: process.env.E2E_USER_EMAIL || 'e2e@vence.es' },
      secret,
      { nowSec: Math.floor(Date.now() / 1000), host },
    )
    await page.context().addCookies([cookieForPlaywright(cookie, host)])
  },
}
