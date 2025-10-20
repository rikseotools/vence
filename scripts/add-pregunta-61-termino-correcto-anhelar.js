import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta61() {
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
      question_text: 'Indique cuál de las alternativas de respuesta que se le presentan, contiene un término ortográficamente correcto.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar el término ortográficamente correcto entre alternativas'
      },
      option_a: 'Hanelar',
      option_b: 'Anhelar', 
      option_c: 'Anelar',
      option_d: 'Hanhelar',
      correct_option: 1, // B = Anhelar
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Anhelar</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Hanelar</strong> - Incorrecto: no existe esta forma
<strong style="color: #16a34a;">✓ B) Anhelar</strong> - Correcto: desear vivamente algo
<strong style="color: #dc2626;">C) Anelar</strong> - Incorrecto: falta la h
<strong style="color: #dc2626;">D) Hanhelar</strong> - Incorrecto: doble h incorrecta

<strong>La palabra correcta es "ANHELAR"</strong> - verbo que significa desear vivamente algo, se escribe con h intercalada.
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

    console.log('✅ Pregunta 61 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta61()