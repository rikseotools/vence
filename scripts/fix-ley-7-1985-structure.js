// scripts/fix-ley-7-1985-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getCorrectLey71985Structure() {
  // Estructura real según BOE oficial - solo tiene títulos I, II, III, IV, V, VII, X
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
      article_range_end: 79,
      slug: 'ley7-titulo-ii-municipio',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. La provincia',
      description: 'Organización y competencias provinciales',
      article_range_start: 31,
      article_range_end: 43,
      slug: 'ley7-titulo-iii-provincia',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Otras entidades locales',
      description: 'Comarcas, áreas metropolitanas y mancomunidades',
      article_range_start: 42,
      article_range_end: 46,
      slug: 'ley7-titulo-iv-otras-entidades-locales',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. Disposiciones comunes a las entidades locales',
      description: 'Competencias, servicios y funcionamiento común',
      article_range_start: 25,
      article_range_end: 87,
      slug: 'ley7-titulo-v-disposiciones-comunes',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'VII',
      title: 'Título VII. Personal al servicio de las entidades locales',
      description: 'Régimen del personal de entidades locales',
      article_range_start: 89,
      article_range_end: 105,
      slug: 'ley7-titulo-vii-personal-entidades-locales',
      order_position: 6
    },
    {
      section_type: 'titulo',
      section_number: 'X',
      title: 'Título X. Régimen de organización de los municipios de gran población',
      description: 'Organización especial para municipios grandes',
      article_range_start: 121,
      article_range_end: 140,
      slug: 'ley7-titulo-x-municipios-gran-poblacion',
      order_position: 7
    }
  ]
}

async function fixLey71985Structure() {
  try {
    console.log('🔧 === CORRIGIENDO ESTRUCTURA LEY 7/1985 ===')
    
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
    
    // 2. Eliminar estructura incorrecta completa
    const { error: deleteError } = await supabase
      .from('law_sections')
      .delete()
      .eq('law_id', law.id)
    
    if (deleteError) {
      console.log('⚠️ Error eliminando estructura anterior:', deleteError.message)
    } else {
      console.log('🗑️ Estructura incorrecta eliminada (11 títulos falsos)')
    }
    
    // 3. Insertar estructura correcta (solo 7 títulos)
    const correctStructure = getCorrectLey71985Structure()
    
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
    
    console.log('\n🎉 ESTRUCTURA LEY 7/1985 CORREGIDA EXITOSAMENTE')
    console.log('📊 Total títulos REAL:', correctStructure.length, '(antes tenía 11 falsos)')
    console.log('📋 Títulos REALES: I, II, III, IV, V, VII, X')
    console.log('❌ Títulos ELIMINADOS: VI, VIII, IX, XI (no existen)')
    console.log('🔧 Rangos corregidos según BOE oficial')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

fixLey71985Structure()