// app/api/law-titles/route.js
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lawShortName = searchParams.get('law')
    
    if (!lawShortName) {
      return Response.json({ error: 'Parámetro law requerido' }, { status: 400 })
    }
    
    // Obtener ID de la ley
    const { data: lawData, error: lawError } = await getSupabase()
      .from('laws')
      .select('id, name')
      .eq('short_name', lawShortName)
      .single()
    
    if (lawError || !lawData) {
      return Response.json({ error: 'Ley no encontrada' }, { status: 404 })
    }
    
    // Obtener títulos únicos con información agregada
    const { data: titlesData, error: titlesError } = await getSupabase()
      .from('articles')
      .select('title_number, section, article_number')
      .eq('law_id', lawData.id)
      .not('title_number', 'is', null)
      .order('title_number, article_number')
    
    if (titlesError) {
      return Response.json({ error: 'Error obteniendo títulos' }, { status: 500 })
    }
    
    // Agrupar por título y calcular estadísticas
    const titleGroups = {}
    
    titlesData.forEach(article => {
      const titleNum = article.title_number
      
      if (!titleGroups[titleNum]) {
        titleGroups[titleNum] = {
          title_number: titleNum,
          section_name: article.section,
          articles: [],
          articles_count: 0
        }
      }
      
      titleGroups[titleNum].articles.push(article.article_number)
      titleGroups[titleNum].articles_count++
    })
    
    // Convertir a array y agregar rangos
    const titles = Object.values(titleGroups).map(title => {
      // Ordenar artículos numéricamente
      title.articles.sort((a, b) => {
        const numA = parseInt(a) || 0
        const numB = parseInt(b) || 0
        return numA - numB
      })
      
      // Crear rango de artículos
      if (title.articles.length > 0) {
        const first = title.articles[0]
        const last = title.articles[title.articles.length - 1]
        title.articles_range = first === last ? first : `${first}-${last}`
      }
      
      return title
    })
    
    // Ordenar títulos
    titles.sort((a, b) => {
      // Manejar casos especiales como "ESTRUCTURA", "I", "II", etc.
      const aNum = a.title_number
      const bNum = b.title_number
      
      // Si son números romanos o especiales, mantener orden original
      if (aNum === 'ESTRUCTURA') return -1
      if (bNum === 'ESTRUCTURA') return 1
      
      // Intentar ordenar como números romanos
      const romanToNumber = (roman) => {
        const romanNumerals = {
          'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
          'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10
        }
        return romanNumerals[roman] || 999
      }
      
      return romanToNumber(aNum) - romanToNumber(bNum)
    })
    
    return Response.json({
      success: true,
      law: lawData.name,
      titles
    })
    
  } catch (error) {
    console.error('Error en API law-titles:', error)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}