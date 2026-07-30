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
    // El motivo dice CUÁNTO se multiplica la densidad — el número que distingue un muro de una cola.
    expect(detectarTecho(REAL).motivo).toMatch(/densidad se multiplica ×\d/)
    expect(detectarTecho(REAL).motivo).toMatch(/solo quedan 0/)
  })
})

describe('detectarTecho — los CUATRO casos reales del 30/07 (la calibración que importa)', () => {
  // Con cuentas brutas salían 4 «techos» y solo 2 eran ciertos. La densidad y el tramo-de-referencia
  // los separan. Estos números son los MEDIDOS en producción, no inventados.
  const banda = (v: number[][]) => v.map(([a, b, n]) => ({ desdeMs: a, hastaMs: b, n }))

  it('answer-and-save SÍ (la densidad se multiplica ×6 y no queda nada por encima)', () => {
    expect(detectarTecho(banda([[5000,10000,64],[10000,20000,66],[20000,24000,6],[24000,26000,19],[26000,60000,0],[60000,600000,0]])).hayTecho).toBe(true)
  })

  it('difficulty-insights SÍ (×3,8) — techo que NO conocíamos', () => {
    expect(detectarTecho(banda([[5000,10000,3],[10000,20000,23],[20000,24000,0],[24000,26000,0],[26000,60000,0],[60000,600000,0]])).hayTecho).toBe(true)
  })

  it('theme-stats NO: 173 > 151 en CUENTA, pero la densidad BAJA (30/s → 17/s)', () => {
    // Con cuentas brutas esto era un falso positivo. Los tramos no miden lo mismo: 5 s contra 10 s.
    expect(detectarTecho(banda([[5000,10000,151],[10000,20000,173],[20000,24000,0],[24000,26000,0],[26000,60000,1],[60000,600000,2]])).hayTecho).toBe(false)
  })

  it('la ruta del PDF NO: el tramo anterior está VACÍO y eso daba «×∞»', () => {
    // Comparar contra un tramo vacío convierte un hueco de la distribución en un muro. Es una cola
    // larga y fina (0,4/s frente a 1,5/s antes) que acaba en su maxDuration de 60 s.
    expect(detectarTecho(banda([[5000,10000,25],[10000,20000,31],[20000,24000,6],[24000,26000,0],[26000,60000,15],[60000,600000,0]])).hayTecho).toBe(false)
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
    expect(r.motivo).toMatch(/cola natural/)
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
