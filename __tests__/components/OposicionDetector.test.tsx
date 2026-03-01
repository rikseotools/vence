/**
 * Tests para OposicionDetector.tsx
 *
 * El componente no renderiza nada (return null) y su lógica principal
 * depende de Supabase auth + DB. Testeamos:
 * 1. La estructura del mapa OPOSICION_DETECTION (datos derivados de config)
 * 2. La lógica de detección de URL (extraída para testing)
 * 3. Que el componente renderiza null
 */
import { render } from '@testing-library/react'
import { OPOSICIONES } from '@/lib/config/oposiciones'

// Mock de next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/test'
}))

// Mock de supabase
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    })
  })
}))

// ============================================================
// Generar OPOSICION_DETECTION desde config (igual que el componente)
// ============================================================

interface OposicionData {
  id: string
  name: string
  categoria: string
  administracion: string
  slug: string
}

const OPOSICION_DETECTION: Record<string, OposicionData> = {
  ...Object.fromEntries(
    OPOSICIONES.map(o => [o.slug, {
      id: o.id,
      name: o.name,
      categoria: o.badge,
      administracion: o.administracion,
      slug: o.slug,
    }])
  ),
  'gestion-procesal': {
    id: 'gestion_procesal',
    name: 'Gestión Procesal y Administrativa',
    categoria: 'C1',
    administracion: 'justicia',
    slug: 'gestion-procesal'
  },
}

function detectOposicionFromUrl(pathname: string | null) {
  if (!pathname) return null
  for (const [pattern, oposicion] of Object.entries(OPOSICION_DETECTION)) {
    if (pathname.includes(pattern)) {
      return oposicion
    }
  }
  return null
}

// ============================================================
// Tests
// ============================================================

describe('OposicionDetector', () => {
  describe('OPOSICION_DETECTION - estructura', () => {
    test('tiene las oposiciones de config + extras', () => {
      // 8 de config + 1 extra (gestion-procesal)
      expect(Object.keys(OPOSICION_DETECTION).length).toBe(OPOSICIONES.length + 1)
    })

    test('cada entrada tiene los campos requeridos', () => {
      for (const [slug, data] of Object.entries(OPOSICION_DETECTION)) {
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('name')
        expect(data).toHaveProperty('categoria')
        expect(data).toHaveProperty('administracion')
        expect(data).toHaveProperty('slug')
        expect(data.slug).toBe(slug)
      }
    })

    test('todos los IDs usan underscore (no guion)', () => {
      for (const data of Object.values(OPOSICION_DETECTION)) {
        expect(data.id).not.toContain('-')
        expect(data.id).toMatch(/^[a-z_]+$/)
      }
    })

    test('todos los slugs usan guion (no underscore)', () => {
      for (const slug of Object.keys(OPOSICION_DETECTION)) {
        expect(slug).not.toContain('_')
        expect(slug).toMatch(/^[a-z0-9-]+$/)
      }
    })

    test('categorias son C1 o C2', () => {
      for (const data of Object.values(OPOSICION_DETECTION)) {
        expect(['C1', 'C2']).toContain(data.categoria)
      }
    })

    test('administraciones son estado, justicia o autonomica', () => {
      for (const data of Object.values(OPOSICION_DETECTION)) {
        expect(['estado', 'justicia', 'autonomica']).toContain(data.administracion)
      }
    })

    test('incluye las CCAA: CARM, CyL, Andalucia, Madrid, Canarias, CLM y Extremadura', () => {
      const autonomicas = Object.values(OPOSICION_DETECTION)
        .filter(d => d.administracion === 'autonomica')
      expect(autonomicas).toHaveLength(7)
      expect(autonomicas.map(a => a.slug).sort()).toEqual([
        'auxiliar-administrativo-andalucia',
        'auxiliar-administrativo-canarias',
        'auxiliar-administrativo-carm',
        'auxiliar-administrativo-clm',
        'auxiliar-administrativo-cyl',
        'auxiliar-administrativo-extremadura',
        'auxiliar-administrativo-madrid',
      ])
    })

    test('datos derivados de config coinciden con config central', () => {
      for (const oposicion of OPOSICIONES) {
        const detection = OPOSICION_DETECTION[oposicion.slug]
        expect(detection).toBeDefined()
        expect(detection.id).toBe(oposicion.id)
        expect(detection.name).toBe(oposicion.name)
        expect(detection.categoria).toBe(oposicion.badge)
        expect(detection.administracion).toBe(oposicion.administracion)
      }
    })
  })

  describe('detectOposicionFromUrl', () => {
    test('detecta oposicion en URL de test', () => {
      const result = detectOposicionFromUrl('/auxiliar-administrativo-madrid/test/tema/1')
      expect(result?.id).toBe('auxiliar_administrativo_madrid')
    })

    test('detecta oposicion en URL de temario', () => {
      const result = detectOposicionFromUrl('/tramitacion-procesal/temario/tema-5')
      expect(result?.id).toBe('tramitacion_procesal')
    })

    test('detecta oposicion base (sin subruta)', () => {
      const result = detectOposicionFromUrl('/auxiliar-administrativo-estado')
      expect(result?.id).toBe('auxiliar_administrativo_estado')
    })

    test('devuelve null para URL sin oposicion', () => {
      expect(detectOposicionFromUrl('/perfil')).toBeNull()
      expect(detectOposicionFromUrl('/login')).toBeNull()
      expect(detectOposicionFromUrl('/')).toBeNull()
    })

    test('devuelve null para pathname null', () => {
      expect(detectOposicionFromUrl(null)).toBeNull()
    })

    test('detecta cada oposicion correctamente', () => {
      for (const [slug, expected] of Object.entries(OPOSICION_DETECTION)) {
        const result = detectOposicionFromUrl(`/${slug}/test`)
        expect(result?.id).toBe(expected.id)
      }
    })

    test('no confunde auxiliar-administrativo-estado con carm/cyl/etc', () => {
      // auxiliar-administrativo-estado NO debe matchear antes que las CCAA
      const result = detectOposicionFromUrl('/auxiliar-administrativo-carm/test')
      expect(result?.id).toBe('auxiliar_administrativo_carm')
      expect(result?.id).not.toBe('auxiliar_administrativo_estado')
    })
  })

  describe('renderizado', () => {
    test('renderiza null (componente invisible)', () => {
      const OposicionDetector = require('@/components/OposicionDetector').default
      const { container } = render(<OposicionDetector />)
      expect(container.innerHTML).toBe('')
    })
  })
})
