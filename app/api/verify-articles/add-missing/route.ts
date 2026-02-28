import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { addMissingParamsSchema } from '@/lib/api/verify-articles/schemas'
import {
  getLawById,
  getExistingArticleNumbers,
  insertArticles,
} from '@/lib/api/verify-articles/queries'
import {
  extractArticlesFromBOE,
  normalizeArticleNumber,
} from '@/lib/boe-extractor'

function generateContentHash(content: string | null): string {
  return crypto.createHash('sha256').update(content || '').digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = addMissingParamsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { lawId, articleNumbers, includeDisposiciones } = validation.data

    const law = await getLawById(lawId)
    if (!law) {
      return NextResponse.json({ success: false, error: 'Ley no encontrada' }, { status: 404 })
    }

    if (!law.boeUrl) {
      return NextResponse.json({ success: false, error: 'La ley no tiene URL del BOE configurada' }, { status: 400 })
    }

    console.log(`📥 Descargando BOE para añadir artículos: ${law.boeUrl}`)
    const boeResponse = await fetch(law.boeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    })

    if (!boeResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Error descargando BOE: ${boeResponse.status}` },
        { status: 500 }
      )
    }

    const boeHtml = await boeResponse.text()
    const boeArticles = extractArticlesFromBOE(boeHtml, { includeDisposiciones })
    console.log(`📄 Artículos encontrados en BOE: ${boeArticles.length}`)

    const normalizedRequested = new Set(articleNumbers.map((n: string) => normalizeArticleNumber(n)))
    const articlesToAdd = boeArticles.filter((a: { article_number: string }) =>
      normalizedRequested.has(normalizeArticleNumber(a.article_number))
    )

    console.log(`🎯 Artículos a añadir: ${articlesToAdd.length}`)

    if (articlesToAdd.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron los artículos solicitados en el BOE' },
        { status: 404 }
      )
    }

    const existingNumbers = await getExistingArticleNumbers(lawId)
    const existingSet = new Set(existingNumbers.map(n => normalizeArticleNumber(n)))

    const newArticles = articlesToAdd.filter((a: { article_number: string }) =>
      !existingSet.has(normalizeArticleNumber(a.article_number))
    )

    if (newArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Todos los artículos ya existen en la base de datos',
        added: 0,
        skipped: articlesToAdd.length,
      })
    }

    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const articlesToInsert = newArticles.map((art: { article_number: string; title: string | null; content: string }) => ({
      lawId,
      articleNumber: art.article_number,
      title: art.title || null,
      content: art.content,
      contentHash: generateContentHash(art.content),
      isActive: true,
      isVerified: true,
      verificationDate: today,
      lastModificationDate: today,
      createdAt: now,
      updatedAt: now,
    }))

    const inserted = await insertArticles(articlesToInsert)

    console.log(`✅ Artículos insertados: ${inserted.length}`)

    return NextResponse.json({
      success: true,
      message: `Se añadieron ${inserted.length} artículos`,
      added: inserted.length,
      skipped: articlesToAdd.length - newArticles.length,
      articles: inserted.map(a => ({
        article_number: a.articleNumber,
        title: a.title,
      })),
    })
  } catch (error) {
    console.error('Error añadiendo artículos:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: (error as Error).message },
      { status: 500 }
    )
  }
}
