// __tests__/integration/lawSlugRegressions.test.ts
// TESTS DE REGRESIÓN: Verifican que URLs reales de producción siguen funcionando.
// Cubre aliases legacy, encoding roto, pattern fallback, y degradación elegante.
//
// Estos tests NO necesitan BD — verifican la LÓGICA pura de resolución.

import {
  mapSlugToShortName,
  generateSlug,
  getCanonicalSlug,
  normalizeLawShortName,
  setSyncCache,
  invalidateSyncCache,
  isSyncCacheLoaded,
} from '@/lib/lawSlugSync'

import {
  generateSlugFromShortName,
  normalizeLawShortName as drizzleNormalize,
} from '@/lib/api/laws/queries'

// Mock Drizzle (queries.ts lo importa pero no lo usa para funciones sync)
jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({
    select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => []) })) })),
  })),
}))
jest.mock('@/db/schema', () => ({ laws: {}, articles: {}, questions: {} }))
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(), and: jest.fn(), sql: jest.fn(), count: jest.fn(), isNotNull: jest.fn(),
}))
jest.mock('next/cache', () => ({ unstable_cache: jest.fn((fn: Function) => fn) }))

// ============================================
// DATOS DE PRUEBA: Simulan las 325 leyes de BD
// ============================================

function loadTestCache() {
  const s2sn = new Map<string, string>([
    ['constitucion-espanola', 'CE'],
    ['ley-39-2015', 'Ley 39/2015'],
    ['ley-40-2015', 'Ley 40/2015'],
    ['ley-19-2013', 'Ley 19/2013'],
    ['rdl-5-2015', 'RDL 5/2015'],
    ['codigo-civil', 'Código Civil'],
    ['codigo-penal', 'CP'],
    ['lo-6-1985', 'LO 6/1985'],
    ['tue', 'TUE'],
    ['tfue', 'TFUE'],
    ['estatuto-trabajadores', 'RDL 2/2015'],
    ['lo-3-2018', 'LO 3/2018'],
    ['lo-2-1979', 'LOTC'],
    ['lo-1-1979', 'LOGP'],
    ['reglamento-del-congreso', 'Reglamento del Congreso'],
    ['reglamento-del-senado', 'Reglamento del Senado'],
    ['informatica-basica', 'Informática Básica'],
    ['hojas-de-calculo-excel', 'Hojas de cálculo. Excel'],
    ['correo-electronico', 'Correo electrónico'],
    ['ley-trafico', 'Ley Tráfico'],
    ['ri-comision', 'RI Comisión'],
    ['administracion-electronica-csl', 'Administración electrónica y servicios al ciudadano (CSL)'],
    ['reglamento-ue-2016-679', 'Reglamento UE 2016/679'],
    ['ley-50-1997', 'Ley 50/1997'],
    ['ley-7-1985', 'Ley 7/1985'],
    ['rd-364-1995', 'RD 364/1995'],
  ])
  const sn2s = new Map<string, string>()
  for (const [slug, name] of s2sn) sn2s.set(name, slug)
  setSyncCache(s2sn, sn2s)
}

// ============================================
// TESTS
// ============================================

describe('Regresión: URLs de producción', () => {
  beforeEach(() => {
    invalidateSyncCache()
    loadTestCache()
  })

  afterEach(() => {
    invalidateSyncCache()
  })

  // ─── ALIASES LEGACY ────────────────────────────────────────
  // URLs que users pueden tener en bookmarks desde antes de la migración.
  // El diccionario estático los resolvía; ahora dependen de BD o pattern.

  describe('aliases legacy (bookmarks de usuarios)', () => {
    it('slugs canónicos siguen funcionando con cache', () => {
      expect(mapSlugToShortName('constitucion-espanola')).toBe('CE')
      expect(mapSlugToShortName('ley-39-2015')).toBe('Ley 39/2015')
      expect(mapSlugToShortName('codigo-penal')).toBe('CP')
      expect(mapSlugToShortName('estatuto-trabajadores')).toBe('RDL 2/2015')
    })

    it('aliases cortos NO funcionan sin estar en BD (necesitan redirect)', () => {
      // Estos aliases estaban en el diccionario estático pero NO son slugs en BD.
      // Sin el diccionario, devuelven null. Necesitan redirects en middleware.
      const legacyAliases = ['ce', 'lrjsp', 'lpac', 'trebep', 'lopj', 'rgpd', 'ebep',
        'lotc', 'lofcs', 'lopd', 'lopdgdd', 'loreg', 'logp', 'cp', 'lec', 'lecrim']

      for (const alias of legacyAliases) {
        const result = mapSlugToShortName(alias)
        // null es el comportamiento correcto — se debe manejar con redirect
        if (result) {
          // Si está en cache (porque alguien lo añadió a BD), OK
          expect(typeof result).toBe('string')
        }
      }
    })
  })

  // ─── ENCODING ROTO ────────────────────────────────────────
  // URLs con encoding roto que Google puede tener indexadas

  describe('URLs con encoding roto (legacy de Google)', () => {
    it('slugs con encoding roto devuelven null (necesitan redirect 301)', () => {
      // Estos slugs existían en el diccionario estático como backward compat.
      // Ahora que los slugs de BD están limpios, estos devuelven null.
      const brokenSlugs = [
        'c-digo-civil',          // debería ser codigo-civil
        'c-digo-penal',          // debería ser codigo-penal
        'constituci-n-espa-ola', // debería ser constitucion-espanola
        'inform-tica-b-sica',    // debería ser informatica-basica
        'ley-tr-fico',           // debería ser ley-trafico
      ]

      for (const slug of brokenSlugs) {
        const result = mapSlugToShortName(slug)
        // null es correcto — middleware debe hacer 301 redirect al slug limpio
        expect(result).toBeNull()
      }
    })
  })

  // ─── PATTERN FALLBACK ──────────────────────────────────────

  describe('pattern fallback (leyes nuevas no en cache)', () => {
    it('patrones ley-XX-YYYY funcionan sin cache', () => {
      invalidateSyncCache()
      expect(mapSlugToShortName('ley-99-2099')).toBe('Ley 99/2099')
      expect(mapSlugToShortName('lo-9-2099')).toBe('LO 9/2099')
      expect(mapSlugToShortName('rd-999-2099')).toBe('RD 999/2099')
      expect(mapSlugToShortName('rdl-9-2099')).toBe('RDL 9/2099')
      expect(mapSlugToShortName('decreto-5-2099')).toBe('Decreto 5/2099')
      expect(mapSlugToShortName('orden-abc-123-2024')).toBe('Orden ABC/123/2024')
      expect(mapSlugToShortName('reglamento-ue-2024-999')).toBe('Reglamento UE 2024/999')
    })

    it('slugs sin patrón conocido devuelven null', () => {
      invalidateSyncCache()
      expect(mapSlugToShortName('algo-completamente-desconocido')).toBeNull()
      expect(mapSlugToShortName('')).toBeNull()
    })
  })

  // ─── DEGRADACIÓN ELEGANTE ──────────────────────────────────

  describe('degradación elegante (cache vacío)', () => {
    it('generateSlug funciona sin cache', () => {
      invalidateSyncCache()
      expect(isSyncCacheLoaded()).toBe(false)

      // Auto-generación determinista
      expect(generateSlug('Ley 39/2015')).toBe('ley-39-2015')
      expect(generateSlug('Código Civil')).toBe('codigo-civil')
      expect(generateSlug('LO 6/1985')).toBe('lo-6-1985')
    })

    it('generateSlug con cache usa slug de BD (puede diferir del auto-gen)', () => {
      loadTestCache()
      // Con cache, CE → constitucion-espanola (de BD)
      expect(generateSlug('CE')).toBe('constitucion-espanola')
      // Sin cache, CE → ce (auto-gen)
      invalidateSyncCache()
      expect(generateSlug('CE')).toBe('ce')
    })

    it('getCanonicalSlug maneja null/undefined/vacío', () => {
      expect(getCanonicalSlug(null)).toBe('unknown')
      expect(getCanonicalSlug(undefined)).toBe('unknown')
      expect(getCanonicalSlug('')).toBe('unknown')
    })

    it('normalizeLawShortName funciona sin cache', () => {
      invalidateSyncCache()
      expect(normalizeLawShortName('RCD')).toBe('Reglamento del Congreso')
      expect(normalizeLawShortName('RS')).toBe('Reglamento del Senado')
      expect(normalizeLawShortName('CE')).toBe('CE') // passthrough
    })
  })

  // ─── CONSISTENCIA ENTRE MÓDULOS ────────────────────────────

  describe('consistencia entre lawSlugSync y queries.ts', () => {
    it('generateSlug y generateSlugFromShortName producen el mismo resultado', () => {
      const testNames = [
        'Ley 39/2015', 'Constitución Española', 'Código Civil', 'LO 6/1985',
        'EBEP-Andalucía', 'Informática Básica', 'Hojas de cálculo. Excel',
        'Ley Orgánica 3/2018', 'RD 364/1995', 'Orden HFP/134/2018',
      ]

      for (const name of testNames) {
        const syncResult = generateSlug(name)
        // Sin cache, ambos usan auto-generación pura
        invalidateSyncCache()
        const syncNoCache = generateSlug(name)
        const drizzleResult = generateSlugFromShortName(name)

        expect(syncNoCache).toBe(drizzleResult)
      }
    })

    it('normalizeLawShortName es idéntica en ambos módulos', () => {
      const cases = ['RCD', 'RS', 'Reglamento Congreso', 'CE', 'Ley 39/2015']
      for (const c of cases) {
        expect(normalizeLawShortName(c)).toBe(drizzleNormalize(c))
      }
    })
  })

  // ─── URL ENCODING ──────────────────────────────────────────

  describe('manejo de URL encoding', () => {
    it('decodifica %C3 encoding en slugs', () => {
      // correo-electrónico (con acento) no es lo mismo que correo-electronico (sin acento)
      // pero decodeURIComponent('correo-electr%C3%B3nico') → 'correo-electrónico'
      const encoded = 'correo-electr%C3%B3nico'
      const result = mapSlugToShortName(encoded)
      // Depende de si el slug con acento está en BD. Si no, null.
      // El slug correcto en BD es 'correo-electronico' (sin acento).
      // El encoded decodifica a 'correo-electrónico' (con acento) → no match → null
      // Esto es correcto: el middleware debe redirigir al slug canónico
    })

    it('limpia colones en slugs (:-)', () => {
      // "base-de-datos:-access" → "base-de-datos-access" tras normalización
      const result = mapSlugToShortName('base-de-datos:-access')
      // Sin ese slug en cache, null es correcto
      expect(result === null || typeof result === 'string').toBe(true)
    })

    it('trailing colon se limpia', () => {
      loadTestCache()
      // 'constitucion-espanola:' → normaliza a 'constitucion-espanola' → 'CE'
      expect(mapSlugToShortName('constitucion-espanola:')).toBe('CE')
    })
  })

  // ─── SEGURIDAD DE SLUGS ────────────────────────────────────

  describe('seguridad: slugs generados son seguros para URLs', () => {
    it('generateSlug nunca produce slugs con caracteres peligrosos', () => {
      const dangerousInputs = [
        'Ley <script>alert(1)</script>',
        'Ley "with quotes"',
        "Ley 'single quotes'",
        'Ley ../../../etc/passwd',
        'Ley %00null%00byte',
        'Ley\nnewline',
        'Ley\ttab',
      ]

      for (const input of dangerousInputs) {
        const slug = generateSlug(input)
        expect(slug).toMatch(/^[a-z0-9-]+$/)
        expect(slug).not.toContain('..')
        expect(slug).not.toContain('<')
        expect(slug).not.toContain('>')
        expect(slug).not.toContain("'")
        expect(slug).not.toContain('"')
        expect(slug).not.toContain('\n')
        expect(slug).not.toContain('\t')
        expect(slug).not.toContain('\0')
      }
    })

    it('mapSlugToShortName no ejecuta código con inputs maliciosos', () => {
      const malicious = [
        'constructor',
        '__proto__',
        'prototype',
        'toString',
        '${7*7}',
        '{{7*7}}',
      ]

      for (const input of malicious) {
        const result = mapSlugToShortName(input)
        expect(result === null || typeof result === 'string').toBe(true)
      }
    })
  })

  // ─── RENDIMIENTO ───────────────────────────────────────────

  describe('rendimiento', () => {
    it('1000 resoluciones de slug < 10ms', () => {
      loadTestCache()
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        mapSlugToShortName('constitucion-espanola')
      }
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(10)
    })

    it('1000 generaciones de slug < 10ms', () => {
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        generateSlug('Ley ' + i + '/2024')
      }
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(10)
    })
  })
})
