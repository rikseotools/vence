/**
 * Smoke: la cabecera NUNCA deja nada fuera de la pantalla (T-504).
 *
 * ## Por qué está aquí y no solo en `scripts/sim/`
 *
 * El 03/08 la cabecera de escritorio dejó de caber: el avatar y la campana quedaban fuera del
 * viewport en las cuatro anchuras de escritorio y, con `html`/`body` en `overflow-x: hidden`,
 * **sin scroll con el que rescatarlos**. Lo reportó un usuario premium. Se arregló y se escribió
 * una simulación con navegador real… que **solo corría a mano**.
 *
 * Ese es justo el modo de fallo que causó el incidente: la cabecera llevaba meses creciendo un
 * enlace cada vez y nadie comprobaba que siguiera cabiendo. Una comprobación que hay que
 * acordarse de lanzar no se lanza. Este fichero la pone donde se repite sola:
 *
 *   - **cada PR** que toque `app/`, `components/`, `lib/`… → contra preview AWS (bloquea merge)
 *   - **cada 6 h** → contra producción, y si falla emite `e2e_smoke_failed` a observabilidad
 *
 * ## Qué cubre y qué NO
 *
 * Cubre el caso **anónimo**, que es el único que se puede montar en CI sin meter `AUTH_SECRET`
 * en GitHub Actions. Es menos que la simulación (que además forja sesiones premium y free, con
 * menús más largos) pero es sensible al fallo de fondo: a 1280 px tampoco caben todos los
 * enlaces sin sesión, así que si alguien quita el `min-w-0` del `<nav>` o el reparto deja de
 * correr, aquí se ve.
 *
 * Los menús con sesión siguen siendo cosa de `npm run sim:cabecera`, que es lo que hay que
 * correr al TOCAR la cabecera. Este smoke es la red de debajo, no el sustituto.
 *
 * El criterio de qué es un defecto NO se escribe aquí: vive en `lib/ui/navOverflowProbe.ts`,
 * compartido con la simulación. Dos criterios sobre lo mismo divergen.
 */
import { test, expect } from '@playwright/test'
import {
  ANCHURAS_ESCRITORIO,
  GUION_MEDIR_CABECERA,
  GUION_MENU_MAS,
  SELECTOR_BOTON_MAS,
  problemasDeCabecera,
  type MedidaCabecera,
} from '../lib/ui/navOverflowProbe'

for (const ancho of ANCHURAS_ESCRITORIO) {
  test(`cabecera alcanzable @${ancho} (anónimo)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 925 })
    const resp = await page.goto('/', { waitUntil: 'networkidle' })
    expect(resp?.status()).toBeLessThan(400)

    // El reparto ocurre TRAS el primer layout (se mide y se vuelve a pintar): sin esta espera
    // se mediría el render provisional, que a propósito enseña todos los enlaces.
    await page.waitForTimeout(2500)

    const m: MedidaCabecera = await page.evaluate(GUION_MEDIR_CABECERA)
    expect(m.hayCabecera, 'no se encontró la cabecera: no se puede juzgar nada').toBe(true)

    // Sin el medidor invisible no se puede comprobar que no falte ningún enlace, y su ausencia
    // significa que el componente del reparto no se está pintando — que es la regresión, no un
    // detalle del instrumento. Un verde parcial no es un verde.
    expect(
      m.totalEnlaces,
      'la cabecera no trae el medidor de anchos: el reparto de HeaderDesktopNav no se está pintando',
    ).toBeGreaterThan(0)

    let enMenu = 0
    let inalcanzablesEnMenu: string[] = []
    if (m.hayBotonMas) {
      await page.click(SELECTOR_BOTON_MAS)
      await page.waitForTimeout(400)
      const r: { total: number; inalcanzables: string[] } = await page.evaluate(GUION_MENU_MAS)
      enMenu = r.total
      inalcanzablesEnMenu = r.inalcanzables
    }

    const problemas = problemasDeCabecera({ ...m, enMenu, inalcanzablesEnMenu }, ancho)
    expect(problemas, `cabecera @${ancho}:\n  · ${problemas.join('\n  · ')}`).toEqual([])
  })
}
