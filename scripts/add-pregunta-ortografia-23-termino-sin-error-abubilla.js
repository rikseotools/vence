import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia23() {
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
      question_text: 'Indique la alternativa de respuesta en donde se encuentra un término que no tiene error ortográfico.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'no_orthographic_error',
        evaluation_description: 'Identificar el término sin error ortográfico'
      },
      option_a: 'Abubilla',
      option_b: 'Avubilla',
      option_c: 'Abubiya',
      option_d: 'Avubiya',
      correct_option: 0, // A = Abubilla
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Abubilla</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Abubilla:</strong> Correcto - pájaro insectívoro con cresta

<strong style="color: #dc2626;">B) Avubilla:</strong> Incorrecto - se escribe con 'b' inicial, no 'v'

<strong style="color: #dc2626;">C) Abubiya:</strong> Incorrecto - termina en 'lla', no 'ya'

<strong style="color: #dc2626;">D) Avubiya:</strong> Incorrecto - doble error ('v' inicial y terminación 'ya')

<strong>La palabra correcta es "ABUBILLA"</strong> - ave del orden de las coraciformes, con cresta de plumas en la cabeza. Es insectívora y se caracteriza por su canto distintivo.

<strong>Etimología:</strong> Del árabe hispánico "bubuílla".
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

    console.log('✅ Pregunta Ortografía 23 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia23()