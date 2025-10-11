// scripts/check-ui-vs-db-mapping.js
// Script para verificar mapping entre UI y base de datos
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkUIvsDBMapping() {
  try {
    console.log('🔍 Checking UI vs DB section mapping...')

    // IDs que usa la UI (del archivo page.js)
    const uiSections = [
      { id: 'cap-admin-tablas', name: 'Tablas' },
      { id: 'cap-admin-graficos', name: 'Gráficos' },
      { id: 'cap-admin-clasificacion', name: 'Pruebas de clasificación' },
      { id: 'cap-admin-atencion-percepcion', name: 'Pruebas de atención-percepción' }
    ]

    console.log('\n📋 UI expects these sections:')
    uiSections.forEach(s => console.log(`   ${s.id} → ${s.name}`))

    // Secciones reales en la BD
    const { data: dbSections, error: sectionsError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .order('section_key')

    if (sectionsError) {
      console.error('❌ Error getting DB sections:', sectionsError)
      return
    }

    console.log('\n🗄️ DB has these sections:')
    dbSections.forEach(s => console.log(`   ${s.section_key} → ${s.display_name || 'No display name'}`))

    console.log('\n🔍 Mapping analysis:')
    for (const uiSection of uiSections) {
      const dbMatch = dbSections.find(db => 
        db.section_key === uiSection.id || 
        db.section_key === uiSection.id.replace('cap-admin-', '') ||
        db.display_name === uiSection.name
      )

      if (dbMatch) {
        // Contar preguntas
        const { data: questions } = await supabase
          .from('psychometric_questions')
          .select('id, question_subtype')
          .eq('section_id', dbMatch.id)

        console.log(`✅ ${uiSection.id} → ${dbMatch.section_key} (${questions?.length || 0} questions)`)
      } else {
        console.log(`❌ ${uiSection.id} → NO MATCH FOUND`)
      }
    }

    // Buscar secciones huérfanas
    console.log('\n🔍 Looking for sections with questions that UI might miss:')
    for (const dbSection of dbSections) {
      const { data: questions } = await supabase
        .from('psychometric_questions')
        .select('id')
        .eq('section_id', dbSection.id)

      if (questions && questions.length > 0) {
        const uiMatch = uiSections.find(ui => 
          ui.id === dbSection.section_key ||
          ui.id === `cap-admin-${dbSection.section_key}` ||
          ui.name === dbSection.display_name
        )

        if (!uiMatch) {
          console.log(`🚨 ${dbSection.section_key} has ${questions.length} questions but NO UI mapping!`)
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
checkUIvsDBMapping()