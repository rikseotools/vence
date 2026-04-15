// __tests__/api/auth/extractOposicion.test.ts
// Tests del helper que extrae target_oposicion de la returnUrl del registro.
// Resuelve el caso de usuarios que no completan onboarding pero tienen señal
// en la URL (22 casos detectados en los últimos 7 días de abril/2026).

import { extractOposicionFromUrl } from '@/lib/api/auth/extract-oposicion'
import { OPOSICIONES } from '@/lib/config/oposiciones'

describe('extractOposicionFromUrl', () => {
  describe('entradas inválidas', () => {
    test('null → null / no_url', () => {
      expect(extractOposicionFromUrl(null)).toEqual({ positionType: null, reason: 'no_url' })
    })
    test('undefined → null / no_url', () => {
      expect(extractOposicionFromUrl(undefined)).toEqual({ positionType: null, reason: 'no_url' })
    })
    test('string vacío → null', () => {
      expect(extractOposicionFromUrl('')).toEqual({ positionType: null, reason: 'no_url' })
    })
  })

  describe('slug en primer segmento (high confidence)', () => {
    test('URL path con slug válido /auxiliar-administrativo-valencia/temario', () => {
      const r = extractOposicionFromUrl('/auxiliar-administrativo-valencia/temario')
      expect(r.positionType).toBe('auxiliar_administrativo_valencia')
      expect(r.reason).toBe('slug_in_path')
    })
    test('/auxilio-judicial/test/tema/1', () => {
      const r = extractOposicionFromUrl('/auxilio-judicial/test/tema/1')
      expect(r.positionType).toBe('auxilio_judicial')
    })
    test('/auxiliar-administrativo-estado/test/tema/101/test-personalizado?n=25', () => {
      const r = extractOposicionFromUrl('/auxiliar-administrativo-estado/test/tema/101/test-personalizado?n=25')
      expect(r.positionType).toBe('auxiliar_administrativo_estado')
      expect(r.reason).toBe('slug_in_path')
    })
    test('URL absoluta con slug', () => {
      const r = extractOposicionFromUrl('https://www.vence.es/auxiliar-administrativo-madrid/temario')
      expect(r.positionType).toBe('auxiliar_administrativo_madrid')
    })
    test('trailing slash', () => {
      const r = extractOposicionFromUrl('/tramitacion-procesal/')
      expect(r.positionType).toBe('tramitacion_procesal')
    })
    test('todos los slugs del catálogo se resuelven sin colisiones', () => {
      for (const opo of OPOSICIONES) {
        const r = extractOposicionFromUrl(`/${opo.slug}/temario`)
        expect(r.positionType).toBe(opo.positionType)
        expect(r.reason).toBe('slug_in_path')
      }
    })
  })

  describe('URLs ambiguas (→ null)', () => {
    test('/leyes/constitucion-espanola/... → null (no sabemos oposición)', () => {
      const r = extractOposicionFromUrl('/leyes/constitucion-espanola/avanzado?n=25')
      expect(r.positionType).toBeNull()
      expect(r.reason).toBe('ambiguous_or_unmappable')
    })
    test('/leyes/ley-39-2015/avanzado → null', () => {
      expect(extractOposicionFromUrl('/leyes/ley-39-2015/avanzado').positionType).toBeNull()
    })
    test('/soporte → null', () => {
      expect(extractOposicionFromUrl('/soporte').positionType).toBeNull()
    })
    test('/ (home) → null', () => {
      expect(extractOposicionFromUrl('/').positionType).toBeNull()
    })
    test('path inexistente /xyz/123 → null', () => {
      expect(extractOposicionFromUrl('/xyz/123').positionType).toBeNull()
    })
  })

  describe('UTM params', () => {
    test('?utm_oposicion=auxiliar_administrativo_cyl válido', () => {
      const r = extractOposicionFromUrl('/?utm_oposicion=auxiliar_administrativo_cyl')
      expect(r.positionType).toBe('auxiliar_administrativo_cyl')
      expect(r.reason).toBe('utm_param')
    })
    test('?opo=auxilio_judicial válido', () => {
      const r = extractOposicionFromUrl('/soporte?opo=auxilio_judicial')
      expect(r.positionType).toBe('auxilio_judicial')
      expect(r.reason).toBe('utm_param')
    })
    test('?utm_oposicion=valor_inventado → null', () => {
      expect(extractOposicionFromUrl('/?utm_oposicion=oposicion_xyz').positionType).toBeNull()
    })
    test('slug en path tiene prioridad sobre utm_oposicion inválido', () => {
      const r = extractOposicionFromUrl('/auxiliar-administrativo-estado/?utm_oposicion=fake')
      expect(r.positionType).toBe('auxiliar_administrativo_estado')
      expect(r.reason).toBe('slug_in_path')
    })
  })

  describe('regresión caso real (abril 2026)', () => {
    // 22 users NULL detectados, algunos con URL unambiguo:
    test('ainhoapac: /auxiliar-administrativo-valencia/temario → valencia', () => {
      expect(extractOposicionFromUrl('/auxiliar-administrativo-valencia/temario').positionType)
        .toBe('auxiliar_administrativo_valencia')
    })
    test('pinaza74: /auxilio-judicial/test/tema/1/test-personalizado?n=25 → auxilio_judicial', () => {
      expect(extractOposicionFromUrl('/auxilio-judicial/test/tema/1/test-personalizado?n=25').positionType)
        .toBe('auxilio_judicial')
    })
    test('hernandezzenaida42: /auxiliar-administrativo-estado/test/tema/101/... → estado', () => {
      expect(extractOposicionFromUrl('/auxiliar-administrativo-estado/test/tema/101/test-personalizado').positionType)
        .toBe('auxiliar_administrativo_estado')
    })
    test('fjap24769: /leyes/ley-7-1985/avanzado → null (correcto: es ambigua)', () => {
      expect(extractOposicionFromUrl('/leyes/ley-7-1985/avanzado?n=25').positionType).toBeNull()
    })
    test('login_directo con url="/" → null', () => {
      expect(extractOposicionFromUrl('/').positionType).toBeNull()
    })
  })
})
