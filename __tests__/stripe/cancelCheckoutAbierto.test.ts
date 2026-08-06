// __tests__/stripe/cancelCheckoutAbierto.test.ts
//
// El criterio que decide si expiramos una sesión de checkout en Stripe. [T-601]
//
// Los mensajes de este fichero son los REALES: el que devolvió Stripe el 05/08/2026 al intentar
// cancelar la suscripción de `cnicolau2024@gmail.com` (16 veces en un minuto), y los vecinos que
// NO deben disparar una escritura.

import {
  esBloqueoPorCheckoutAbierto,
  sesionesAExpirar,
} from '@/lib/stripe/cancelCheckoutAbierto'

/** Literal, tal y como lo devolvió Stripe. Si esto cambia, el arreglo deja de actuar. */
const MENSAJE_REAL =
  'You cannot cancel a subscription with an active checkout session. Expire the checkout session instead.'

describe('esBloqueoPorCheckoutAbierto — reconocer el bloqueo real', () => {
  it('reconoce el mensaje EXACTO que devolvió Stripe en el caso que motiva esto', () => {
    expect(esBloqueoPorCheckoutAbierto({ message: MENSAJE_REAL })).toBe(true)
  })

  it('no depende de las mayúsculas', () => {
    expect(esBloqueoPorCheckoutAbierto({ message: MENSAJE_REAL.toUpperCase() })).toBe(true)
  })

  it('acepta la variante «can not» separada', () => {
    expect(
      esBloqueoPorCheckoutAbierto({
        message: 'You can not cancel a subscription with an active checkout session.',
      }),
    ).toBe(true)
  })
})

describe('esBloqueoPorCheckoutAbierto — NO actuar por parecido', () => {
  // Expirar un checkout es una ESCRITURA en Stripe sobre la compra de una persona. Confundir el
  // error dejaría sin sesión a quien está pagando bien en ese momento, así que se exigen las dos
  // ideas: que niega la cancelación Y que señala la sesión de checkout.

  it('un error que solo menciona checkout no basta', () => {
    expect(
      esBloqueoPorCheckoutAbierto({ message: 'No such checkout session: cs_live_xxx' }),
    ).toBe(false)
  })

  it('un «cannot cancel» por otro motivo no basta', () => {
    expect(
      esBloqueoPorCheckoutAbierto({
        message: 'You cannot cancel a subscription that is already canceled.',
      }),
    ).toBe(false)
  })

  it('un rechazo de tarjeta no tiene nada que ver', () => {
    expect(
      esBloqueoPorCheckoutAbierto({ code: 'card_declined', message: 'Your card was declined.' }),
    ).toBe(false)
  })

  it('sin error, sin mensaje o vacío: no se actúa', () => {
    expect(esBloqueoPorCheckoutAbierto(null)).toBe(false)
    expect(esBloqueoPorCheckoutAbierto(undefined)).toBe(false)
    expect(esBloqueoPorCheckoutAbierto({})).toBe(false)
    expect(esBloqueoPorCheckoutAbierto({ message: '' })).toBe(false)
  })

  it('falla hacia NO actuar: un texto que Stripe cambie deja el comportamiento anterior', () => {
    // Si un día el mensaje se reescribe, esto devuelve false y el usuario vuelve a ver el error
    // crudo — el fallo CONOCIDO. Nunca una escritura a ciegas.
    expect(
      esBloqueoPorCheckoutAbierto({ message: 'Subscription has a pending payment session.' }),
    ).toBe(false)
  })
})

describe('sesionesAExpirar — solo las que de verdad bloquean', () => {
  it('devuelve únicamente las `open`', () => {
    // Las 11 sesiones del caso real: 1 `open` y 10 `expired`. Solo la abierta bloqueaba.
    expect(
      sesionesAExpirar([
        { id: 'cs_open', status: 'open' },
        { id: 'cs_exp', status: 'expired' },
        { id: 'cs_ok', status: 'complete' },
      ]),
    ).toEqual(['cs_open'])
  })

  it('pedirle a Stripe que expire una sesión ya cerrada da error — por eso se filtra aquí', () => {
    expect(sesionesAExpirar([{ id: 'a', status: 'expired' }, { id: 'b', status: 'complete' }]))
      .toEqual([])
  })

  it('descarta las que no traen id', () => {
    expect(sesionesAExpirar([{ status: 'open' }, { id: '', status: 'open' }])).toEqual([])
  })

  it('tolera nulos y lista vacía sin reventar', () => {
    expect(sesionesAExpirar(null)).toEqual([])
    expect(sesionesAExpirar(undefined)).toEqual([])
    expect(sesionesAExpirar([])).toEqual([])
    expect(sesionesAExpirar([null, undefined])).toEqual([])
  })
})
