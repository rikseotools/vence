/**
 * @jest-environment node
 */
// Exención del gate anti-scraping: afirmar que eres un canary NO basta, hay que demostrarlo.
//
// Hallazgo 29/07/2026, comprobado contra producción: `/api/questions/filtered` eximía del
// Turnstile a quien enviara `x-vence-canary`, un header SIN secreto. Una petición anónima con
// esa línea recibía las preguntas (con su respuesta correcta); sin ella, 403. El banco entero
// quedaba detrás de un header que cualquiera puede escribir.
import {
  CABECERA_CANARY_SECRETO,
  comparacionSegura,
  esCanaryDeConfianza,
  secretoCanaryEsperado,
} from '@/lib/api/syntheticTrust'

const SECRETO = 'un-secreto-de-longitud-suficiente-1234'

/** Request mínima con los headers dados. */
const req = (headers: Record<string, string>) => ({
  headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
})

describe('esCanaryDeConfianza', () => {
  it('acepta al canary que manda el secreto correcto', () => {
    expect(esCanaryDeConfianza(req({ [CABECERA_CANARY_SECRETO]: SECRETO }), SECRETO)).toBe(true)
  })

  it('EL FALLO ORIGINAL: el header sin secreto NO exime', () => {
    // Esto es exactamente lo que hacía un scraper con `x-vence-canary: 1`.
    expect(esCanaryDeConfianza(req({ 'x-vence-canary': '1' }), SECRETO)).toBe(false)
  })

  it('un secreto equivocado no exime', () => {
    expect(esCanaryDeConfianza(req({ [CABECERA_CANARY_SECRETO]: 'otro-secreto-cualquiera-x' }), SECRETO)).toBe(false)
  })

  it('sin secreto configurado en el servidor, NADIE queda eximido (ante la duda, se protege)', () => {
    expect(esCanaryDeConfianza(req({ [CABECERA_CANARY_SECRETO]: SECRETO }), null)).toBe(false)
    expect(esCanaryDeConfianza(req({ [CABECERA_CANARY_SECRETO]: SECRETO }), '')).toBe(false)
  })

  it('un secreto ridículamente corto se rechaza aunque coincida (config rota, no exención)', () => {
    expect(esCanaryDeConfianza(req({ [CABECERA_CANARY_SECRETO]: '123' }), '123')).toBe(false)
  })

  it('no revienta con requests raras', () => {
    expect(esCanaryDeConfianza(null, SECRETO)).toBe(false)
    expect(esCanaryDeConfianza({}, SECRETO)).toBe(false)
    expect(esCanaryDeConfianza({ headers: null }, SECRETO)).toBe(false)
  })
})

describe('comparacionSegura', () => {
  it('compara por igualdad', () => {
    expect(comparacionSegura('abc', 'abc')).toBe(true)
    expect(comparacionSegura('abc', 'abd')).toBe(false)
  })

  it('longitudes distintas no coinciden', () => {
    expect(comparacionSegura('abc', 'abcd')).toBe(false)
  })

  it('no corta al primer carácter distinto (recorre todo, para no filtrar por tiempo)', () => {
    // No se puede medir el tiempo de forma fiable en un test, pero sí fijar el contrato:
    // dos cadenas que difieren al principio y al final se tratan igual de "no coinciden".
    expect(comparacionSegura('Xbc', 'abc')).toBe(false)
    expect(comparacionSegura('abX', 'abc')).toBe(false)
  })
})

describe('secretoCanaryEsperado', () => {
  it('usa CANARY_SECRET si está, para poder separarlo del de los crons', () => {
    expect(secretoCanaryEsperado({ CANARY_SECRET: 'a', CRON_SECRET: 'b' })).toBe('a')
  })

  it('cae a CRON_SECRET, que es el que los canaries ya llevan', () => {
    expect(secretoCanaryEsperado({ CRON_SECRET: 'b' })).toBe('b')
  })

  it('sin ninguno, null (y entonces no se exime a nadie)', () => {
    expect(secretoCanaryEsperado({})).toBeNull()
  })
})
