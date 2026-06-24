// app/api/v2/psychometric/questions/route.ts
// Carga de preguntas psicotécnicas por categoría(s) para las test-pages.
// PÚBLICO (anónimos pueden hacer tests) + rate-limit anti-scraping.
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('psychometric_questions') de
// cliente (con embeds !inner) por Drizzle. Forma de salida IDÉNTICA al embed
// PostgREST: cada fila = to_jsonb(q.*) + psychometric_categories/psychometric_sections.
//
// NOTA (decisión de producto 24/06): se conserva `correct_option` en la carga para
// preservar el feedback INSTANTÁNEO client-side del PsychometricTestLayout (mismo
// comportamiento que el .from anterior). Cerrar esa exposición exigiría mover la
// validación a /api/answer/psychometric (cambio de UX, fuera de alcance aquí).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { checkRateLimit, getClientIp, RATE_LIMIT_PSYCHOMETRIC } from '@/lib/api/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

async function _GET(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request)
  const rate = checkRateLimit(ip, RATE_LIMIT_PSYCHOMETRIC)
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) } }
    )
  }

  const params = new URL(request.url).searchParams
  const categories = (params.get('categories') || '').split(',').map((s) => s.trim()).filter(Boolean)
  const sections = (params.get('sections') || '').split(',').map((s) => s.trim()).filter(Boolean)

  if (categories.length === 0) {
    return NextResponse.json({ success: false, error: 'Parámetro "categories" requerido' }, { status: 400 })
  }

  const sectionFilter = sections.length > 0
    ? sql` AND s.section_key = ANY(${sections}::text[])`
    : sql``

  const res = await getAdminDb().execute(sql`
    SELECT to_jsonb(q.*)
      || jsonb_build_object(
           'psychometric_categories', jsonb_build_object('category_key', c.category_key, 'display_name', c.display_name),
           'psychometric_sections', jsonb_build_object('section_key', s.section_key, 'display_name', s.display_name)
         ) AS question
    FROM psychometric_questions q
    JOIN psychometric_categories c ON c.id = q.category_id
    JOIN psychometric_sections s ON s.id = q.section_id
    WHERE q.is_active = true
      AND c.category_key = ANY(${categories}::text[])${sectionFilter}
    ORDER BY q.created_at DESC
  `)
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as { question: unknown }[]
  const questions = rows.map((r) => r.question)

  return NextResponse.json({ success: true, questions })
}

export const GET = withErrorLogging('/api/v2/psychometric/questions', _GET)
