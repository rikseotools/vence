// app/api/admin/oposiciones-stats/route.ts
// API interna para obtener estadísticas de oposiciones de usuarios
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { userProfiles, oposiciones } from '@/db/schema'
import { isNotNull } from 'drizzle-orm'

export async function GET() {
  try {
    const db = getDb()

    // User profiles con target_oposicion
    const profiles = await db
      .select({
        targetOposicion: userProfiles.targetOposicion,
        targetOposicionData: userProfiles.targetOposicionData,
      })
      .from(userProfiles)
      .where(isNotNull(userProfiles.targetOposicion))

    // Oposiciones de BD
    const oposicionesBD = await db
      .select({
        id: oposiciones.id,
        slug: oposiciones.slug,
        shortName: oposiciones.shortName,
        nombre: oposiciones.nombre,
        isActive: oposiciones.isActive,
        plazasLibres: oposiciones.plazasLibres,
        examDate: oposiciones.examDate,
      })
      .from(oposiciones)

    return NextResponse.json({ success: true, profiles, oposicionesBD })
  } catch (error) {
    console.error('Error loading oposiciones stats:', error)
    return NextResponse.json(
      { success: false, error: 'Error loading data' },
      { status: 500 }
    )
  }
}
