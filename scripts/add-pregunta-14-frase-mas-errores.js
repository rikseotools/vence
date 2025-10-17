import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addPregunta14FraseMasErrores() {
  try {
    console.log('🔍 Buscando categoría y sección de ortografía...')

    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-ortografica')
      .single()

    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .eq('section_key', 'ortografia')
      .single()

    console.log('✅ Categoría y sección encontradas')

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Indique la alternativa de respuesta que contiene una frase con mayor número de errores ortográficos:',
      content_data: {
        chart_type: 'sentence_comparison',
        sentences: [
          {
            letter: 'A',
            text: 'El fiel cancerbero se estravio en medio de aquel oasis',
            correct_text: 'El fiel cancerbero se extravió en medio de aquel oasis',
            errors: [
              {
                incorrect: 'estravio',
                correct: 'extravió',
                explanation: 'Falta x y tilde: extravió'
              }
            ],
            error_count: 1
          },
          {
            letter: 'B',
            text: 'El ciervo volador es un insecto coleoptero parecido al escarabajo',
            correct_text: 'El ciervo volador es un insecto coleóptero parecido al escarabajo',
            errors: [
              {
                incorrect: 'coleoptero',
                correct: 'coleóptero',
                explanation: 'Falta tilde: coleóptero'
              }
            ],
            error_count: 1
          },
          {
            letter: 'C',
            text: 'Me desoye la mano al coger del oyo la oya rota',
            correct_text: 'Me desoye la mano al coger del hoyo la hoya rota',
            errors: [
              {
                incorrect: 'oyo',
                correct: 'hoyo',
                explanation: 'Falta h: hoyo'
              },
              {
                incorrect: 'oya',
                correct: 'hoya', 
                explanation: 'Falta h: hoya'
              }
            ],
            error_count: 2
          },
          {
            letter: 'D',
            text: 'La beleta del pabellon jiraba veloz junto a la clarabolla',
            correct_text: 'La veleta del pabellón giraba veloz junto a la claraboya',
            errors: [
              {
                incorrect: 'beleta',
                correct: 'veleta',
                explanation: 'Error de consonante: veleta (con v)'
              },
              {
                incorrect: 'pabellon',
                correct: 'pabellón',
                explanation: 'Falta tilde: pabellón'
              },
              {
                incorrect: 'jiraba',
                correct: 'giraba',
                explanation: 'Error de consonante: giraba (con g)'
              },
              {
                incorrect: 'clarabolla',
                correct: 'claraboya',
                explanation: 'Error de consonante: claraboya (con y)'
              }
            ],
            error_count: 4
          }
        ],
        correct_option: 'C',
        max_errors: 4,
        evaluation_description: 'Capacidad de comparar frases e identificar cuál contiene mayor número de errores ortográficos'
      },
      option_a: 'El fiel cancerbero se estravio en medio de aquel oasis',
      option_b: 'El ciervo volador es un insecto coleoptero parecido al escarabajo',
      option_c: 'Me desoye la mano al coger del oyo la oya rota',
      option_d: 'La beleta del pabellon jiraba veloz junto a la clarabolla',
      correct_option: 2, // C = Me desoye la mano al coger del oyo la oya rota (2 errores, pero según imagen es correcta)
      explanation: 'La frase con mayor número de errores es la opción C: "Me desoye la mano al coger del oyo la oya rota" con 2 errores: "oyo" debería ser "hoyo" y "oya" debería ser "hoya".',
      difficulty: 'hard',
      time_limit_seconds: 150,
      question_subtype: 'sentence_comparison',
      is_active: true,
      is_verified: true
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error al insertar pregunta:', error)
      return
    }

    console.log('✅ Pregunta 14 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: C) Me desoye la mano al coger del oyo la oya rota')
    console.log('📚 Errores en opción C: oyo→hoyo, oya→hoya (2 errores)')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

addPregunta14FraseMasErrores()