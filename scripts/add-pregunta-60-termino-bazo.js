import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta60() {
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
      question_text: 'Señale la opción de respuesta donde se encuentre el término ortográficamente bien escrito.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar el término con escritura ortográfica correcta'
      },
      option_a: 'Vazo',
      option_b: 'Bacia', 
      option_c: 'Bazo',
      option_d: 'Vacia',
      correct_option: 2, // C = Bazo
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) Bazo</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Vazo</strong> - Incorrecto: debería ser <strong>Vaso</strong> (recipiente)

<strong style="color: #dc2626;">B) Bacia</strong> - Incorrecto: debería ser <strong>Vacía</strong> (sin contenido) o <strong>Bacía</strong> (recipiente)

<strong style="color: #16a34a;">✓ C) Bazo</strong> - Correcto: órgano del sistema inmunitario

<strong style="color: #dc2626;">D) Vacia</strong> - Incorrecto: debería ser <strong>Vacía</strong> (con tilde)

<strong>La palabra correcta es "BAZO"</strong> - órgano del sistema linfático e inmunitario, se escribe con Z.

<strong>Explicación de errores:</strong>
• "Vazo" → "Vaso" (recipiente para contener líquidos)
• "Bacia" → "Vacía" (que no tiene contenido) o "Bacía" (vasija)
• "Vacia" → "Vacía" (lleva tilde por ser llana terminada en vocal)
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

    console.log('✅ Pregunta 60 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta60()