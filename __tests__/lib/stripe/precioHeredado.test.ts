// Núcleo puro de los precios heredados (caso Rocío, 29/07/2026).
//
// Lo que se protege aquí es dinero: un fallo de redondeo o una clave inestable no
// revientan nada visible, simplemente facturan mal durante meses.
import {
  euroACentimos,
  lookupKeyPrecioHeredado,
  nombreProductoHeredado,
  avisoSiNoMejora,
  metadataHeredado,
  esIntervaloValido,
  RECURRENCIA,
  INTERVALOS,
  derivarPrecioHeredado,
  intervaloDesdeRecurrencia,
  MAX_CENTIMOS_HEREDABLE,
  type SuscripcionAnterior,
} from '@/lib/stripe/precioHeredado'

describe('euroACentimos', () => {
  it('convierte los importes normales', () => {
    expect(euroACentimos(18)).toBe(1800)
    expect(euroACentimos(20)).toBe(2000)
    expect(euroACentimos(9.99)).toBe(999)
    expect(euroACentimos(0.5)).toBe(50)
  })

  it('no se come el céntimo por coma flotante', () => {
    // 18.29 * 100 = 1828.9999999999998 en IEEE754. Sin el redondeo, 1828.
    expect(euroACentimos(18.29)).toBe(1829)
    expect(euroACentimos(1.1)).toBe(110)
  })

  it('rechaza 0, negativos y no-números (un regalo NO se hace con un price a 0)', () => {
    expect(() => euroACentimos(0)).toThrow()
    expect(() => euroACentimos(-5)).toThrow()
    expect(() => euroACentimos(NaN)).toThrow()
    expect(() => euroACentimos(Infinity)).toThrow()
  })

  it('rechaza más de dos decimales (18,333 € factura mal)', () => {
    expect(() => euroACentimos(18.333)).toThrow(/decimales/)
  })
})

describe('lookupKeyPrecioHeredado', () => {
  it('es estable: la misma pareja da la misma clave (idempotencia del price)', () => {
    expect(lookupKeyPrecioHeredado('mensual', 1800)).toBe('heredado_mensual_1800')
    expect(lookupKeyPrecioHeredado('mensual', 1800)).toBe(lookupKeyPrecioHeredado('mensual', 1800))
  })

  it('distingue intervalo e importe (18 € al mes ≠ 18 € al año)', () => {
    expect(lookupKeyPrecioHeredado('anual', 1800)).not.toBe(lookupKeyPrecioHeredado('mensual', 1800))
    expect(lookupKeyPrecioHeredado('mensual', 2000)).not.toBe(lookupKeyPrecioHeredado('mensual', 1800))
  })
})

describe('intervalos', () => {
  it('cubre los cuatro del catálogo y valida la entrada del operador', () => {
    expect(INTERVALOS).toEqual(['mensual', 'trimestral', 'semestral', 'anual'])
    expect(esIntervaloValido('mensual')).toBe(true)
    expect(esIntervaloValido('quincenal')).toBe(false)
    expect(esIntervaloValido('')).toBe(false)
  })

  it('la recurrencia es la que `determinePlanType` mapea a cada plan', () => {
    // Si esto cambia, el webhook clasificaría la suscripción en otro plan.
    expect(RECURRENCIA.mensual).toEqual({ interval: 'month', interval_count: 1 })
    expect(RECURRENCIA.trimestral).toEqual({ interval: 'month', interval_count: 3 })
    expect(RECURRENCIA.semestral).toEqual({ interval: 'month', interval_count: 6 })
    expect(RECURRENCIA.anual).toEqual({ interval: 'year', interval_count: 1 })
  })

  it('el nombre del producto es el que verá en su recibo', () => {
    expect(nombreProductoHeredado('mensual')).toBe('Vence Premium Mensual')
    expect(nombreProductoHeredado('anual')).toBe('Vence Premium Anual')
  })
})

describe('avisoSiNoMejora', () => {
  it('calla cuando el heredado es más barato (el caso normal)', () => {
    expect(avisoSiNoMejora(1800, 2900)).toBeNull()
  })

  it('avisa si es igual o más caro que la tarifa vigente', () => {
    expect(avisoSiNoMejora(2900, 2900)).toMatch(/IGUAL/)
    expect(avisoSiNoMejora(3500, 2900)).toMatch(/MÁS CARO/)
  })

  it('sin tarifa vigente conocida no inventa un aviso', () => {
    expect(avisoSiNoMejora(1800, null)).toBeNull()
  })
})

describe('metadataHeredado', () => {
  it('deja el rastro que hace falta para auditar quién pagó qué y por qué', () => {
    const m = metadataHeredado({
      userId: 'd3431251-89f1-4c40-b21b-37941c9641f7',
      email: 'x@y.es',
      motivo: 'precio anterior al cambio de tarifa',
      feedbackId: '48f1503a',
      creadoPor: 'soporte',
    })
    // supabase_user_id es el que usa el webhook para vincular la suscripción.
    expect(m.supabase_user_id).toBe('d3431251-89f1-4c40-b21b-37941c9641f7')
    expect(m.tipo).toBe('precio_heredado')
    expect(m.feedback_id).toBe('48f1503a')
    expect(m.motivo).toContain('tarifa')
  })

  it('sin feedback no mete la clave vacía', () => {
    const m = metadataHeredado({ userId: 'u', email: 'e', motivo: 'm' })
    expect('feedback_id' in m).toBe(false)
    expect(m.creado_por).toBe('soporte')
  })
})

// ── Derivar «el precio que tenía» desde su histórico (T-341) ──────────────────────────────
//
// Esto decide lo que se le va a cobrar a 377 personas sin que nadie revise caso por caso,
// así que lo que importa es que se calle cuando no está seguro: la alternativa a no ofrecer
// nada es la tarifa normal, y la alternativa a equivocarse es cobrar mal.
describe('derivarPrecioHeredado', () => {
  const sub = (over: Partial<SuscripcionAnterior> = {}): SuscripcionAnterior => ({
    estado: 'canceled',
    centimos: 2000,
    intervalo: 'month',
    intervalCount: 1,
    creadaEn: 1_700_000_000,
    ...over,
  })

  it('devuelve las tres tarifas reales del vaciado', () => {
    expect(derivarPrecioHeredado([sub()])).toEqual({ centimos: 2000, intervalo: 'mensual' })
    expect(derivarPrecioHeredado([sub({ centimos: 3500, intervalCount: 3 })]))
      .toEqual({ centimos: 3500, intervalo: 'trimestral' })
    expect(derivarPrecioHeredado([sub({ centimos: 5900, intervalCount: 6 })]))
      .toEqual({ centimos: 5900, intervalo: 'semestral' })
  })

  it('con varias, manda la MÁS RECIENTE (su último precio, no el más barato)', () => {
    const elegido = derivarPrecioHeredado([
      sub({ centimos: 1000, creadaEn: 1_600_000_000 }),
      sub({ centimos: 2000, creadaEn: 1_700_000_000 }),
    ])
    expect(elegido).toEqual({ centimos: 2000, intervalo: 'mensual' })
  })

  it('ignora las que no sirven y sigue buscando en vez de rendirse', () => {
    const elegido = derivarPrecioHeredado([
      sub({ centimos: null, creadaEn: 1_800_000_000 }),          // sin importe
      sub({ intervalCount: 2, creadaEn: 1_750_000_000 }),        // periodicidad no mapeable
      sub({ centimos: 3500, intervalCount: 3, creadaEn: 1_700_000_000 }),
    ])
    expect(elegido).toEqual({ centimos: 3500, intervalo: 'trimestral' })
  })

  it('sin nada utilizable devuelve null (la persona va a la tarifa normal)', () => {
    expect(derivarPrecioHeredado([])).toBeNull()
    expect(derivarPrecioHeredado([sub({ centimos: 0 })])).toBeNull()
    expect(derivarPrecioHeredado([sub({ centimos: -100 })])).toBeNull()
    expect(derivarPrecioHeredado([sub({ intervalo: null, intervalCount: null })])).toBeNull()
  })

  it('un importe absurdo NO se hereda: es un dato roto, no una tarifa', () => {
    expect(derivarPrecioHeredado([sub({ centimos: MAX_CENTIMOS_HEREDABLE + 1 })])).toBeNull()
    expect(derivarPrecioHeredado([sub({ centimos: MAX_CENTIMOS_HEREDABLE })])).not.toBeNull()
  })

  it('mapea las periodicidades del catálogo y solo esas', () => {
    expect(intervaloDesdeRecurrencia('month', 1)).toBe('mensual')
    expect(intervaloDesdeRecurrencia('month', 3)).toBe('trimestral')
    expect(intervaloDesdeRecurrencia('month', 6)).toBe('semestral')
    expect(intervaloDesdeRecurrencia('year', 1)).toBe('anual')
    expect(intervaloDesdeRecurrencia('month', 2)).toBeNull()
    expect(intervaloDesdeRecurrencia('week', 1)).toBeNull()
    expect(intervaloDesdeRecurrencia(null, null)).toBeNull()
  })
})
