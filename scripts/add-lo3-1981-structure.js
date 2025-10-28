// scripts/add-lo3-1981-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLO31981Structure() {
  // Estructura extraída con metodología TÍTULO del BOE oficial
  // URL: https://www.boe.es/buscar/act.php?id=BOE-A-1981-10325
  // VERIFICADA: Títulos reales confirmados en BOE
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título Primero. Nombramiento, cese y condiciones',
      description: 'Nombramiento, cese y condiciones del Defensor del Pueblo',
      article_range_start: 1,
      article_range_end: 8,
      slug: 'lo3-1981-titulo-i-nombramiento-cese-condiciones',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título Segundo. Del procedimiento',
      description: 'Procedimiento de actuación e investigación del Defensor del Pueblo',
      article_range_start: 9,
      article_range_end: 27,
      slug: 'lo3-1981-titulo-ii-procedimiento',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título Tercero. De las resoluciones',
      description: 'Resoluciones y recomendaciones del Defensor del Pueblo',
      article_range_start: 28,
      article_range_end: 33,
      slug: 'lo3-1981-titulo-iii-resoluciones',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título Cuarto. Medios personales y materiales',
      description: 'Recursos humanos y materiales del Defensor del Pueblo',
      article_range_start: 34,
      article_range_end: 37,
      slug: 'lo3-1981-titulo-iv-medios-personales-materiales',
      order_position: 4
    }
  ]
}

async function insertLO31981Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA LO 3/1981 - DEFENSOR DEL PUEBLO ===')
    
    // 1. Obtener law_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'LO 3/1981')
      .single()
    
    if (lawError || !law) {
      throw new Error('LO 3/1981 no encontrada: ' + (lawError?.message || 'No existe'))
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
    const structure = getLO31981Structure()
    
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
    
    console.log('\n🎉 ESTRUCTURA LO 3/1981 CREADA EXITOSAMENTE')
    console.log('📊 Total títulos:', structure.length)
    console.log('📋 Rango completo: Arts. 1-37')
    console.log('🔗 Fuente: https://www.boe.es/buscar/act.php?id=BOE-A-1981-10325')
    console.log('✅ VERIFICADA: Estructura real confirmada en BOE oficial')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insertLO31981Structure()