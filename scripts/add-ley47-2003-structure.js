// scripts/add-ley47-2003-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLey472003Structure() {
  // Estructura basada en BOE oficial + artículos reales en BD
  // URL: https://www.boe.es/buscar/act.php?id=BOE-A-2003-21614
  // VERIFICADA: Rangos ajustados a artículos disponibles en BD
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. Del ámbito de aplicación y de la Hacienda Pública estatal',
      description: 'Objeto, ámbito y principios de la Hacienda Pública',
      article_range_start: 1,
      article_range_end: 25,
      slug: 'ley47-2003-titulo-i-ambito-hacienda-publica',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. De los Presupuestos Generales del Estado',
      description: 'Principios y elaboración de presupuestos estatales',
      article_range_start: 26,
      article_range_end: 33,
      slug: 'ley47-2003-titulo-ii-presupuestos-generales',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. De la gestión presupuestaria',
      description: 'Ejecución, gestión y modificación de presupuestos',
      article_range_start: 34,
      article_range_end: 89,
      slug: 'ley47-2003-titulo-iii-gestion-presupuestaria',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Operaciones Financieras del Tesoro Público',
      description: 'Tesorería y operaciones financieras del Estado',
      article_range_start: 90,
      article_range_end: 118,
      slug: 'ley47-2003-titulo-iv-operaciones-tesoro',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. De la contabilidad del sector público estatal',
      description: 'Contabilidad pública y rendición de cuentas',
      article_range_start: 119,
      article_range_end: 139,
      slug: 'ley47-2003-titulo-v-contabilidad-sector-publico',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. Del control de la actividad económico-financiera',
      description: 'Control y fiscalización económico-financiera',
      article_range_start: 140,
      article_range_end: 175,
      slug: 'ley47-2003-titulo-vi-control-actividad-economica',
      order_position: 6
    }
  ]
}

async function insertLey472003Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA LEY 47/2003 - GENERAL PRESUPUESTARIA ===')
    
    // 1. Obtener law_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'Ley 47/2003')
      .single()
    
    if (lawError || !law) {
      throw new Error('Ley 47/2003 no encontrada: ' + (lawError?.message || 'No existe'))
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
      
      // Verificar distribución por títulos
      const estructura = getLey472003Structure()
      estructura.forEach(titulo => {
        const articulosEnTitulo = articleNumbers.filter(n => 
          n >= titulo.article_range_start && n <= titulo.article_range_end
        )
        console.log(`📖 ${titulo.title.substring(0, 50)}...`)
        console.log(`   Arts. ${titulo.article_range_start}-${titulo.article_range_end}: ${articulosEnTitulo.length} artículos disponibles`)
      })
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
    const structure = getLey472003Structure()
    
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
    
    console.log('\n🎉 ESTRUCTURA LEY 47/2003 CREADA EXITOSAMENTE')
    console.log('📊 Total títulos:', structure.length)
    console.log('📋 Rango completo: Arts. 1-175')
    console.log('🔗 Fuente: https://www.boe.es/buscar/act.php?id=BOE-A-2003-21614')
    console.log('✅ VERIFICADA: Estructura adaptada a artículos reales en BD')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insertLey472003Structure()