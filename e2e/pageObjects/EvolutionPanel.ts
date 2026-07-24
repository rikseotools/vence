// e2e/pageObjects/EvolutionPanel.ts
//
// Page Object del panel "Tu Evolución en esta pregunta" (componente QuestionEvolution).
// Expone lo que un spec necesita afirmar: cuántas filas hay en la cronología y cuántas
// están marcadas como el intento ACTUAL ("Ahora / Justo ahora"). El bug de MariSol
// (feedback 90aa6caa) se manifiesta como currentRowCount() === 2 en vez de 1.

import { type Locator, type Page } from '@playwright/test'

export class EvolutionPanel {
  constructor(private readonly page: Page) {}

  /** Abre "Cronología detallada" (botón "Ver fechas"). Solo aparece con >3 intentos. */
  async open(): Promise<EvolutionPanel> {
    const verFechas = this.page.getByRole('button', { name: /Ver fechas/i })
    if (await verFechas.count()) await verFechas.first().click()
    await this.page.getByText('Cronología detallada').first().waitFor()
    return this
  }

  private timeline(): Locator {
    // Bloque que sigue al encabezado "Cronología detallada".
    return this.page.locator('div', { has: this.page.getByText('Cronología detallada') }).last()
  }

  /** Nº total de filas en la cronología. */
  async rowCount(): Promise<number> {
    return this.timeline().locator('text=/—\\s*(Correcto|Incorrecto|En blanco)/').count()
  }

  /** Nº de filas marcadas como el intento ACTUAL. Debe ser <= 1. El bug lo hacía 2. */
  async currentRowCount(): Promise<number> {
    return this.page.getByText('Justo ahora').count()
  }

  /** El "(N intentos)" que muestra la cabecera de aciertos. */
  async totalIntentos(): Promise<number> {
    const txt = await this.page.getByText(/\(\d+\s+intentos?\)/).first().innerText()
    return Number(txt.match(/\((\d+)/)?.[1] ?? '0')
  }
}
