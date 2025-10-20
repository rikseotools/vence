import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia14() {
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
      question_text: 'Señale la alternativa de respuesta en que aparezca la palabra que está ortográficamente bien escrita.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'well_written_word',
        evaluation_description: 'Identificar la palabra ortográficamente bien escrita'
      },
      option_a: 'Ojén',
      option_b: 'Agenjo',
      option_c: 'Gengibre',
      option_d: 'Ajónjoli',
      correct_option: 0, // A = Ojén
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Ojén</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Ojén:</strong> Correcto - licor anisado típico de Andalucía

<strong style="color: #dc2626;">B) Agenjo:</strong> Incorrecto - debe ser <strong style="color: #16a34a;">"ajenjo"</strong> (planta aromática)

<strong style="color: #dc2626;">C) Gengibre:</strong> Incorrecto - debe ser <strong style="color: #16a34a;">"jengibre"</strong> (raíz aromática)

<strong style="color: #dc2626;">D) Ajónjoli:</strong> Incorrecto - debe ser <strong style="color: #16a34a;">"ajonjolí"</strong> (sésamo, sin tilde)

<strong>La palabra correcta es "OJÉN"</strong> - aguardiente anisado que se elabora en la localidad malagueña de Ojén.

<strong>Correcciones:</strong>
• Agenjo → Ajenjo
• Gengibre → Jengibre  
• Ajónjoli → Ajonjolí
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

    console.log('✅ Pregunta Ortografía 14 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia14()