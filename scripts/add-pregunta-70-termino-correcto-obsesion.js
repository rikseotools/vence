import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta70() {
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
      question_text: 'Indique cuál de las siguientes alternativas de respuesta contiene el término correcto.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_term_identification',
        evaluation_description: 'Capacidad de identificar el término correcto entre alternativas'
      },
      option_a: 'Obsesion',
      option_b: 'Obsesión', 
      option_c: 'Opseción',
      option_d: 'Ovsesión',
      correct_option: 1, // B = Obsesión
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Obsesión</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Obsesion</strong> - Incorrecto: falta la tilde
<strong style="color: #16a34a;">✓ B) Obsesión</strong> - Correcto: idea fija, preocupación constante
<strong style="color: #dc2626;">C) Opseción</strong> - Incorrecto: falta la 'b' y mal escrita
<strong style="color: #dc2626;">D) Ovsesión</strong> - Incorrecto: lleva 'v' en lugar de 'b'

<strong>La palabra correcta es "OBSESIÓN"</strong> - sustantivo que significa preocupación persistente, idea fija que domina el pensamiento. Es palabra aguda terminada en 'n', por lo que lleva tilde. Se escribe con 'b' y 's'.
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

    console.log('✅ Pregunta 70 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta70()