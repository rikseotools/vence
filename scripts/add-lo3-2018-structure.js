// scripts/add-lo3-2018-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLO32018Structure() {
  // Estructura extraída con metodología TÍTULO del BOE oficial
  // URL: https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. Disposiciones generales',
      description: 'Objeto, ámbito de aplicación y definiciones',
      article_range_start: 1,
      article_range_end: 3,
      slug: 'lo3-2018-titulo-i-disposiciones-generales',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. Principios de protección de datos',
      description: 'Principios relativos al tratamiento de datos personales',
      article_range_start: 4,
      article_range_end: 10,
      slug: 'lo3-2018-titulo-ii-principios-proteccion-datos',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. Derechos de las personas',
      description: 'Derechos de los interesados en protección de datos',
      article_range_start: 11,
      article_range_end: 18,
      slug: 'lo3-2018-titulo-iii-derechos-personas',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Disposiciones aplicables a tratamientos concretos',
      description: 'Tratamientos específicos de datos personales',
      article_range_start: 19,
      article_range_end: 27,
      slug: 'lo3-2018-titulo-iv-tratamientos-concretos',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. Responsable y encargado del tratamiento',
      description: 'Obligaciones del responsable y encargado del tratamiento',
      article_range_start: 28,
      article_range_end: 41,
      slug: 'lo3-2018-titulo-v-responsable-encargado',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. Transferencias internacionales de datos',
      description: 'Transferencias de datos a terceros países',
      article_range_start: 42,
      article_range_end: 49,
      slug: 'lo3-2018-titulo-vi-transferencias-internacionales',
      order_position: 6
    },
    {
      section_type: 'titulo',
      section_number: 'VII',
      title: 'Título VII. Autoridades de protección de datos',
      description: 'Agencia Española de Protección de Datos',
      article_range_start: 50,
      article_range_end: 62,
      slug: 'lo3-2018-titulo-vii-autoridades-proteccion',
      order_position: 7
    },
    {
      section_type: 'titulo',
      section_number: 'VIII',
      title: 'Título VIII. Procedimientos en caso de posible vulneración',
      description: 'Procedimientos ante vulneraciones de protección de datos',
      article_range_start: 63,
      article_range_end: 69,
      slug: 'lo3-2018-titulo-viii-procedimientos-vulneracion',
      order_position: 8
    },
    {
      section_type: 'titulo',
      section_number: 'IX',
      title: 'Título IX. Régimen sancionador',
      description: 'Infracciones y sanciones en protección de datos',
      article_range_start: 70,
      article_range_end: 78,
      slug: 'lo3-2018-titulo-ix-regimen-sancionador',
      order_position: 9
    },
    {
      section_type: 'titulo',
      section_number: 'X',
      title: 'Título X. Garantía de los derechos digitales',
      description: 'Derechos digitales de los ciudadanos',
      article_range_start: 79,
      article_range_end: 97,
      slug: 'lo3-2018-titulo-x-garantia-derechos-digitales',
      order_position: 10
    }
  ]
}

async function insertLO32018Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA LO 3/2018 - LOPDGDD ===')
    
    // 1. Obtener law_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'LO 3/2018')
      .single()
    
    if (lawError || !law) {
      throw new Error('LO 3/2018 no encontrada: ' + (lawError?.message || 'No existe'))
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
    const structure = getLO32018Structure()
    
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
    
    console.log('\n🎉 ESTRUCTURA LO 3/2018 CREADA EXITOSAMENTE')
    console.log('📊 Total títulos:', structure.length)
    console.log('📋 Rango completo: Arts. 1-97+')
    console.log('🔗 Fuente: https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insertLO32018Structure()