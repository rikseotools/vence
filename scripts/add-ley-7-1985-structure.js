// scripts/add-ley-7-1985-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLey71985Structure() {
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. Disposiciones generales',
      description: 'Principios generales del régimen local',
      article_range_start: 1,
      article_range_end: 10,
      slug: 'ley7-titulo-i-disposiciones-generales',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. El municipio',
      description: 'Territorio, población y organización municipal',
      article_range_start: 11,
      article_range_end: 24,
      slug: 'ley7-titulo-ii-municipio',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. La provincia',
      description: 'Organización y competencias provinciales',
      article_range_start: 25,
      article_range_end: 39,
      slug: 'ley7-titulo-iii-provincia',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Otras entidades locales',
      description: 'Comarcas, áreas metropolitanas y mancomunidades',
      article_range_start: 40,
      article_range_end: 46,
      slug: 'ley7-titulo-iv-otras-entidades-locales',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. Disposiciones comunes a las entidades locales',
      description: 'Competencias, servicios y actividad de fomento',
      article_range_start: 47,
      article_range_end: 62,
      slug: 'ley7-titulo-v-disposiciones-comunes',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. Bienes, actividad económica y expropiación',
      description: 'Patrimonio y actividad económica local',
      article_range_start: 63,
      article_range_end: 83,
      slug: 'ley7-titulo-vi-bienes-actividad-economica',
      order_position: 6
    },
    {
      section_type: 'titulo',
      section_number: 'VII',
      title: 'Título VII. Régimen de las competencias municipales y provinciales',
      description: 'Distribución de competencias entre administraciones',
      article_range_start: 84,
      article_range_end: 90,
      slug: 'ley7-titulo-vii-regimen-competencias',
      order_position: 7
    },
    {
      section_type: 'titulo',
      section_number: 'VIII',
      title: 'Título VIII. Régimen de funcionamiento',
      description: 'Funcionamiento de las entidades locales',
      article_range_start: 91,
      article_range_end: 111,
      slug: 'ley7-titulo-viii-regimen-funcionamiento',
      order_position: 8
    },
    {
      section_type: 'titulo',
      section_number: 'IX',
      title: 'Título IX. Régimen de sesiones',
      description: 'Sesiones de los órganos colegiados',
      article_range_start: 112,
      article_range_end: 119,
      slug: 'ley7-titulo-ix-regimen-sesiones',
      order_position: 9
    },
    {
      section_type: 'titulo',
      section_number: 'X',
      title: 'Título X. Información y participación ciudadanas',
      description: 'Transparencia y participación de los ciudadanos',
      article_range_start: 120,
      article_range_end: 127,
      slug: 'ley7-titulo-x-informacion-participacion-ciudadanas',
      order_position: 10
    },
    {
      section_type: 'titulo',
      section_number: 'XI',
      title: 'Título XI. Régimen de impugnación de los actos y control',
      description: 'Impugnación de actos y control de legalidad',
      article_range_start: 128,
      article_range_end: 146,
      slug: 'ley7-titulo-xi-regimen-impugnacion-control',
      order_position: 11
    }
  ]
}

async function insertLey71985Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA LEY 7/1985 ===')
    
    // 1. Obtener law_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'Ley 7/1985')
      .single()
    
    if (lawError || !law) {
      throw new Error('Ley 7/1985 no encontrada: ' + (lawError?.message || 'No existe'))
    }
    
    console.log('📚 Ley encontrada:', law.name)
    console.log('🆔 Law ID:', law.id)
    
    // 2. Eliminar estructura existente (si hay)
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
    const structure = getLey71985Structure()
    
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
    
    console.log('\\n🎉 ESTRUCTURA LEY 7/1985 CREADA EXITOSAMENTE')
    console.log('📊 Total títulos:', structure.length)
    console.log('📋 Rango completo: Arts. 1-146')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insertLey71985Structure()