import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia16() {
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
      question_text: 'Señale qué definición es la que se corresponde con la palabra INCIERTO:',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'word_definition_match',
        evaluation_description: 'Identificar la definición correcta de la palabra dada'
      },
      option_a: 'Que hurta o roba',
      option_b: 'Acto de discurrir el entendimiento',
      option_c: 'No saber algo o no tener noticia de ello',
      option_d: 'No seguro, dudoso',
      correct_option: 3, // D = No seguro, dudoso
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) No seguro, dudoso</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Definición de "INCIERTO":</strong>

<strong style="color: #16a34a;">✓ D) No seguro, dudoso</strong> - Definición correcta de "incierto"

<strong>Análisis de otras opciones:</strong>

<strong style="color: #dc2626;">A) Que hurta o roba:</strong> Esta sería la definición de "ladrón" o "ratero"

<strong style="color: #dc2626;">B) Acto de discurrir el entendimiento:</strong> Esta sería la definición de "razonamiento" o "discurso"

<strong style="color: #dc2626;">C) No saber algo o no tener noticia de ello:</strong> Esta sería la definición de "ignorar" o "desconocer"

<strong>Sinónimos de "incierto":</strong> dudoso, impreciso, vago, borroso, inseguro, eventual, vacilante.

<strong>Antónimos:</strong> seguro, cierto, conocido.
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

    console.log('✅ Pregunta Ortografía 16 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia16()