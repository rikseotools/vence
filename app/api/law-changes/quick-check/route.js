// app/api/law-changes/quick-check/route.js
// Endpoint ligero que solo verifica fechas del BOE sin parsear contenido completo
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Extrae SOLO la fecha de "Última actualización" del HTML del BOE
 * Optimizado para ser lo más rápido posible
 */
function extractLastUpdateFromBOE(htmlContent) {
  try {
    // Solo buscar la sección que contiene la fecha (normalmente está al inicio)
    // Limitamos la búsqueda a los primeros 50KB para mayor rapidez
    const searchContent = htmlContent.substring(0, 50000)
      .replace(/&oacute;/g, 'ó')
      .replace(/&aacute;/g, 'á')
      .replace(/&eacute;/g, 'é')
      .replace(/&iacute;/g, 'í')
      .replace(/&uacute;/g, 'ú')

    // Patrón principal del BOE para fecha de actualización
    const match = searchContent.match(/Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i)
    if (match && match[1]) {
      return match[1]
    }

    // Patrón alternativo
    const altMatch = searchContent.match(/actualización, publicada el (\d{2}\/\d{2}\/\d{4})/i)
    if (altMatch && altMatch[1]) {
      return altMatch[1]
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Convierte fecha DD/MM/YYYY a objeto Date para comparación
 */
function parseSpanishDate(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  // DD/MM/YYYY -> YYYY-MM-DD
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
}

export async function GET() {
  try {
    // 1. Obtener leyes con URL del BOE
    const { data: laws, error } = await getSupabase()
      .from('laws')
      .select('id, short_name, boe_url, last_update_boe, last_checked')
      .not('boe_url', 'is', null)

    if (error) {
      return Response.json({ success: false, error: 'Error obteniendo leyes' }, { status: 500 })
    }

    if (!laws || laws.length === 0) {
      return Response.json({
        success: true,
        hasOutdatedLaws: false,
        checked: 0,
        message: 'No hay leyes configuradas para monitoreo'
      })
    }

    // 2. Verificar fechas de cada ley (en paralelo para rapidez)
    const checkPromises = laws.map(async (law) => {
      try {
        // Fetch con timeout de 10 segundos
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(law.boe_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)'
          },
          signal: controller.signal
        })
        clearTimeout(timeout)

        if (!response.ok) {
          return { id: law.id, status: 'error', outdated: false }
        }

        const html = await response.text()
        const boeDate = extractLastUpdateFromBOE(html)

        if (!boeDate) {
          return { id: law.id, status: 'no_date', outdated: false }
        }

        // Comparar fechas
        const boeDateObj = parseSpanishDate(boeDate)
        const savedDateObj = parseSpanishDate(law.last_update_boe)

        // Si la fecha del BOE es más reciente que la guardada, hay actualización
        const isOutdated = boeDateObj && savedDateObj && boeDateObj > savedDateObj

        return {
          id: law.id,
          law: law.short_name,
          status: 'checked',
          boeDate,
          savedDate: law.last_update_boe,
          outdated: isOutdated
        }
      } catch (err) {
        return { id: law.id, status: 'error', outdated: false, error: err.message }
      }
    })

    const results = await Promise.all(checkPromises)

    // 3. Determinar si hay leyes desactualizadas
    const outdatedLaws = results.filter(r => r.outdated)
    const hasOutdatedLaws = outdatedLaws.length > 0

    return Response.json({
      success: true,
      hasOutdatedLaws,
      outdatedCount: outdatedLaws.length,
      outdatedLaws: outdatedLaws.map(l => ({
        law: l.law,
        boeDate: l.boeDate,
        savedDate: l.savedDate
      })),
      checked: results.filter(r => r.status === 'checked').length,
      errors: results.filter(r => r.status === 'error').length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error en quick-check:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
