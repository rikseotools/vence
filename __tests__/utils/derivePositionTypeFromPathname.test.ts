// __tests__/utils/derivePositionTypeFromPathname.test.ts
//
// Tests del helper que captura tests.position_type al crear un test.
//
// Es la ÚNICA vía por la que un test nuevo hereda su oposición desde la URL del
// navegador. Si devuelve null cuando no debe, el test se guarda con
// position_type=NULL → desambiguación cruzada rota + user_theme_stats mal
// agregado (incidente 05/07/2026, commit b4ef6fc9). No depende de BD.
//
// IMPORTANTE: importamos la función REAL de producción — NO una copia. La
// versión anterior de este test replicaba la lógica localmente, así que cuando
// el commit b4ef6fc9 BORRÓ la función real, este test siguió en verde y no cazó
// la regresión. Ahora testeamos el código que de verdad corre.

import { derivePositionTypeFromPathname, SLUG_TO_POSITION_TYPE, ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'

describe('derivePositionTypeFromPathname (función REAL de producción)', () => {
  describe('casos de oposición — debe devolver el position_type del catálogo', () => {
    test('/auxiliar-administrativo-estado/test/tema/5 → auxiliar_administrativo_estado', () => {
      expect(derivePositionTypeFromPathname('/auxiliar-administrativo-estado/test/tema/5')).toBe('auxiliar_administrativo_estado')
    })

    test('/administrativo-seguridad-social/test/tema/105/test-personalizado → administrativo_seguridad_social', () => {
      expect(derivePositionTypeFromPathname('/administrativo-seguridad-social/test/tema/105/test-personalizado')).toBe('administrativo_seguridad_social')
    })

    test('/tramitacion-procesal/test/simulacro → tramitacion_procesal', () => {
      expect(derivePositionTypeFromPathname('/tramitacion-procesal/test/simulacro')).toBe('tramitacion_procesal')
    })

    // REGRESIÓN 05/07/2026 (caso Ana Guillen, administrativo-gva): esta URL exacta
    // se guardaba con position_type=NULL tras migrar la creación al endpoint v2.
    test('REGRESIÓN Ana: /administrativo-gva/test/tema/106/test-personalizado → administrativo_gva', () => {
      expect(derivePositionTypeFromPathname('/administrativo-gva/test/tema/106/test-personalizado')).toBe('administrativo_gva')
    })

    // Blindaje escalable: TODAS las oposiciones del catálogo deben resolverse a su
    // positionType REAL (no `slug.replace('-','_')` — hay slugs cuyo positionType
    // difiere, p.ej. auxiliar-administrativo-valencia). Añadir una oposición nueva
    // y ver este test en verde garantiza que su position_type se persistirá.
    test('toda oposición en el catálogo resuelve a su positionType real', () => {
      for (const slug of ALL_OPOSICION_SLUGS) {
        const path = `/${slug}/test/tema/1`
        expect(derivePositionTypeFromPathname(path)).toBe(SLUG_TO_POSITION_TYPE[slug])
      }
    })
  })

  describe('casos NO-oposición — debe devolver null (test global, sin atribución)', () => {
    test('/test/rapido → null', () => {
      expect(derivePositionTypeFromPathname('/test/rapido')).toBeNull()
    })

    test('/test/repaso-fallos-v2 → null', () => {
      expect(derivePositionTypeFromPathname('/test/repaso-fallos-v2')).toBeNull()
    })

    test('/test/por-leyes → null (test por leyes, no atado a oposición)', () => {
      expect(derivePositionTypeFromPathname('/test/por-leyes')).toBeNull()
    })

    test('/leyes/informatica-basica/avanzado → null', () => {
      expect(derivePositionTypeFromPathname('/leyes/informatica-basica/avanzado')).toBeNull()
    })

    test('/perfil → null', () => {
      expect(derivePositionTypeFromPathname('/perfil')).toBeNull()
    })

    test('/oposicion-inventada/test/tema/1 → null (slug no está en el catálogo)', () => {
      expect(derivePositionTypeFromPathname('/oposicion-inventada/test/tema/1')).toBeNull()
    })

    test('/AUXILIAR-ADMINISTRATIVO-ESTADO/test → null (case-sensitive, solo minúsculas)', () => {
      expect(derivePositionTypeFromPathname('/AUXILIAR-ADMINISTRATIVO-ESTADO/test')).toBeNull()
    })
  })

  describe('inputs degenerados → null', () => {
    test('null → null', () => {
      expect(derivePositionTypeFromPathname(null)).toBeNull()
    })
    test('string vacío → null', () => {
      expect(derivePositionTypeFromPathname('')).toBeNull()
    })
    test('/ → null (solo raíz)', () => {
      expect(derivePositionTypeFromPathname('/')).toBeNull()
    })
    test('//auxiliar-administrativo-estado/test → null (doble slash inicial)', () => {
      expect(derivePositionTypeFromPathname('//auxiliar-administrativo-estado/test')).toBeNull()
    })
    test('auxiliar-administrativo-estado/test (sin slash inicial) → null', () => {
      expect(derivePositionTypeFromPathname('auxiliar-administrativo-estado/test')).toBeNull()
    })
  })

  describe('robustez contra spoofing → null', () => {
    test('URLs raras nunca mandan basura a BD', () => {
      expect(derivePositionTypeFromPathname('/<script>alert(1)</script>/test')).toBeNull()
      expect(derivePositionTypeFromPathname('/auxiliar..administrativo..estado/test')).toBeNull()
      expect(derivePositionTypeFromPathname('/?slug=auxiliar-administrativo-estado/test')).toBeNull()
    })
  })
})
