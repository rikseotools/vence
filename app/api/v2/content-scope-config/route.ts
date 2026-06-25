// app/api/v2/content-scope-config/route.ts
// Configuración de content_scope para un test personalizado por sección
// (app/test-personalizado). Contenido PÚBLICO de catálogo (secciones, scope,
// artículos) — sin datos de usuario, sin auth (equivalente al acceso ANON previo).
//
// AGNÓSTICO (Fase C1): sustituye 3 supabase.from de cliente por Drizzle y además
// corrige el N+1 del original (un SELECT por article_number → un ANY por scope).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { pgTextArray } from '@/lib/api/sqlArrays'

export const maxDuration = 15

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const seccion = new URL(request.url).searchParams.get('seccion')
  if (!seccion) {
    return NextResponse.json({ success: false, error: 'missing_seccion' }, { status: 400 })
  }
  const db = getAdminDb()

  // 1. Sección + su colección (embed content_collections reconstruido)
  const sectionRes = await db.execute(sql`
    SELECT s.id, s.name, s.slug, s.description, s.icon,
      json_build_object('name', c.name, 'slug', c.slug) AS content_collections
    FROM content_sections s
    LEFT JOIN content_collections c ON c.id = s.collection_id
    WHERE s.slug = ${seccion}
    LIMIT 1
  `)
  const section = rowsOf(sectionRes)[0] as { id: string } | undefined
  if (!section) {
    return NextResponse.json({ success: false, error: 'section_not_found' }, { status: 404 })
  }

  // 2. content_scope de la sección
  const scopeRes = await db.execute(sql`
    SELECT law_id, article_numbers
    FROM content_scope
    WHERE section_id = ${section.id}::uuid
  `)
  const contentScopes = rowsOf(scopeRes) as Array<{ law_id: string; article_numbers: string[] }>

  // 3. Resolver IDs de artículos (un ANY por scope, no N+1 por artículo)
  const articleIds: string[] = []
  for (const scope of contentScopes) {
    if (!scope.article_numbers?.length) continue
    const artRes = await db.execute(sql`
      SELECT id FROM articles
      WHERE law_id = ${scope.law_id}::uuid
        AND article_number = ANY(${pgTextArray(scope.article_numbers)})
    `)
    for (const a of rowsOf(artRes) as Array<{ id: string }>) articleIds.push(a.id)
  }

  return NextResponse.json({
    success: true,
    sectionInfo: section,
    articleIds,
    contentScopes,
    questionsMode: 'content_scope',
  })
}

export const GET = withErrorLogging('/api/v2/content-scope-config', _GET)
