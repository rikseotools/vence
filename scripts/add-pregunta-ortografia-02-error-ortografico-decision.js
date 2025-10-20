import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia02() {
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
      question_text: 'Señale la opción que contiene algún error ortográfico.',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'word_list_analysis',
        question_type: 'find_orthographic_error',
        evaluation_description: 'Identificar la opción que contiene error ortográfico'
      },
      option_a: 'Aprehender, concisión, vestíbulo',
      option_b: 'Efímero, innato, austero',
      option_c: 'Instinto, precaución, ilusión',
      option_d: 'Extender, desición, cordial',
      correct_option: 3, // D = desición está mal
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Extender, desición, cordial</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">A) Correcta:</strong> Aprehender, concisión, vestíbulo - todas bien escritas

<strong style="color: #16a34a;">B) Correcta:</strong> Efímero, innato, austero - todas bien escritas

<strong style="color: #16a34a;">C) Correcta:</strong> Instinto, precaución, ilusión - todas bien escritas

<strong style="color: #dc2626;">D) Error:</strong> "desición" → <strong style="color: #16a34a;">"decisión"</strong> (se escribe con 'c')

<strong>Explicación del error:</strong>
• "Decisión" se escribe con 'c' porque viene del verbo "decidir"
• Las demás palabras de la opción D están correctas: "extender" y "cordial"
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

    console.log('✅ Pregunta Ortografía 02 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia02()