/**
 * @jest-environment node
 */
// GUARDARRAÍL: el marcador SIN secreto no puede volver a conceder nada.
//
// `x-vence-canary` (lib/api/syntheticRequest.ts) existe para no ensuciar el log de errores con
// tráfico de canaries, y su documentación dice que "NUNCA" se usa para conceder acceso ni
// saltar validaciones — con ese argumento se justifica que no lleve secreto. El 29/07/2026 se
// descubrió que `/api/questions/filtered` lo usaba justo para eso: eximía del reto
// anti-scraping, así que una petición anónima con esa línea descargaba preguntas.
//
// Este test vigila que la exención siga exigiendo PRUEBA (`x-vence-canary-secret`) y que el
// marcador barato no vuelva a colarse en una decisión de acceso.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const filtered = readFileSync(join(ROOT, 'app/api/questions/filtered/route.ts'), 'utf-8')

describe('guardarraíl — exención del gate anti-scraping', () => {
  it('el gate se exime con el canary DEMOSTRADO, no con el header suelto', () => {
    expect(filtered).toMatch(/esCanaryDeConfianza\(/)
    expect(filtered).toMatch(/isCaptchaEnabled\(\)\s*&&\s*!canaryDeConfianza/)
  })

  it('el endpoint ya NO decide nada con el marcador sin secreto', () => {
    expect(filtered).not.toMatch(/isSyntheticRequest/)
  })

  // [T-381] Hasta el 07/08/2026 esta aserción exigía el MISMO criterio que el reto
  // (`canaryDeConfianza`) — y eso es justo lo que T-381 rompe a propósito: el contador de
  // `daily_questions_served` ahora exime también con `canaryParaMetricas` (más laxo, ver
  // `lib/api/syntheticTrust.ts), porque `canary-questions-gate` necesita demostrar que es un
  // canario SIN eximirse del reto — está probando justo que el reto no le salta. NO es el
  // agujero de antes del 29/07: `canaryParaMetricas` sigue exigiendo secreto compartido
  // (`x-vence-canary-metrics-secret` O el del reto), nunca el marcador `x-vence-canary` sin
  // firmar — de ahí el segundo `it` de abajo.
  it('el contador que alimenta el gate exime con el criterio MÁS LAXO, nunca con el marcador sin secreto', () => {
    expect(filtered).toMatch(/questions\?\.length\s*&&\s*!canaryParaMetricas/)
  })

  it('el criterio laxo del contador sigue exigiendo secreto (no es el agujero pre-29/07)', () => {
    expect(filtered).toMatch(/esCanaryParaMetricas\(/)
    // Todo lo que exime del reto (canaryDeConfianza) también exime del contador — la laxitud
    // es ADICIONAL, no una vía distinta que lo esquive.
    const contrato = readFileSync(join(ROOT, 'lib/api/syntheticTrust.ts'), 'utf-8')
    expect(contrato).toMatch(/esCanaryDeConfianza\([^)]*\)\s*\|\|/)
  })

  it('los canaries que necesitan la exención mandan la prueba', () => {
    for (const f of [
      'backend/src/canary-por-leyes-scope/canary-por-leyes-scope.service.ts',
      'backend/src/canary-questions-gate/canary-questions-gate.service.ts',
    ]) {
      expect(readFileSync(join(ROOT, f), 'utf-8')).toMatch(/x-vence-canary-secret/)
    }
  })

  it('el módulo del marcador barato sigue documentando que no concede nada', () => {
    const src = readFileSync(join(ROOT, 'lib/api/syntheticRequest.ts'), 'utf-8')
    expect(src).toMatch(/NUNCA para conceder acceso/)
  })
})
