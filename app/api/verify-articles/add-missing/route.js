import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import {
  extractArticlesFromBOE,
  normalizeArticleNumber
} from '@/lib/boe-extractor'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Genera hash de contenido
 */
function generateContentHash(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex')
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { lawId, articleNumbers } = body

    if (!lawId) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId'
      }, { status: 400 })
    }

    if (!articleNumbers || !Array.isArray(articleNumbers) || articleNumbers.length === 0) {
      return Response.json({
        success: false,
        error: 'Se requiere array de articleNumbers'
      }, { status: 400 })
    }

    // 1. Obtener la ley
    const { data: law, error: lawError } = await getSupabase()
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
    console.log(`📥 Descargando BOE para añadir artículos: ${law.boe_url}`)
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

    // 4. Filtrar solo los artículos solicitados
    const normalizedRequested = new Set(articleNumbers.map(n => normalizeArticleNumber(n)))
    const articlesToAdd = boeArticles.filter(a =>
      normalizedRequested.has(normalizeArticleNumber(a.article_number))
    )

    console.log(`🎯 Artículos a añadir: ${articlesToAdd.length}`)

    if (articlesToAdd.length === 0) {
      return Response.json({
        success: false,
        error: 'No se encontraron los artículos solicitados en el BOE'
      }, { status: 404 })
    }

    // 5. Verificar que no existan ya en BD
    const { data: existingArticles } = await getSupabase()
      .from('articles')
      .select('article_number')
      .eq('law_id', lawId)
      .eq('is_active', true)

    const existingNumbers = new Set((existingArticles || []).map(a =>
      normalizeArticleNumber(a.article_number)
    ))

    const newArticles = articlesToAdd.filter(a =>
      !existingNumbers.has(normalizeArticleNumber(a.article_number))
    )

    if (newArticles.length === 0) {
      return Response.json({
        success: true,
        message: 'Todos los artículos ya existen en la base de datos',
        added: 0,
        skipped: articlesToAdd.length
      })
    }

    // 6. Preparar artículos para insertar
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const articlesToInsert = newArticles.map(art => ({
      law_id: lawId,
      article_number: art.article_number,
      title: art.title || null,
      content: art.content,
      content_hash: generateContentHash(art.content),
      is_active: true,
      is_verified: true,
      verification_date: today,
      last_modification_date: today,
      created_at: now,
      updated_at: now
    }))

    // 7. Insertar en la BD
    const { data: inserted, error: insertError } = await getSupabase()
      .from('articles')
      .insert(articlesToInsert)
      .select('id, article_number, title')

    if (insertError) {
      console.error('❌ Error insertando artículos:', insertError)
      return Response.json({
        success: false,
        error: 'Error insertando artículos',
        details: insertError.message
      }, { status: 500 })
    }

    console.log(`✅ Artículos insertados: ${inserted.length}`)

    return Response.json({
      success: true,
      message: `Se añadieron ${inserted.length} artículos`,
      added: inserted.length,
      skipped: articlesToAdd.length - newArticles.length,
      articles: inserted.map(a => ({
        article_number: a.article_number,
        title: a.title
      }))
    })

  } catch (error) {
    console.error('Error añadiendo artículos:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
