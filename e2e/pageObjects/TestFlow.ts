// e2e/pageObjects/TestFlow.ts
//
// Page Object del flujo de test normal (componente TestLayout). Encapsula las acciones
// reutilizables: arrancar un test, responder, y esperar a que el guardado aterrice.
// Los specs NO tocan selectores → si la UI cambia, se ajusta AQUÍ una vez.
//
// NOTA: los selectores marcados «confirmar 1ª corrida» se afinan al correrlo la primera
// vez contra el app real (traza de Playwright). Se han elegido role/text-based para ser
// robustos a cambios de clases.

import { expect, type Page } from '@playwright/test'

export class TestFlow {
  constructor(private readonly page: Page) {}

  /** Navega a una ruta de test ya construida (p.ej. la de repaso o un test de tema). */
  async goto(path: string) {
    await this.page.goto(path)
    // El contenedor de pregunta lleva data-question-id (TestLayout).
    await expect(this.page.locator('[data-question-id]').first()).toBeVisible()
  }

  /** Responde la pregunta actual por letra usando los botones rápidos A/B/C/D. */
  async answer(letter: 'A' | 'B' | 'C' | 'D') {
    // Botón cuadrado rápido (56x56). Fallback: opción completa por su prefijo de letra.
    const quick = this.page.getByRole('button', { name: new RegExp(`^${letter}$`) })
    if (await quick.count()) {
      await quick.first().click()
    } else {
      await this.page.getByRole('button', { name: new RegExp(`^\\s*${letter}[).\\s]`) }).first().click()
    }
  }

  /**
   * Espera a que el guardado asíncrono aterrice en el servidor. Es lo que FUERZA la
   * carrera del bug de la cronología: cuando esta respuesta vuelve, el historial en vivo
   * ya incluye el intento actual.
   */
  async waitAnswerSaved() {
    await this.page.waitForResponse(
      (r) => r.url().includes('/api/v2/answer-and-save') && r.request().method() === 'POST',
      { timeout: 15_000 },
    )
  }
}
