// app/api/admin/newsletters/templates/route.ts
// CRUD de plantillas de email desde BD
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { emailTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

// GET - Listar todas las plantillas
async function _GET() {
  const db = getDb()
  const templates = await db
    .select()
    .from(emailTemplates)
    .orderBy(emailTemplates.createdAt)

  return NextResponse.json({ success: true, templates })
}

// POST - Crear nueva plantilla
const CreateTemplateSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  name: z.string().min(1),
  category: z.enum(['broadcast', 'transactional', 'marketing']).default('broadcast'),
  subjectTemplate: z.string().min(1),
  htmlTemplate: z.string().min(1),
  variables: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'url', 'list']),
    default_value: z.string().optional(),
  })).default([]),
  previewData: z.record(z.unknown()).default({}),
})

async function _POST(request: NextRequest) {
  const body = await request.json()
  const parsed = CreateTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const db = getDb()

  // Verificar slug único
  const existing = await db
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(eq(emailTemplates.slug, parsed.data.slug))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: `Ya existe una plantilla con slug "${parsed.data.slug}"` }, { status: 409 })
  }

  const [created] = await db
    .insert(emailTemplates)
    .values({
      slug: parsed.data.slug,
      name: parsed.data.name,
      category: parsed.data.category,
      subjectTemplate: parsed.data.subjectTemplate,
      htmlTemplate: parsed.data.htmlTemplate,
      variables: parsed.data.variables,
      previewData: parsed.data.previewData,
    })
    .returning()

  return NextResponse.json({ success: true, template: created }, { status: 201 })
}

export const GET = withErrorLogging('/api/admin/newsletters/templates', _GET)
export const POST = withErrorLogging('/api/admin/newsletters/templates', _POST)
