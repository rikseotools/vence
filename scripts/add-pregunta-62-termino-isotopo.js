import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta62() {
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
      question_text: 'En las siguientes alternativas de respuesta, hay un término que está ortográficamente bien escrito, indíquelo.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar el término que está ortográficamente bien escrito'
      },
      option_a: 'Hisotopo',
      option_b: 'Isótopo', 
      option_c: 'Isopo',
      option_d: 'Hísopo',
      correct_option: 1, // B = Isótopo
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Isótopo</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Hisotopo</strong> - Incorrecto: no lleva h inicial
<strong style="color: #16a34a;">✓ B) Isótopo</strong> - Correcto: átomos de un mismo elemento químico
<strong style="color: #dc2626;">C) Isopo</strong> - Incorrecto: falta la acentuación y la terminación
<strong style="color: #dc2626;">D) Hísopo</strong> - Incorrecto: esta palabra existe pero significa otra cosa (planta aromática)

<strong>La palabra correcta es "ISÓTOPO"</strong> - término químico que se refiere a átomos de un mismo elemento con diferente masa atómica.
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

    console.log('✅ Pregunta 62 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta62()