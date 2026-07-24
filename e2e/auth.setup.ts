// e2e/auth.setup.ts
//
// SETUP project: crea la sesión autenticada UNA vez y la guarda en STORAGE_STATE. El
// resto de proyectos autenticados dependen de él (dependencies: ['setup']) y reutilizan
// ese estado → los specs nunca se loguean.
//
// El CÓMO se autentica está detrás del contrato SessionProvider (agnóstico): hoy
// 'storage' (captura manual) o 'bridge' (mint programático); mañana 'koigrid'. Cambiar
// de entorno NO toca este fichero, solo E2E_SESSION_PROVIDER / E2E_BASE_URL.

import fs from 'node:fs'
import path from 'node:path'
import { test as setup, expect } from '@playwright/test'
import { getSessionProvider } from './helpers/sessionProvider'
import { E2E_BASE_URL, STORAGE_STATE } from './config/env'

setup('autenticar y guardar storageState', async ({ page }) => {
  const provider = getSessionProvider()
  await provider.authenticate(page, { baseURL: E2E_BASE_URL })

  // Validación: una página protegida NO debe redirigir a login. Si el provider no
  // hidrató la sesión (p.ej. el bridge no cuajó), esto falla con un mensaje claro.
  await page.goto('/perfil')
  await expect(page, `[e2e] La sesión no quedó autenticada con el provider "${provider.name}". ` +
    `Si es 'bridge' y no hidrata, usa E2E_SESSION_PROVIDER=storage (captura manual).`)
    .not.toHaveURL(/\/login|\/auth|\/$/)

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true })
  await page.context().storageState({ path: STORAGE_STATE })
})
