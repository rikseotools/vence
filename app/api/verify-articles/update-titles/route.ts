import { NextRequest, NextResponse } from 'next/server'
import { updateTitlesParamsSchema } from '@/lib/api/verify-articles/schemas'
import {
  getLawById,
  updateArticle,
  insertArticleUpdateLog,
  getArticleUpdateLogs,
} from '@/lib/api/verify-articles/queries'

function normalizeArticleNumber(num: string | null): string {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/quáter/gi, 'quater')
    .replace(/(\d+)\s*(bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies)(\s*\d+)?/gi, '$1 $2$3')
    .replace(/\s+/g, ' ')
    .trim()
}

function spanishTextToNumber(text: string | null): string | null {
  if (!text) return null
  text = text.replace(/\.+$/, '').trim()
  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i)
  const mainText = suffixMatch ? suffixMatch[1].trim() : text.trim()
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : ''
  const normalized = mainText.toLowerCase().trim()

  const ordinals: Record<string, number> = { 'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4, 'quinto': 5, 'sexto': 6, 'séptimo': 7, 'septimo': 7, 'octavo': 8, 'noveno': 9 }
  const units: Record<string, number> = { 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9 }
  const teens: Record<string, number> = { 'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15, 'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19 }
  const twenties: Record<string, number> = { 'veinte': 20, 'veintiuno': 21, 'veintiuna': 21, 'veintidós': 22, 'veintidos': 22, 'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25, 'veintiséis': 26, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29 }
  const tens: Record<string, number> = { 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90 }
  const hundreds: Record<string, number> = { 'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200, 'trescientos': 300, 'trescientas': 300 }

  function convertPart(str: string): number | null {
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
  if (directConversion !== null) return suffix ? `${directConversion} ${suffix}` : String(directConversion)

  const hundredsMatch = normalized.match(/^(cien|ciento|doscientos?|doscientas?|trescientos?|trescientas?)(?:\s+(.+))?$/i)
  if (hundredsMatch) {
    const hundredValue = hundreds[hundredsMatch[1].toLowerCase()] || 0
    if (hundredsMatch[2]) {
      const rest = convertPart(hundredsMatch[2])
      if (rest !== null) { const total = hundredValue + rest; return suffix ? `${total} ${suffix}` : String(total) }
    }
    return suffix ? `${hundredValue} ${suffix}` : String(hundredValue)
  }
  return null
}

async function fetchArticleFromBOE(boeUrl: string, articleNumber: string): Promise<{ title: string; content: string } | null> {
  try {
    const response = await fetch(boeUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)', 'Accept': 'text/html', 'Accept-Language': 'es-ES,es;q=0.9' } })
    if (!response.ok) return null
    const html = await response.text()
    const targetArticle = normalizeArticleNumber(articleNumber)
    const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="(?:a|art)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi

    let match: RegExpExecArray | null
    while ((match = articleBlockRegex.exec(html)) !== null) {
      const blockContent = match[1]
      let foundArticle: string | null = null
      let title = ''

      const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([^<]*)<\/h5>/i)
      if (numericMatch) { foundArticle = normalizeArticleNumber(numericMatch[1]); title = numericMatch[2] ? numericMatch[2].trim().replace(/\.$/, '') : '' }
      else {
        const textMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+([^<]+)<\/h5>/i)
        if (textMatch) {
          let textContent = textMatch[1].trim()
          const titleSeparatorMatch = textContent.match(/^(.+?)\.\s+(.+)$/)
          if (titleSeparatorMatch) { textContent = titleSeparatorMatch[1].trim(); title = titleSeparatorMatch[2].trim().replace(/\.$/, '') }
          const converted = spanishTextToNumber(textContent)
          if (converted) foundArticle = normalizeArticleNumber(converted)
        }
      }
      if (!foundArticle) continue

      if (foundArticle === targetArticle) {
        const content = blockContent
          .replace(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/gi, '')
          .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '')
          .replace(/<p[^>]*class="nota_pie"[^>]*>[\s\S]*?<\/p>/gi, '')
          .replace(/<p[^>]*class="pie_unico"[^>]*>[\s\S]*?<\/p>/gi, '')
          .replace(/<p[^>]*class="linkSubir"[^>]*>[\s\S]*?<\/p>/gi, '')
          .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
          .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
          .replace(/<a[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
          .replace(/<span[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
          .replace(/Jurisprudencia/gi, '')
          .replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<\/div>/gi, '\n')
          .replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').replace(/^ +| +$/gm, '').trim()
        return { title, content }
      }
    }
    return null
  } catch (error) { console.error('Error fetching BOE article:', error); return null }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = updateTitlesParamsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { lawId, articles: articleList } = validation.data

    const law = await getLawById(lawId)
    if (!law?.boeUrl) {
      return NextResponse.json({ success: false, error: 'No se pudo obtener la URL del BOE para esta ley' }, { status: 400 })
    }

    const results: { updated: Record<string, unknown>[]; errors: Record<string, unknown>[]; created: Record<string, unknown>[] } = { updated: [], errors: [], created: [] }

    for (const article of articleList) {
      const { article_number, boe_title, db_title, db_id } = article
      try {
        if (db_id) {
          const boeData = await fetchArticleFromBOE(law.boeUrl, article_number)

          const updateData: { title?: string | null; content?: string; updatedAt: string } = {
            title: boeData?.title || boe_title || null,
            updatedAt: new Date().toISOString(),
          }

          if (boeData?.content) {
            updateData.content = boeData.content
          }

          await updateArticle(db_id, updateData)

          results.updated.push({
            article_number,
            old_title: db_title,
            new_title: updateData.title,
            content_updated: !!boeData?.content,
            db_id,
          })

          await insertArticleUpdateLog({
            lawId,
            articleId: db_id,
            articleNumber: article_number,
            oldTitle: db_title,
            newTitle: updateData.title,
            changeType: boeData?.content ? 'full_update' : 'title_update',
            source: 'boe_verification',
          })
        } else {
          results.errors.push({ article_number, error: 'Artículo no tiene ID en BD - no se puede actualizar' })
        }
      } catch (err) {
        results.errors.push({ article_number, error: (err as Error).message })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: { total: articleList.length, updated: results.updated.length, errors: results.errors.length },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error actualizando artículos:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')

  if (!lawId) {
    return NextResponse.json({ success: false, error: 'Se requiere lawId' }, { status: 400 })
  }

  try {
    const logs = await getArticleUpdateLogs(lawId)
    return NextResponse.json({ success: true, logs })
  } catch (error) {
    console.error('Error obteniendo logs:', error)
    return NextResponse.json(
      { success: false, error: 'Error obteniendo historial', details: (error as Error).message },
      { status: 500 }
    )
  }
}
