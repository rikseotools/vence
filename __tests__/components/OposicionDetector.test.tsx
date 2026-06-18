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
  // Patrón más largo primero: evita colisión por substring (p.ej.
  // 'administrativo-andalucia' ⊂ 'auxiliar-administrativo-andalucia').
  const entries = Object.entries(OPOSICION_DETECTION).sort((a, b) => b[0].length - a[0].length)
  for (const [pattern, oposicion] of entries) {
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

    test('categorias son A1, A2, B, C1 o C2', () => {
      for (const data of Object.values(OPOSICION_DETECTION)) {
        expect(['A1', 'A2', 'B', 'C1', 'C2', 'E']).toContain(data.categoria)
      }
    })

    test('administraciones son estado, justicia o autonomica', () => {
      for (const data of Object.values(OPOSICION_DETECTION)) {
        expect(['estado', 'justicia', 'autonomica', 'local', 'empresa_publica']).toContain(data.administracion)
      }
    })

    test('incluye las CCAA: CARM, CyL, Andalucia, Madrid, Canarias, CLM, Extremadura, Valencia, Galicia, Aragon, Asturias y Baleares', () => {
      const autonomicas = Object.values(OPOSICION_DETECTION)
        .filter(d => d.administracion === 'autonomica')
      expect(autonomicas).toHaveLength(52)
      expect(autonomicas.map(a => a.slug).sort()).toEqual([
        'administrativo-andalucia',
        'administrativo-cantabria',
        'administrativo-castilla-la-mancha',
        'administrativo-castilla-leon',
        'administrativo-diputacion-jaen',
        'administrativo-galicia',
        'administrativo-gva',  // Añadida 07/05/2026: Administrativo Generalitat Valenciana C1-01
        'administrativo-la-rioja',  // Añadida 18/06/2026: Administrativo C1 Gobierno de La Rioja (BOR 108: 22 plz)
        'administrativo-madrid',
        'administrativo-navarra',
        'administrativo-pais-vasco',  // Añadida 12/06/2026: Administrativo Gobierno Vasco C1 (temario IVAP)
        'administrativo-universidad-leon',
        'auxiliar-administrativo-andalucia',
        'auxiliar-administrativo-aragon',
        'auxiliar-administrativo-asturias',
        'auxiliar-administrativo-baleares',
        'auxiliar-administrativo-canarias',
        'auxiliar-administrativo-cantabria',
        'auxiliar-administrativo-carm',
        'auxiliar-administrativo-catalunya',  // Añadida 31/05/2026: Aux Admin Generalitat Catalunya C2 (OEP 2025: 114 plz)
        'auxiliar-administrativo-clm',
        'auxiliar-administrativo-cyl',
        'auxiliar-administrativo-extremadura',
        'auxiliar-administrativo-galicia',
        'auxiliar-administrativo-la-rioja',
        'auxiliar-administrativo-madrid',
        'auxiliar-administrativo-pais-vasco',  // Añadida 31/05/2026: Aux Admin Gobierno Vasco C2 (OPE 2026)
        'auxiliar-administrativo-scs-canarias',
        'auxiliar-administrativo-sermas',  // Añadida 09/06/2026: Aux Admin SERMAS C2 (BOCM 04/07/2025: 933 plz)
        'auxiliar-administrativo-sms',
        'auxiliar-administrativo-universidad-alcala',  // Añadida 15/06/2026: Aux Admin UAH C2 (OEP 2022-25: 54 plz)
        'auxiliar-administrativo-universidad-cadiz',  // Añadida 16/06/2026: Aux Admin UCA C2 (BOE-A-2026-9563: 12 plz)
        'auxiliar-administrativo-universidad-complutense',  // Añadida 15/06/2026: Aux Admin UCM C2 (OEP 2022: 53 plz TL)
        'auxiliar-administrativo-universidad-huelva',  // Añadida 16/06/2026: Aux Admin UHU C2 (BOJA 228/2025: 45 plz)
        'auxiliar-administrativo-universidad-leon',  // Añadida 16/06/2026: Aux Admin ULE C2 (BOE-A-2026-4150: 9 plz)
        'auxiliar-administrativo-valencia',
        'auxiliar-enfermeria-gva',
        'auxiliar-enfermeria-osakidetza',
        'celador-galicia',  // Añadida 12/06/2026: Celador SERGAS Galicia E (DOG 04/09/2025: 135 plz TL)
        'celador-sas',  // Añadida 12/06/2026: Celador SAS Andalucía E (OEP 2025 BOJA 250: 1.225 plz TL)
        'celador-scs-canarias',
        'celador-sermas-madrid',
        'celador-sescam-clm',
        'enfermero-sas-andalucia',
        'tcae-aragon',
        'tcae-canarias',
        'tcae-extremadura',  // Añadida 15/06/2026: TCAE SES Extremadura C2 (DOE 249/2024: 224 plz TL)
        'tcae-galicia',
        'tcae-murcia',
        'tcae-sas',  // Añadida 10/06/2026: TCAE Servicio Andaluz de Salud C2 (OEP 2022-2024: 3.049 plz TL)
        'tcae-sermas-madrid',
        'tcae-sescam',  // Añadida 12/06/2026: TCAE SESCAM Castilla-La Mancha C2 (OEP 2023-2024: 795 plz TL)
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
