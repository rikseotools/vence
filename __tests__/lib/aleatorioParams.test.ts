// __tests__/lib/aleatorioParams.test.ts
//
// Guardarraíl del caso Pilar (2026-06-22): el Test Aleatorio de una oposición
// SIN exámenes oficiales propios (Administrativo CARM C1) generaba una URL con
// `focus_essential=true` que la generación no podía satisfacer → pantalla de
// error "no puede generarlo". buildAleatorioTestParams NO debe emitir los flags
// que dependen de oficiales propios cuando hasOwnOfficialQuestions === false.

import { buildAleatorioTestParams, type AleatorioParamsInput } from '@/lib/test/aleatorioParams'

const base: AleatorioParamsInput = {
  selectedThemes: [22, 25, 28],
  numQuestions: 25,
  difficulty: 'mixed',
  onlyOfficialQuestions: false,
  includeSharedOfficials: false,
  focusEssentialArticles: false,
  adaptiveMode: false,
  includeSeenQuestions: false,
  hasOwnOfficialQuestions: true,
}

describe('buildAleatorioTestParams', () => {
  it('siempre incluye los params base', () => {
    const p = buildAleatorioTestParams(base)
    expect(p.get('themes')).toBe('22,25,28')
    expect(p.get('n')).toBe('25')
    expect(p.get('difficulty')).toBe('mixed')
    expect(p.get('mode')).toBe('aleatorio')
  })

  describe('oposición SIN oficiales propios (hasOwnOfficialQuestions = false)', () => {
    const noOfficials = { ...base, hasOwnOfficialQuestions: false }

    it('NO emite focus_essential aunque el flag venga activado (caso Pilar)', () => {
      const p = buildAleatorioTestParams({ ...noOfficials, focusEssentialArticles: true })
      expect(p.has('focus_essential')).toBe(false)
    })

    it('NO emite official_only ni only_official aunque el flag venga activado', () => {
      const p = buildAleatorioTestParams({ ...noOfficials, onlyOfficialQuestions: true })
      expect(p.has('official_only')).toBe(false)
      expect(p.has('only_official')).toBe(false)
    })

    it('NO emite include_shared_officials aunque venga activado', () => {
      const p = buildAleatorioTestParams({ ...noOfficials, includeSharedOfficials: true })
      expect(p.has('include_shared_officials')).toBe(false)
    })

    it('sí respeta los flags NO dependientes de oficiales (adaptive)', () => {
      const p = buildAleatorioTestParams({ ...noOfficials, adaptiveMode: true })
      expect(p.get('adaptive')).toBe('true')
    })
  })

  describe('oposición CON oficiales propios (hasOwnOfficialQuestions = true)', () => {
    it('emite focus_essential cuando el flag está activado', () => {
      const p = buildAleatorioTestParams({ ...base, focusEssentialArticles: true })
      expect(p.get('focus_essential')).toBe('true')
    })

    it('emite official_only + only_official (doble alias) + include_shared_officials', () => {
      const p = buildAleatorioTestParams({
        ...base,
        onlyOfficialQuestions: true,
        includeSharedOfficials: true,
      })
      // Doble alias: práctica lee only_official, examen lee official_only.
      expect(p.get('official_only')).toBe('true')
      expect(p.get('only_official')).toBe('true')
      expect(p.get('include_shared_officials')).toBe('true')
    })
  })

  it('emite prioritize_never_seen=false solo si includeSeenQuestions', () => {
    expect(buildAleatorioTestParams(base).has('prioritize_never_seen')).toBe(false)
    const p = buildAleatorioTestParams({ ...base, includeSeenQuestions: true })
    expect(p.get('prioritize_never_seen')).toBe('false')
  })
})
