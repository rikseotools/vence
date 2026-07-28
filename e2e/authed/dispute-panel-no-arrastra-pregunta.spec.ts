// e2e/authed/dispute-panel-no-arrastra-pregunta.spec.ts
//
// El panel de impugnar NO puede enseñar la impugnación de OTRA pregunta.
//
// Bug real (28/07/2026, impugnación `dc236653`): `TestLayout` monta `<QuestionDispute>` sin `key`,
// así que es la misma instancia durante todo el test, y `checkExistingDispute` solo escribía el
// resultado cuando había impugnación previa —sin rama else—. La consecuencia la vio la usuaria
// Rocío: impugnó la pregunta 13 de su test y en la 22, que había dejado en blanco, el panel le
// dijo «Ya impugnaste esta pregunta» con un motivo que ella no había marcado. Lo reportó con estas
// palabras: «no he marcado ese titulo».
//
// **Con dientes:** contra el código anterior al arreglo `8f85b6dac` este test FALLA (el aviso
// aparece en la segunda pregunta). Contra el arreglo, pasa. Por eso vale como verificación DEL
// DESPLIEGUE: mientras falle, el arreglo no ha llegado a producción.
//
// NO CREA IMPUGNACIONES: aborta cualquier POST a la API de impugnación y simula la respuesta del
// GET, así que no toca datos de nadie y no necesita limpieza.

import { test, expect } from '../fixtures/test'

const TEST_PATH = process.env.E2E_DISPUTE_TEST_PATH ?? '/test/repaso-fallos-v2'

test.describe('Impugnar — el panel no arrastra el estado entre preguntas', () => {
  test('el aviso de «ya impugnaste» no reaparece en la pregunta siguiente', async ({ page, testFlow }) => {
    // Red de seguridad: nada se envía de verdad.
    const intentosDeEnvio: string[] = []
    await page.route('**/api/v2/dispute**', (route) => {
      if (route.request().method() !== 'GET') {
        intentosDeEnvio.push(route.request().method())
        return route.abort()
      }
      return route.fallback()
    })

    // La API responde "ya impugnada" SOLO para la primera pregunta que se consulte. Así se
    // reproduce el escenario real sin depender de que la cuenta de test tenga impugnaciones
    // previas: lo que se prueba es el ARRASTRE, no el dato.
    let primeraConsultada: string | null = null
    await page.route('**/api/v2/dispute?**', async (route) => {
      const url = new URL(route.request().url())
      const qid = url.searchParams.get('questionId') ?? ''
      if (!primeraConsultada) primeraConsultada = qid
      const esLaPrimera = qid === primeraConsultada
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Forma REAL del endpoint v2: `{success, dispute}`. Escribirla a mano fue justo el error
        // que dejó vivo el bug de contrato durante meses, así que aquí se replica el contrato tal
        // cual lo define `getDisputeResponseSchema`.
        body: JSON.stringify({
          success: true,
          dispute: esLaPrimera
            ? {
                id: '00000000-0000-4000-8000-0000000000e2',
                questionId: qid,
                status: 'pending',
                disputeType: 'tema_incorrecto',
                description: 'Motivo: tema_incorrecto',
                adminResponse: null,
                createdAt: null,
                resolvedAt: null,
              }
            : null,
        }),
      })
    })

    await testFlow.goto(TEST_PATH)

    const abrirPanel = async () => {
      const abrir = page.getByRole('button', { name: /Impugnar pregunta/i }).first()
      if (!(await abrir.isVisible().catch(() => false))) await testFlow.answer('A')
      await abrir.waitFor({ state: 'visible', timeout: 20_000 })
      await abrir.click()
    }

    // 1) Primera pregunta: el aviso SÍ debe salir (la API dice que está impugnada).
    await abrirPanel()
    await expect(page.getByText(/Ya impugnaste esta pregunta/i)).toBeVisible({ timeout: 10_000 })

    // 2) Se pasa a la siguiente pregunta y se vuelve a abrir el panel.
    await testFlow.next()
    await abrirPanel()

    // 3) Aquí estaba el bug: el aviso NO puede seguir ahí, porque esta pregunta no está impugnada.
    await expect(
      page.getByText(/Ya impugnaste esta pregunta/i),
      'el panel arrastró la impugnación de la pregunta anterior (bug dc236653)',
    ).toHaveCount(0)

    // 4) Y debe ofrecer el formulario, no un estado heredado.
    await expect(page.getByRole('button', { name: /Enviar impugnación/i }).first()).toBeVisible()

    expect(intentosDeEnvio, 'no debería haberse enviado ninguna impugnación real').toHaveLength(0)
  })
})
