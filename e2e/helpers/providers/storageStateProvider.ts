// e2e/helpers/providers/storageStateProvider.ts
//
// Provider RUTA 2 (fiable, sin reversear el OAuth): reutiliza un estado de sesión
// CAPTURADO A MANO una sola vez. Flujo:
//   1. Login manual una vez (headed) → guardar cookies/localStorage en CAPTURED_STATE.
//   2. Este provider carga ese estado en el context; el setup lo re-guarda en
//      STORAGE_STATE para que todos los specs arranquen logueados.
//
// Es determinista y agnóstico del backend: solo aplica el estado del navegador que ya
// funcionaba. Cuando caduque la sesión, se re-captura (npm run e2e:login:capture).

import fs from 'node:fs'
import type { BrowserContext, Page } from '@playwright/test'
import type { SessionProvider } from '../sessionProvider'
import { CAPTURED_STATE } from '../../config/env'

type CookieList = Parameters<BrowserContext['addCookies']>[0]

interface StorageStateFile {
  cookies?: Array<Record<string, unknown>>
  origins?: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>
}

export const storageStateProvider: SessionProvider = {
  name: 'storage',
  async authenticate(page: Page, { baseURL }) {
    if (!fs.existsSync(CAPTURED_STATE)) {
      throw new Error(
        `[e2e] No hay sesión capturada en ${CAPTURED_STATE}.\n` +
        `Captúrala UNA vez con:  npm run e2e:login:capture\n` +
        `(abre un navegador, te logueas a mano, y se guarda el estado para reutilizarlo).`,
      )
    }
    const state = JSON.parse(fs.readFileSync(CAPTURED_STATE, 'utf8')) as StorageStateFile

    // Cookies directas al context.
    if (state.cookies?.length) {
      await page.context().addCookies(state.cookies as unknown as CookieList)
    }
    // localStorage por origen (la app hidrata la sesión desde la clave sb-<ref>-auth).
    for (const origin of state.origins ?? []) {
      await page.goto(origin.origin || baseURL)
      await page.evaluate((items) => {
        for (const { name, value } of items) window.localStorage.setItem(name, value)
      }, origin.localStorage)
    }
  },
}
