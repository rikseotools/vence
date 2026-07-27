/**
 * @jest-environment node
 */
// __tests__/referrals/vouchers-endpoint.test.ts — el endpoint de "Mis vales".
//
// POR QUÉ EXISTE (27/07/2026). Bitrefill es un AGREGADOR: sirve las tarjetas de Amazon.es desde
// lotes de distintos distribuidores y **cada lote entrega un formato distinto**. Medido sobre los
// cinco vales comprados hasta esa fecha (misma denominación, cuatro días de diferencia):
//
//   11/07 → code + `extra_fields["Fallback link"]`   (revealyourgift.com)
//   13/07 → code a secas
//   15/07 → code + pin + serial
//   20/07 → code a secas
//   27/07 → code a secas
//
// La API no dice de qué lote viene, así que el formato NO se puede predecir ni exigir. Lo único
// constante es el `code` (5 de 5) — de ahí que la UI no pueda depender de pin/serial/enlace, y que
// el "dónde se canjea" tenga que ponerlo la app.
//
// Este test fija las dos cosas que importan: que el vale se sirve pase lo que pase con los extras,
// y que las claves internas `_*` (trazabilidad para soporte) NUNCA salen al usuario… salvo
// `_fallback_link`, que sí es suyo porque lo necesita para canjear.

import { NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_n: string, h: unknown) => h }))
jest.mock('@/db/client', () => ({ getReadDb: jest.fn() }))

import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getReadDb } from '@/db/client'
import { _GET } from '@/app/api/referrals/vouchers/route'

const req = () => new NextRequest('https://www.vence.es/api/referrals/vouchers')

function mockRows(rows: unknown[]) {
  ;(getReadDb as jest.Mock).mockReturnValue({ execute: jest.fn().mockResolvedValue(rows) })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthenticatedUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1' } })
})

describe('vouchers — los TRES formatos que entrega Bitrefill', () => {
  it('vale con pin + serial (lote del 15/07)', async () => {
    mockRows([{ amount: '5.00', purchased_via: 'bitrefill', paid_at: new Date('2026-07-15'),
      giftcard_ref: JSON.stringify({ code: 'X2BP-VN78C2-P4BS', pin: '216937', serial: '2614089911540397' }) }])
    const { vouchers } = await (await _GET(req())).json()
    expect(vouchers[0]).toMatchObject({ code: 'X2BP-VN78C2-P4BS', pin: '216937', serial: '2614089911540397', fallbackLink: null })
  })

  it('vale con enlace de revelación (lote del 11/07)', async () => {
    mockRows([{ amount: '5.00', purchased_via: 'bitrefill', paid_at: new Date('2026-07-11'),
      giftcard_ref: JSON.stringify({ code: 'VVDY-FAQM9L-C5BR', pin: '', serial: '', _fallback_link: 'https://revealyourgift.com/a/b' }) }])
    const { vouchers } = await (await _GET(req())).json()
    expect(vouchers[0].fallbackLink).toBe('https://revealyourgift.com/a/b')
  })

  it('vale con SOLO el código (el caso más común: 3 de 5)', async () => {
    mockRows([{ amount: '10.00', purchased_via: 'bitrefill', paid_at: new Date('2026-07-27'),
      giftcard_ref: JSON.stringify({ code: 'GT93-C6K2H2-JPB6', pin: '', serial: '', _fallback_link: null }) }])
    const { vouchers } = await (await _GET(req())).json()
    expect(vouchers[0]).toMatchObject({ code: 'GT93-C6K2H2-JPB6', fallbackLink: null })
    expect(vouchers[0].amount).toBe(10)
  })

  it('vale legacy en texto plano (sin JSON) sigue sirviéndose', async () => {
    mockRows([{ amount: '5.00', purchased_via: null, paid_at: null, giftcard_ref: '4UEF-TVPKHT-ZNBZ' }])
    const { vouchers } = await (await _GET(req())).json()
    expect(vouchers[0]).toMatchObject({ code: '4UEF-TVPKHT-ZNBZ', pin: null, serial: null, fallbackLink: null })
  })
})

describe('vouchers — la trazabilidad interna NO se filtra al usuario', () => {
  it('las claves _* de soporte no salen; el enlace de canje sí', async () => {
    mockRows([{ amount: '10.00', purchased_via: 'bitrefill', paid_at: new Date('2026-07-27'),
      giftcard_ref: JSON.stringify({
        code: 'GT93-C6K2H2-JPB6', pin: '', serial: '',
        _invoice_id: '28a453a4-49f9-427f-9dec-7c1e8d8c7982',
        _order_id: '6a67b12442fdfd94b01b25a7',
        _price_sats: 17909,
        _fallback_link: 'https://revealyourgift.com/x/y',
      }) }])
    const { vouchers } = await (await _GET(req())).json()
    const claves = Object.keys(vouchers[0])
    expect(claves).not.toContain('_invoice_id')
    expect(claves).not.toContain('_order_id')
    expect(claves).not.toContain('_price_sats')
    expect(JSON.stringify(vouchers[0])).not.toContain('17909')
    expect(vouchers[0].fallbackLink).toBe('https://revealyourgift.com/x/y') // este SÍ: lo necesita para canjear
  })

  it('un _fallback_link que no sea una URL http se descarta', async () => {
    mockRows([{ amount: '5.00', purchased_via: 'bitrefill', paid_at: null,
      giftcard_ref: JSON.stringify({ code: 'AAAA-BBBB', _fallback_link: '' }) }])
    const { vouchers } = await (await _GET(req())).json()
    expect(vouchers[0].fallbackLink).toBeNull()
  })
})
