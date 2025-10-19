import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta43() {
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
      question_text: 'Lee con atención las siguientes frases y selecciona la opción que no contiene ningún error ortográfico.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar la frase sin errores ortográficos entre opciones con errores'
      },
      option_a: 'El hierro estaba completamente oxsidado tras tantos años.',
      option_b: 'Me hecharon del equipo por no asistir a los entrenamientos.', 
      option_c: 'El director tomó la desición más arriesgada del proyecto.',
      option_d: 'La buhardilla del edificio estaba repleta de objetos antiguos.',
      correct_option: 3, // D es la correcta
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D)</strong> "La buhardilla del edificio estaba repleta de objetos antiguos."

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Error:</strong> "oxsidado" → <strong>oxidado</strong> (sin s)
<strong style="color: #dc2626;">B) Errores:</strong> "hecharon" → <strong>echaron</strong> (el verbo echar es sin h)
<strong style="color: #dc2626;">C) Error:</strong> "desición" → <strong>decisión</strong> (la forma correcta es decisión)
<strong style="color: #16a34a;">✓ D) Correcta:</strong> buhardilla, la frase no presenta errores.

<strong>SOLUCIÓN:</strong><br>
la buhardilla del edificio estaba repleta de objetos antiguos.<br>
Explicación:<br>
Correcta: buhardilla, la frase no presenta errores.<br>
• Incorrecta: hecharon, el verbo echar es sin "h".<br>
• Incorrecta: desición, la forma correcta es decisión.<br>
• Incorrecta: Oxsidado, debe ser oxidado.
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

    console.log('✅ Pregunta 43 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta43()