// app/api/law-changes/route.js
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Limpia elementos dinámicos del HTML para generar un hash estable
 * Elimina timestamps, IDs de sesión, elementos variables, etc.
 */
function cleanHTMLForHashing(htmlContent) {
  try {
    let cleanContent = htmlContent
    
    // Eliminar timestamps y fechas dinámicas comunes
    cleanContent = cleanContent.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[Z\+\-\d:]*\b/g, 'TIMESTAMP')
    cleanContent = cleanContent.replace(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/g, 'DATETIME')
    
    // Eliminar IDs de sesión y tokens comunes
    cleanContent = cleanContent.replace(/sessionid=[^"'\s&]+/gi, 'sessionid=SESSION')
    cleanContent = cleanContent.replace(/token=[^"'\s&]+/gi, 'token=TOKEN')
    cleanContent = cleanContent.replace(/jsessionid=[^"'\s&]+/gi, 'jsessionid=SESSION')
    
    // Eliminar elementos con atributos data- dinámicos
    cleanContent = cleanContent.replace(/data-\w+="[^"]*"/g, 'data-attr="DYNAMIC"')
    
    // Eliminar comentarios HTML que pueden incluir timestamps
    cleanContent = cleanContent.replace(/<!--[\s\S]*?-->/g, '')
    
    // Eliminar scripts que pueden tener contenido dinámico
    cleanContent = cleanContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<script>DYNAMIC</script>')
    
    // Eliminar espacios múltiples y normalizar
    cleanContent = cleanContent.replace(/\s+/g, ' ').trim()
    
    return cleanContent
  } catch (error) {
    console.error('Error limpiando HTML:', error)
    return htmlContent // Fallback al contenido original
  }
}

/**
 * Extrae la fecha de "Última actualización" del HTML del BOE
 * Busca patrones como: "Última actualización publicada el 02/08/2024"
 */
function extractLastUpdateFromBOE(htmlContent) {
  try {
    // Limpiar entidades HTML comunes antes de buscar
    let cleanContent = htmlContent
      .replace(/&oacute;/g, 'ó')
      .replace(/&aacute;/g, 'á')
      .replace(/&eacute;/g, 'é')
      .replace(/&iacute;/g, 'í')
      .replace(/&uacute;/g, 'ú')
      .replace(/&ntilde;/g, 'ñ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    
    // Patrones comunes en BOE para fecha de actualización
    const patterns = [
      /Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /actualización, publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /Actualizado el (\d{2}\/\d{2}\/\d{4})/i,
      /Versión consolidada.*?(\d{2}\/\d{2}\/\d{4})/i,
      /Modificado por.*?(\d{2}\/\d{2}\/\d{4})/i,
      /data-fecha-actualizacion="([^"]+)"/i,
      /Vigente hasta el (\d{2}\/\d{2}\/\d{4})/i,
      /Texto consolidado.*?(\d{2}\/\d{2}\/\d{4})/i,
      /Última modificación.*?(\d{2}\/\d{2}\/\d{4})/i,
      // Patrón para selector de redacción
      /Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i
    ]
    
    for (const pattern of patterns) {
      const match = cleanContent.match(pattern)
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
    const readonly = searchParams.get('readonly') === 'true'

    // Si se especifica una ley, verificar solo esa
    let query = supabase
      .from('laws')
      .select('id, short_name, name, boe_url, content_hash, last_checked, change_status, last_update_boe')
      .not('boe_url', 'is', null)
      .or('is_derogated.is.null,is_derogated.eq.false') // Excluir leyes derogadas

    if (lawShortName) {
      query = query.eq('short_name', lawShortName)
    }

    const { data: laws, error } = await query

    if (error) {
      return Response.json({ error: 'Error obteniendo leyes' }, { status: 500 })
    }

    // Si es readonly, solo devolver datos existentes sin verificar
    if (readonly) {
      const results = laws.map(law => ({
        id: law.id,
        law: law.short_name,
        name: law.name,
        boeUrl: law.boe_url,
        status: 'unchanged', // No verificamos, solo mostramos estado actual
        changeStatus: law.change_status || 'none',
        lastChecked: law.last_checked,
        previousHash: law.content_hash?.substring(0, 16),
        currentHash: law.content_hash?.substring(0, 16),
        lastUpdateBOE: law.last_update_boe,
        changed: false
      }))

      const summary = {
        total: results.length,
        unchanged: results.filter(r => r.changeStatus !== 'changed').length,
        changed: results.filter(r => r.changeStatus === 'changed').length,
        errors: 0,
        hasUnreviewedChanges: results.some(r => r.changeStatus === 'changed'),
        lastRun: new Date().toISOString(),
        readonly: true
      }

      return Response.json({
        success: true,
        summary,
        results
      })
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
        
        // Extraer fecha de "Última actualización" del BOE
        const currentLastUpdate = extractLastUpdateFromBOE(currentContent)
        
        // Limpiar contenido dinámico antes de generar hash para evitar falsos positivos
        const cleanedContent = cleanHTMLForHashing(currentContent)
        
        // Generar hash del contenido limpio (más estable, sin elementos dinámicos)
        const currentHash = crypto.createHash('sha256').update(cleanedContent).digest('hex')
        
        // ESTRATEGIA OFICIAL: Usar FECHAS BOE como detección principal (según manual)
        // Solo usar fecha de "Última actualización publicada el XX/XX/XXXX" del BOE
        const dateChanged = currentLastUpdate && law.last_update_boe &&
                           law.last_update_boe !== currentLastUpdate

        // Primera vez sin fecha almacenada = establecer baseline, no cambio
        const isFirstTimeWithDate = currentLastUpdate && !law.last_update_boe

        // CAMBIO REAL = Solo cuando fecha BOE oficial cambia (no primera vez)
        // Hash se mantiene para tracking interno pero NO para detección
        const hasChanged = dateChanged && !isFirstTimeWithDate
        const lastChecked = law.last_checked ? new Date(law.last_checked) : null

        // Solo log en caso de cambio real detectado
        if (hasChanged) {
          console.log(`🚨 CAMBIO DETECTADO: ${law.short_name} - BOE actualizado: ${currentLastUpdate}`)
        }




        const result = {
          id: law.id,
          law: law.short_name,
          name: law.name,
          boeUrl: law.boe_url,
          status: hasChanged ? 'changed' : 'unchanged',
          changeStatus: law.change_status || 'none',
          lastChecked: lastChecked?.toISOString(),
          previousHash: law.content_hash?.substring(0, 16),
          currentHash: currentHash.substring(0, 16),
          lastUpdateBOE: currentLastUpdate || law.last_update_boe, // Usar fecha extraída o existente
          changed: hasChanged
        }

        // Si hay cambios reales, marcar como changed
        if (hasChanged) {
          await supabase
            .from('laws')
            .update({
              content_hash: currentHash,
              last_update_boe: currentLastUpdate || law.last_update_boe, // Preservar fecha existente si no hay nueva
              last_checked: new Date().toISOString(),
              change_status: 'changed',
              change_detected_at: new Date().toISOString()
            })
            .eq('id', law.id)

          result.changeStatus = 'changed'
          result.newChangeDetected = true
        } else {
          // NO hay cambios reales: solo actualizar hash y fecha sin cambiar el estado
          await supabase
            .from('laws')
            .update({
              content_hash: currentHash,
              last_update_boe: currentLastUpdate || law.last_update_boe, // Preservar fecha existente si no hay nueva
              last_checked: new Date().toISOString()
              // NO tocamos change_status para preservar "reviewed"
            })
            .eq('id', law.id)
          
          // Mantener el estado actual (reviewed, changed, etc.)
          result.changeStatus = law.change_status || 'none'
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