import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta66() {
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
      question_text: 'Seleccione la frase que esté ortográficamente correcta.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_phrase_selection',
        evaluation_description: 'Capacidad de seleccionar la frase ortográficamente correcta'
      },
      option_a: 'Despues de mucho reflexionar, decidió marcharse a Francia.',
      option_b: 'Después de mucho reflexionar, decidió marcharse a Francia.', 
      option_c: 'Despues de mucho reflexionar, decídio marcharse a Francia.',
      option_d: 'Después de mucho reflexionar, decídio marcharse a Francia.',
      correct_option: 1, // B = Después... decidió
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Después de mucho reflexionar, decidió marcharse a Francia</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Error:</strong> "Despues" → <strong>Después</strong> (falta la tilde)

<strong style="color: #16a34a;">✓ B) Correcta:</strong> "Después" (con tilde) y "decidió" (con tilde) están bien escritos

<strong style="color: #dc2626;">C) Errores:</strong> "Despues" → <strong>Después</strong> (falta tilde) y "decídio" → <strong>decidió</strong> (mal acentuada)

<strong style="color: #dc2626;">D) Error:</strong> "decídio" → <strong>decidió</strong> (la tilde va en la í, no en la e)

<strong>Reglas aplicadas:</strong>
• "Después" lleva tilde por ser palabra aguda terminada en 's'
• "Decidió" lleva tilde por ser palabra aguda terminada en vocal
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

    console.log('✅ Pregunta 66 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta66()