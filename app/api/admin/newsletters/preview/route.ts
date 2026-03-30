// app/api/admin/newsletters/preview/route.ts
// Renderizar preview de una plantilla con variables
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { emailTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { renderTemplate } from '@/lib/api/newsletters'

const PreviewSchema = z.object({
  templateSlug: z.string().min(1),
  variables: z.record(z.unknown()).default({}),
})

async function _POST(request: NextRequest) {
  const body = await request.json()
  const parsed = PreviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const db = getDb()
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.slug, parsed.data.templateSlug))
    .limit(1)

  if (!template) {
    return NextResponse.json({ error: `Plantilla "${parsed.data.templateSlug}" no encontrada` }, { status: 404 })
  }

  // Merge: preview_data como base + variables del request como override
  const previewData = template.previewData as Record<string, unknown> || {}
  const mergedVars = { ...previewData, ...parsed.data.variables }

  const renderedSubject = renderTemplate(template.subjectTemplate, mergedVars)
  const renderedHtml = renderTemplate(template.htmlTemplate, mergedVars)

  return NextResponse.json({
    success: true,
    subject: renderedSubject,
    html: renderedHtml,
    template: {
      slug: template.slug,
      name: template.name,
      variables: template.variables,
    },
  })
}

export const POST = withErrorLogging('/api/admin/newsletters/preview', _POST)
