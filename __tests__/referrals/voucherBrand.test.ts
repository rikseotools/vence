// __tests__/referrals/voucherBrand.test.ts — de qué MARCA es un vale y dónde se canjea.
//
// POR QUÉ EXISTE (T-591, 05/08/2026). La tarjeta de «Mis vales» decía «Amazon.es» y enlazaba a
// `amazon.es/gc/redeem` fuera cual fuera la marca. Se descubrió al comprar los tres primeros vales
// de **Nike España** (retirada del propietario, 50+20+20 €): salían etiquetados como Amazon con un
// enlace donde su código no funciona.
//
// Lo que fija este test es la regla que evita repetirlo con la CUARTA marca: la marca se DERIVA del
// vale, y lo desconocido NO hereda el enlace de Amazon.

import { brandForVoucher, parseGiftcardRef, toVoucherDTO } from '@/lib/referrals/voucherView'

describe('brandForVoucher — la marca se deriva, no se supone', () => {
  it('reconoce Nike España por el product_id de Bitrefill', () => {
    const b = brandForVoucher('nike-spain', 'nike_giftcard')
    expect(b.label).toBe('Nike España')
    expect(b.redeemUrl).toContain('nike.com')
    expect(b.balanceUrl).toContain('nike.com')
  })

  it('reconoce Amazon.es por product_id y por el method legacy', () => {
    expect(brandForVoucher('amazon_es-spain', null).label).toBe('Amazon.es')
    // Las filas antiguas no guardan `_product`: nacieron con el DEFAULT de la columna `method`.
    expect(brandForVoucher(null, 'amazon_giftcard').label).toBe('Amazon.es')
    expect(brandForVoucher(null, 'amazon_giftcard').redeemUrl).toBe('https://www.amazon.es/gc/redeem')
  })

  it('el product_id MANDA sobre el method (es el id exacto del proveedor)', () => {
    // Caso real posible: fila creada con el method por defecto pero producto Nike en el ref.
    expect(brandForVoucher('nike-spain', 'amazon_giftcard').label).toBe('Nike España')
  })

  it('Zalando se reconoce por marca aunque su enlace no esté verificado (nunca se inventa)', () => {
    // 07/08/2026: zalando.es da 403 a fetch Y a navegador real desde nuestra IP, así que la URL de
    // canje no se pudo abrir. Registrar la marca SIN enlace es correcto; heredar el de Amazon no.
    for (const b of [brandForVoucher('zalando-spain', null), brandForVoucher(null, 'zalando_giftcard')]) {
      expect(b.label).toBe('Zalando España')
      expect(b.redeemUrl).toBeNull()
      expect(b.redeemCta).toBeNull()
      expect(b.redeemHint).toMatch(/tarjetas regalo/i)
    }
  })

  it('una marca DESCONOCIDA no hereda el enlace de Amazon — se queda sin destino', () => {
    const b = brandForVoucher('decathlon-spain', 'decathlon_giftcard')
    expect(b.redeemUrl).toBeNull()
    expect(b.redeemCta).toBeNull()
    expect(b.label).not.toMatch(/Amazon/)
    // Pero SIEMPRE dice algo: un código suelto sin instrucción alguna no es servible.
    expect(b.redeemHint.length).toBeGreaterThan(10)
  })

  it('sin marca ninguna (vale sin product ni method) tampoco inventa destino', () => {
    const b = brandForVoucher(null, null)
    expect(b.redeemUrl).toBeNull()
    expect(b.label).toBe('Tarjeta regalo')
  })

  it('los enlaces registrados son https y del dominio de su marca', () => {
    for (const [prod, host] of [['nike-spain', 'nike.com'], ['amazon_es-spain', 'amazon.es']] as const) {
      const b = brandForVoucher(prod, null)
      expect(b.redeemUrl!.startsWith('https://')).toBe(true)
      expect(new URL(b.redeemUrl!).hostname.endsWith(host)).toBe(true)
      if (b.balanceUrl) expect(new URL(b.balanceUrl).hostname.endsWith(host)).toBe(true)
    }
  })
})

describe('toVoucherDTO — la fila de BD tal como la lee la tarjeta', () => {
  const refNike = JSON.stringify({
    code: '6363426831131196145', pin: '866603', serial: '',
    _invoice_id: '74cc3d9b-9f47-43e3-8d43-866372c3b855', _product: 'nike-spain',
    _note: 'retirada del propietario',
  })

  it('un vale Nike real sale con su marca, su código y su PIN', () => {
    const v = toVoucherDTO({ amount: '50.00', giftcard_ref: refNike, method: 'nike_giftcard', purchased_via: 'bitrefill', paid_at: '2026-08-05T17:53:12.785Z' })
    expect(v.amount).toBe(50)
    expect(v.code).toBe('6363426831131196145')
    expect(v.pin).toBe('866603')
    expect(v.brand.label).toBe('Nike España')
  })

  it('la trazabilidad interna `_*` NO viaja al usuario', () => {
    const v = toVoucherDTO({ amount: 50, giftcard_ref: refNike, method: 'nike_giftcard', paid_at: null })
    const plano = JSON.stringify(v)
    expect(plano).not.toContain('74cc3d9b')     // _invoice_id
    expect(plano).not.toContain('retirada del propietario') // _note
    // …salvo el fallback link, que sí es suyo (lo necesita para canjear).
    const conFb = toVoucherDTO({ amount: 5, giftcard_ref: JSON.stringify({ code: 'X', _fallback_link: 'https://revealyourgift.com/abc' }), method: 'amazon_giftcard', paid_at: null })
    expect(conFb.fallbackLink).toBe('https://revealyourgift.com/abc')
  })

  it('una fila LEGACY en texto plano sigue sirviéndose (y como Amazon, que es lo que era)', () => {
    const v = toVoucherDTO({ amount: 5, giftcard_ref: 'ABCD-1234-EFGH', method: 'amazon_giftcard', paid_at: null })
    expect(v.code).toBe('ABCD-1234-EFGH')
    expect(v.pin).toBeNull()
    expect(v.brand.label).toBe('Amazon.es')
  })

  it('parseGiftcardRef no acepta un _fallback_link que no sea http (defensa de render)', () => {
    const p = parseGiftcardRef(JSON.stringify({ code: 'X', _fallback_link: 'javascript:alert(1)' }))
    expect(p.fallbackLink).toBeNull()
  })
})
