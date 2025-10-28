// scripts/fix-ley-50-1997-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getCorrectLey501997Structure() {
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. Del Gobierno: composición, organización y órganos de colaboración y apoyo',
      description: 'Gobierno, composición, organización, funciones y órganos de colaboración',
      article_range_start: 1,
      article_range_end: 10,
      slug: 'ley50-titulo-i-gobierno-composicion-organizacion',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. Del estatuto de los miembros del Gobierno, de los Secretarios de Estado y de los Directores de los Gabinetes',
      description: 'Estatuto jurídico de miembros del Gobierno, Secretarios de Estado y Directores',
      article_range_start: 11,
      article_range_end: 16,
      slug: 'ley50-titulo-ii-estatuto-miembros-gobierno',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. De las normas de funcionamiento del Gobierno y de la delegación de competencias',
      description: 'Funcionamiento del Gobierno y delegación de competencias',
      article_range_start: 17,
      article_range_end: 20,
      slug: 'ley50-titulo-iii-funcionamiento-delegacion',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Del Gobierno en funciones',
      description: 'Régimen del Gobierno en funciones',
      article_range_start: 21,
      article_range_end: 21,
      slug: 'ley50-titulo-iv-gobierno-funciones',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. De la iniciativa legislativa y la potestad reglamentaria del Gobierno',
      description: 'Iniciativa legislativa, potestad reglamentaria y plan normativo',
      article_range_start: 22,
      article_range_end: 28,
      slug: 'ley50-titulo-v-iniciativa-legislativa-reglamentaria',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. Del control del Gobierno',
      description: 'Control parlamentario del Gobierno',
      article_range_start: 29,
      article_range_end: 29,
      slug: 'ley50-titulo-vi-control-gobierno',
      order_position: 6
    }
  ]
}

async function fixLey501997Structure() {
  try {
    console.log('🔧 === CORRIGIENDO ESTRUCTURA LEY 50/1997 ===')
    
    // 1. Obtener law_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'Ley 50/1997')
      .single()
    
    if (lawError || !law) {
      throw new Error('Ley 50/1997 no encontrada: ' + (lawError?.message || 'No existe'))
    }
    
    console.log('📚 Ley encontrada:', law.name)
    console.log('🆔 Law ID:', law.id)
    
    // 2. Eliminar estructura incorrecta
    const { error: deleteError } = await supabase
      .from('law_sections')
      .delete()
      .eq('law_id', law.id)
    
    if (deleteError) {
      console.log('⚠️ Error eliminando estructura anterior:', deleteError.message)
    } else {
      console.log('🗑️ Estructura incorrecta eliminada')
    }
    
    // 3. Insertar estructura correcta
    const correctStructure = getCorrectLey501997Structure()
    
    for (const section of correctStructure) {
      const sectionData = {
        law_id: law.id,
        ...section,
        is_active: true
      }
      
      const { error: insertError } = await supabase
        .from('law_sections')
        .insert(sectionData)
      
      if (insertError) {
        throw new Error(`Error insertando ${section.title}: ${insertError.message}`)
      }
      
      console.log('✅', section.title, `(Arts. ${section.article_range_start}-${section.article_range_end})`)
    }
    
    console.log('\n🎉 ESTRUCTURA LEY 50/1997 CORREGIDA EXITOSAMENTE')
    console.log('📊 Total títulos:', correctStructure.length)
    console.log('📋 Rango correcto: Arts. 1-29')
    console.log('🔧 Eliminado: Título Preliminar inexistente')
    console.log('🔧 Corregido: Rangos de artículos según BOE oficial')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

fixLey501997Structure()