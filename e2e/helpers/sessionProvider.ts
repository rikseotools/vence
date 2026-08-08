// e2e/helpers/sessionProvider.ts
//
// CONTRATO de autenticación E2E (agnóstico). El resto del harness (fixtures, page
// objects, specs) NO sabe cómo se inicia sesión: solo consume un storageState ya
// autenticado. Cambiar el mecanismo de login (AWS/Auth.js hoy, koigrid mañana) =
// escribir un provider nuevo y apuntar E2E_SESSION_PROVIDER a él. Nada más cambia.

import type { Page } from '@playwright/test'
import { E2E_SESSION_PROVIDER } from '../config/env'
import { storageStateProvider } from './providers/storageStateProvider'
import { bridgeMintProvider } from './providers/bridgeMintProvider'
import { ownMintProvider } from './providers/ownMintProvider'

export interface SessionProvider {
  readonly name: string
  /**
   * Deja el `context` de `page` AUTENTICADO (cookies + storage). El setup guardará
   * después el storageState resultante. Debe lanzar con un mensaje accionable si no
   * puede autenticar (p.ej. falta captura o credenciales).
   */
  authenticate(page: Page, opts: { baseURL: string }): Promise<void>
}

const REGISTRY: Record<string, SessionProvider> = {
  storage: storageStateProvider,
  bridge: bridgeMintProvider,
  // [T-713] El que funciona HOY y el único que puede correr en CI: acuña la cookie Auth.js con
  // `AUTH_SECRET`, igual que las simulaciones con navegador de `scripts/sim/*`. `bridge` acuña
  // por Supabase (CONGELADO desde el 04/07) y `storage` exige una captura manual, así que
  // ninguno de los dos sirve sin una persona delante — que es por lo que los 6 specs de
  // `authed/` llevaban sin ejecutarse desde que existen.
  'own-mint': ownMintProvider,
  // koigrid: koigridProvider,   // ← futuro: 1 fichero, sin tocar tests
}

export function getSessionProvider(name = E2E_SESSION_PROVIDER): SessionProvider {
  const p = REGISTRY[name]
  if (!p) {
    throw new Error(
      `[e2e] SessionProvider desconocido: "${name}". Válidos: ${Object.keys(REGISTRY).join(', ')}. ` +
      `Configúralo con E2E_SESSION_PROVIDER.`,
    )
  }
  return p
}
