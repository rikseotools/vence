// e2e/authed/dispute-motivo-obligatorio.spec.ts
//
// T-198 en el producto REAL: al impugnar, elegir el motivo NO envía nada — el usuario llega al
// textarea y decide, y el envío es SIEMPRE explícito. Hasta el 28/07/2026 el formulario se AUTOENVIABA al
// pulsar el motivo, y por eso el 54% de las impugnaciones (1.024 de 1.882) llegaba sin una sola
// palabra del usuario — y esas se rechazaban al doble (42% vs 22%).
//
// Con dientes: contra el código VIEJO este test FALLA en la primera afirmación (al pulsar el
// motivo ya habría salido un POST y el formulario habría desaparecido). Contra el desplegado
// hoy, pasa.
//
// NO ENVÍA NADA: comprueba el estado del botón y aborta cualquier POST a la API de impugnación
// por si acaso, así que no crea impugnaciones reales ni molesta a nadie. Por eso no necesita
// limpieza posterior.

import { test, expect } from '../fixtures/test'

const TEST_PATH = process.env.E2E_DISPUTE_TEST_PATH ?? '/test/repaso-fallos-v2'

test.describe('Impugnar — el envío es explícito, nunca automático (T-198)', () => {
  test('elegir motivo no envía nada; el texto es opcional y el envío lo decide el usuario', async ({ page, testFlow }) => {
    // Red de seguridad: si algo intentara enviar la impugnación, se corta aquí.
    const intentosDeEnvio: string[] = []
    await page.route('**/api/v2/dispute**', (route) => {
      intentosDeEnvio.push(route.request().method())
      return route.abort()
    })
    await page.route('**/api/dispute**', (route) => {
      intentosDeEnvio.push(route.request().method())
      return route.abort()
    })

    await testFlow.goto(TEST_PATH)

    // El botón de impugnar aparece con la pregunta ya respondida en algunos layouts;
    // en otros está disponible desde el principio. Se busca de las dos formas.
    const abrir = page.getByRole('button', { name: /Impugnar pregunta/i }).first()
    if (!(await abrir.isVisible().catch(() => false))) {
      await testFlow.answer('A')
    }
    await abrir.waitFor({ state: 'visible', timeout: 20_000 })
    await abrir.click()

    // 1) Elegir motivo: NO debe enviarse nada.
    const motivo = page.getByLabel(/no se ajusta exactamente al artículo/i).first()
    await motivo.waitFor({ state: 'visible', timeout: 10_000 })
    await motivo.check()
    expect(intentosDeEnvio, 'elegir el motivo disparó un envío (auto-envío reintroducido)').toHaveLength(0)

    // 2) El formulario sigue en pantalla y pide el porqué.
    const enviar = page.getByRole('button', { name: /Enviar impugnación/i }).first()
    await expect(enviar).toBeVisible()
    await expect(page.getByText(/¿Por qué crees que está mal\?/i)).toBeVisible()

    // 3) El texto es OPCIONAL en los motivos tipificados: se puede enviar sin escribir nada.
    //    (Decisión Manuel 28/07: el motivo del radio ya dice qué falla; obligar a escribir es
    //    cobrarle un peaje al usuario por reportar un fallo NUESTRO.)
    await expect(enviar, 'sin texto debería poder enviarse: es opcional').toBeEnabled()

    // 4) Y si escribe, tan válido.
    const texto = page.locator('textarea').first()
    await texto.fill('El artículo 14 dice justo lo contrario que la opción marcada')
    await expect(enviar).toBeEnabled()

    // No se pulsa: el test no crea impugnaciones reales.
    expect(intentosDeEnvio, 'no debería haberse enviado nada en todo el flujo').toHaveLength(0)
  })
})
