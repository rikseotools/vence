/**
 * @jest-environment node
 *
 * La IP que CORROBORA una huella tiene que ser de confianza — [T-657].
 *
 * Desde que la huella de hardware solo agrupa cuentas si comparten IP, esa IP es parte de una
 * decisión de antifraude. Dos formas de estropearlo, las dos probadas aquí:
 *   · aceptar una cabecera que pone el cliente → basta con mandar una IP distinta por cuenta para
 *     esquivar la agrupación, y el límite se vuelve decorativo;
 *   · dejar pasar el `'unknown'` que devuelve el resolvedor cuando no hay ninguna cabecera → se
 *     agruparían entre sí todos los desconocidos, que es el error contrario y peor.
 */
import { ipDeConfianza, getClientIp } from '@/lib/api/clientIp'

const req = (headers: Record<string, string>) => ({
  headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
})

describe('ipDeConfianza', () => {
  it('acepta la que pone el borde (CloudFront), sin el puerto', () => {
    expect(ipDeConfianza(req({ 'cloudfront-viewer-address': '81.44.20.3:41234' }))).toBe('81.44.20.3')
  })

  it('acepta la de Cloudflare', () => {
    expect(ipDeConfianza(req({ 'cf-connecting-ip': '81.44.20.3' }))).toBe('81.44.20.3')
  })

  it('RECHAZA x-forwarded-for a secas: lo puede escribir el cliente', () => {
    expect(ipDeConfianza(req({ 'x-forwarded-for': '81.44.20.3' }))).toBeNull()
    // …aunque getClientIp sí la devuelva: ese es justo el matiz que se estaba perdiendo.
    expect(getClientIp(req({ 'x-forwarded-for': '81.44.20.3' }))).toBe('81.44.20.3')
  })

  it('RECHAZA x-real-ip por el mismo motivo', () => {
    expect(ipDeConfianza(req({ 'x-real-ip': '81.44.20.3' }))).toBeNull()
  })

  it('sin ninguna cabecera devuelve null, NUNCA la cadena "unknown"', () => {
    expect(ipDeConfianza(req({}))).toBeNull()
    expect(getClientIp(req({}))).toBe('unknown')
  })

  it('una cabecera vacía no cuenta', () => {
    expect(ipDeConfianza(req({ 'cf-connecting-ip': '' }))).toBeNull()
  })

  it('el borde manda sobre la cabecera falsificable cuando vienen las dos', () => {
    expect(ipDeConfianza(req({
      'cf-connecting-ip': '81.44.20.3',
      'x-forwarded-for': '1.2.3.4',
    }))).toBe('81.44.20.3')
  })
})
