// __tests__/chat/shared/unknownAbbreviationDetector.test.ts
// Verifica detección de abreviaturas no reconocidas (caso #1 auditoría).
// Los tests cargan una cache simulada para emular el contenido real de BD.

import {
  detectUnknownAbbreviations,
  buildClarificationRequest,
} from '@/lib/chat/shared/unknownAbbreviationDetector'
import { setSyncCache, invalidateSyncCache } from '@/lib/lawSlugSync'

function loadTestCache() {
  // short_name → slug (lo que existe en BD)
  const sn2s = new Map<string, string>([
    ['CE', 'constitucion-espanola'],
    ['LOTC', 'lotc'],
    ['LECrim', 'rd-14-sep-1882'],
    ['LOFCS', 'lo-2-1986'],
    ['CP', 'codigo-penal'],
    ['LSP', 'ley-5-2014'],
    ['Ley 39/2015', 'ley-39-2015'],
    ['LO 6/1985', 'lo-6-1985'],
  ])
  const s2sn = new Map<string, string>()
  for (const [name, slug] of sn2s) s2sn.set(slug, name)
  setSyncCache(s2sn, sn2s)
}

describe('detectUnknownAbbreviations', () => {
  beforeEach(() => {
    invalidateSyncCache()
    loadTestCache()
  })
  afterEach(() => invalidateSyncCache())

  describe('reconoce abreviaturas que SON short_name en BD', () => {
    test('CE → ignorada por longitud (2 chars), pero NO va a unknown', () => {
      // CE tiene 2 chars y el filtro min-3 la descarta. La detección de CE
      // como ley ocurre en detectMentionedLaws (otro path). Aquí solo
      // queremos garantizar que no genere falso positivo en unknown.
      const r = detectUnknownAbbreviations('qué dice el art 53 CE')
      expect(r.candidates).not.toContain('CE')
      expect(r.unknown).toEqual([])
    })

    test('LECrim (≥3 chars) → reconocida (mixed case)', () => {
      const r = detectUnknownAbbreviations('qué dice la LECrim sobre prescripción')
      expect(r.candidates).toContain('LECrim')
      expect(r.unknown).toEqual([])
    })

    test('LOTC → reconocida (slug=lotc, short_name=LOTC)', () => {
      const r = detectUnknownAbbreviations('art 50 LOTC sobre amparo')
      expect(r.candidates).toContain('LOTC')
      expect(r.unknown).toEqual([])
    })
  })

  describe('marca como unknown las que no están en cache', () => {
    test('LOPJ → unknown (short_name canónico es "LO 6/1985")', () => {
      const r = detectUnknownAbbreviations('Art 36 LOPJ')
      expect(r.unknown).toContain('LOPJ')
    })

    test('LPAC → unknown', () => {
      const r = detectUnknownAbbreviations('según la LPAC')
      expect(r.unknown).toContain('LPAC')
    })

    test('TREBEP → unknown', () => {
      const r = detectUnknownAbbreviations('el TREBEP art 14')
      expect(r.unknown).toContain('TREBEP')
    })

    test('LRJSP → unknown', () => {
      const r = detectUnknownAbbreviations('plazo en el LRJSP')
      expect(r.unknown).toContain('LRJSP')
    })

    test('sigla totalmente inventada (XYZ) → unknown', () => {
      const r = detectUnknownAbbreviations('qué dice el ABCD sobre plazos')
      expect(r.unknown).toContain('ABCD')
    })
  })

  describe('filtros anti-ruido', () => {
    test('palabras en NOT_ABBREVIATIONS no se capturan (CUALQUIER)', () => {
      const r = detectUnknownAbbreviations('CUALQUIER ciudadano puede recurrir')
      expect(r.candidates).not.toContain('CUALQUIER')
    })

    test('preposición ANTE no se captura', () => {
      const r = detectUnknownAbbreviations('comparecer ANTE el tribunal')
      expect(r.candidates).not.toContain('ANTE')
    })

    test('fragmento de palabra acentuada NO se captura (ATRAV de ATRAVÉS)', () => {
      // Caso real del log #1: "ATRAVÉS DEL RECURSO" se troceaba como "ATRAV"
      const r = detectUnknownAbbreviations('a través DEL recurso ATRAVÉS de tribunales')
      expect(r.candidates).not.toContain('ATRAV')
      expect(r.unknown).not.toContain('ATRAV')
    })

    test('siglas de 2 chars descartadas (CC, CP cortos)', () => {
      // Trade-off: filtrar 2-letter elimina ruido pero pierde algunas
      // siglas reales. Esas leyes se detectan via aliases del nombre completo.
      const r = detectUnknownAbbreviations('CC art 1902 responsabilidad civil')
      expect(r.candidates).toEqual([])
    })
  })

  describe('modo "grito" — mensaje mayoritariamente en mayúsculas', () => {
    test('mensaje 100% caps no marca unknown (evita falsos positivos)', () => {
      // Caso real del log #1: usuario escribe enunciado oficial en mayúsculas.
      // No podemos distinguir sigla de palabra normal. Solo confiamos en lo
      // que detectMentionedLaws encuentra por short_name conocido.
      const r = detectUnknownAbbreviations(
        '53.2 CE CUALQUIER CIUDADANO PUEDE RECABAR LA TUTELA DE DERECHOS Y LIBERTADES ATRAVÉS DEL RECURSO DE AMPARO ANTE EL TRIBUNAL CONSTITUCIONAL',
      )
      expect(r.unknown).toEqual([])
    })

    test('grito sin sigla real → no falso positivo', () => {
      const r = detectUnknownAbbreviations('POR FAVOR EXPLICAME LA RESPUESTA AHORA')
      expect(r.unknown).toEqual([])
    })

    test('mensaje normal con sigla → SÍ marca unknown', () => {
      const r = detectUnknownAbbreviations('me puedes decir qué dice el art 36 de la LOPJ')
      expect(r.unknown).toContain('LOPJ')
    })
  })

  describe('edge cases', () => {
    test('mensaje sin abreviaturas → arrays vacíos', () => {
      const r = detectUnknownAbbreviations('plazo para presentar el recurso administrativo')
      expect(r.candidates).toEqual([])
      expect(r.unknown).toEqual([])
    })

    test('múltiples siglas desconocidas', () => {
      const r = detectUnknownAbbreviations('plazo para recurrir según LPAC y LRJSP')
      expect(r.unknown).toContain('LPAC')
      expect(r.unknown).toContain('LRJSP')
    })

    test('mensaje vacío', () => {
      const r = detectUnknownAbbreviations('')
      expect(r.candidates).toEqual([])
      expect(r.unknown).toEqual([])
    })
  })
})

describe('buildClarificationRequest', () => {
  test('1 sigla — singular', () => {
    const text = buildClarificationRequest(['LOPJ'])
    expect(text).toContain('**LOPJ**')
    expect(text).toMatch(/no la tengo identificada/i)
  })

  test('múltiples siglas — plural', () => {
    const text = buildClarificationRequest(['LPAC', 'LRJSP'])
    expect(text).toContain('**LPAC**')
    expect(text).toContain('**LRJSP**')
    expect(text).toMatch(/no las tengo identificadas/i)
  })

  test('array vacío → string vacío', () => {
    expect(buildClarificationRequest([])).toBe('')
  })

  test('incluye ejemplo de formato esperado', () => {
    const text = buildClarificationRequest(['ABCD'])
    expect(text).toMatch(/nombre completo|número/i)
  })
})
