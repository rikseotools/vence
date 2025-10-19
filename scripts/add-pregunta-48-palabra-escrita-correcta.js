import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta48() {
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
      question_text: 'Elija la palabra que esté correctamente escrita.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_selection',
        evaluation_description: 'Capacidad de elegir la palabra con escritura ortográfica correcta'
      },
      option_a: 'Exibir',
      option_b: 'Exhibir', 
      option_c: 'Esivir',
      option_d: 'Eshibir',
      correct_option: 1, // B = Exhibir
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Exhibir</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Exibir</strong> - Incorrecto: falta la "h" después de "x"
<strong style="color: #16a34a;">✓ B) Exhibir</strong> - Correcto: mostrar o exponer algo con "xh"
<strong style="color: #dc2626;">C) Esivir</strong> - Incorrecto: debería ser con "x" no con "s"
<strong style="color: #dc2626;">D) Eshibir</strong> - Incorrecto: debería empezar con "ex" no con "es"

<strong>La palabra correcta es "EXHIBIR"</strong> - mostrar o exponer algo públicamente, se escribe con "xh".
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

    console.log('✅ Pregunta 48 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta48()