// __tests__/lib/oposiciones/familiaBackfill.test.ts
//
// La regla que impide que el backfill de familia borre trabajo humano (T-377).

/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('fs')
const { join } = require('path')
const { degradaFamilia } = require('../../../lib/oposiciones/familiaBackfill.cjs')

describe('degradaFamilia', () => {
  test('devolver una familia concreta a "otros" ES degradar (el caso que motivó la regla)', () => {
    expect(degradaFamilia('social', 'otros')).toBe(true)
    expect(degradaFamilia('sanidad', 'otros')).toBe(true)
    expect(degradaFamilia('administracion_general', 'otros')).toBe(true)
    expect(degradaFamilia('tecnica', 'otros')).toBe(true)
  })

  test('de "sin familia" a "otros" NO es degradar: no había nada que perder', () => {
    expect(degradaFamilia(null, 'otros')).toBe(false)
    expect(degradaFamilia(undefined, 'otros')).toBe(false)
    expect(degradaFamilia('', 'otros')).toBe(false)
  })

  test('"otros" → "otros" no cambia nada', () => {
    expect(degradaFamilia('otros', 'otros')).toBe(false)
  })

  test('ganar detalle nunca es degradar, venga de donde venga', () => {
    expect(degradaFamilia(null, 'educacion')).toBe(false)
    expect(degradaFamilia('otros', 'educacion')).toBe(false)
    expect(degradaFamilia('social', 'sanidad')).toBe(false)
  })
})

// Los TRES sitios que opinan sobre familia (el que escribe, el que lo prueba y el que lo
// vigila en vivo) tienen que usar ESTE criterio, no una copia. Si uno se hace su propia
// versión, vuelve el conflicto que costó esta tarde: el test exigiendo que se borre justo
// lo que el backfill protege.
describe('paridad — nadie se hace su propia versión de la regla', () => {
  const RAIZ = join(__dirname, '../../..')
  const consumidores = [
    'scripts/backfill-familia.cjs',
    'scripts/canary-familia.cjs',
    '__tests__/integration/familiaClassification.test.ts',
  ]

  test.each(consumidores)('%s usa el núcleo puro compartido', (f) => {
    expect(readFileSync(join(RAIZ, f), 'utf8')).toMatch(/familiaBackfill\.cjs/)
  })
})
