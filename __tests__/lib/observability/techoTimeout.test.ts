/**
 * @jest-environment node
 */
// Unitarios de la capa que faltaba: distinguir «lento» de «choca contra un timeout» (T-315).
// Importa el módulo REAL de producción, nunca una copia.
//
// Por qué existe: el mismo síntoma recibió TRES atribuciones erróneas antes de dar con la causa, y
// ninguno de los detectores existentes podía distinguirlo porque todos miran la MAGNITUD (p95, máx,
// % > X) y un timeout y una lentitud real dan la misma magnitud. Lo que los separa es la FORMA.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { detectarTecho, MIN_EN_TECHO } = require('@/lib/observability/techoTimeout.cjs') as {
  detectarTecho: (t: Array<{ desdeMs: number; hastaMs: number; n: number }>) => {
    hayTecho: boolean; techoMs: number | null; enTecho: number; porEncima: number; motivo: string
  }
  MIN_EN_TECHO: number
}

describe('detectarTecho — el caso REAL de answer-and-save', () => {
  // Los tramos medidos el 30/07 sobre 14 días de peticiones de más de 5 s.
  const REAL = [
    { desdeMs: 5_000, hastaMs: 10_000, n: 66 },
    { desdeMs: 10_000, hastaMs: 20_000, n: 65 },
    { desdeMs: 20_000, hastaMs: 24_000, n: 6 },
    { desdeMs: 24_000, hastaMs: 26_000, n: 19 },
    { desdeMs: 26_000, hastaMs: 60_000, n: 0 },
  ]

  it('CAZA el techo de ~25 s (ANTIFRAUD_TIMEOUT_MS)', () => {
    const r = detectarTecho(REAL)
    expect(r.hayTecho).toBe(true)
    expect(r.techoMs).toBe(26_000)
    expect(r.enTecho).toBe(19)
    expect(r.porEncima).toBe(0)
  })

  it('el motivo explica la firma con números, no con una etiqueta', () => {
    expect(detectarTecho(REAL).motivo).toMatch(/19 peticiones/)
    expect(detectarTecho(REAL).motivo).toMatch(/el tramo anterior tenía 6/)
  })
})

describe('detectarTecho — lo que NO debe marcar', () => {
  it('una cola que ADELGAZA es lentitud real, no un techo', () => {
    const r = detectarTecho([
      { desdeMs: 5_000, hastaMs: 10_000, n: 100 },
      { desdeMs: 10_000, hastaMs: 20_000, n: 40 },
      { desdeMs: 20_000, hastaMs: 30_000, n: 12 },
      { desdeMs: 30_000, hastaMs: 60_000, n: 3 },
    ])
    expect(r.hayTecho).toBe(false)
    expect(r.motivo).toMatch(/adelgaza/)
  })

  it('una acumulación PEQUEÑA no basta (tres muestras ya costaron tres falsas alarmas)', () => {
    const r = detectarTecho([
      { desdeMs: 5_000, hastaMs: 10_000, n: 10 },
      { desdeMs: 10_000, hastaMs: 20_000, n: 2 },
      { desdeMs: 20_000, hastaMs: 26_000, n: MIN_EN_TECHO - 1 },
      { desdeMs: 26_000, hastaMs: 60_000, n: 0 },
    ])
    expect(r.hayTecho).toBe(false)
  })

  it('si por encima del supuesto techo sigue habiendo volumen, NO es un techo', () => {
    const r = detectarTecho([
      { desdeMs: 5_000, hastaMs: 10_000, n: 10 },
      { desdeMs: 10_000, hastaMs: 20_000, n: 5 },
      { desdeMs: 20_000, hastaMs: 26_000, n: 20 },
      { desdeMs: 26_000, hastaMs: 60_000, n: 15 },
    ])
    expect(r.hayTecho).toBe(false)
  })

  it('tolera alguna petición suelta por encima (reintentos, relojes distintos)', () => {
    // Exigir CERO haría el detector frágil: un timeout real puede dejar algún rezagado.
    const r = detectarTecho([
      { desdeMs: 5_000, hastaMs: 10_000, n: 60 },
      { desdeMs: 20_000, hastaMs: 24_000, n: 6 },
      { desdeMs: 24_000, hastaMs: 26_000, n: 30 },
      { desdeMs: 26_000, hastaMs: 60_000, n: 2 },
    ])
    expect(r.hayTecho).toBe(true)
  })

  it('con pocos tramos no opina', () => {
    expect(detectarTecho([{ desdeMs: 0, hastaMs: 10, n: 5 }]).hayTecho).toBe(false)
    // @ts-expect-error — entrada inválida a propósito
    expect(detectarTecho(undefined).hayTecho).toBe(false)
  })
})
