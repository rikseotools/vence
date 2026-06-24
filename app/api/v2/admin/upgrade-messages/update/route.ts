// app/api/v2/admin/upgrade-messages/update/route.ts
// Edita un mensaje de upgrade (A/B testing): peso y/o activación. Tier admin.
//
// AGNÓSTICO (Fase C1): sustituye los 2 supabase.from('upgrade_messages').update de
// cliente por Drizzle detrás de requireAdmin. Actualiza solo los campos provistos.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  messageId: z.string().uuid(),
  weight: z.number().int().min(0).max(1000000).optional(),
  isActive: z.boolean().optional(),
}).refine(b => b.weight !== undefined || b.isActive !== undefined, {
  message: 'nada que actualizar',
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { messageId, weight, isActive } = parsed.data
  const db = getAdminDb()

  // Columnas literales por campo (sin interpolar nombres). Solo lo provisto.
  if (weight !== undefined) {
    await db.execute(sql`UPDATE upgrade_messages SET weight = ${weight} WHERE id = ${messageId}::uuid`)
  }
  if (isActive !== undefined) {
    await db.execute(sql`UPDATE upgrade_messages SET is_active = ${isActive} WHERE id = ${messageId}::uuid`)
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/admin/upgrade-messages/update', _POST)
