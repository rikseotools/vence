// e2e/helpers/providers/bridgeMintProvider.ts
//
// Provider RUTA 1 (cero login manual): acuña una sesión de forma programática y la
// inyecta en el navegador — el mismo truco que usamos para responder feedbacks
// (generateLink + verifyOtp). Por el BRIDGE (AUTH_BRIDGE_ENABLED), un Bearer Supabase
// válido basta para que el cliente monte la sesión Auth.js.
//
// ⚠️ Se VALIDA en la primera ejecución: si el cliente no hidrata la sesión desde la
// clave sb-<ref>-auth, el setup lo detecta (la página protegida redirige a login) y
// cae al provider 'storage'. No damos por hecho que hidrata: es un spike hasta correrlo.

import type { Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { SessionProvider } from '../sessionProvider'
import { E2E_ACCOUNT } from '../../config/env'

function projectRef(supabaseUrl: string): string {
  // https://<ref>.supabase.co → <ref>
  return new URL(supabaseUrl).hostname.split('.')[0]
}

export const bridgeMintProvider: SessionProvider = {
  name: 'bridge',
  async authenticate(page: Page, { baseURL }) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anon || !service || !E2E_ACCOUNT.email) {
      throw new Error(
        '[e2e] bridgeMintProvider necesita NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, ' +
        'SUPABASE_SERVICE_ROLE_KEY y E2E_USER_EMAIL. Si no, usa E2E_SESSION_PROVIDER=storage.',
      )
    }

    // 1. Acuñar sesión Supabase para la cuenta E2E (magic link → verifyOtp).
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { data: link, error: e1 } = await admin.auth.admin.generateLink({
      type: 'magiclink', email: E2E_ACCOUNT.email,
    })
    if (e1 || !link?.properties?.hashed_token) throw new Error(`[e2e] generateLink falló: ${e1?.message}`)

    const anonClient = createClient(url, anon, { auth: { persistSession: false } })
    const { data: ses, error: e2 } = await anonClient.auth.verifyOtp({
      token_hash: link.properties.hashed_token, type: 'magiclink',
    })
    if (e2 || !ses?.session) throw new Error(`[e2e] verifyOtp falló: ${e2?.message}`)

    // 2. Inyectar la sesión en el localStorage del app (clave que lee el cliente).
    const ref = projectRef(url)
    const storageKey = `sb-${ref}-auth`
    await page.goto(baseURL)
    await page.evaluate(
      ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
      { key: storageKey, session: ses.session },
    )
  },
}
