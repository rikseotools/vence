// app/api/law-changes/route.js
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Extrae la fecha de "Última actualización" del HTML del BOE
 * Busca patrones como: "Última actualización publicada el 02/08/2024"
 */
function extractLastUpdateFromBOE(htmlContent) {
  try {
    // Patrones comunes en BOE para fecha de actualización
    const patterns = [
      /Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /Actualizado el (\d{2}\/\d{2}\/\d{4})/i,
      /Versión consolidada.*?(\d{2}\/\d{2}\/\d{4})/i,
      /Modificado por.*?(\d{2}\/\d{2}\/\d{4})/i,
      /data-fecha-actualizacion="([^"]+)"/i
    ]
    
    for (const pattern of patterns) {
      const match = htmlContent.match(pattern)
      if (match && match[1]) {
        const dateStr = match[1]
        // Validar formato DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
          return dateStr
        }
      }
    }
    
    // Si no encuentra fecha específica, buscar en metadatos
    const metaDateMatch = htmlContent.match(/<meta[^>]*name="date"[^>]*content="([^"]+)"/i)
    if (metaDateMatch && metaDateMatch[1]) {
      // Convertir formato ISO a DD/MM/YYYY si es necesario
      const isoDate = metaDateMatch[1]
      if (isoDate.includes('-')) {
        const date = new Date(isoDate)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          })
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error extrayendo fecha de actualización BOE:', error)
    return null
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lawShortName = searchParams.get('law')

    // Si se especifica una ley, verificar solo esa
    let query = supabase
      .from('laws')
      .select('id, short_name, name, boe_url, content_hash, last_checked, change_status, last_update_boe')
      .not('boe_url', 'is', null)

    if (lawShortName) {
      query = query.eq('short_name', lawShortName)
    }

    const { data: laws, error } = await query

    if (error) {
      return Response.json({ error: 'Error obteniendo leyes' }, { status: 500 })
    }

    const results = []

    for (const law of laws) {
      try {
        // Descargar contenido actual del BOE
        const response = await fetch(law.boe_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VenceApp/1.0)'
          }
        })

        if (!response.ok) {
          results.push({
            law: law.short_name,
            status: 'error',
            message: `HTTP ${response.status}: ${response.statusText}`
          })
          continue
        }

        const currentContent = await response.text()
        
        // Extraer fecha de "Última actualización" del BOE (más preciso que hash completo)
        const currentLastUpdate = extractLastUpdateFromBOE(currentContent)
        const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex')
        
        // Detectar cambios: prioritizar fecha BOE, fallback a hash
        const hasChanged = currentLastUpdate ? 
          (law.last_update_boe !== currentLastUpdate) : 
          (law.content_hash !== currentHash)
        const lastChecked = law.last_checked ? new Date(law.last_checked) : null

        const result = {
          id: law.id,
          law: law.short_name,
          name: law.name,
          status: hasChanged ? 'changed' : 'unchanged',
          changeStatus: law.change_status || 'none',
          lastChecked: lastChecked?.toISOString(),
          previousHash: law.content_hash?.substring(0, 16),
          currentHash: currentHash.substring(0, 16),
          lastUpdateBOE: currentLastUpdate, // Fecha extraída del BOE
          changed: hasChanged
        }

        // Si hay cambios nuevos, actualizar estado
        if (hasChanged && law.change_status !== 'changed') {
          await supabase
            .from('laws')
            .update({
              content_hash: currentHash,
              last_update_boe: currentLastUpdate,
              last_checked: new Date().toISOString(),
              change_status: 'changed',
              change_detected_at: new Date().toISOString()
            })
            .eq('id', law.id)

          result.changeStatus = 'changed'
          result.newChangeDetected = true
        } else if (!hasChanged && law.change_status === 'changed') {
          // Si ya no hay cambios pero estaba marcado como cambiado, mantener estado
          result.changeStatus = 'changed'
        } else if (!hasChanged) {
          // Actualizar última verificación sin cambios
          await supabase
            .from('laws')
            .update({
              last_checked: new Date().toISOString(),
              last_update_boe: currentLastUpdate
            })
            .eq('id', law.id)
        }

        results.push(result)

        // Pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        results.push({
          law: law.short_name,
          status: 'error',
          message: error.message
        })
      }
    }

    // Resumen
    const summary = {
      total: results.length,
      unchanged: results.filter(r => r.status === 'unchanged').length,
      changed: results.filter(r => r.changeStatus === 'changed').length,
      errors: results.filter(r => r.status === 'error').length,
      hasUnreviewedChanges: results.some(r => r.changeStatus === 'changed'),
      lastRun: new Date().toISOString()
    }

    return Response.json({
      success: true,
      summary,
      results
    })

  } catch (error) {
    console.error('Error en law-changes API:', error)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Marcar cambio como revisado
export async function POST(request) {
  try {
    const body = await request.json()
    const { action, lawId } = body

    if (action === 'mark_reviewed' && lawId) {
      const { error } = await supabase
        .from('laws')
        .update({
          change_status: 'reviewed',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', lawId)

      if (error) {
        return Response.json({ error: 'Error marcando como revisado' }, { status: 500 })
      }

      return Response.json({ success: true, message: 'Marcado como revisado' })
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    return Response.json({ error: 'Error procesando request' }, { status: 500 })
  }
}