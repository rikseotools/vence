import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta41() {
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
      question_text: 'Señale la opción de respuesta que corresponda con la palabra ortográficamente correcta.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar la palabra correctamente escrita entre opciones'
      },
      option_a: 'Veyo',
      option_b: 'Corveta', 
      option_c: 'abión',
      option_d: 'Savia',
      correct_option: 1, // B = Corveta
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Corveta</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Veyo</strong> - Incorrecto: debería ser <strong>Bello</strong> (con b)

<strong style="color: #16a34a;">✓ B) Corveta</strong> - Correcto: embarcación militar ligera

<strong style="color: #dc2626;">C) abión</strong> - Incorrecto: debería ser <strong>Avión</strong> (con v y mayúscula)

<strong style="color: #dc2626;">D) Savia</strong> - Incorrecto en contexto: es <strong>Sabia</strong> (con b para persona sabia)

<strong>La respuesta correcta es Corveta</strong><br>
Avión se escribe con "v"<br>
Bello se escribe con "b"<br>
Sabia se escribe con "b".
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

    console.log('✅ Pregunta 41 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta41()