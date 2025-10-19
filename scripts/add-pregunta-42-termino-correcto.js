import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta42() {
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
      question_text: 'En las siguientes alternativas de respuesta, hay un término que está correctamente escrito; Indíquelo.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar el término correctamente escrito entre opciones incorrectas'
      },
      option_a: 'Vahido',
      option_b: 'Vaido', 
      option_c: 'Vahido',
      option_d: 'Vaido',
      correct_option: 2, // C = Vahido (desvanecimiento)
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) Vahido</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Vahido</strong> - Incorrecto: repetido, debería ser única la correcta
<strong style="color: #dc2626;">B) Vaido</strong> - Incorrecto: sin h, forma incorrecta
<strong style="color: #16a34a;">✓ C) Vahido</strong> - Correcto: desvanecimiento, mareo (con h)
<strong style="color: #dc2626;">D) Vaido</strong> - Incorrecto: sin h, forma incorrecta

<strong>El término correcto sería "vahido" (desvanecimiento), opción c). Los demás son incorrectos.</strong>
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

    console.log('✅ Pregunta 42 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta42()