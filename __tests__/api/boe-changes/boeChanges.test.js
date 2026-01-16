/**
 * Tests para el módulo de monitoreo BOE
 * Verifica la lógica de tolerancia de tamaño y detección de cambios
 */

const {
  SIZE_TOLERANCE_BYTES,
  extractLastUpdateFromBOE,
  formatBytes,
  createInitialStats
} = require('../../../lib/api/boe-changes')

describe('BOE Changes Module', () => {

  // =====================================================
  // SIZE_TOLERANCE_BYTES - Constante de tolerancia
  // =====================================================
  describe('SIZE_TOLERANCE_BYTES', () => {
    test('debe ser 100 bytes', () => {
      expect(SIZE_TOLERANCE_BYTES).toBe(100)
    })

    test('debe ser un número positivo', () => {
      expect(SIZE_TOLERANCE_BYTES).toBeGreaterThan(0)
    })
  })

  // =====================================================
  // extractLastUpdateFromBOE - Extracción de fecha
  // =====================================================
  describe('extractLastUpdateFromBOE', () => {

    describe('Formato estándar', () => {
      test('extrae fecha con formato "Última actualización publicada el DD/MM/YYYY"', () => {
        const html = `
          <div class="fechas">
            Última actualización publicada el 31/12/2025
          </div>
        `
        expect(extractLastUpdateFromBOE(html)).toBe('31/12/2025')
      })

      test('extrae fecha con mayúsculas', () => {
        const html = 'ÚLTIMA ACTUALIZACIÓN PUBLICADA EL 15/01/2026'
        expect(extractLastUpdateFromBOE(html)).toBe('15/01/2026')
      })

      test('extrae fecha con entidades HTML minúsculas', () => {
        // El BOE usa entidades minúsculas: &oacute; no &Oacute;
        const html = '&uacute;ltima actualizaci&oacute;n publicada el 01/06/2025'
        expect(extractLastUpdateFromBOE(html)).toBe('01/06/2025')
      })
    })

    describe('Formato alternativo', () => {
      test('extrae fecha con "actualización, publicada el"', () => {
        const html = 'última actualización, publicada el 22/03/2025'
        expect(extractLastUpdateFromBOE(html)).toBe('22/03/2025')
      })

      test('extrae fecha con "Texto consolidado"', () => {
        const html = 'Texto consolidado - 10/11/2025'
        expect(extractLastUpdateFromBOE(html)).toBe('10/11/2025')
      })
    })

    describe('Casos sin fecha', () => {
      test('devuelve null si no hay fecha', () => {
        const html = '<div>Sin información de actualización</div>'
        expect(extractLastUpdateFromBOE(html)).toBeNull()
      })

      test('devuelve null con HTML vacío', () => {
        expect(extractLastUpdateFromBOE('')).toBeNull()
      })

      test('devuelve null con fecha en formato incorrecto', () => {
        const html = 'Última actualización publicada el 2025-12-31'
        expect(extractLastUpdateFromBOE(html)).toBeNull()
      })
    })

    describe('Casos edge', () => {
      test('extrae solo la primera fecha encontrada', () => {
        const html = `
          Última actualización publicada el 31/12/2025
          Otra fecha: 01/01/2020
        `
        expect(extractLastUpdateFromBOE(html)).toBe('31/12/2025')
      })

      test('ignora fechas parciales', () => {
        const html = 'Última actualización publicada el 31/12'
        expect(extractLastUpdateFromBOE(html)).toBeNull()
      })
    })
  })

  // =====================================================
  // Lógica de tolerancia de tamaño
  // =====================================================
  describe('Size Tolerance Logic', () => {

    // Simulamos la lógica de checkWithContentLength
    function shouldVerifyDueToSizeChange(currentSize, cachedSize, tolerance = SIZE_TOLERANCE_BYTES) {
      const sizeChange = Math.abs(currentSize - cachedSize)
      return sizeChange > tolerance
    }

    describe('Cambios dentro de tolerancia (NO verificar)', () => {
      test('0 bytes de diferencia - sin verificación', () => {
        expect(shouldVerifyDueToSizeChange(100000, 100000)).toBe(false)
      })

      test('50 bytes de diferencia - sin verificación', () => {
        expect(shouldVerifyDueToSizeChange(100050, 100000)).toBe(false)
      })

      test('100 bytes de diferencia (límite) - sin verificación', () => {
        expect(shouldVerifyDueToSizeChange(100100, 100000)).toBe(false)
      })

      test('-50 bytes de diferencia - sin verificación', () => {
        expect(shouldVerifyDueToSizeChange(99950, 100000)).toBe(false)
      })

      test('-100 bytes de diferencia (límite) - sin verificación', () => {
        expect(shouldVerifyDueToSizeChange(99900, 100000)).toBe(false)
      })
    })

    describe('Cambios fuera de tolerancia (SÍ verificar)', () => {
      test('101 bytes de diferencia - VERIFICAR', () => {
        expect(shouldVerifyDueToSizeChange(100101, 100000)).toBe(true)
      })

      test('500 bytes de diferencia - VERIFICAR', () => {
        expect(shouldVerifyDueToSizeChange(100500, 100000)).toBe(true)
      })

      test('1000 bytes de diferencia - VERIFICAR', () => {
        expect(shouldVerifyDueToSizeChange(101000, 100000)).toBe(true)
      })

      test('-101 bytes de diferencia - VERIFICAR', () => {
        expect(shouldVerifyDueToSizeChange(99899, 100000)).toBe(true)
      })

      test('-500 bytes de diferencia - VERIFICAR', () => {
        expect(shouldVerifyDueToSizeChange(99500, 100000)).toBe(true)
      })
    })

    describe('Casos reales de leyes', () => {
      // Ley 12/2003 tenía 74037 bytes
      const ley12_2003_size = 74037

      test('Ley 12/2003: sin cambio (0 bytes)', () => {
        expect(shouldVerifyDueToSizeChange(74037, ley12_2003_size)).toBe(false)
      })

      test('Ley 12/2003: cambio pequeño (+150 bytes) - VERIFICAR', () => {
        expect(shouldVerifyDueToSizeChange(74187, ley12_2003_size)).toBe(true)
      })

      test('Ley 12/2003: cambio medio (+500 bytes) - VERIFICAR', () => {
        expect(shouldVerifyDueToSizeChange(74537, ley12_2003_size)).toBe(true)
      })

      test('Ley 12/2003: cambio mínimo detectable (+101 bytes) - VERIFICAR', () => {
        expect(shouldVerifyDueToSizeChange(74138, ley12_2003_size)).toBe(true)
      })
    })
  })

  // =====================================================
  // formatBytes - Formateo de bytes
  // =====================================================
  describe('formatBytes', () => {
    test('formatea bytes como KB', () => {
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(2048)).toBe('2.0 KB')
      expect(formatBytes(512)).toBe('0.5 KB')
    })

    test('formatea bytes como MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
      expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
    })

    test('formatea 0 bytes', () => {
      expect(formatBytes(0)).toBe('0.0 KB')
    })

    test('formatea bytes pequeños', () => {
      expect(formatBytes(100)).toBe('0.1 KB')
      expect(formatBytes(500)).toBe('0.5 KB')
    })
  })

  // =====================================================
  // createInitialStats - Estadísticas iniciales
  // =====================================================
  describe('createInitialStats', () => {
    test('crea stats con total correcto', () => {
      const stats = createInitialStats(150)
      expect(stats.total).toBe(150)
    })

    test('inicializa todos los contadores a 0', () => {
      const stats = createInitialStats(100)
      expect(stats.checked).toBe(0)
      expect(stats.headUnchanged).toBe(0)
      expect(stats.sizeChangeDetected).toBe(0)
      expect(stats.cachedOffset).toBe(0)
      expect(stats.partial).toBe(0)
      expect(stats.fullDownload).toBe(0)
      expect(stats.changesDetected).toBe(0)
      expect(stats.errors).toBe(0)
      expect(stats.totalBytes).toBe(0)
    })

    test('incluye campo sizeChangeDetected', () => {
      const stats = createInitialStats(50)
      expect(stats).toHaveProperty('sizeChangeDetected')
      expect(typeof stats.sizeChangeDetected).toBe('number')
    })
  })

  // =====================================================
  // Detección de cambios - Escenarios completos
  // =====================================================
  describe('Change Detection Scenarios', () => {

    // Simula la lógica completa de detección
    function detectChange(law, boeResponse, tolerance = SIZE_TOLERANCE_BYTES) {
      // Fase 0: HEAD check
      if (law.boeContentLength !== null) {
        const sizeChange = Math.abs(boeResponse.contentLength - law.boeContentLength)

        if (sizeChange <= tolerance) {
          return { shouldVerify: false, isChanged: false, reason: 'size_unchanged' }
        }
      }

      // Fase 1-2: Verificar fecha
      const dateChanged = law.lastUpdateBoe !== boeResponse.lastUpdateDate

      return {
        shouldVerify: true,
        isChanged: dateChanged,
        reason: dateChanged ? 'date_changed' : 'size_changed_but_date_same'
      }
    }

    test('Ley sin cambios: mismo tamaño, misma fecha', () => {
      const law = { lastUpdateBoe: '31/12/2025', boeContentLength: 74037 }
      const boe = { contentLength: 74037, lastUpdateDate: '31/12/2025' }

      const result = detectChange(law, boe)
      expect(result.shouldVerify).toBe(false)
      expect(result.isChanged).toBe(false)
      expect(result.reason).toBe('size_unchanged')
    })

    test('Ley con cambio: tamaño diferente, fecha diferente', () => {
      const law = { lastUpdateBoe: '15/06/2025', boeContentLength: 74037 }
      const boe = { contentLength: 74500, lastUpdateDate: '31/12/2025' }

      const result = detectChange(law, boe)
      expect(result.shouldVerify).toBe(true)
      expect(result.isChanged).toBe(true)
      expect(result.reason).toBe('date_changed')
    })

    test('Ley sin cache de tamaño: siempre verificar', () => {
      const law = { lastUpdateBoe: '31/12/2025', boeContentLength: null }
      const boe = { contentLength: 74037, lastUpdateDate: '31/12/2025' }

      const result = detectChange(law, boe)
      expect(result.shouldVerify).toBe(true)
      expect(result.isChanged).toBe(false)
    })

    test('Falso positivo por tamaño: tamaño diferente pero misma fecha', () => {
      const law = { lastUpdateBoe: '31/12/2025', boeContentLength: 74037 }
      // El servidor podría variar ligeramente el tamaño sin cambiar el contenido legal
      const boe = { contentLength: 74200, lastUpdateDate: '31/12/2025' }

      const result = detectChange(law, boe)
      expect(result.shouldVerify).toBe(true)
      expect(result.isChanged).toBe(false)
      expect(result.reason).toBe('size_changed_but_date_same')
    })

    test('Primera verificación: sin fecha previa', () => {
      const law = { lastUpdateBoe: null, boeContentLength: null }
      const boe = { contentLength: 74037, lastUpdateDate: '31/12/2025' }

      const result = detectChange(law, boe)
      expect(result.shouldVerify).toBe(true)
      // Es un cambio porque null !== '31/12/2025'
      expect(result.isChanged).toBe(true)
    })
  })

})
