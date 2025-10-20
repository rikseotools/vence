import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta63() {
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
      question_text: 'Indique cuál de las siguientes opciones de respuesta contiene el término verdadero.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'true_term_identification',
        evaluation_description: 'Capacidad de identificar el término verdadero entre alternativas ortográficas'
      },
      option_a: 'Bacuo',
      option_b: 'Bácuo', 
      option_c: 'Vacúo',
      option_d: 'Vacuo',
      correct_option: 2, // C = Vacúo
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) Vacúo</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Bacuo</strong> - Incorrecto: esta palabra no existe
<strong style="color: #dc2626;">B) Bácuo</strong> - Incorrecto: no existe esta forma con B
<strong style="color: #16a34a;">✓ C) Vacúo</strong> - Correcto: que está vacío o hueco
<strong style="color: #dc2626;">D) Vacuo</strong> - Incorrecto: falta la tilde

<strong>La palabra correcta es "VACÚO"</strong> - adjetivo que significa vacío, hueco o que carece de contenido. Es palabra esdrújula y por tanto lleva tilde.
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

    console.log('✅ Pregunta 63 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta63()