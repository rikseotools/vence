import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta52() {
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
      question_text: 'Indique la opción de respuesta que se corresponde con la palabra ortográficamente correcta.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar la palabra con escritura ortográfica correcta'
      },
      option_a: 'Uranio',
      option_b: 'Poyo', 
      option_c: 'Tribial',
      option_d: 'Párbulo',
      correct_option: 1, // B = Poyo
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Poyo</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Uranio</strong> - Incorrecto: debería ser <strong>Urano</strong> (planeta)
<strong style="color: #16a34a;">✓ B) Poyo</strong> - Correcto: banco de piedra arrimado a las paredes
<strong style="color: #dc2626;">C) Tribial</strong> - Incorrecto: debería ser <strong>Trivial</strong>
<strong style="color: #dc2626;">D) Párbulo</strong> - Incorrecto: debería ser <strong>Párvulo</strong>

<strong>La palabra correcta es "POYO"</strong> - banco de piedra que se construye arrimado a las paredes junto al hogar.
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

    console.log('✅ Pregunta 52 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta52()