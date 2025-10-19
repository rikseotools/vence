import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta22() {
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
      question_text: 'Marque la palabra correctamente escrita:',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar la palabra correctamente escrita entre opciones'
      },
      option_a: 'Zahérir',
      option_b: 'Covre', 
      option_c: 'Peritage',
      option_d: 'Cinc',
      correct_option: 3, // D = Cinc
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Cinc</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Zahérir</strong> - Incorrecto: no lleva tilde, debería ser <strong>zaherir</strong>

<strong style="color: #dc2626;">B) Covre</strong> - Incorrecto: debería ser <strong>cobre</strong> (con b)

<strong style="color: #dc2626;">C) Peritage</strong> - Incorrecto: debería ser <strong>peritaje</strong> (con j)

<strong style="color: #16a34a;">✓ D) Cinc</strong> - Correcto: forma correcta de escribir este elemento químico (zinc)
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

    console.log('✅ Pregunta 22 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta22()