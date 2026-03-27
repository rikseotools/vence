// app/api/admin/oposiciones-migrate/route.ts
// Migra usuarios de una oposición custom (UUID) a una oficial (slug)
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb as getDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { eq } from 'drizzle-orm'

async function _POST(request: NextRequest) {
  try {
    const { fromUUID, toSlug, toData } = await request.json()

    if (!fromUUID || !toSlug) {
      return NextResponse.json(
        { success: false, error: 'fromUUID y toSlug son requeridos' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Contar cuántos se van a migrar
    const affected = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.targetOposicion, fromUUID))

    if (affected.length === 0) {
      return NextResponse.json({
        success: true,
        migratedCount: 0,
        message: 'No se encontraron usuarios con esa oposición',
      })
    }

    // Migrar: actualizar target_oposicion y target_oposicion_data
    await db
      .update(userProfiles)
      .set({
        targetOposicion: toSlug,
        targetOposicionData: toData || { id: toSlug, tipo: 'oficial' },
      })
      .where(eq(userProfiles.targetOposicion, fromUUID))

    console.log(`✅ [Migrate] ${affected.length} usuarios migrados de ${fromUUID} a ${toSlug}`)

    return NextResponse.json({
      success: true,
      migratedCount: affected.length,
      message: `${affected.length} usuarios migrados a ${toSlug}`,
    })
  } catch (error) {
    console.error('Error migrando usuarios:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/admin/oposiciones-migrate', _POST)
