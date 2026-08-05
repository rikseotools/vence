/**
 * @jest-environment node
 */
// Los tres estados del icono 🎁 (decisión Manuel, 29/07/2026). Es la única función que decide si a
// alguien se le promete dinero en la barra, así que se fija aquí.
import { estadoIconoRecompensas, formatearEuros, MIN_PAYOUT_EUR } from '@/lib/referrals/logic'

describe('estadoIconoRecompensas — los tres estados', () => {
  it('sin saldo → apagado y sin cifra', () => {
    const r = estadoIconoRecompensas({ balanceEur: 0, unseen: 0 })
    expect(r.estado).toBe('sin_saldo')
    expect(r.importeMostrado).toBeNull()
  })

  it('con saldo por debajo del mínimo → encendido pero SIN cifra', () => {
    // El caso real de hoy: Esther gana 1 € y no puede canjearlo hasta los 5 €. Pintar «1 €» en la
    // barra la lleva a un clic que acaba en decepción.
    for (const balanceEur of [1, 3, 4.99]) {
      const r = estadoIconoRecompensas({ balanceEur, unseen: 1 })
      expect(r.estado).toBe('con_saldo')
      expect(r.importeMostrado).toBeNull()
    }
  })

  it('saldo cobrable → encendido CON la cifra', () => {
    expect(estadoIconoRecompensas({ balanceEur: 5, unseen: 0 }).importeMostrado).toBe(5)
    expect(estadoIconoRecompensas({ balanceEur: 5, unseen: 0 }).estado).toBe('cobrable')
  })

  it('🔒 la cifra es el SALDO REAL, no la denominación del vale', () => {
    // Cambio de criterio (Manuel, 05/08/2026). Antes se pintaba el vale y eso ESCONDÍA dinero:
    // Alfonso tenía 18 € y el chip decía «10 €». El chip es lo único que la mayoría mira.
    expect(estadoIconoRecompensas({ balanceEur: 18, unseen: 0 }).importeMostrado).toBe(18)
    expect(estadoIconoRecompensas({ balanceEur: 7, unseen: 0 }).importeMostrado).toBe(7)
    expect(estadoIconoRecompensas({ balanceEur: 12, unseen: 0 }).importeMostrado).toBe(12)
    expect(estadoIconoRecompensas({ balanceEur: 37, unseen: 0 }).importeMostrado).toBe(37)
  })

  it('lo canjeable HOY sigue calculándose, pero no se pinta en el chip', () => {
    // No se pierde el dato: lo usa el título para no prometer un vale de 18 € que no existe.
    expect(estadoIconoRecompensas({ balanceEur: 18, unseen: 0 }).importeCanjeableAhora).toBe(10)
    expect(estadoIconoRecompensas({ balanceEur: 7, unseen: 0 }).importeCanjeableAhora).toBe(5)
    expect(estadoIconoRecompensas({ balanceEur: 37, unseen: 0 }).importeCanjeableAhora).toBe(20)
  })

  it('el título distingue el saldo de lo canjeable cuando NO coinciden', () => {
    const t18 = estadoIconoRecompensas({ balanceEur: 18, unseen: 0 }).titulo
    expect(t18).toContain('18 €')
    expect(t18).toContain('10 €')
    // Y cuando coinciden no se repite (sonaría a trabalenguas).
    expect(estadoIconoRecompensas({ balanceEur: 10, unseen: 0 }).titulo).toBe(
      'Tienes 10 € listos para canjear',
    )
  })

  it('el umbral sale de la constante del pago, no de un número suelto', () => {
    expect(estadoIconoRecompensas({ balanceEur: MIN_PAYOUT_EUR - 0.01, unseen: 0 }).estado).toBe('con_saldo')
    expect(estadoIconoRecompensas({ balanceEur: MIN_PAYOUT_EUR, unseen: 0 }).estado).toBe('cobrable')
  })
})

describe('la novedad es una señal APARTE del color', () => {
  it('hay saldo y además algo nuevo → las dos señales a la vez', () => {
    const r = estadoIconoRecompensas({ balanceEur: 3, unseen: 2 })
    expect(r.estado).toBe('con_saldo')
    expect(r.hayNovedad).toBe(true)
  })

  it('hay saldo YA VISTO → encendido pero sin punto (si no, sería papel pintado)', () => {
    expect(estadoIconoRecompensas({ balanceEur: 3, unseen: 0 }).hayNovedad).toBe(false)
  })

  it('novedad sin saldo cobrable tampoco inventa cifra', () => {
    const r = estadoIconoRecompensas({ balanceEur: 0, unseen: 1 })
    expect(r.hayNovedad).toBe(true)
    expect(r.importeMostrado).toBeNull()
  })
})

describe('entradas sucias no encienden nada por error', () => {
  it('saldo negativo, NaN o indefinido se tratan como cero', () => {
    for (const balanceEur of [-3, NaN, undefined as unknown as number]) {
      expect(estadoIconoRecompensas({ balanceEur, unseen: 0 }).estado).toBe('sin_saldo')
    }
  })

  it('el título nunca promete un cobro que no existe', () => {
    expect(estadoIconoRecompensas({ balanceEur: 1, unseen: 0 }).titulo).toContain('a partir de 5 €')
    expect(estadoIconoRecompensas({ balanceEur: 5, unseen: 0 }).titulo).toContain('listos para canjear')
  })
})

describe('formatearEuros — el saldo real puede traer decimales', () => {
  it('entero sin decimales (18, no 18,00)', () => {
    expect(formatearEuros(18)).toBe('18')
    expect(formatearEuros(5)).toBe('5')
  })

  it('con decimales, coma decimal española', () => {
    expect(formatearEuros(7.5)).toBe('7,50')
    expect(formatearEuros(4.99)).toBe('4,99')
  })

  it('redondea a céntimos, no arrastra la basura del float', () => {
    expect(formatearEuros(0.1 + 0.2)).toBe('0,30')
    expect(formatearEuros(18.000000001)).toBe('18')
  })
})
