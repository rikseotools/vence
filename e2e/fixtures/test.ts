// e2e/fixtures/test.ts
//
// `test` extendido del harness: inyecta los page objects listos para usar. Un spec
// autenticado solo importa de aquí y recibe { page (ya logueada), testFlow, evolution }.
// La sesión la aplica el PROYECTO 'authenticated' (storageState en playwright.config),
// así que `page` ya viene autenticada sin que el spec haga nada.
//
//   import { test, expect } from '../fixtures/test'
//   test('...', async ({ testFlow, evolution }) => { ... })

import { test as base, expect } from '@playwright/test'
import { TestFlow } from '../pageObjects/TestFlow'
import { EvolutionPanel } from '../pageObjects/EvolutionPanel'

type Fixtures = {
  testFlow: TestFlow
  evolution: EvolutionPanel
}

export const test = base.extend<Fixtures>({
  testFlow: async ({ page }, use) => { await use(new TestFlow(page)) },
  evolution: async ({ page }, use) => { await use(new EvolutionPanel(page)) },
})

export { expect }
