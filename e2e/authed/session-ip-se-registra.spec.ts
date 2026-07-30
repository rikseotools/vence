// e2e/authed/session-ip-se-registra.spec.ts
//
// T-314 en el producto REAL: al entrar con la sesión ya iniciada, el navegador registra la IP.
//
// ── POR QUÉ ESTE TEST Y NO SOLO LOS UNITARIOS ───────────────────────────────
// El fallo que arregla no se veía desde ninguna otra capa. El endpoint funcionaba, los tipos
// compilaban, no había errores en los logs… simplemente **nadie llamaba al endpoint**, porque el
// disparador colgaba del evento `SIGNED_IN` y Auth.js —que emula los eventos por polling— entrega
// `INITIAL_SESSION` a quien vuelve con la cookie de 30 días. Resultado: el registro de IP cayó del
// 80% al 1% y estuvo **27 días roto en silencio**.
//
// Eso solo lo ve un navegador de verdad cargando la app con una sesión ya iniciada, que es
// exactamente lo que hace el proyecto `authenticated` de Playwright. Un unitario puede afirmar que
// la decisión es correcta; solo esto afirma que la decisión LLEGA A TOMARSE.
//
// ── CON DIENTES ─────────────────────────────────────────────────────────────
// Contra el código de ayer este test FALLA: no salía ninguna petición a `track-session-ip` al
// cargar con sesión viva. Contra el de hoy, pasa.
//
// NO ESCRIBE NADA en producción: la petición se INTERCEPTA y se responde con un 200 falso, así que
// se comprueba que el navegador la emite sin tocar `user_sessions`. Por eso no necesita limpieza.

import { test, expect } from '../fixtures/test'

test.describe('Registro de IP de sesión (T-314)', () => {
  test('cargar la app con sesión ya iniciada dispara el registro de IP', async ({ page }) => {
    const llamadas: Array<Record<string, unknown>> = []

    // Interceptar ANTES de navegar: la llamada sale durante la hidratación del contexto de auth.
    await page.route('**/api/auth/track-session-ip', async (route) => {
      const body = route.request().postDataJSON?.() ?? {}
      llamadas.push(body)
      // Se responde en corto: no queremos escribir una IP de CI en la sesión de nadie.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, intercepted: true }),
      })
    })

    // Sesión ya iniciada (storageState del proyecto `authenticated`) = el caso que fallaba:
    // Auth.js emite INITIAL_SESSION, nunca SIGNED_IN.
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // El disparo es fire-and-forget durante la hidratación; se le da margen sin colgar el test.
    await expect
      .poll(() => llamadas.length, {
        message:
          'No se registró la IP al cargar con sesión viva. Es el fallo de T-314: el disparador ' +
          'volvió a depender de un evento de auth (SIGNED_IN) que Auth.js no emite en este flujo.',
        timeout: 15000,
      })
      .toBeGreaterThan(0)

    // Y va con lo necesario para que el registro sirva de algo.
    const primera = llamadas[0]
    expect(primera).toHaveProperty('userId')
    expect(String(primera.userId)).toMatch(/^[0-9a-f-]{36}$/i)
  })

  test('recargar dentro de la ventana NO vuelve a registrar (una navegación no es una escritura)', async ({ page }) => {
    const llamadas: string[] = []
    await page.route('**/api/auth/track-session-ip', async (route) => {
      llamadas.push(route.request().method())
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect.poll(() => llamadas.length, { timeout: 15000 }).toBeGreaterThan(0)
    const trasPrimera = llamadas.length

    // Segunda carga inmediata: la marca de la ventana debe evitar el registro.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    expect(
      llamadas.length,
      'Se registró dos veces seguidas: la ventana de deduplicación no está funcionando y cada ' +
        'navegación se convierte en una escritura (el problema que ya causó auth_token_mint_waste).',
    ).toBe(trasPrimera)
  })
})
