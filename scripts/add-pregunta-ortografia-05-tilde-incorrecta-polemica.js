import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia05() {
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
      question_text: 'Señale la opción que contiene una tilde incorrecta.',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'word_list_analysis',
        question_type: 'incorrect_accent_detection',
        evaluation_description: 'Identificar la opción con tilde incorrecta'
      },
      option_a: 'Menú, café, rubí',
      option_b: 'Árbol, lápida, líquenes',
      option_c: 'Incisión, víbora, cóncavo',
      option_d: 'Pólemica, súbito, céfiro',
      correct_option: 3, // D = Pólemica está mal
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Pólemica, súbito, céfiro</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">A) Correcta:</strong> Menú (aguda), café (aguda), rubí (aguda) - todas correctas

<strong style="color: #16a34a;">B) Correcta:</strong> Árbol (llana), lápida (esdrújula), líquenes (esdrújula) - todas correctas

<strong style="color: #16a34a;">C) Correcta:</strong> Incisión (aguda), víbora (esdrújula), cóncavo (esdrújula) - todas correctas

<strong style="color: #dc2626;">D) Error:</strong> "Pólemica" → <strong style="color: #16a34a;">"polémica"</strong> (la tilde va en la 'e', no en la 'o')

<strong>Explicación del error:</strong>
• "Polémica" es palabra esdrújula, la tilde va en la antepenúltima sílaba: po-LÉ-mi-ca
• "Súbito" y "céfiro" están correctamente acentuadas
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

    console.log('✅ Pregunta Ortografía 05 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia05()