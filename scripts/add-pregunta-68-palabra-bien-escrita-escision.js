import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta68() {
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
      question_text: 'Indique cuál de las siguientes palabras está bien escrita.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'well_written_word',
        evaluation_description: 'Capacidad de identificar la palabra bien escrita'
      },
      option_a: 'Escision',
      option_b: 'Escisión', 
      option_c: 'Esición',
      option_d: 'Ecisión',
      correct_option: 1, // B = Escisión
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Escisión</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Escision</strong> - Incorrecto: falta la tilde
<strong style="color: #16a34a;">✓ B) Escisión</strong> - Correcto: división, separación
<strong style="color: #dc2626;">C) Esición</strong> - Incorrecto: falta la 'c' inicial
<strong style="color: #dc2626;">D) Ecisión</strong> - Incorrecto: falta la 's'

<strong>La palabra correcta es "ESCISIÓN"</strong> - sustantivo que significa división, separación o corte. Es palabra aguda terminada en 'n', por lo que lleva tilde. Se escribe con 'sc'.
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

    console.log('✅ Pregunta 68 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta68()