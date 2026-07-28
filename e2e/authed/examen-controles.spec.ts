/**
 * Controles flotantes del examen: que se VEAN y que se puedan PULSAR mientras se baja.
 *
 * Por qué existe este spec y no basta con tests unitarios: el fallo real (feedback Manolo,
 * 28/07/2026) no estaba en la lógica —que tenía tests y pasaban— sino en la CAPA DE PINTADO.
 * Los controles se pegaban con `top-0` bajo una cabecera que también es pegajosa y va por
 * encima (z-50): quedaban detrás de ella, invisibles y sin recibir los clics. Un test unitario
 * no ve una oclusión; sólo un navegador de verdad.
 *
 * La comprobación clave es `elementFromPoint`: no basta con que el elemento exista y esté en
 * pantalla — hay que exigir que sea ÉL quien reciba el clic en su propio centro.
 *
 * Va en el harness AUTENTICADO y no en el smoke anónimo a propósito: abrir exámenes seguidos
 * sin sesión hace saltar la protección anti-scraping (`/api/questions/filtered` responde 403 y
 * la página muestra "Error al cargar examen"). Eso es la protección funcionando, no un fallo —
 * pero convierte en inestable a cualquier spec anónimo que abra exámenes.
 */
import { test, expect, type Page } from '@playwright/test'

const RUTA_EXAMEN = '/auxiliar-administrativo-diputacion-cordoba/test/tema/3/test-examen'

/** ¿Recibiría este botón un clic en su centro, o hay algo tapándolo? */
async function estaTapado(page: Page, aria: string): Promise<boolean> {
  return page.evaluate((etiqueta) => {
    const el = [...document.querySelectorAll('button')].find(
      b => b.getAttribute('aria-label') === etiqueta,
    )
    if (!el) return true
    const r = el.getBoundingClientRect()
    const enElPunto = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !(enElPunto === el || el.contains(enElPunto))
  }, aria)
}

/** Los controles solo salen tras dejar atrás la cabecera del examen: bajar es parte del setup. */
async function abrirExamenYBajar(page: Page) {
  const resp = await page.goto(RUTA_EXAMEN)
  expect(resp?.status()).toBeLessThan(400)
  await expect(page.locator('[id^=pregunta-]').first()).toBeVisible({ timeout: 60_000 })
  await page.evaluate(() => window.scrollTo(0, 3000))
  await page.waitForTimeout(600)
}

test('arriba NO tapan la cabecera del examen, y al bajar aparecen', async ({ page }) => {
  const resp = await page.goto(RUTA_EXAMEN)
  expect(resp?.status()).toBeLessThan(400)
  await expect(page.locator('[id^=pregunta-]').first()).toBeVisible({ timeout: 60_000 })

  // Con la cabecera del examen a la vista sobran: ya enseña tiempo y respondidas, y flotar ahí
  // solo taparía el título.
  await expect(page.getByTestId('reloj-examen')).toBeHidden()

  await page.evaluate(() => window.scrollTo(0, 1500))
  await expect(page.getByTestId('reloj-examen')).toBeVisible()
})

test('los controles del examen siguen visibles y pulsables al bajar', async ({ page }) => {
  await abrirExamenYBajar(page)

  const reloj = page.getByTestId('reloj-examen')
  await expect(reloj).toBeVisible()

  const caja = await reloj.boundingBox()
  expect(caja, 'el reloj desapareció al bajar').not.toBeNull()
  expect(caja!.y, 'el reloj se fue de la pantalla al bajar').toBeGreaterThan(-1)
  expect(caja!.y, 'el reloj quedó demasiado abajo (¿offset de cabecera mal medido?)').toBeLessThan(400)

  // Y que NO estén detrás de la cabecera: el fallo original pasaba la prueba de posición pero
  // fallaba esta otra.
  expect(await estaTapado(page, 'Ver la cuenta atrás hasta tu objetivo'),
    'algo tapa los botones del reloj: los clics no les llegan').toBe(false)
  expect(await estaTapado(page, 'Ir a la siguiente pregunta en blanco'),
    'algo tapa el botón de saltar a las que quedan en blanco').toBe(false)
})

test('el reloj y la cuenta atrás son dos botones nombrados', async ({ page }) => {
  await abrirExamenYBajar(page)
  const reloj = page.getByTestId('reloj-examen')

  // Nombrados y no un toque oculto sobre el reloj: se ve qué se está mirando y que hay otra
  // opción.
  await expect(reloj).toContainText('⏱️')
  await page.getByRole('button', { name: 'Ver la cuenta atrás hasta tu objetivo' }).click()
  await expect(reloj).toContainText('⏳')
  await page.getByRole('button', { name: 'Ver el tiempo transcurrido' }).click()
  await expect(reloj).toContainText('⏱️')
})

test('saltar a las que quedan en blanco lleva a otra pregunta, en los dos sentidos', async ({ page }) => {
  await abrirExamenYBajar(page)
  const siguiente = page.getByRole('button', { name: 'Ir a la siguiente pregunta en blanco' })
  const anterior = page.getByRole('button', { name: 'Ir a la anterior pregunta en blanco' })

  const centrada = () => page.evaluate(() => {
    const centro = window.innerHeight / 2
    return [...document.querySelectorAll('[id^=pregunta-]')]
      .map(e => {
        const r = e.getBoundingClientRect()
        return { id: e.id, d: Math.abs(r.top + r.height / 2 - centro) }
      })
      .sort((a, b) => a.d - b.d)[0]?.id
  })

  await siguiente.click()
  await page.waitForTimeout(1200)
  const primera = await centrada()
  await siguiente.click()
  await page.waitForTimeout(1200)
  const segunda = await centrada()
  expect(segunda, 'el salto hacia delante no movió a otra pregunta').not.toBe(primera)

  // Encadenar saltos tiene que funcionar aunque uno lleve cerca del principio: por eso los
  // controles no se esconden en cuanto asoma un trozo de la cabecera.
  await anterior.click()
  await page.waitForTimeout(1200)
  expect(await centrada(), 'el salto hacia atrás no volvió a la anterior en blanco').toBe(primera)
})
