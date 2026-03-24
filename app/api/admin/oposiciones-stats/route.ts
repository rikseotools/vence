// app/api/admin/oposiciones-stats/route.ts
// API interna para obtener estadísticas de oposiciones de usuarios
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { userProfiles, oposiciones } from '@/db/schema'
import { isNotNull } from 'drizzle-orm'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CustomOposicion {
  target_oposicion: string
  nombre: string | null
  categoria: string | null
  administracion: string | null
  tipo: string | null
  count: number
}

export async function GET() {
  try {
    const db = getDb()

    // 1. User profiles con target_oposicion
    const profiles = await db
      .select({
        targetOposicion: userProfiles.targetOposicion,
        targetOposicionData: userProfiles.targetOposicionData,
      })
      .from(userProfiles)
      .where(isNotNull(userProfiles.targetOposicion))

    // 2. Agregar en servidor: contar por target_oposicion
    const counts: Record<string, number> = {}
    const customMap = new Map<string, CustomOposicion>()

    for (const p of profiles) {
      const key = p.targetOposicion
      if (!key) continue
      counts[key] = (counts[key] || 0) + 1

      if (UUID_PATTERN.test(key) && !customMap.has(key)) {
        const data = p.targetOposicionData as any
        customMap.set(key, {
          target_oposicion: key,
          nombre: data?.nombre || null,
          categoria: data?.categoria || null,
          administracion: data?.administracion || null,
          tipo: data?.tipo || null,
          count: 0,
        })
      }
    }

    // Actualizar counts en custom
    for (const [k, v] of customMap) {
      v.count = counts[k] || 0
    }

    const customOposiciones = Array.from(customMap.values()).sort((a, b) => b.count - a.count)

    // 3. Oposiciones de BD
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

    return NextResponse.json({
      success: true,
      userCounts: counts,
      totalUsers: profiles.length,
      customOposiciones,
      oposicionesBD,
    })
  } catch (error) {
    console.error('Error loading oposiciones stats:', error)
    return NextResponse.json(
      { success: false, error: 'Error loading data' },
      { status: 500 }
    )
  }
}
