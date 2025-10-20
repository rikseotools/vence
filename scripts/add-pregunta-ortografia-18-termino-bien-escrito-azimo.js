import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia18() {
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
      question_text: '¿Cuál de las siguientes opciones de respuesta presenta un término ortográficamente bien escrito?',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'well_written_term',
        evaluation_description: 'Identificar el término ortográficamente bien escrito'
      },
      option_a: 'Ázimo',
      option_b: 'Acimo',
      option_c: 'Hácimo',
      option_d: 'Azimo',
      correct_option: 0, // A = Ázimo
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Ázimo</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Ázimo:</strong> Correcto - pan sin levadura

<strong style="color: #dc2626;">B) Acimo:</strong> Incorrecto - falta la tilde

<strong style="color: #dc2626;">C) Hácimo:</strong> Incorrecto - lleva 'h' innecesaria

<strong style="color: #dc2626;">D) Azimo:</strong> Incorrecto - falta la tilde

<strong>La palabra correcta es "ÁZIMO"</strong> - adjetivo que se aplica al pan elaborado sin levadura. Es palabra esdrújula, por lo que lleva tilde en la antepenúltima sílaba.

<strong>Definición:</strong> Pan que se hace sin levadura y se utiliza especialmente en ceremonias religiosas (como la Pascua judía).

<strong>Etimología:</strong> Del griego "ázymos" (sin fermentar).
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

    console.log('✅ Pregunta Ortografía 18 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia18()