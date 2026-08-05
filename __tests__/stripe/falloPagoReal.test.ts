/**
 * T-594 — El correo «Problema con el pago» solo debe salir cuando el pago ha fallado DE VERDAD.
 *
 * Los casos vienen de eventos reales de Stripe (cuenta Nila, 05/08/2026), no de imaginación:
 * el feedback `ec8e59fe` llegó con la secuencia payment_intent.requires_action → invoice.
 * payment_failed → (24 s después) charge.succeeded, y con la factura `paid` y `attempt_count=1`.
 */
import { describe, it, expect } from '@jest/globals'
import { decidirAvisoPagoFallido } from '@/lib/stripe/falloPagoReal'

describe('decidirAvisoPagoFallido', () => {
  describe('NO se avisa', () => {
    it('3DS/SCA en curso: la persona está en la pantalla de su banco', () => {
      const v = decidirAvisoPagoFallido({ status: 'open' }, { status: 'requires_action' })
      expect(v).toEqual({ avisar: false, motivo: 'autenticacion_pendiente' })
    })

    it('el error que reporta Stripe es "authentication_required", aunque el estado no lo diga', () => {
      const v = decidirAvisoPagoFallido(
        { status: 'open' },
        { status: 'requires_payment_method', last_payment_error: { code: 'authentication_required' } },
      )
      expect(v).toEqual({ avisar: false, motivo: 'autenticacion_pendiente' })
    })

    it('requires_confirmation también es autenticación pendiente', () => {
      expect(decidirAvisoPagoFallido({ status: 'open' }, { status: 'requires_confirmation' }).avisar).toBe(false)
    })

    it('la factura ya está pagada cuando la miramos (carrera con el cobro)', () => {
      const v = decidirAvisoPagoFallido({ status: 'paid' }, { status: 'requires_payment_method' })
      expect(v).toEqual({ avisar: false, motivo: 'ya_pagada' })
    })

    it('`paid: true` cuenta igual que status "paid"', () => {
      expect(decidirAvisoPagoFallido({ paid: true }, null).avisar).toBe(false)
    })

    it('el PaymentIntent ya entró (succeeded / processing)', () => {
      expect(decidirAvisoPagoFallido({ status: 'open' }, { status: 'succeeded' }).motivo).toBe('ya_pagada')
      expect(decidirAvisoPagoFallido({ status: 'open' }, { status: 'processing' }).motivo).toBe('ya_pagada')
    })
  })

  describe('SÍ se avisa — el fallo es real', () => {
    it('tarjeta rechazada', () => {
      const v = decidirAvisoPagoFallido(
        { status: 'open' },
        { status: 'requires_payment_method', last_payment_error: { code: 'card_declined' } },
      )
      expect(v).toEqual({ avisar: true, motivo: null })
    })

    it('fondos insuficientes', () => {
      expect(
        decidirAvisoPagoFallido(
          { status: 'open' },
          { status: 'requires_payment_method', last_payment_error: { code: 'insufficient_funds' } },
        ).avisar,
      ).toBe(true)
    })

    it('factura impagada sin más contexto', () => {
      expect(decidirAvisoPagoFallido({ status: 'open' }, { status: 'requires_payment_method' }).avisar).toBe(true)
    })
  })

  describe('falla hacia AVISAR — la duda no puede volverse silencio', () => {
    it('sin PaymentIntent (no vino, o Stripe no nos lo dio)', () => {
      expect(decidirAvisoPagoFallido({ status: 'open' }, null).avisar).toBe(true)
      expect(decidirAvisoPagoFallido({ status: 'open' }, undefined).avisar).toBe(true)
    })

    it('sin factura y sin PaymentIntent', () => {
      expect(decidirAvisoPagoFallido(null, null).avisar).toBe(true)
    })

    it('un estado de Stripe que no sabemos leer', () => {
      expect(decidirAvisoPagoFallido({ status: 'open' }, { status: 'estado_futuro_desconocido' }).avisar).toBe(true)
    })
  })
})
