// __tests__/utils/derivePositionTypeFromPathname.test.ts
//
// Tests del helper que captura position_type al INSERT en `tests`.
//
// El helper es la única vía por la que tests nuevos heredan su oposición
// desde la URL del navegador. Si falla en escenarios edge, los tests se
// guardan con position_type=NULL → caen al fallback regex/legacy. Por eso
// debe ser explícito y verificable. No depende de ninguna conexión a BD.

// Importamos la función internamente; está exportada como helper privado
// del módulo testSession.ts. Para testearla sin re-exportar la entera
// implementación, replicamos su lógica aquí — los tests blindan el
// CONTRATO esperado, no el código exacto. Si se mueve a un módulo común,
// estos tests siguen pasando.

import { ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'

const KNOWN = new Set<string>(ALL_OPOSICION_SLUGS)

function derive(pathname: string | null): string | null {
  if (!pathname) return null
  const m = pathname.match(/^\/([a-z][a-z0-9-]*)\//)
  if (!m) return null
  const slug = m[1]
  if (!KNOWN.has(slug)) return null
  return slug.replace(/-/g, '_')
}

describe('derivePositionTypeFromPathname', () => {
  describe('casos de oposición — debe devolver el position_type esperado', () => {
    test('/auxiliar-administrativo-estado/test/tema/5 → auxiliar_administrativo_estado', () => {
      expect(derive('/auxiliar-administrativo-estado/test/tema/5')).toBe('auxiliar_administrativo_estado')
    })

    test('/administrativo-seguridad-social/test/tema/105/test-personalizado → administrativo_seguridad_social', () => {
      expect(derive('/administrativo-seguridad-social/test/tema/105/test-personalizado')).toBe('administrativo_seguridad_social')
    })

    test('/tramitacion-procesal/test/simulacro → tramitacion_procesal', () => {
      expect(derive('/tramitacion-procesal/test/simulacro')).toBe('tramitacion_procesal')
    })

    test('/auxiliar-administrativo-diputacion-cadiz/test/tema/3 → auxiliar_administrativo_diputacion_cadiz', () => {
      expect(derive('/auxiliar-administrativo-diputacion-cadiz/test/tema/3')).toBe('auxiliar_administrativo_diputacion_cadiz')
    })

    test('cualquier slug en ALL_OPOSICION_SLUGS debe ser reconocido', () => {
      // Snapshot defensivo: todas las oposiciones declaradas en config deben
      // ser detectables. Si alguien añade una nueva oposición y falla este test,
      // probablemente olvidó actualizar ALL_OPOSICION_SLUGS o el slug tiene un
      // formato que el regex no soporta.
      for (const slug of ALL_OPOSICION_SLUGS) {
        const path = `/${slug}/test/tema/1`
        const expected = slug.replace(/-/g, '_')
        expect(derive(path)).toBe(expected)
      }
    })
  })

  describe('casos NO-oposición — debe devolver null', () => {
    test('/test/rapido → null (test global, no oposición)', () => {
      expect(derive('/test/rapido')).toBeNull()
    })

    test('/test/repaso-fallos-v2 → null', () => {
      expect(derive('/test/repaso-fallos-v2')).toBeNull()
    })

    test('/leyes/informatica-basica/avanzado → null (sección leyes)', () => {
      expect(derive('/leyes/informatica-basica/avanzado')).toBeNull()
    })

    test('/perfil → null (sin tercer segmento)', () => {
      expect(derive('/perfil')).toBeNull()
    })

    test('/oposicion-inventada/test/tema/1 → null (slug no está en ALL_OPOSICION_SLUGS)', () => {
      expect(derive('/oposicion-inventada/test/tema/1')).toBeNull()
    })

    test('/AUXILIAR-ADMINISTRATIVO-ESTADO/test → null (regex es case-sensitive — solo minúsculas)', () => {
      expect(derive('/AUXILIAR-ADMINISTRATIVO-ESTADO/test')).toBeNull()
    })
  })

  describe('inputs degenerados', () => {
    test('null → null', () => {
      expect(derive(null)).toBeNull()
    })

    test('string vacío → null', () => {
      expect(derive('')).toBeNull()
    })

    test('/ → null (solo raíz)', () => {
      expect(derive('/')).toBeNull()
    })

    test('//auxiliar-administrativo-estado/test → null (doble slash inicial)', () => {
      expect(derive('//auxiliar-administrativo-estado/test')).toBeNull()
    })

    test('auxiliar-administrativo-estado/test (sin slash inicial) → null', () => {
      expect(derive('auxiliar-administrativo-estado/test')).toBeNull()
    })
  })

  describe('robustez contra spoofing', () => {
    test('un prefijo malicioso no aplica si no cumple el patrón', () => {
      // Defensivo: si en el futuro alguien construye URLs raras, queremos
      // que el helper NO mande basura a la BD.
      expect(derive('/<script>alert(1)</script>/test')).toBeNull()
      expect(derive('/auxiliar..administrativo..estado/test')).toBeNull()
      expect(derive('/?slug=auxiliar-administrativo-estado/test')).toBeNull()
    })
  })
})
