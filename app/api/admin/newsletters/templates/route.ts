// app/api/admin/newsletters/templates/route.ts
// CRUD de plantillas de email desde BD
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { emailTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'rikseotools@gmail.com').split(',')

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return !error && !!user && ADMIN_EMAILS.includes(user.email || '')
}

// GET - Listar todas las plantillas
async function _GET(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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
