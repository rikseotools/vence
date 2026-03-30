// app/api/admin/newsletters/templates/[slug]/route.ts
// Editar / obtener una plantilla individual
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

// GET - Obtener plantilla por slug
async function _GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { slug } = await params
  const db = getDb()

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.slug, slug))
    .limit(1)

  if (!template) {
    return NextResponse.json({ error: `Plantilla "${slug}" no encontrada` }, { status: 404 })
  }

  return NextResponse.json({ success: true, template })
}

// PUT - Actualizar plantilla
const UpdateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(['broadcast', 'transactional', 'marketing']).optional(),
  subjectTemplate: z.string().min(1).optional(),
  htmlTemplate: z.string().min(1).optional(),
  variables: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'url', 'list']),
    default_value: z.string().optional(),
  })).optional(),
  previewData: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

async function _PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { slug } = await params
  const body = await request.json()
  const parsed = UpdateTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const db = getDb()

  // Verificar que existe
  const [existing] = await db
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(eq(emailTemplates.slug, slug))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: `Plantilla "${slug}" no encontrada` }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category
  if (parsed.data.subjectTemplate !== undefined) updateData.subjectTemplate = parsed.data.subjectTemplate
  if (parsed.data.htmlTemplate !== undefined) updateData.htmlTemplate = parsed.data.htmlTemplate
  if (parsed.data.variables !== undefined) updateData.variables = parsed.data.variables
  if (parsed.data.previewData !== undefined) updateData.previewData = parsed.data.previewData
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive

  const [updated] = await db
    .update(emailTemplates)
    .set(updateData)
    .where(eq(emailTemplates.slug, slug))
    .returning()

  return NextResponse.json({ success: true, template: updated })
}

export const GET = withErrorLogging('/api/admin/newsletters/templates/[slug]', _GET)
export const PUT = withErrorLogging('/api/admin/newsletters/templates/[slug]', _PUT)
