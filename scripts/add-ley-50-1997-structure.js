// scripts/add-ley-50-1997-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLey501997Structure() {
  return [
    {
      section_type: 'titulo',
      section_number: 'Preliminar',
      title: 'Título Preliminar. Disposiciones generales',
      description: 'Naturaleza y funciones del Gobierno',
      article_range_start: 1,
      article_range_end: 5,
      slug: 'ley50-titulo-preliminar-disposiciones-generales',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. De la composición, organización y funcionamiento del Gobierno',
      description: 'Estructura y organización del Gobierno',
      article_range_start: 6,
      article_range_end: 16,
      slug: 'ley50-titulo-i-composicion-organizacion-funcionamiento',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. Del Presidente del Gobierno',
      description: 'Funciones y prerrogativas del Presidente',
      article_range_start: 17,
      article_range_end: 21,
      slug: 'ley50-titulo-ii-presidente-gobierno',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. Del Vicepresidente o Vicepresidentes del Gobierno',
      description: 'Funciones de los Vicepresidentes',
      article_range_start: 22,
      article_range_end: 23,
      slug: 'ley50-titulo-iii-vicepresidentes-gobierno',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. De los Ministros',
      description: 'Funciones y responsabilidades de los Ministros',
      article_range_start: 24,
      article_range_end: 27,
      slug: 'ley50-titulo-iv-ministros',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. De los órganos de colaboración y apoyo del Gobierno',
      description: 'Comisiones Delegadas y órganos de apoyo',
      article_range_start: 28,
      article_range_end: 32,
      slug: 'ley50-titulo-v-organos-colaboracion-apoyo',
      order_position: 6
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. De los altos cargos de la Administración General del Estado',
      description: 'Secretarios de Estado y otros altos cargos',
      article_range_start: 33,
      article_range_end: 36,
      slug: 'ley50-titulo-vi-altos-cargos-administracion',
      order_position: 7
    }
  ]
}

async function insertLey501997Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA LEY 50/1997 ===')
    
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
    
    // 2. Eliminar estructura existente
    const { error: deleteError } = await supabase
      .from('law_sections')
      .delete()
      .eq('law_id', law.id)
    
    if (deleteError) {
      console.log('⚠️ Error eliminando estructura anterior:', deleteError.message)
    } else {
      console.log('🗑️ Estructura anterior eliminada')
    }
    
    // 3. Insertar nueva estructura
    const structure = getLey501997Structure()
    
    for (const section of structure) {
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
    
    console.log('\\n🎉 ESTRUCTURA LEY 50/1997 CREADA EXITOSAMENTE')
    console.log('📊 Total títulos:', structure.length)
    console.log('📋 Rango completo: Arts. 1-36')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insertLey501997Structure()