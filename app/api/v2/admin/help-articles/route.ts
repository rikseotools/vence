// app/api/v2/admin/help-articles/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET() {
  try {
    const db = getDb()

    const result = await db.execute(sql`
      SELECT
        id, slug, title, category, content, keywords, related_urls,
        is_published, updated_at,
        embedding IS NOT NULL AS has_embedding,
        LENGTH(content) AS content_length,
        EXTRACT(DAY FROM NOW() - updated_at)::int AS days_since_update
      FROM help_articles
      ORDER BY category, title
    `)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const articles = (result as any[]).map((r: Record<string, unknown>) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      content: r.content,
      keywords: r.keywords || [],
      related_urls: r.related_urls || [],
      is_published: r.is_published,
      updated_at: r.updated_at,
      has_embedding: r.has_embedding,
      content_length: Number(r.content_length) || 0,
      days_since_update: Number(r.days_since_update) || 0,
    }))

    let published = 0, outdated = 0, noEmbedding = 0, shortContent = 0
    for (const a of articles) {
      if (a.is_published) published++
      if (a.days_since_update > 30) outdated++
      if (!a.has_embedding) noEmbedding++
      if (a.content_length < 200) shortContent++
    }
    const summary = { total: articles.length, published, outdated, noEmbedding, shortContent }

    return NextResponse.json({ articles, summary })
  } catch (error) {
    console.error('Error loading help articles:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/v2/admin/help-articles', _GET)
