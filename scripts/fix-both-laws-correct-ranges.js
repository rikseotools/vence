// scripts/fix-both-laws-correct-ranges.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getCorrectLey501997Structure() {
  // Rangos extraídos usando metodología TÍTULO del BOE oficial
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. Del Gobierno: composición, organización y órganos de colaboración y apoyo',
      description: 'Gobierno, composición, organización, funciones y órganos de colaboración',
      article_range_start: 1,
      article_range_end: 10, // Precede: Article 11
      slug: 'ley50-titulo-i-gobierno-composicion-organizacion',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. Del estatuto de los miembros del Gobierno, de los Secretarios de Estado y de los Directores de los Gabinetes',
      description: 'Estatuto jurídico de miembros del Gobierno, Secretarios de Estado y Directores',
      article_range_start: 11,
      article_range_end: 16, // Precede: Article 17
      slug: 'ley50-titulo-ii-estatuto-miembros-gobierno',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. De las normas de funcionamiento del Gobierno y de la delegación de competencias',
      description: 'Funcionamiento del Gobierno y delegación de competencias',
      article_range_start: 17,
      article_range_end: 20, // Precede: Article 21
      slug: 'ley50-titulo-iii-funcionamiento-delegacion',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Del Gobierno en funciones',
      description: 'Régimen del Gobierno en funciones',
      article_range_start: 21,
      article_range_end: 21, // Precede: Article 22
      slug: 'ley50-titulo-iv-gobierno-funciones',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. De la iniciativa legislativa y la potestad reglamentaria del Gobierno',
      description: 'Iniciativa legislativa, potestad reglamentaria y plan normativo',
      article_range_start: 22,
      article_range_end: 28, // Precede: Article 29
      slug: 'ley50-titulo-v-iniciativa-legislativa-reglamentaria',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. Del control del Gobierno',
      description: 'Control parlamentario del Gobierno',
      article_range_start: 29,
      article_range_end: 29, // Final de la ley
      slug: 'ley50-titulo-vi-control-gobierno',
      order_position: 6
    }
  ]
}

function getCorrectLey71985Structure() {
  // Rangos extraídos usando metodología TÍTULO del BOE oficial
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. Disposiciones generales',
      description: 'Principios generales del régimen local',
      article_range_start: 1,
      article_range_end: 10, // Precede: Article 11
      slug: 'ley7-titulo-i-disposiciones-generales',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. El municipio',
      description: 'Territorio, población y organización municipal',
      article_range_start: 11,
      article_range_end: 30, // Precede: Article 31 (Título III)
      slug: 'ley7-titulo-ii-municipio',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. La provincia',
      description: 'Organización y competencias provinciales',
      article_range_start: 31,
      article_range_end: 41, // Precede: Article 42 (Título IV)
      slug: 'ley7-titulo-iii-provincia',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Otras entidades locales',
      description: 'Comarcas, áreas metropolitanas y mancomunidades',
      article_range_start: 42,
      article_range_end: 45, // Precede: Article 46
      slug: 'ley7-titulo-iv-otras-entidades-locales',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. Disposiciones comunes a las entidades locales',
      description: 'Competencias, servicios y funcionamiento común',
      article_range_start: 46,
      article_range_end: 77, // Precede: Article 78 (no hay más títulos inmediatos)
      slug: 'ley7-titulo-v-disposiciones-comunes',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. Bienes, actividad económica y expropiación',
      description: 'Patrimonio y actividad económica local',
      article_range_start: 78,
      article_range_end: 88, // Precede: Article 89 (Título VII)
      slug: 'ley7-titulo-vi-bienes-actividad-economica',
      order_position: 6
    },
    {
      section_type: 'titulo',
      section_number: 'VII',
      title: 'Título VII. Personal al servicio de las entidades locales',
      description: 'Régimen del personal de entidades locales',
      article_range_start: 89,
      article_range_end: 104, // Precede: Article 105 (Título VIII)
      slug: 'ley7-titulo-vii-personal-entidades-locales',
      order_position: 7
    },
    {
      section_type: 'titulo',
      section_number: 'VIII',
      title: 'Título VIII. Régimen de funcionamiento',
      description: 'Funcionamiento de las entidades locales',
      article_range_start: 105,
      article_range_end: 115, // Precede: Article 116ter (Título IX)
      slug: 'ley7-titulo-viii-regimen-funcionamiento',
      order_position: 8
    },
    {
      section_type: 'titulo',
      section_number: 'IX',
      title: 'Título IX. Régimen de sesiones',
      description: 'Sesiones de los órganos colegiados',
      article_range_start: 116,
      article_range_end: 120, // Precede: Article 121 (Título X)
      slug: 'ley7-titulo-ix-regimen-sesiones',
      order_position: 9
    },
    {
      section_type: 'titulo',
      section_number: 'X',
      title: 'Título X. Régimen de organización de los municipios de gran población',
      description: 'Organización especial para municipios grandes',
      article_range_start: 121,
      article_range_end: 132, // Precede: Article 133
      slug: 'ley7-titulo-x-municipios-gran-poblacion',
      order_position: 10
    }
  ]
}

async function fixBothLawsCorrectRanges() {
  try {
    console.log('🔧 === CORRIGIENDO AMBAS ESTRUCTURAS CON RANGOS REALES ===')
    
    // 1. Corregir Ley 50/1997
    console.log('\n📚 CORRIGIENDO LEY 50/1997...')
    const { data: law50, error: lawError50 } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'Ley 50/1997')
      .single()
    
    if (lawError50 || !law50) {
      throw new Error('Ley 50/1997 no encontrada')
    }
    
    // Eliminar estructura incorrecta
    await supabase.from('law_sections').delete().eq('law_id', law50.id)
    console.log('🗑️ Estructura incorrecta Ley 50/1997 eliminada')
    
    // Insertar estructura correcta
    const correctStructure50 = getCorrectLey501997Structure()
    for (const section of correctStructure50) {
      const { error: insertError } = await supabase
        .from('law_sections')
        .insert({ law_id: law50.id, ...section, is_active: true })
      
      if (insertError) {
        throw new Error(`Error insertando Ley 50/1997 ${section.title}: ${insertError.message}`)
      }
      
      console.log('✅', section.title, `(Arts. ${section.article_range_start}-${section.article_range_end})`)
    }
    
    // 2. Corregir Ley 7/1985
    console.log('\n📚 CORRIGIENDO LEY 7/1985...')
    const { data: law7, error: lawError7 } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'Ley 7/1985')
      .single()
    
    if (lawError7 || !law7) {
      throw new Error('Ley 7/1985 no encontrada')
    }
    
    // Eliminar estructura incorrecta
    await supabase.from('law_sections').delete().eq('law_id', law7.id)
    console.log('🗑️ Estructura incorrecta Ley 7/1985 eliminada')
    
    // Insertar estructura correcta
    const correctStructure7 = getCorrectLey71985Structure()
    for (const section of correctStructure7) {
      const { error: insertError } = await supabase
        .from('law_sections')
        .insert({ law_id: law7.id, ...section, is_active: true })
      
      if (insertError) {
        throw new Error(`Error insertando Ley 7/1985 ${section.title}: ${insertError.message}`)
      }
      
      console.log('✅', section.title, `(Arts. ${section.article_range_start}-${section.article_range_end})`)
    }
    
    console.log('\n🎉 AMBAS ESTRUCTURAS CORREGIDAS CON RANGOS REALES')
    console.log('🔧 Ley 50/1997: 6 títulos, Arts. 1-29')
    console.log('🔧 Ley 7/1985: 10 títulos, Arts. 1-132')
    console.log('✅ Rangos extraídos usando metodología TÍTULO del BOE oficial')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

fixBothLawsCorrectRanges()