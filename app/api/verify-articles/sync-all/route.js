import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Convierte texto de número español a dígito
 */
function spanishTextToNumber(text) {
  if (!text) return null

  text = text.replace(/\.+$/, '').trim()

  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i)
  let mainText = suffixMatch ? suffixMatch[1].trim() : text.trim()
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : ''

  const normalized = mainText.toLowerCase().trim()

  const ordinals = {
    'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4, 'quinto': 5,
    'sexto': 6, 'séptimo': 7, 'septimo': 7, 'octavo': 8, 'noveno': 9,
    'décimo': 10, 'decimo': 10, 'undécimo': 11, 'undecimo': 11,
    'duodécimo': 12, 'duodecimo': 12, 'decimotercero': 13, 'decimocuarto': 14,
    'decimoquinto': 15, 'decimosexto': 16, 'decimoséptimo': 17, 'decimoseptimo': 17,
    'decimooctavo': 18, 'decimonoveno': 19, 'vigésimo': 20, 'vigesimo': 20
  }

  const units = {
    'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9
  }

  const teens = {
    'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14,
    'quince': 15, 'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17,
    'dieciocho': 18, 'diecinueve': 19
  }

  const twenties = {
    'veinte': 20, 'veintiuno': 21, 'veintiuna': 21, 'veintidós': 22, 'veintidos': 22,
    'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25,
    'veintiséis': 26, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28,
    'veintinueve': 29
  }

  const tens = {
    'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
    'setenta': 70, 'ochenta': 80, 'noventa': 90
  }

  const hundreds = {
    'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200,
    'trescientos': 300, 'trescientas': 300
  }

  function convertPart(str) {
    str = str.toLowerCase().trim()
    if (ordinals[str]) return ordinals[str]
    if (units[str]) return units[str]
    if (teens[str]) return teens[str]
    if (twenties[str]) return twenties[str]
    if (tens[str]) return tens[str]

    const tensCompound = str.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(\w+)$/i)
    if (tensCompound) {
      const tenValue = tens[tensCompound[1].toLowerCase()] || 0
      const unitValue = units[tensCompound[2].toLowerCase()] || 0
      if (tenValue && unitValue) return tenValue + unitValue
    }

    if (hundreds[str]) return hundreds[str]
    return null
  }

  const directConversion = convertPart(normalized)
  if (directConversion !== null) {
    return suffix ? `${directConversion} ${suffix}` : String(directConversion)
  }

  const hundredsMatch = normalized.match(/^(cien|ciento|doscientos?|doscientas?|trescientos?|trescientas?)(?:\s+(.+))?$/i)
  if (hundredsMatch) {
    const hundredValue = hundreds[hundredsMatch[1].toLowerCase()] || 0
    if (hundredsMatch[2]) {
      const rest = convertPart(hundredsMatch[2])
      if (rest !== null) {
        const total = hundredValue + rest
        return suffix ? `${total} ${suffix}` : String(total)
      }
    }
    return suffix ? `${hundredValue} ${suffix}` : String(hundredValue)
  }

  return null
}

/**
 * Extrae los artículos del HTML del BOE
 */
function extractArticlesFromBOE(html) {
  const articles = []
  // Ampliado para incluir: a1, art1, aprimero, primero, decimotercero, etc.
  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="(?:a(?:\d|rt|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinti|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo|und[eé]cimo|duod[eé]cimo|decimotercero|decimocuarto|decimoquinto|decimosexto|decimos[eé]ptimo|decimooctavo|decimonoveno|vig[eé]simo)|regla\d+|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo|und[eé]cimo|duod[eé]cimo|decimotercero|decimocuarto|decimoquinto)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi

  let match
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const blockContent = match[1]
    let articleNumber = null
    let title = ''

    // Regex mejorado: permite HTML dentro del título (para enlaces como en RDL 6/2019)
    const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([\s\S]*?)<\/h5>/i)

    if (numericMatch) {
      articleNumber = numericMatch[1].trim().replace(/\s+/g, ' ')
      // Limpiar HTML del título (enlaces, etc.)
      title = (numericMatch[2] || '').replace(/<[^>]*>/g, '').trim().replace(/\.$/, '') || ''
    } else {
      // Intenta con texto escrito (Artículo primero, segundo, etc.)
      const textMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+([\s\S]*?)<\/h5>/i)
      if (textMatch) {
        let textContent = textMatch[1].replace(/<[^>]*>/g, '').trim()
        const titleSeparatorMatch = textContent.match(/^(.+?)\.\s+(.+)$/)
        if (titleSeparatorMatch) {
          textContent = titleSeparatorMatch[1].trim()
          title = titleSeparatorMatch[2].trim().replace(/\.$/, '')
        }
        const converted = spanishTextToNumber(textContent)
        if (converted) {
          articleNumber = converted
        }
      }

      // Caso especial: Órdenes ministeriales con "Primero.", "Segundo.", "Decimotercero.", etc. (sin "Artículo")
      if (!articleNumber) {
        const ordinalMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(Primero|Segundo|Tercero|Cuarto|Quinto|Sexto|S[ée]ptimo|Octavo|Noveno|D[ée]cimo|Und[ée]cimo|Duod[ée]cimo|Decimotercero|Decimocuarto|Decimoquinto|Decimosexto|Decimos[ée]ptimo|Decimooctavo|Decimonoveno|Vig[ée]simo)\.?\s*([\s\S]*?)<\/h5>/i)
        if (ordinalMatch) {
          const converted = spanishTextToNumber(ordinalMatch[1])
          if (converted) {
            articleNumber = converted
            title = (ordinalMatch[2] || '').replace(/<[^>]*>/g, '').trim().replace(/\.$/, '') || ''
          }
        }
      }
    }

    if (!articleNumber) continue

    let content = blockContent
      .replace(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/gi, '')
      .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '')
      .replace(/<p[^>]*class="nota_pie"[^>]*>[\s\S]*?<\/p>/gi, '')
      .replace(/<p[^>]*class="pie_unico"[^>]*>[\s\S]*?<\/p>/gi, '')
      .replace(/<p[^>]*class="linkSubir"[^>]*>[\s\S]*?<\/p>/gi, '')
      .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
      .replace(/<a[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(/<span[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<div[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/Jurisprudencia/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^ +| +$/gm, '')
      .trim()

    articles.push({
      article_number: articleNumber,
      title: title || null,
      content: content
    })
  }

  const suffixOrder = { '': 0, 'bis': 1, 'ter': 2, 'quater': 3, 'quinquies': 4, 'sexies': 5, 'septies': 6, 'octies': 7, 'nonies': 8, 'decies': 9 }
  articles.sort((a, b) => {
    const parseArticle = (num) => {
      const normalized = num.replace(/quáter/gi, 'quater')
      const match = normalized.match(/^(\d+)(?:\s+([a-z]+))?(?:\s+(\d+))?$/i)
      if (!match) return { base: 0, suffix: 0, subnum: 0 }
      return {
        base: parseInt(match[1]) || 0,
        suffix: suffixOrder[match[2]?.toLowerCase() || ''] || 0,
        subnum: parseInt(match[3]) || 0
      }
    }
    const parsedA = parseArticle(a.article_number)
    const parsedB = parseArticle(b.article_number)
    if (parsedA.base !== parsedB.base) return parsedA.base - parsedB.base
    if (parsedA.suffix !== parsedB.suffix) return parsedA.suffix - parsedB.suffix
    return parsedA.subnum - parsedB.subnum
  })

  return articles
}

/**
 * Normaliza número de artículo para comparación
 */
function normalizeArticleNumber(num) {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/quáter/gi, 'quater')
    .replace(/(\d+)\s*(bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies)(\s*\d+)?/gi, '$1 $2$3')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Genera hash de contenido
 */
function generateContentHash(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex')
}

/**
 * POST: Sincroniza TODOS los artículos del BOE con la BD
 * - Añade artículos que faltan en BD
 * - Actualiza artículos que han cambiado
 * - Marca como inactivos los que ya no existen en BOE
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { lawId, mode = 'sync' } = body // mode: 'sync' (default) | 'replace'

    if (!lawId) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId'
      }, { status: 400 })
    }

    // 1. Obtener la ley
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, short_name, name, boe_url')
      .eq('id', lawId)
      .single()

    if (lawError || !law) {
      return Response.json({
        success: false,
        error: 'Ley no encontrada'
      }, { status: 404 })
    }

    if (!law.boe_url) {
      return Response.json({
        success: false,
        error: 'La ley no tiene URL del BOE configurada'
      }, { status: 400 })
    }

    // 2. Descargar HTML del BOE
    console.log(`📥 Sincronizando ${law.short_name} desde BOE: ${law.boe_url}`)
    const boeResponse = await fetch(law.boe_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    })

    if (!boeResponse.ok) {
      return Response.json({
        success: false,
        error: `Error descargando BOE: ${boeResponse.status}`
      }, { status: 500 })
    }

    const boeHtml = await boeResponse.text()

    // 3. Extraer artículos del BOE
    const boeArticles = extractArticlesFromBOE(boeHtml)
    console.log(`📄 Artículos encontrados en BOE: ${boeArticles.length}`)

    // Si no hay artículos, verificar si es doc.php (sin texto consolidado)
    if (boeArticles.length === 0) {
      const isDocPhp = law.boe_url.includes('doc.php')
      const now = new Date().toISOString()

      // Actualizar la ley como verificada aunque no tenga artículos
      const verificationSummary = {
        total_boe: 0,
        total_db: 0,
        matching: 0,
        missing_in_db: 0,
        missing_in_boe: 0,
        no_consolidated_text: isDocPhp,
        last_sync: now,
        message: isDocPhp
          ? 'Ley sin texto consolidado en BOE (solo documento original)'
          : 'No se encontraron artículos en el BOE'
      }

      await supabase
        .from('laws')
        .update({
          last_checked: now,
          last_verification_summary: verificationSummary
        })
        .eq('id', lawId)

      // Si es doc.php, es éxito (solo no tiene artículos)
      if (isDocPhp) {
        console.log(`📄 ${law.short_name}: Ley sin texto consolidado - marcada como verificada`)
        return Response.json({
          success: true,
          message: `${law.short_name} verificada (sin texto consolidado en BOE)`,
          stats: {
            boeTotal: 0,
            added: 0,
            updated: 0,
            deactivated: 0,
            unchanged: 0,
            noConsolidatedText: true
          }
        })
      }

      // Si es act.php pero no encontró artículos, es un error
      return Response.json({
        success: false,
        error: 'No se encontraron artículos en el BOE'
      }, { status: 404 })
    }

    // 4. Obtener artículos actuales de la BD
    const { data: dbArticles, error: dbError } = await supabase
      .from('articles')
      .select('id, article_number, content_hash, is_active')
      .eq('law_id', lawId)

    if (dbError) {
      return Response.json({
        success: false,
        error: 'Error obteniendo artículos de BD'
      }, { status: 500 })
    }

    // 5. Crear mapas para comparación
    const dbArticleMap = new Map()
    ;(dbArticles || []).forEach(a => {
      dbArticleMap.set(normalizeArticleNumber(a.article_number), a)
    })

    const boeArticleSet = new Set(boeArticles.map(a => normalizeArticleNumber(a.article_number)))

    const now = new Date().toISOString()
    const today = now.split('T')[0]

    let added = 0
    let updated = 0
    let deactivated = 0
    let unchanged = 0

    // 6. Procesar artículos del BOE
    for (const boeArt of boeArticles) {
      const normalizedNum = normalizeArticleNumber(boeArt.article_number)
      const dbArt = dbArticleMap.get(normalizedNum)
      const newHash = generateContentHash(boeArt.content)

      if (!dbArt) {
        // Artículo nuevo - insertar
        const { error: insertError } = await supabase
          .from('articles')
          .insert({
            law_id: lawId,
            article_number: boeArt.article_number,
            title: boeArt.title || null,
            content: boeArt.content,
            content_hash: newHash,
            is_active: true,
            is_verified: true,
            verification_date: today,
            last_modification_date: today,
            created_at: now,
            updated_at: now
          })

        if (!insertError) {
          added++
          console.log(`➕ Añadido: Art. ${boeArt.article_number}`)
        }
      } else if (dbArt.content_hash !== newHash) {
        // Artículo existente con cambios - actualizar
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            title: boeArt.title || null,
            content: boeArt.content,
            content_hash: newHash,
            is_active: true,
            is_verified: true,
            verification_date: today,
            last_modification_date: today,
            updated_at: now
          })
          .eq('id', dbArt.id)

        if (!updateError) {
          updated++
          console.log(`🔄 Actualizado: Art. ${boeArt.article_number}`)
        }
      } else {
        unchanged++
      }
    }

    // 7. Marcar como inactivos los artículos que ya no existen en BOE
    for (const [normalizedNum, dbArt] of dbArticleMap.entries()) {
      if (!boeArticleSet.has(normalizedNum) && dbArt.is_active) {
        const { error: deactivateError } = await supabase
          .from('articles')
          .update({
            is_active: false,
            updated_at: now
          })
          .eq('id', dbArt.id)

        if (!deactivateError) {
          deactivated++
          console.log(`❌ Desactivado: Art. ${dbArt.article_number}`)
        }
      }
    }

    console.log(`✅ Sincronización completada: +${added} 🔄${updated} -${deactivated} =${unchanged}`)

    // 8. Actualizar estado de verificación en la ley
    const verificationSummary = {
      total_boe: boeArticles.length,
      total_db: boeArticles.length, // Después del sync, deberían ser iguales
      matching: boeArticles.length,
      title_mismatch: 0,
      content_mismatch: 0,
      missing_in_db: 0,
      missing_in_boe: deactivated,
      last_sync: now
    }

    await supabase
      .from('laws')
      .update({
        last_checked: now,
        last_verification_summary: verificationSummary
      })
      .eq('id', lawId)

    return Response.json({
      success: true,
      message: `Sincronización completada para ${law.short_name}`,
      stats: {
        boeTotal: boeArticles.length,
        added,
        updated,
        deactivated,
        unchanged
      }
    })

  } catch (error) {
    console.error('Error sincronizando artículos:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
