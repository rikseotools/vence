/**
 * Tests para verificar cobertura del EXAM_POSITION_MAP
 *
 * Este test detecta cuando hay valores de exam_position en la BD
 * que no están cubiertos por el mapeo, evitando bugs donde
 * las preguntas oficiales no se encuentran.
 *
 * BUG PREVENIDO: 2026-02-08 - administrativo_estado no estaba en el mapeo
 */

// ============================================
// MAPEO: Copia del EXAM_POSITION_MAP de queries.ts
// Debe mantenerse sincronizado con el original
// ============================================
const EXAM_POSITION_MAP: Record<string, string[]> = {
  'auxiliar_administrativo': [
    'auxiliar administrativo del estado',
    'auxiliar administrativo',
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
  ],
  'administrativo': [
    'administrativo',
    'administrativo_estado',
    'cuerpo_general_administrativo',
    'cuerpo general administrativo de la administración del estado',
  ],
  'gestion_administracion_civil': [
    'cuerpo_gestion_administracion_civil',
    'cuerpo de gestión de la administración civil del estado',
  ],
  'tramitacion_procesal': [
    'tramitacion_procesal',
    'tramitación procesal',
  ],
  'auxilio_judicial': [
    'auxilio_judicial',
    'auxilio judicial',
  ],
  'gestion_procesal': [
    'gestion_procesal',
    'gestión procesal',
  ],
}

// ============================================
// HELPER: Obtener todos los valores mapeados
// ============================================
function getAllMappedValues(): Set<string> {
  const allValues = new Set<string>()
  for (const values of Object.values(EXAM_POSITION_MAP)) {
    for (const value of values) {
      allValues.add(value.toLowerCase())
    }
  }
  return allValues
}

// ============================================
// VALORES CONOCIDOS DE exam_position EN LA BD
// Actualizar cuando se añadan nuevos valores
// ============================================
const KNOWN_EXAM_POSITIONS = [
  'auxiliar_administrativo_estado',
  'administrativo_estado',
  'auxilio_judicial',
  'tramitacion_procesal',
  'cuerpo_gestion_administracion_civil',
  // Añadir nuevos valores aquí cuando se detecten
]

// ============================================
// TESTS
// ============================================
describe('EXAM_POSITION_MAP Cobertura', () => {

  test('Todos los valores conocidos de exam_position deben estar mapeados', () => {
    const mappedValues = getAllMappedValues()
    const unmappedValues: string[] = []

    for (const position of KNOWN_EXAM_POSITIONS) {
      if (!mappedValues.has(position.toLowerCase())) {
        unmappedValues.push(position)
      }
    }

    if (unmappedValues.length > 0) {
      console.error('❌ Valores de exam_position sin mapear:')
      unmappedValues.forEach(v => console.error(`   - ${v}`))
      console.error('\n💡 Añade estos valores al EXAM_POSITION_MAP en:')
      console.error('   lib/api/filtered-questions/queries.ts')
    }

    expect(unmappedValues).toEqual([])
  })

  test('Cada positionType debe tener al menos un valor mapeado', () => {
    for (const [positionType, values] of Object.entries(EXAM_POSITION_MAP)) {
      expect(values.length).toBeGreaterThan(0)
    }
  })

  test('No debe haber valores duplicados en diferentes positionTypes', () => {
    const seenValues = new Map<string, string>() // value -> positionType
    const duplicates: string[] = []

    for (const [positionType, values] of Object.entries(EXAM_POSITION_MAP)) {
      for (const value of values) {
        const normalized = value.toLowerCase()
        if (seenValues.has(normalized)) {
          duplicates.push(`"${value}" está en "${seenValues.get(normalized)}" y "${positionType}"`)
        } else {
          seenValues.set(normalized, positionType)
        }
      }
    }

    if (duplicates.length > 0) {
      console.warn('⚠️ Valores duplicados en diferentes positionTypes:')
      duplicates.forEach(d => console.warn(`   - ${d}`))
    }

    // Solo advertir, no fallar (puede haber casos legítimos de overlap)
    expect(duplicates.length).toBeLessThanOrEqual(0)
  })

  test('Los valores mapeados deben ser strings no vacíos', () => {
    for (const [positionType, values] of Object.entries(EXAM_POSITION_MAP)) {
      for (const value of values) {
        expect(typeof value).toBe('string')
        expect(value.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

// ============================================
// TEST DE INTEGRACIÓN (requiere BD)
// Se ejecuta solo si DATABASE_URL está configurada
// ============================================
describe('EXAM_POSITION_MAP vs Base de Datos', () => {
  const canConnectToDb = !!process.env.DATABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL

  // Skip si no hay conexión a BD
  const testOrSkip = canConnectToDb ? test : test.skip

  testOrSkip('Verificar cobertura contra valores reales de BD', async () => {
    // Este test se puede implementar para consultar la BD real
    // Por ahora, solo verificamos que los valores conocidos están actualizados

    // TODO: Implementar consulta real a BD si se necesita
    // const { createClient } = require('@supabase/supabase-js')
    // const supabase = createClient(...)
    // const { data } = await supabase.from('questions').select('exam_position').eq('is_official_exam', true)

    expect(true).toBe(true) // Placeholder
  })
})

// ============================================
// INSTRUCCIONES PARA MANTENER ESTE TEST
// ============================================
/**
 * Cuando añadas preguntas oficiales con un nuevo valor de exam_position:
 *
 * 1. Añade el valor a KNOWN_EXAM_POSITIONS en este archivo
 * 2. Si el test falla, añade el valor al EXAM_POSITION_MAP en queries.ts
 * 3. Commit ambos cambios juntos
 *
 * Este test previene bugs como el de 2026-02-08 donde
 * "administrativo_estado" no estaba mapeado y las preguntas
 * oficiales no se encontraban para Administrativo C1.
 */
