import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta65() {
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
      question_text: 'De las siguientes alternativas de respuesta, indique cuál está bien escrita.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'well_written_term',
        evaluation_description: 'Capacidad de identificar el término bien escrito entre alternativas'
      },
      option_a: 'Exhuberante',
      option_b: 'Exuverante', 
      option_c: 'Exuberante',
      option_d: 'Exhuvierante',
      correct_option: 2, // C = Exuberante
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) Exuberante</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Exhuberante</strong> - Incorrecto: lleva h innecesaria
<strong style="color: #dc2626;">B) Exuverante</strong> - Incorrecto: falta la b
<strong style="color: #16a34a;">✓ C) Exuberante</strong> - Correcto: abundante, copioso
<strong style="color: #dc2626;">D) Exhuvierante</strong> - Incorrecto: lleva h y termina mal

<strong>La palabra correcta es "EXUBERANTE"</strong> - adjetivo que significa abundante, copioso, que se manifiesta con gran abundancia. Se escribe sin h y con b.
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

    console.log('✅ Pregunta 65 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta65()