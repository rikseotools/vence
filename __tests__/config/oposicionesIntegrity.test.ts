/**
 * Tests cross-config que bloquean los bugs sistémicos detectados el 31/05/2026
 * tras añadir Catalunya + País Vasco landings.
 *
 * Cada test corresponde a un bug real que pasó por CI sin ser detectado:
 *
 * 1. `color: 'yellow'` no existía en COLOR_SCHEMES → fallback silencioso a
 *    emerald, landing con color erróneo.
 * 2. `auxiliar_administrativo_catalunya` añadida a OPOSICIONES sin entrada
 *    `'cataluna'` en CCAA_FILTERS → /oposiciones/cataluna 404, sitemap incompleto.
 * 3. `oposicionToCcaa('auxiliar-administrativo-pais-vasco')` no devolvía
 *    'pais-vasco' → filtros por CCAA no funcionan para esa oposición.
 * 4. ALL_OPOSICION_SLUGS sigue derivado, pero los tests hardcoded en counts
 *    (42, 28...) requieren update manual. Este test detecta inconsistencias
 *    entre OPOSICIONES.length y los derivados.
 * 5. Páginas estáticas legacy huérfanas (page.tsx para slug no en OPOSICIONES).
 *
 * Cualquier PR que añada una nueva oposición sin actualizar los registros
 * cruzados fallará en CI antes de mergear.
 */

import { OPOSICIONES, ALL_OPOSICION_SLUGS, ALL_POSITION_TYPES } from '@/lib/config/oposiciones'
import { COLOR_SCHEMES } from '@/lib/utils/landing-colors'
import { CCAA_FILTERS, TIPO_FILTERS, oposicionToCcaa } from '@/app/oposiciones/lib/oposiciones-filters'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('OPOSICIONES integrity (cross-config)', () => {
  // ============================================================
  // BLOQUEO #1: cada `color` debe existir en COLOR_SCHEMES
  // Origen: 31/05/2026 Catalunya con color='yellow' no existente
  // ============================================================
  describe('colores referenciados existen en COLOR_SCHEMES', () => {
    test.each(OPOSICIONES.map(o => [o.slug, o.color] as const))(
      '%s: color "%s" existe en COLOR_SCHEMES',
      (_slug, color) => {
        expect(COLOR_SCHEMES[color]).toBeDefined()
      }
    )

    test('lista de colores válidos documentada (informativo)', () => {
      const validColors = Object.keys(COLOR_SCHEMES).sort()
      // Si esta lista cambia, actualiza el manual crear-nueva-oposicion §4a
      expect(validColors).toEqual([
        'amber',
        'blue',
        'cyan',
        'emerald',
        'green',
        'indigo',
        'orange',
        'purple',
        'red',
        'rose',
        'sky',
        'teal',
        'violet',
        'yellow',
      ])
    })
  })

  // ============================================================
  // BLOQUEO #2: si oposicionToCcaa() devuelve slug, debe existir
  // como entrada en CCAA_FILTERS (sin esto → /oposiciones/X 404)
  // Origen: 31/05/2026 Catalunya mapeaba a 'cataluna' inexistente
  // ============================================================
  describe('mappings CCAA son consistentes con CCAA_FILTERS o TIPO_FILTERS', () => {
    test.each(OPOSICIONES.map(o => o.slug))(
      'oposicionToCcaa(%s) → null o slug existente en CCAA_FILTERS / TIPO_FILTERS',
      (slug) => {
        const result = oposicionToCcaa(slug)
        if (result !== null) {
          // La función puede devolver una CCAA (cataluna, madrid…) o un tipo
          // (estado, justicia) para oposiciones nacionales. Ambos válidos.
          const inCcaa = CCAA_FILTERS[result] !== undefined
          const inTipo = TIPO_FILTERS[result] !== undefined
          expect(inCcaa || inTipo).toBe(true)
        }
      }
    )
  })

  // ============================================================
  // BLOQUEO #3: cada OPOSICIONES con administracion='autonomica'
  // debe tener mapping en oposicionToCcaa (sin esto, no aparece
  // en /oposiciones?ccaa=X y se rompe la navegación por CCAA).
  // Excepciones: añadir slug a ALLOWLIST_SIN_CCAA si es legítimo.
  // Origen: 31/05/2026 Catalunya + P.Vasco sin mapping
  // ============================================================
  describe('cada OPOSICIONES autonómica tiene mapping CCAA', () => {
    // Allowlist: oposiciones autonómicas que LEGÍTIMAMENTE no mapean a una
    // CCAA específica (ej. genéricas multi-territorio). Vacío por ahora.
    const ALLOWLIST_SIN_CCAA = new Set<string>([])

    const autonomicas = OPOSICIONES.filter(o => o.administracion === 'autonomica')

    test.each(autonomicas.map(o => o.slug))(
      '%s: tiene mapping en oposicionToCcaa()',
      (slug) => {
        if (ALLOWLIST_SIN_CCAA.has(slug)) return
        expect(oposicionToCcaa(slug)).not.toBeNull()
      }
    )
  })

  // ============================================================
  // BLOQUEO #4: derivados ALL_OPOSICION_SLUGS / ALL_POSITION_TYPES
  // deben coincidir con OPOSICIONES.length y no tener duplicados.
  // Origen: detección preventiva de drifts de configuración.
  // ============================================================
  describe('derivados están sincronizados con OPOSICIONES', () => {
    test('ALL_OPOSICION_SLUGS.length === OPOSICIONES.length', () => {
      expect(ALL_OPOSICION_SLUGS).toHaveLength(OPOSICIONES.length)
    })

    test('ALL_POSITION_TYPES.length === OPOSICIONES.length', () => {
      expect(ALL_POSITION_TYPES).toHaveLength(OPOSICIONES.length)
    })

    test('cada OPOSICIONES.slug está en ALL_OPOSICION_SLUGS', () => {
      for (const op of OPOSICIONES) {
        expect(ALL_OPOSICION_SLUGS).toContain(op.slug)
      }
    })

    test('cada OPOSICIONES.positionType está en ALL_POSITION_TYPES', () => {
      for (const op of OPOSICIONES) {
        expect(ALL_POSITION_TYPES).toContain(op.positionType)
      }
    })

    test('slugs únicos (no duplicados)', () => {
      const set = new Set(OPOSICIONES.map(o => o.slug))
      expect(set.size).toBe(OPOSICIONES.length)
    })

    test('positionTypes únicos (no duplicados)', () => {
      const set = new Set(OPOSICIONES.map(o => o.positionType))
      expect(set.size).toBe(OPOSICIONES.length)
    })

    test('ids únicos (no duplicados)', () => {
      const set = new Set(OPOSICIONES.map(o => o.id))
      expect(set.size).toBe(OPOSICIONES.length)
    })
  })

  // ============================================================
  // BLOQUEO #5: page.tsx estáticos huérfanos (slug sin OPOSICIONES)
  // Detecta páginas legacy que apuntan a oposiciones eliminadas
  // del catálogo (404 silencioso al navegar internamente).
  // ============================================================
  describe('page.tsx estáticos están en OPOSICIONES (no huérfanos)', () => {
    // Buscar carpetas con page.tsx que parezcan slugs de oposiciones
    const appDir = path.join(process.cwd(), 'app')
    const knownSlugSet = new Set(OPOSICIONES.map(o => o.slug))

    // Patrones de slugs de oposiciones (heurística para distinguir de rutas técnicas)
    const opoSlugPatterns = [
      /^auxiliar-/,
      /^administrativo-/,
      /^tcae-/,
      /^celador-/,
      /^enfermero-/,
      /^auxilio-/,
      /^tramitacion-/,
      /^correos-/,
      /^guardia-civil$/,
      /^policia-/,
    ]

    const candidateDirs = fs.existsSync(appDir)
      ? fs.readdirSync(appDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
          .filter(name => opoSlugPatterns.some(re => re.test(name)))
          .filter(name => fs.existsSync(path.join(appDir, name, 'page.tsx')))
      : []

    if (candidateDirs.length === 0) {
      test('(skipped) no hay page.tsx estáticos que parezcan oposiciones', () => {
        expect(true).toBe(true)
      })
    } else {
      test.each(candidateDirs)(
        'page.tsx estático "%s" corresponde a una OPOSICIONES.slug',
        (slug) => {
          expect(knownSlugSet.has(slug)).toBe(true)
        }
      )
    }
  })
})
