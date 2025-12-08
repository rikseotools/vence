// Script para probar la detección de oposiciones duplicadas
// Este script simula el comportamiento de la normalización implementada

// Función para normalizar nombres de oposiciones (quitar acentos, minúsculas)
const normalizeOposicionName = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s]/g, ' ') // Reemplazar caracteres especiales con espacios
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .trim()
}

// Oposiciones oficiales (muestra reducida para testing)
const OFFICIAL_OPOSICIONES = [
  {
    id: 'auxiliar_administrativo_estado',
    nombre: 'Auxiliar Administrativo del Estado'
  },
  {
    id: 'administrativo_estado',
    nombre: 'Administrativo del Estado'
  },
  {
    id: 'policia_nacional',
    nombre: 'Policía Nacional (Escala Básica)'
  }
]

// Función para detectar si una oposición personalizada coincide con una oficial
const findMatchingOfficialOposicion = (customName) => {
  const normalizedCustom = normalizeOposicionName(customName)
  const customWords = normalizedCustom.split(' ').filter(w => w.length > 0)

  return OFFICIAL_OPOSICIONES.find(official => {
    const normalizedOfficial = normalizeOposicionName(official.nombre)

    // Coincidencia exacta después de normalizar
    if (normalizedCustom === normalizedOfficial) return true

    // Coincidencia parcial: al menos 70% de las palabras del usuario deben estar en la oficial
    const officialWords = normalizedOfficial.split(' ').filter(w => w.length > 0)
    const matchingWords = customWords.filter(word =>
      officialWords.some(officialWord =>
        // Coincidencia exacta de palabra o palabra oficial contiene la del usuario
        officialWord === word || officialWord.includes(word) || word.includes(officialWord)
      )
    )

    const matchPercentage = matchingWords.length / customWords.length

    // Si al menos 70% de las palabras coinciden, considerarlo un match
    return matchPercentage >= 0.7
  })
}

// CASOS DE PRUEBA
console.log('🧪 PRUEBAS DE DETECCIÓN DE DUPLICADOS\n')

const testCases = [
  // Casos que DEBERÍAN detectarse como duplicados
  {
    input: 'Auxiliar Administrativo del Estado',
    shouldMatch: true,
    expected: 'auxiliar_administrativo_estado'
  },
  {
    input: 'auxiliar administrativo del estado',
    shouldMatch: true,
    expected: 'auxiliar_administrativo_estado'
  },
  {
    input: 'Auxiliar Administrativo Estado',
    shouldMatch: true,
    expected: 'auxiliar_administrativo_estado'
  },
  {
    input: 'AUX ADMIN ESTADO',
    shouldMatch: true,
    expected: 'auxiliar_administrativo_estado'
  },
  {
    input: 'Policía Nacional',
    shouldMatch: true,
    expected: 'policia_nacional'
  },
  {
    input: 'Policia Nacional Escala Basica',
    shouldMatch: true,
    expected: 'policia_nacional'
  },
  // Casos que NO deberían detectarse (oposiciones realmente diferentes)
  {
    input: 'Auxiliar Enfermería',
    shouldMatch: false,
    expected: null
  },
  {
    input: 'Bombero',
    shouldMatch: false,
    expected: null
  },
  {
    input: 'Maestro de Primaria',
    shouldMatch: false,
    expected: null
  }
]

let passed = 0
let failed = 0

testCases.forEach((testCase, index) => {
  const result = findMatchingOfficialOposicion(testCase.input)
  const matched = result !== undefined
  const matchedId = result?.id

  const success = (matched === testCase.shouldMatch) &&
                  (!testCase.shouldMatch || matchedId === testCase.expected)

  if (success) {
    console.log(`✅ Test ${index + 1}: PASSED`)
    console.log(`   Input: "${testCase.input}"`)
    if (matched) {
      console.log(`   Matched: "${result.nombre}" (${result.id})`)
    } else {
      console.log(`   No match found (as expected)`)
    }
    passed++
  } else {
    console.log(`❌ Test ${index + 1}: FAILED`)
    console.log(`   Input: "${testCase.input}"`)
    console.log(`   Expected: ${testCase.shouldMatch ? `Match with ${testCase.expected}` : 'No match'}`)
    console.log(`   Got: ${matched ? `Match with ${matchedId}` : 'No match'}`)
    failed++
  }
  console.log('')
})

console.log('=' .repeat(50))
console.log(`📊 RESUMEN: ${passed} passed, ${failed} failed`)
console.log('=' .repeat(50))

if (failed === 0) {
  console.log('\n🎉 ¡Todos los tests pasaron correctamente!')
  process.exit(0)
} else {
  console.log('\n⚠️ Algunos tests fallaron. Revisar la lógica de detección.')
  process.exit(1)
}
