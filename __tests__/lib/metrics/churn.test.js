// Tests del núcleo de churn (T-266). Los casos vienen de datos REALES medidos el
// 29/07/2026 sobre las dos cuentas Stripe, no de ejemplos inventados: es lo que
// distingue un test que protege de uno que solo acompaña al código.
const { calcularChurn, SUELO, TECHO } = require('../../../lib/metrics/churn')

const AHORA = Date.parse('2026-07-29T12:00:00Z')
const hace = (dias) => Math.floor((AHORA - dias * 24 * 3600 * 1000) / 1000)

const sub = (o) => ({
  stripe_account: 'nila',
  status: 'active',
  cancel_at_period_end: false,
  metadata: { supabase_user_id: o.uid ?? `u-${Math.random()}` },
  ...o,
})

const activas = (n, cuenta = 'nila') =>
  Array.from({ length: n }, (_, i) => sub({ stripe_account: cuenta, uid: `${cuenta}-act-${i}` }))

describe('calcularChurn — la cuenta en vaciado no produce churn', () => {
  test('las bajas de una cuenta apagada NO entran en la tasa, se reportan aparte', () => {
    const subs = [
      ...activas(40),
      // Manuel: 100 canceladas recientes + 190 activas marcadas para no renovar.
      ...Array.from({ length: 100 }, (_, i) =>
        sub({ stripe_account: 'manuel', status: 'canceled', canceled_at: hace(10), uid: `m-can-${i}` })),
      ...Array.from({ length: 190 }, (_, i) =>
        sub({ stripe_account: 'manuel', cancel_at_period_end: true, uid: `m-act-${i}` })),
    ]
    const r = calcularChurn({ subs, cuentasVivas: ['nila'], ahoraMs: AHORA })

    // Sin bajas en la cuenta viva, la tasa medida es 0 (y se aplica el suelo).
    expect(r.canceladasVentana).toBe(0)
    expect(r.tasaMedida).toBe(0)
    expect(r.aplicada).toBe('suelo')
    // Y el vaciado se ve, pero como lo que es.
    expect(r.vencimientosProgramados).toBe(190)
    expect(r.canceladasEnVaciado).toBe(100)
    expect(r.cuentasEnVaciado).toEqual(['manuel'])
  })

  test('el defecto original: con la cuenta apagada DENTRO, el churn se dispara', () => {
    const subs = [
      ...activas(40),
      ...Array.from({ length: 100 }, (_, i) =>
        sub({ stripe_account: 'manuel', status: 'canceled', canceled_at: hace(10), uid: `m-${i}` })),
      ...activas(190, 'manuel'),
    ]
    const dentro = calcularChurn({ subs, cuentasVivas: ['nila', 'manuel'], ahoraMs: AHORA })
    // 100 bajas / 3 meses / 230 activas = 14,5% → casi el techo, y ninguna es un cliente que se va.
    expect(dentro.tasaMedida).toBeCloseTo(100 / 3 / 230, 5)
    expect(dentro.tasaMedida).toBeGreaterThan(0.14)
  })
})

describe('calcularChurn — ventana móvil', () => {
  test('lo cancelado FUERA de la ventana no cuenta', () => {
    const subs = [
      ...activas(50),
      sub({ status: 'canceled', canceled_at: hace(200), uid: 'viejo' }),
      sub({ status: 'canceled', canceled_at: hace(10), uid: 'reciente' }),
    ]
    const r = calcularChurn({ subs, cuentasVivas: ['nila'], ahoraMs: AHORA })
    expect(r.canceladasVentana).toBe(1)
    expect(r.tasaMedida).toBeCloseTo(1 / 3 / 50, 5)
  })

  test('la ventana es configurable y cambia el resultado de forma coherente', () => {
    const subs = [
      ...activas(50),
      sub({ status: 'canceled', canceled_at: hace(45), uid: 'a' }),
      sub({ status: 'canceled', canceled_at: hace(10), uid: 'b' }),
    ]
    const trimestre = calcularChurn({ subs, cuentasVivas: ['nila'], ahoraMs: AHORA })
    const mes = calcularChurn({ subs, cuentasVivas: ['nila'], ahoraMs: AHORA, ventanaDias: 30 })
    expect(trimestre.canceladasVentana).toBe(2)
    expect(mes.canceladasVentana).toBe(1)
    // Una sola baja en 30 días pesa MÁS que dos en 90: el churn es una tasa, no un recuento.
    expect(mes.tasaMedida).toBeGreaterThan(trimestre.tasaMedida)
  })
})

describe('calcularChurn — migraciones', () => {
  test('quien cancela en una cuenta y sigue activo en otra NO es una baja', () => {
    const subs = [
      ...activas(50),
      sub({ status: 'canceled', canceled_at: hace(5), uid: 'migrante' }),
      sub({ stripe_account: 'nila', uid: 'migrante' }), // sigue vivo en la cuenta viva
      sub({ status: 'canceled', canceled_at: hace(5), uid: 'se-fue' }),
    ]
    const r = calcularChurn({ subs, cuentasVivas: ['nila'], ahoraMs: AHORA })
    expect(r.canceladasVentana).toBe(2)
    expect(r.migracionesExcluidas).toBe(1)
    // Solo la baja real entra en la tasa: 1 baja, no 2.
    expect(r.tasaMedida).toBeCloseTo(1 / 3 / 51, 5)
  })

  test('una cancelada sin user_id en metadata se cuenta como baja (no se regala)', () => {
    const subs = [
      ...activas(50),
      { stripe_account: 'nila', status: 'canceled', canceled_at: hace(5), metadata: {} },
    ]
    const r = calcularChurn({ subs, cuentasVivas: ['nila'], ahoraMs: AHORA })
    expect(r.migracionesExcluidas).toBe(0)
    expect(r.tasaMedida).toBeGreaterThan(0)
  })
})

describe('calcularChurn — suelo, techo y muestra', () => {
  test('con muestra pequeña no inventa una tasa: lo dice', () => {
    const r = calcularChurn({
      subs: [...activas(10), sub({ status: 'canceled', canceled_at: hace(5), uid: 'x' })],
      cuentasVivas: ['nila'],
      ahoraMs: AHORA,
    })
    expect(r.aplicada).toBe('muestra_insuficiente')
    expect(r.tasaMensual).toBe(SUELO)
  })

  test('el techo MUERDE y se informa (no se enseña un número recortado como si fuera el medido)', () => {
    const subs = [
      ...activas(30),
      ...Array.from({ length: 30 }, (_, i) =>
        sub({ status: 'canceled', canceled_at: hace(5), uid: `x-${i}` })),
    ]
    const r = calcularChurn({ subs, cuentasVivas: ['nila'], ahoraMs: AHORA })
    expect(r.tasaMedida).toBeGreaterThan(TECHO)
    expect(r.tasaMensual).toBe(TECHO)
    expect(r.aplicada).toBe('techo')
  })

  test('una cartera sin bajas cae al suelo, y también se informa', () => {
    const r = calcularChurn({ subs: activas(60), cuentasVivas: ['nila'], ahoraMs: AHORA })
    expect(r.tasaMedida).toBe(0)
    expect(r.tasaMensual).toBe(SUELO)
    expect(r.aplicada).toBe('suelo')
  })
})

describe('calcularChurn — robustez', () => {
  test('sin suscripciones no revienta', () => {
    const r = calcularChurn({ subs: [], cuentasVivas: ['nila'], ahoraMs: AHORA })
    expect(r.activasBase).toBe(0)
    expect(r.aplicada).toBe('muestra_insuficiente')
  })

  test('si NINGUNA cuenta está viva, no reparte churn a ciegas', () => {
    const subs = [...activas(50, 'manuel'), sub({ stripe_account: 'manuel', status: 'canceled', canceled_at: hace(5), uid: 'z' })]
    const r = calcularChurn({ subs, cuentasVivas: [], ahoraMs: AHORA })
    expect(r.activasBase).toBe(0)
    expect(r.aplicada).toBe('muestra_insuficiente')
    expect(r.canceladasEnVaciado).toBe(1)
  })
})
