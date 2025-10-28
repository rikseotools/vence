// scripts/add-lo1-2004-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLO12004Structure() {
  // Estructura extraída con metodología TÍTULO del BOE oficial
  // URL: https://www.boe.es/buscar/act.php?id=BOE-A-2004-21760
  return [
    {
      section_type: 'titulo',
      section_number: 'PRELIMINAR',
      title: 'Título Preliminar',
      description: 'Objeto y principios rectores de la ley',
      article_range_start: 1,
      article_range_end: 2,
      slug: 'lo1-2004-titulo-preliminar',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. Medidas de sensibilización, prevención y detección',
      description: 'Medidas de educación, publicidad, medios de comunicación y sanidad',
      article_range_start: 3,
      article_range_end: 16,
      slug: 'lo1-2004-titulo-i-medidas-sensibilizacion',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. Derechos de las mujeres víctimas de violencia de género',
      description: 'Derechos de información, laborales, económicos y de reparación',
      article_range_start: 17,
      article_range_end: 28,
      slug: 'lo1-2004-titulo-ii-derechos-mujeres-victimas',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. Tutela Institucional',
      description: 'Delegación del Gobierno, observatorios y fuerzas de seguridad',
      article_range_start: 29,
      article_range_end: 32,
      slug: 'lo1-2004-titulo-iii-tutela-institucional',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Tutela Penal',
      description: 'Modificaciones penales y protecciones específicas',
      article_range_start: 33,
      article_range_end: 42,
      slug: 'lo1-2004-titulo-iv-tutela-penal',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. Tutela Judicial',
      description: 'Juzgados especializados y procedimientos judiciales',
      article_range_start: 43,
      article_range_end: 72,
      slug: 'lo1-2004-titulo-v-tutela-judicial',
      order_position: 6
    }
  ]
}

async function insertLO12004Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA LO 1/2004 - VIOLENCIA DE GÉNERO ===')
    
    // 1. Obtener law_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'LO 1/2004')
      .single()
    
    if (lawError || !law) {
      throw new Error('LO 1/2004 no encontrada: ' + (lawError?.message || 'No existe'))
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
    const structure = getLO12004Structure()
    
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
    
    console.log('\n🎉 ESTRUCTURA LO 1/2004 CREADA EXITOSAMENTE')
    console.log('📊 Total títulos:', structure.length)
    console.log('📋 Rango completo: Arts. 1-72')
    console.log('🔗 Fuente: https://www.boe.es/buscar/act.php?id=BOE-A-2004-21760')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insertLO12004Structure()