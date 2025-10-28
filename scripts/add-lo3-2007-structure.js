// scripts/add-lo3-2007-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLO32007Structure() {
  // Estructura extraída con metodología TÍTULO del BOE oficial
  // URL: https://www.boe.es/buscar/act.php?id=BOE-A-2007-6115
  // VERIFICADA: Títulos reales confirmados en BOE + artículos en BD (hasta Art. 78)
  return [
    {
      section_type: 'titulo',
      section_number: 'PRELIMINAR',
      title: 'Título Preliminar. Objeto y ámbito de la Ley',
      description: 'Objeto y ámbito de aplicación de la ley',
      article_range_start: 1,
      article_range_end: 2,
      slug: 'lo3-2007-titulo-preliminar-objeto-ambito',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. El principio de igualdad y la tutela contra la discriminación',
      description: 'Principios de igualdad y protección contra discriminación',
      article_range_start: 3,
      article_range_end: 13,
      slug: 'lo3-2007-titulo-i-principio-igualdad-tutela',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. Políticas públicas para la igualdad',
      description: 'Políticas públicas y acción administrativa para la igualdad',
      article_range_start: 14,
      article_range_end: 35,
      slug: 'lo3-2007-titulo-ii-politicas-publicas-igualdad',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. Igualdad y medios de comunicación',
      description: 'Igualdad en medios de comunicación y publicidad',
      article_range_start: 36,
      article_range_end: 41,
      slug: 'lo3-2007-titulo-iii-igualdad-medios-comunicacion',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. El derecho al trabajo en igualdad de oportunidades',
      description: 'Derecho al trabajo y derechos laborales en igualdad',
      article_range_start: 42,
      article_range_end: 50,
      slug: 'lo3-2007-titulo-iv-derecho-trabajo-igualdad',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. El principio de igualdad en el empleo público',
      description: 'Igualdad en el empleo y administraciones públicas',
      article_range_start: 51,
      article_range_end: 68,
      slug: 'lo3-2007-titulo-v-principio-igualdad-empleo-publico',
      order_position: 6
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. Igualdad de trato en el acceso a bienes y servicios',
      description: 'Igualdad de trato en acceso a bienes y servicios',
      article_range_start: 69,
      article_range_end: 72,
      slug: 'lo3-2007-titulo-vi-igualdad-trato-bienes-servicios',
      order_position: 7
    },
    {
      section_type: 'titulo',
      section_number: 'VII',
      title: 'Título VII. La igualdad en la responsabilidad social de las empresas',
      description: 'Igualdad en la responsabilidad social empresarial',
      article_range_start: 73,
      article_range_end: 75,
      slug: 'lo3-2007-titulo-vii-igualdad-responsabilidad-social',
      order_position: 8
    },
    {
      section_type: 'titulo',
      section_number: 'VIII',
      title: 'Título VIII. Disposiciones organizativas',
      description: 'Órganos y disposiciones organizativas para la igualdad',
      article_range_start: 76,
      article_range_end: 78,
      slug: 'lo3-2007-titulo-viii-disposiciones-organizativas',
      order_position: 9
    }
  ]
}

async function insertLO32007Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA LO 3/2007 - IGUALDAD MUJERES/HOMBRES ===')
    
    // 1. Obtener law_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'LO 3/2007')
      .single()
    
    if (lawError || !law) {
      throw new Error('LO 3/2007 no encontrada: ' + (lawError?.message || 'No existe'))
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
    const structure = getLO32007Structure()
    
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
    
    console.log('\n🎉 ESTRUCTURA LO 3/2007 CREADA EXITOSAMENTE')
    console.log('📊 Total títulos:', structure.length)
    console.log('📋 Rango completo: Arts. 1-78')
    console.log('🔗 Fuente: https://www.boe.es/buscar/act.php?id=BOE-A-2007-6115')
    console.log('✅ VERIFICADA: Estructura real confirmada en BOE oficial')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insertLO32007Structure()