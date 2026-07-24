// e2e/authed/laws-configurator.spec.ts
//
// E2E "con dientes" del bug David/Galicia (feedback 442bc679, 24/07/2026): la página
// "Test combinando leyes" (/test/por-leyes) carga el listado de leyes vía
// /api/laws-configurator, cuya query de stats acotada a la oposición tardaba 30s →
// statement timeout → 500 → la página caía en su `catch` mostrando "Error al cargar",
// que el usuario leía como "Error al generar test".
//
// Secuencia con teeth: contra el código VIEJO (query lenta bajo carga) puede FALLAR;
// tras el fix (CTE + timeout 8s + caché) carga rápido y estable. Afirma que NO sale la
// pantalla de error y que el configurador SÍ se renderiza para una cuenta autenticada.
//
// Complementa al canary HTTP (scripts/canary-laws-configurator.cjs, nivel API) con la
// verificación a nivel de UI que ve el usuario. La sesión la aplica el proyecto
// 'authenticated' (storageState en playwright.config).

import { test, expect } from '../fixtures/test'

test.describe('Configurador "Test combinando leyes" (/test/por-leyes)', () => {
  test('carga el configurador SIN la pantalla "Error al cargar" (regresión 442bc679)', async ({ page }) => {
    await page.goto('/test/por-leyes')

    // El spinner inicial ("Cargando tu configuración..." / "Cargando leyes disponibles...")
    // debe resolver a un estado bueno. La pantalla del BUG es un <h1>Error al cargar</h1>.
    await expect(page.getByRole('heading', { name: /Error al cargar/i })).toHaveCount(0, { timeout: 20000 })

    // Y el configurador (o, si su oposición no tuviera leyes, el aviso controlado) SÍ aparece
    // — nunca el dead-end de error. El header del configurador es "Configura tu Test".
    await expect(
      page.getByRole('heading', { name: /Configura tu Test|Test Personalizado Multi-Ley|Sin leyes disponibles/i }),
    ).toBeVisible({ timeout: 20000 })
  })
})
