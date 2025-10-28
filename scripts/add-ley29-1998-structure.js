// scripts/add-ley29-1998-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLey291998Structure() {
  // Estructura basada en artículos reales en BD y fuentes oficiales verificadas
  // URL: https://www.boe.es/buscar/act.php?id=BOE-A-1998-16718
  // CONSERVADORA: Solo títulos principales donde tenemos artículos reales
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. Del orden jurisdiccional contencioso-administrativo',
      description: 'Ámbito, órganos, competencias y constitución de tribunales',
      article_range_start: 1,
      article_range_end: 17,
      slug: 'ley29-1998-titulo-i-orden-jurisdiccional',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. Las partes',
      description: 'Capacidad procesal, legitimación y representación',
      article_range_start: 18,
      article_range_end: 24,
      slug: 'ley29-1998-titulo-ii-las-partes',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. Objeto del recurso contencioso-administrativo',
      description: 'Actividad administrativa impugnable y pretensiones',
      article_range_start: 25,
      article_range_end: 42,
      slug: 'ley29-1998-titulo-iii-objeto-recurso',
      order_position: 3
    }
  ]
}

async function insertLey291998Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA LEY 29/1998 - JURISDICCIÓN CONTENCIOSO-ADMINISTRATIVA ===')
    
    // 1. Obtener law_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'Ley 29/1998')
      .single()
    
    if (lawError || !law) {
      throw new Error('Ley 29/1998 no encontrada: ' + (lawError?.message || 'No existe'))
    }
    
    console.log('📚 Ley encontrada:', law.name)
    console.log('🆔 Law ID:', law.id)
    
    // 2. Verificar artículos disponibles
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('article_number')
      .eq('law_id', law.id)
    
    if (articlesError) {
      console.log('⚠️ Error verificando artículos:', articlesError.message)
    } else {
      const articleNumbers = articles.map(a => parseInt(a.article_number)).filter(n => !isNaN(n)).sort((a, b) => a - b)
      console.log('📋 Artículos disponibles en BD:', articleNumbers.length)
      console.log('📄 Rango:', articleNumbers[0], '-', articleNumbers[articleNumbers.length - 1])
      console.log('📝 Algunos artículos:', articleNumbers.slice(0, 10).join(', ') + (articleNumbers.length > 10 ? '...' : ''))
    }
    
    // 3. Eliminar estructura existente (si hay)
    const { error: deleteError } = await supabase
      .from('law_sections')
      .delete()
      .eq('law_id', law.id)
    
    if (deleteError) {
      console.log('⚠️ Error eliminando estructura anterior:', deleteError.message)
    } else {
      console.log('🗑️ Estructura anterior eliminada')
    }
    
    // 4. Insertar nueva estructura
    const structure = getLey291998Structure()
    
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
    
    console.log('\n🎉 ESTRUCTURA LEY 29/1998 CREADA EXITOSAMENTE')
    console.log('📊 Total títulos:', structure.length)
    console.log('📋 Rango cubierto: Arts. 1-42 (estructura conservadora)')
    console.log('🔗 Fuente: https://www.boe.es/buscar/act.php?id=BOE-A-1998-16718')
    console.log('⚠️ NOTA: Estructura conservadora basada en artículos disponibles en BD')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insertLey291998Structure()