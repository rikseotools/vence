// e2e/authed/bearer-en-rutas-con-dueno.spec.ts
//
// [T-692] Las rutas con guarda de propiedad tienen que recibir el Bearer. En un navegador de
// verdad, con la sesión ya iniciada — que es el único sitio donde este fallo se ve.
//
// ── POR QUÉ NO BASTA CON LOS UNITARIOS ──────────────────────────────────────
// El código de los tres call-sites es CORRECTO leído: `headers: await getAuthHeaders()` está
// escrito en `app/Header.tsx`, `components/UserAvatar.tsx` y `components/PendingExams.tsx`, y
// [T-671]/[T-675] los arreglaron uno a uno. Un unitario que monte el componente pasa. Y aun así,
// medido en producción el 08/08: `/api/exam/pending` llevaba NUEVE DÍAS a 0 % de 401 y saltó al
// 44 % (18 usuarios en un día); `/api/v2/user-stats` arrastra un 20-36 % DIARIO desde antes.
//
// El motivo es que `getAuthHeaders()` **falla en silencio**: si `auth.getAccessToken()` todavía no
// tiene token, el `catch {}` devuelve `{}` SIN `Authorization` y la petición **sale igual**. El
// navegador adjunta la cookie de sesión por su cuenta, así que desde el servidor la petición
// parece «con credenciales» y el 401 se contabiliza como rechazo legítimo. Nadie reintenta: de 58
// fallos medidos solo 7 volvieron a acertar, y en `user-stats` 0 de 29.
//
// Solo un navegador con sesión viva puede afirmar lo que aquí se afirma: que la cabecera VIAJA.
//
// ── CON DIENTES ─────────────────────────────────────────────────────────────
// Si la petición se emite sin `Authorization`, este test FALLA nombrando la ruta culpable. Un
// `getAuthHeaders()` que vuelva a devolver `{}` en el arranque lo enciende.
//
// NO ESCRIBE NADA: las dos rutas se INTERCEPTAN y se responden con un 200 de mentira, así que se
// comprueba lo que el navegador ENVÍA sin tocar datos de nadie ni depender de la respuesta real.

import { test, expect } from '../fixtures/test'

/** Rutas con guarda de propiedad ([T-565]) que el cliente llama con el userId en la query. */
const RUTAS_CON_DUENO = [
  { patron: '**/api/exam/pending**', nombre: '/api/exam/pending', cuerpo: { success: true, exams: [] } },
  {
    patron: '**/api/v2/user-stats**',
    nombre: '/api/v2/user-stats',
    cuerpo: { success: true, currentStreak: 0, globalAccuracy: 0, questionsThisWeek: 0, totalQuestions: 0 },
  },
]

interface Emitida {
  ruta: string
  conBearer: boolean
  url: string
}

test.describe('Bearer en rutas con guarda de propiedad (T-692)', () => {
  test('toda llamada a una ruta con dueño lleva Authorization', async ({ page }) => {
    const emitidas: Emitida[] = []

    for (const ruta of RUTAS_CON_DUENO) {
      await page.route(ruta.patron, async (route) => {
        const cabeceras = route.request().headers()
        const auth = cabeceras['authorization'] ?? ''
        emitidas.push({
          ruta: ruta.nombre,
          conBearer: auth.startsWith('Bearer ') && auth.length > 'Bearer '.length,
          url: route.request().url(),
        })
        // Se responde en corto: lo que se mide es lo que SALE, no lo que contesta producción.
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ruta.cuerpo),
        })
      })
    }

    // El arranque de página es donde se concentra el fallo: el 63 % de los 401 medidos cae en
    // los 10 primeros segundos de la sesión (mediana 0 s).
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // El avatar monta su propio par de llamadas al abrirse; se fuerza para cubrir ese call-site
    // además del que dispara la cabecera al cargar.
    const avatar = page.locator('[data-testid="user-avatar"], header button:has(img)').first()
    if (await avatar.count()) {
      await avatar.click({ trial: false }).catch(() => {})
      await page.waitForTimeout(1500)
    }

    // Si no salió NINGUNA, este test no puede afirmar nada: se dice, no se aprueba en falso.
    // (Mismo criterio que `resumenBarrida()` en el detector de fronteras: un verde vacío no es
    // un verde.)
    test.skip(
      emitidas.length === 0,
      'no se emitió ninguna llamada a las rutas con dueño: sin evidencia, no se aprueba',
    )

    const sinBearer = emitidas.filter((e) => !e.conBearer)
    expect(
      sinBearer,
      `Estas llamadas salieron SIN Authorization (el servidor las rechaza con 401 y la pantalla ` +
        `se queda vacía sin reintentar):\n` +
        sinBearer.map((e) => `  · ${e.ruta} → ${e.url}`).join('\n'),
    ).toEqual([])

    // Y que de verdad se ejercitó lo que dice ejercitar.
    expect(emitidas.length).toBeGreaterThan(0)
  })
})
