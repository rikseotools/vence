import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia11() {
  try {
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'ortografia')
      .single()

    if (!section) {
      console.error('❌ No se encontró la sección de ortografía')
      return
    }

    const questionData = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Si tenemos que las consonantes mayúsculas valen 33, las vocales minúsculas valen 20, las consonantes minúsculas valen 04 y las vocales mayúsculas valen 00, ¿cuánto vale la palabra OrNiTOrRINCo?',
      question_subtype: 'data_tables',
      content_data: {
        chart_type: 'value_calculation',
        question_type: 'word_value_calculation',
        evaluation_description: 'Calcular el valor de una palabra según sistema de códigos',
        calculation_rules: {
          'consonantes_mayusculas': 33,
          'vocales_minusculas': 20,
          'consonantes_minusculas': 4,
          'vocales_mayusculas': 0
        },
        word_to_analyze: 'OrNiTOrRINCo'
      },
      option_a: '00043320333043320333320',
      option_b: '00043300333043300333320',
      option_c: '00043320332004330033320',
      option_d: '00043320330004330033320',
      correct_option: 3, // D
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) 00043320330004330033320</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis letra por letra de "OrNiTOrRINCo":</strong>

<strong>Sistema de valores:</strong>
• Consonantes mayúsculas = 33
• Vocales minúsculas = 20  
• Consonantes minúsculas = 04
• Vocales mayúsculas = 00

<strong>Desglose:</strong>
• O (vocal mayúscula) = 00
• r (consonante minúscula) = 04
• N (consonante mayúscula) = 33
• i (vocal minúscula) = 20
• T (consonante mayúscula) = 33
• O (vocal mayúscula) = 00
• r (consonante minúscula) = 04
• R (consonante mayúscula) = 33
• I (vocal mayúscula) = 00
• N (consonante mayúscula) = 33
• C (consonante mayúscula) = 33
• o (vocal minúscula) = 20

<strong>Resultado:</strong> 00 04 33 20 33 00 04 33 00 33 33 20 = 00043320330004330033320
</div>`,
      is_active: true
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta Ortografía 11 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: data_tables`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia11()