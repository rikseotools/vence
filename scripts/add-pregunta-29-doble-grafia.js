import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta29() {
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
      question_text: 'De las siguientes parejas de palabras, ¿Cuáles no acepta la RAE con doble grafía?:',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar palabras no aceptadas por la RAE con doble grafía'
      },
      option_a: '3',
      option_b: '1', 
      option_c: '2',
      option_d: '4',
      correct_option: 0, // A = 3 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) 3</strong> parejas no aceptadas por la RAE con doble grafía.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis de las parejas de palabras:</strong>

<strong style="color: #dc2626;">No admitidas por la RAE con doble grafía (3):</strong>
• <strong>ázimo-azimo</strong> - Solo se admite "ázimo" con tilde
• <strong>aureola-auréola</strong> - Solo se admite "aureola" sin tilde  
• <strong>fláccido-flaccido</strong> - Solo se admite "fláccido" con tilde

<strong style="color: #16a34a;">Admitidas con doble grafía (4):</strong>
• <strong>amoniaco-amoniaco</strong> - Ambas formas son correctas
• <strong>cantiga-cántiga</strong> - Ambas formas son correctas
• <strong>bisnieto-biznieto</strong> - Ambas formas son correctas
• <strong>cinc-zinc</strong> - Ambas formas son correctas
• <strong>dinamo-dínamo</strong> - Ambas formas son correctas
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

    console.log('✅ Pregunta 29 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta29()