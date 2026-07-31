import {
  resolveClientIp,
  getClientIp,
  EDGE_PROVIDERS,
  type HeaderReader,
} from '@/lib/api/clientIp'
import { readFileSync } from 'fs'
import { join } from 'path'

const h = (o: Record<string, string>): HeaderReader => ({
  get: (n: string) => o[n.toLowerCase()] ?? null,
})

/**
 * IP del cliente agnóstica del CDN (27/07/2026).
 *
 * Lo que protegen estos tests no es "sabe leer una cabecera": es la ASIMETRÍA de
 * confianza. La versión anterior, al cambiar de borde, pasaba en silencio a fiarse
 * de `x-forwarded-for` —falsificable— mientras el antifraude seguía tratándola como
 * buena. Un control de seguridad debilitado sin avisar es peor que uno roto.
 */
describe('resolveClientIp', () => {
  describe('bordes de confianza', () => {
    it('CloudFront: quita el puerto (formato IP:puerto)', () => {
      const r = resolveClientIp(h({ 'cloudfront-viewer-address': '203.0.113.7:44321' }), undefined)
      expect(r).toEqual({ ip: '203.0.113.7', trust: 'trusted', source: 'cloudfront', foreignEdgeHeaders: [] })
    })

    it('CloudFront con IPv6: corta por el ÚLTIMO ":"', () => {
      const r = resolveClientIp(h({ 'cloudfront-viewer-address': '2001:db8::1:44321' }), undefined)
      expect(r.ip).toBe('2001:db8::1')
      expect(r.trust).toBe('trusted')
    })

    it('Cloudflare: CF-Connecting-IP viene pelada', () => {
      const r = resolveClientIp(h({ 'cf-connecting-ip': '198.51.100.4' }), undefined)
      expect(r).toEqual({ ip: '198.51.100.4', trust: 'trusted', source: 'cloudflare', foreignEdgeHeaders: [] })
    })

    it('añadir un proveedor es UNA fila: los declarados se resuelven todos', () => {
      for (const p of EDGE_PROVIDERS) {
        const raw = p.id === 'cloudfront' ? '203.0.113.9:1234' : '203.0.113.9'
        const r = resolveClientIp(h({ [p.header]: raw }), undefined)
        expect(r.trust).toBe('trusted')
        expect(r.ip).toBe('203.0.113.9')
      }
    })
  })

  describe('respaldo falsificable — nunca asciende a "trusted"', () => {
    it('x-forwarded-for se marca untrusted y coge el PRIMER salto', () => {
      const r = resolveClientIp(h({ 'x-forwarded-for': '203.0.113.1, 70.41.3.18' }), undefined)
      expect(r).toEqual({ ip: '203.0.113.1', trust: 'untrusted', source: 'x-forwarded-for', foreignEdgeHeaders: [] })
    })

    it('sin ninguna cabecera: unknown, y NO revienta', () => {
      expect(resolveClientIp(h({}), undefined)).toEqual({
        ip: 'unknown', trust: 'unknown', source: 'none', foreignEdgeHeaders: [],
      })
    })
  })

  describe('TRUSTED_EDGE — el interruptor que hace agnóstico el cambio de proveedor', () => {
    it('fijado a un borde, SOLO se confía en ese', () => {
      const cabeceras = h({ 'cf-connecting-ip': '198.51.100.4' })
      expect(resolveClientIp(cabeceras, 'cloudflare').trust).toBe('trusted')
      // Declaramos estar tras CloudFront: la cabecera de Cloudflare ya no vale.
      expect(resolveClientIp(cabeceras, 'cloudfront').trust).not.toBe('trusted')
    })

    it('EL CASO QUE MOTIVA TODO: declaras un borde, llega tráfico saltándoselo → untrusted', () => {
      // Alguien alcanza el origen directamente y se inventa las cabeceras.
      const suplantado = h({
        'cf-connecting-ip': '1.2.3.4',
        'x-forwarded-for': '9.9.9.9',
      })
      const r = resolveClientIp(suplantado, 'cloudfront')
      expect(r.trust).toBe('untrusted')
      expect(r.ip).toBe('9.9.9.9')
    })
  })

  describe('getClientIp (compatibilidad con los llamadores existentes)', () => {
    it('devuelve solo la IP, misma prioridad', () => {
      expect(getClientIp({ headers: h({ 'cloudfront-viewer-address': '203.0.113.7:1' }) })).toBe('203.0.113.7')
      expect(getClientIp({ headers: h({}) })).toBe('unknown')
    })
  })

  describe('cabecera de borde AJENO (31/07): el punto ciego que quedaba', () => {
    // Por qué: sin `TRUSTED_EDGE` una `cf-connecting-ip` falsificada se aceptaba como
    // buena. Ponerlo la ignora — pero en SILENCIO, que es el mismo pecado que motivó el
    // módulo. Ahora se ignora Y se reporta.
    it('estando tras CloudFront, una cf-connecting-ip inyectada NI se usa NI se calla', () => {
      const r = resolveClientIp(
        h({ 'cloudfront-viewer-address': '203.0.113.7:1', 'cf-connecting-ip': '9.9.9.9' }),
        'cloudfront',
      )
      expect(r.ip).toBe('203.0.113.7')            // gana la nuestra
      expect(r.trust).toBe('trusted')
      expect(r.foreignEdgeHeaders).toEqual(['cloudflare'])  // …y queda constancia
    })

    it('el caso peligroso: sin la cabecera buena, la ajena NO asciende a trusted', () => {
      const r = resolveClientIp(h({ 'cf-connecting-ip': '9.9.9.9' }), 'cloudfront')
      expect(r.trust).not.toBe('trusted')
      expect(r.ip).not.toBe('9.9.9.9')
      expect(r.foreignEdgeHeaders).toEqual(['cloudflare'])
    })

    it('el día que cambiemos a Cloudflare, basta cambiar TRUSTED_EDGE (agnóstico)', () => {
      const cabeceras = h({ 'cf-connecting-ip': '9.9.9.9' })
      expect(resolveClientIp(cabeceras, 'cloudflare')).toMatchObject({
        ip: '9.9.9.9', trust: 'trusted', source: 'cloudflare', foreignEdgeHeaders: [],
      })
    })

    it('en el caso normal (solo nuestro borde) no reporta nada: no hay ruido', () => {
      const r = resolveClientIp(h({ 'cloudfront-viewer-address': '203.0.113.7:1' }), 'cloudfront')
      expect(r.foreignEdgeHeaders).toEqual([])
    })

    it('sin TRUSTED_EDGE no inventa alarmas (no hay "ajeno" que valga)', () => {
      const r = resolveClientIp(h({ 'cf-connecting-ip': '9.9.9.9' }), undefined)
      expect(r.foreignEdgeHeaders).toEqual([])
    })
  })

  describe('anti-silo: que nadie vuelva a escribir su propia copia', () => {
    // Origen: había DOS copias locales (sessions/check-active, sessions/track-block)
    // que solo leían x-forwarded-for, y tres rutas leyéndolo a pelo.
    const raiz = join(__dirname, '..', '..', '..')
    const FICHEROS = [
      'app/api/sessions/check-active/route.ts',
      'app/api/sessions/track-block/route.ts',
      'app/api/auth/store-registration-ip/route.ts',
    ]

    it.each(FICHEROS)('%s usa el canónico y no lee la cabecera cruda', (f) => {
      const s = readFileSync(join(raiz, f), 'utf8')
      expect(s).toContain('resolveClientIp')
      expect(s).not.toMatch(/headers\.get\(['"]x-forwarded-for['"]\)/)
    })
  })
})
