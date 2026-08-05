/**
 * @jest-environment node
 */
// T-529. Un cero de un detector no se distingue de un detector muerto: falta el latido de lo
// EVALUADO. Estos tests fijan el criterio autorreferencial: un kind "se cae" del radar cuando
// dejó de aparecer en pasadas RECIENTES que sí completaron — no hace falta una lista estática de
// "todos los kinds que deberían existir" (esa lista ya vive, duplicada, en el script CLI y el
// `@Cron`; una tercera copia aquí sería justo la carga que este módulo evita).
const { ultimaAparicionPorKind, kindsSinEvaluar, estadoDeKind } = require('@/lib/health/kindsEvaluados.cjs')

const DIA = 24 * 60 * 60 * 1000
const AHORA = Date.parse('2026-08-05T07:30:00Z')

const pasada = (haceDias, kindsEvaluados, status = 'success') => ({
  ts: new Date(AHORA - haceDias * DIA).toISOString(),
  status,
  kindsEvaluados,
})

describe('ultimaAparicionPorKind', () => {
  it('se queda con la aparición MÁS RECIENTE de cada kind, sin importar el orden de entrada', () => {
    const pasadas = [
      pasada(0, { opciones_duplicadas: 138115 }),
      pasada(1, { opciones_duplicadas: 138000, psicotecnico_integridad: 7102 }),
    ]
    const m = ultimaAparicionPorKind(pasadas)
    expect(m.get('opciones_duplicadas').sujetos).toBe(138115)
    expect(m.get('psicotecnico_integridad').sujetos).toBe(7102)
  })

  it('ignora pasadas con timestamp inválido en vez de reventar', () => {
    const m = ultimaAparicionPorKind([{ ts: 'no-es-fecha', kindsEvaluados: { x: 1 } }])
    expect(m.size).toBe(0)
  })

  it('una pasada sin kindsEvaluados (p.ej. la rama catch del cron) no aporta nada', () => {
    const m = ultimaAparicionPorKind([{ ts: pasada(0, {}).ts, status: 'failure' }])
    expect(m.size).toBe(0)
  })
})

describe('kindsSinEvaluar — el caso central: un CERO no se puede afirmar sin esto', () => {
  it('un kind presente en la pasada de ANOCHE no sale como sin evaluar', () => {
    const pasadas = [pasada(0, { opciones_duplicadas: 0, psicotecnico_integridad: 0 })]
    expect(kindsSinEvaluar(pasadas, AHORA)).toEqual([])
  })

  it('un kind que llevaba evaluándose y DEJA de aparecer sale como sin evaluar — el caso T-406/T-384', () => {
    // 10 pasadas anteriores lo evaluaban; las últimas 3 (0, 1, 2 días) ya no lo traen —
    // el detector se calló, con el kind reportando 0 hallazgos indistinguible de "vive".
    const pasadas = [
      pasada(0, { otro_kind: 5 }),
      pasada(1, { otro_kind: 5 }),
      pasada(2, { otro_kind: 5 }),
      pasada(3, { otro_kind: 5, opciones_duplicadas: 0 }),
      pasada(4, { otro_kind: 5, opciones_duplicadas: 0 }),
    ]
    const out = kindsSinEvaluar(pasadas, AHORA)
    expect(out.map((x) => x.kind)).toContain('opciones_duplicadas')
    const entrada = out.find((x) => x.kind === 'opciones_duplicadas')
    expect(entrada.diasSinEvaluar).toBeGreaterThan(2)
    expect(entrada.sujetos).toBe(0) // el último valor visto, ANTES de callarse — la pista de que no era "detector roto y ya"
  })

  it('un kind gateado por un feature flag OFF sale del radar solo: nunca aparece, nunca se echa de menos', () => {
    // Nunca apareció en ninguna pasada de la ventana → no hay "última vez" que comparar, así
    // que no genera falso positivo. Es justo la propiedad que evita mantener una lista de
    // excepciones a mano (a diferencia de CLI_ONLY_KINDS/ON_DEMAND_KINDS del test de paridad).
    const pasadas = [pasada(0, { opciones_duplicadas: 10 }), pasada(1, { opciones_duplicadas: 10 })]
    expect(kindsSinEvaluar(pasadas, AHORA).map((x) => x.kind)).not.toContain('shuffle_encendido_sin_efecto')
  })

  it('respeta el umbral de días configurado', () => {
    const pasadas = [pasada(3, { opciones_duplicadas: 0 })]
    expect(kindsSinEvaluar(pasadas, AHORA, { umbralDias: 2 })).toHaveLength(1)
    expect(kindsSinEvaluar(pasadas, AHORA, { umbralDias: 5 })).toHaveLength(0)
  })

  it('una pasada MUY vieja (fuera de la ventana) no cuenta ni para bien ni para mal', () => {
    // Si la única aparición histórica de un kind es de hace 30 días, no se puede decir "lleva
    // 30 días sin evaluarse" con la misma confianza que si lo vimos ayer y hoy no — podría ser
    // un detector retirado a propósito. La ventana lo excluye en vez de alarmar sin fundamento.
    const pasadas = [pasada(30, { kind_retirado: 5 })]
    expect(kindsSinEvaluar(pasadas, AHORA, { ventanaDias: 14 }).map((x) => x.kind)).not.toContain('kind_retirado')
  })

  it('ordena de más a menos días sin evaluar', () => {
    const pasadas = [
      pasada(3, { a: 1, b: 1 }),
      pasada(10, { a: 1 }), // 'a' se vio también hace 10 días, pero cuenta la más RECIENTE (3)
      pasada(0, { c: 1 }),
    ]
    // 'a' y 'b' última vez hace 3 días, 'c' hace 0 (evaluado, no entra si umbral=2 no se supera)
    const out = kindsSinEvaluar(pasadas, AHORA, { umbralDias: 2 })
    expect(out.map((x) => x.kind).sort()).toEqual(['a', 'b'])
  })
})

describe('estadoDeKind — la pregunta puntual que no se podía contestar (T-406/T-384)', () => {
  it('"¿se evaluó psicotecnico_integridad y con cuántos sujetos?" — sí, ayer, sobre 7.102', () => {
    const pasadas = [pasada(0, { psicotecnico_integridad: 7102 })]
    expect(estadoDeKind(pasadas, 'psicotecnico_integridad')).toEqual({
      evaluado: true,
      ultimaVez: pasada(0, {}).ts,
      sujetos: 7102,
    })
  })

  it('un kind que nunca apareció en el historial: no evaluado, sin inventar una fecha', () => {
    expect(estadoDeKind([pasada(0, { otro: 1 })], 'kind_fantasma')).toEqual({
      evaluado: false,
      ultimaVez: null,
      sujetos: null,
    })
  })
})
