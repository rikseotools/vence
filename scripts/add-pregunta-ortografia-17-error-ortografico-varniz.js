import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia17() {
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
      question_text: 'Indique cuál de las siguientes palabras contiene un error ortográfico.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_identification',
        evaluation_description: 'Identificar la palabra con error ortográfico'
      },
      option_a: 'Varniz',
      option_b: 'Baño',
      option_c: 'Pátina',
      option_d: 'Grabar',
      correct_option: 0, // A = Varniz (debe ser Barniz)
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Varniz</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">✗ A) Varniz:</strong> ERROR - La palabra correcta es <strong style="color: #16a34a;">"barniz"</strong> (se escribe con 'b')

<strong style="color: #16a34a;">✓ B) Baño:</strong> Correcto - acción de bañarse

<strong style="color: #16a34a;">✓ C) Pátina:</strong> Correcto - tono que toma un objeto con el tiempo

<strong style="color: #16a34a;">✓ D) Grabar:</strong> Correcto - registrar sonidos o imágenes

<strong>Explicación del error:</strong>
• "Barniz" se escribe con 'b', no con 'v'
• Es una disolución de sustancias resinosas que se aplica a pinturas
• Procede del árabe "barnīq"
• No confundir con palabras que sí llevan 'v' como "varón" o "vapor"
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

    console.log('✅ Pregunta Ortografía 17 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia17()