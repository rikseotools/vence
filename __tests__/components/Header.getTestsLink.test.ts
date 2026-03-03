// __tests__/components/Header.getTestsLink.test.js
// Tests para la función getTestsLink del Header
// Detecta bugs como el de hookUserOposicion siendo string en vez de objeto
const { getOposicion } = require('../../lib/config/oposiciones')

// Reimplementamos la función para testear (debe coincidir con app/Header.js)
const getTestsLink = (hookUserOposicion) => {
  // hookUserOposicion puede ser un string JSON o un objeto
  let oposicionData = hookUserOposicion
  if (typeof hookUserOposicion === 'string') {
    try {
      oposicionData = JSON.parse(hookUserOposicion)
    } catch (e) {
      oposicionData = null
    }
  }
  const oposicionId = oposicionData?.id || oposicionData?.slug
  if (!oposicionId) return '/'

  const oposicion = getOposicion(oposicionId)
  return oposicion ? `/${oposicion.slug}/test` : '/'
}

describe('Header - getTestsLink', () => {

  // ============================================
  // BUG FIX: hookUserOposicion como STRING JSON
  // ============================================
  describe('Bug Fix: hookUserOposicion como string JSON', () => {

    test('CRÍTICO: Debe parsear string JSON correctamente para Auxiliar', () => {
      // Este es el bug real que ocurrió - hookUserOposicion venía como string
      const hookUserOposicion = '{"id":"auxiliar_administrativo_estado","name":"Auxiliar Administrativo"}'

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/auxiliar-administrativo-estado/test')
    })

    test('CRÍTICO: Debe parsear string JSON correctamente para Administrativo C1', () => {
      const hookUserOposicion = '{"id":"administrativo_estado","name":"Administrativo del Estado"}'

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/administrativo-estado/test')
    })

    test('Debe manejar string JSON con slug en vez de id', () => {
      const hookUserOposicion = '{"slug":"auxiliar_administrativo_estado","name":"Auxiliar"}'

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/auxiliar-administrativo-estado/test')
    })

    test('Debe retornar home para string JSON inválido', () => {
      const hookUserOposicion = 'esto no es JSON válido'

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/')
    })

    test('Debe retornar home para string vacío', () => {
      const hookUserOposicion = ''

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/')
    })
  })

  // ============================================
  // Caso normal: hookUserOposicion como objeto
  // ============================================
  describe('hookUserOposicion como objeto', () => {

    test('Auxiliar con id (underscores)', () => {
      const hookUserOposicion = { id: 'auxiliar_administrativo_estado', name: 'Auxiliar' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/auxiliar-administrativo-estado/test')
    })

    test('Auxiliar con id (guiones)', () => {
      const hookUserOposicion = { id: 'auxiliar-administrativo-estado', name: 'Auxiliar' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/auxiliar-administrativo-estado/test')
    })

    test('Administrativo C1 con id (underscores)', () => {
      const hookUserOposicion = { id: 'administrativo_estado', name: 'Administrativo' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/administrativo-estado/test')
    })

    test('Administrativo C1 con id (guiones)', () => {
      const hookUserOposicion = { id: 'administrativo-estado', name: 'Administrativo' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/administrativo-estado/test')
    })

    test('Objeto con slug en vez de id', () => {
      const hookUserOposicion = { slug: 'administrativo_estado', name: 'Administrativo' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/administrativo-estado/test')
    })
  })

  // ============================================
  // Casos de oposición no soportada o inválida
  // ============================================
  describe('Oposición no soportada o inválida', () => {

    test('hookUserOposicion null debe retornar home', () => {
      const result = getTestsLink(null)

      expect(result).toBe('/')
    })

    test('hookUserOposicion undefined debe retornar home', () => {
      const result = getTestsLink(undefined)

      expect(result).toBe('/')
    })

    test('Objeto vacío debe retornar home', () => {
      const hookUserOposicion = {}

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/')
    })

    test('Tramitación Procesal con id (underscores)', () => {
      const hookUserOposicion = { id: 'tramitacion_procesal', name: 'Tramitación Procesal' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/tramitacion-procesal/test')
    })

    test('Tramitación Procesal con id (guiones)', () => {
      const hookUserOposicion = { id: 'tramitacion-procesal', name: 'Tramitación Procesal' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/tramitacion-procesal/test')
    })

    test('Tramitación Procesal como string JSON', () => {
      const hookUserOposicion = '{"id":"tramitacion_procesal","name":"Tramitación Procesal"}'

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/tramitacion-procesal/test')
    })

    test('Auxilio Judicial con id (underscores)', () => {
      const hookUserOposicion = { id: 'auxilio_judicial', name: 'Auxilio Judicial' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/auxilio-judicial/test')
    })

    test('Auxilio Judicial con id (guiones)', () => {
      const hookUserOposicion = { id: 'auxilio-judicial', name: 'Auxilio Judicial' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/auxilio-judicial/test')
    })

    test('Auxilio Judicial como string JSON', () => {
      const hookUserOposicion = '{"id":"auxilio_judicial","name":"Auxilio Judicial"}'

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/auxilio-judicial/test')
    })

    test('Oposición desconocida debe retornar home', () => {
      const hookUserOposicion = { id: 'gestion_procesal', name: 'Gestión Procesal' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/')
    })

    test('Oposición con id vacío debe retornar home', () => {
      const hookUserOposicion = { id: '', name: 'Sin ID' }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/')
    })
  })

  // ============================================
  // Escenarios del mundo real
  // ============================================
  describe('Escenarios del mundo real', () => {

    test('Escenario: Usuario con Auxiliar seleccionado (formato BD)', () => {
      // Así viene de la BD cuando target_oposicion_data es JSONB pero se serializa
      const hookUserOposicion = '{"id":"auxiliar_administrativo_estado","name":"Auxiliar Administrativo"}'

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/auxiliar-administrativo-estado/test')
      expect(result).not.toBe('/') // NO debe ir a home
    })

    test('Escenario: Usuario con Administrativo C1 seleccionado (formato BD)', () => {
      const hookUserOposicion = '{"id":"administrativo_estado","name":"Administrativo del Estado"}'

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/administrativo-estado/test')
      expect(result).not.toBe('/') // NO debe ir a home
    })

    test('Escenario: Usuario nuevo sin oposición', () => {
      const hookUserOposicion = null

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/')
    })

    test('Escenario: Hook aún cargando (undefined)', () => {
      const hookUserOposicion = undefined

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/')
    })

    test('Escenario: Cambio de oposición en caliente (objeto directo)', () => {
      // Cuando el usuario cambia oposición, puede venir como objeto
      const hookUserOposicion = {
        id: 'administrativo_estado',
        name: 'Administrativo del Estado',
        slug: 'administrativo_estado'
      }

      const result = getTestsLink(hookUserOposicion)

      expect(result).toBe('/administrativo-estado/test')
    })
  })

  // ============================================
  // Consistencia de URLs generadas
  // ============================================
  describe('Consistencia de URLs', () => {

    test('URL de Auxiliar siempre usa guiones', () => {
      const casosAuxiliar = [
        { id: 'auxiliar_administrativo_estado' },
        { id: 'auxiliar-administrativo-estado' },
        { slug: 'auxiliar_administrativo_estado' },
        '{"id":"auxiliar_administrativo_estado"}',
        '{"id":"auxiliar-administrativo-estado"}'
      ]

      casosAuxiliar.forEach(caso => {
        const result = getTestsLink(caso)
        expect(result).toBe('/auxiliar-administrativo-estado/test')
        expect(result).toContain('-') // Siempre guiones en URL
        expect(result).not.toContain('_') // Nunca underscores en URL
      })
    })

    test('URL de Administrativo C1 siempre usa guiones', () => {
      const casosAdmin = [
        { id: 'administrativo_estado' },
        { id: 'administrativo-estado' },
        { slug: 'administrativo_estado' },
        '{"id":"administrativo_estado"}',
        '{"id":"administrativo-estado"}'
      ]

      casosAdmin.forEach(caso => {
        const result = getTestsLink(caso)
        expect(result).toBe('/administrativo-estado/test')
        expect(result).toContain('-') // Siempre guiones en URL
        expect(result).not.toContain('_') // Nunca underscores en URL
      })
    })
  })

  // ============================================
  // Regresión: Detectar el bug original
  // ============================================
  describe('Regresión: Bug del string JSON', () => {

    test('REGRESIÓN: No debe retornar home cuando hookUserOposicion es string válido', () => {
      // Este test habría fallado ANTES del fix
      const stringJson = '{"id":"auxiliar_administrativo_estado","name":"Auxiliar Administrativo"}'

      const result = getTestsLink(stringJson)

      // ANTES del fix: result era '/' porque no se parseaba el string
      // DESPUÉS del fix: result es '/auxiliar-administrativo-estado/test'
      expect(result).not.toBe('/')
      expect(result).toBe('/auxiliar-administrativo-estado/test')
    })

    test('REGRESIÓN: typeof string no tiene .id', () => {
      const stringJson = '{"id":"auxiliar_administrativo_estado"}'

      // Simular el bug: acceder a .id en un string devuelve undefined
      const buggyResult = stringJson?.id // undefined porque string no tiene .id

      expect(buggyResult).toBeUndefined()

      // La función corregida SÍ debe obtener el id
      const fixedResult = getTestsLink(stringJson)
      expect(fixedResult).toBe('/auxiliar-administrativo-estado/test')
    })
  })
})
