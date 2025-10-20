import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia24() {
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
      question_text: 'Seleccione la opción que contiene un error en el uso de B/V.',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'word_list_analysis',
        question_type: 'bv_usage_error',
        evaluation_description: 'Identificar error en el uso de B/V'
      },
      option_a: 'Gravamen, exacerbar, bisagra',
      option_b: 'Subvención, obviar, advertir',
      option_c: 'Herbívoro, absolver, bovino',
      option_d: 'Vaazista, vibrar, envolver',
      correct_option: 3, // D = Vaazista (debe ser Baazista)
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Vaazista, vibrar, envolver</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">A) Correcta:</strong> Gravamen, exacerbar, bisagra - todas bien escritas

<strong style="color: #16a34a;">B) Correcta:</strong> Subvención, obviar, advertir - todas bien escritas

<strong style="color: #16a34a;">C) Correcta:</strong> Herbívoro, absolver, bovino - todas bien escritas

<strong style="color: #dc2626;">D) Error:</strong> "Vaazista" → <strong style="color: #16a34a;">"Baazista"</strong> (se escribe con 'b')

<strong>Explicación del error:</strong>
• "Baazista" se escribe con 'b' inicial (no existe la palabra "vaazista")
• Las demás palabras de la opción D están correctas: "vibrar" y "envolver"
• Baazista: seguidor del partido político Baaz (en países árabes)
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

    console.log('✅ Pregunta Ortografía 24 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia24()