/**
 * @jest-environment node
 */
// Los tres estados del icono 🎁 (decisión Manuel, 29/07/2026). Es la única función que decide si a
// alguien se le promete dinero en la barra, así que se fija aquí.
import { estadoIconoRecompensas, MIN_PAYOUT_EUR } from '@/lib/referrals/logic'

describe('estadoIconoRecompensas — los tres estados', () => {
  it('sin saldo → apagado y sin cifra', () => {
    const r = estadoIconoRecompensas({ balanceEur: 0, unseen: 0 })
    expect(r.estado).toBe('sin_saldo')
    expect(r.importeCobrable).toBeNull()
  })

  it('con saldo por debajo del mínimo → encendido pero SIN cifra', () => {
    // El caso real de hoy: Esther gana 1 € y no puede canjearlo hasta los 5 €. Pintar «1 €» en la
    // barra la lleva a un clic que acaba en decepción.
    for (const balanceEur of [1, 3, 4.99]) {
      const r = estadoIconoRecompensas({ balanceEur, unseen: 1 })
      expect(r.estado).toBe('con_saldo')
      expect(r.importeCobrable).toBeNull()
    }
  })

  it('saldo cobrable → encendido CON la cifra del vale', () => {
    expect(estadoIconoRecompensas({ balanceEur: 5, unseen: 0 }).importeCobrable).toBe(5)
    expect(estadoIconoRecompensas({ balanceEur: 5, unseen: 0 }).estado).toBe('cobrable')
  })

  it('la cifra es el VALE que se puede pedir, no el saldo entero', () => {
    // Denominaciones fijas de Amazon: con 7 € sale un vale de 5 € y quedan 2 € acumulados.
    expect(estadoIconoRecompensas({ balanceEur: 7, unseen: 0 }).importeCobrable).toBe(5)
    expect(estadoIconoRecompensas({ balanceEur: 12, unseen: 0 }).importeCobrable).toBe(10)
    expect(estadoIconoRecompensas({ balanceEur: 37, unseen: 0 }).importeCobrable).toBe(20)
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
    expect(r.importeCobrable).toBeNull()
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
