// app/oposiciones/lib/catalogadas.ts
//
// Fetch compartido de convocatorias CATALOGADAS abiertas (is_active=false, sin
// landing/tests todavía) con inscripción abierta HOY y convocatoria oficial. Se
// muestran como sección "sin test todavía" enlazando a la fuente oficial (nunca a
// una landing inexistente). Lo usan /oposiciones y /oposiciones/[filtro] para que el
// tag "Inscripción abierta" dé EXACTAMENTE lo mismo en ambas.
//
// Service-role: las catalogadas no son visibles por el camino anon (RLS); getAdminDb
// bypasea RLS (= service_role). Alineado con la retirada de RLS (Fase P). Decisión
// producto 20/06.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { isShowableCatalogada } from '@/lib/oposiciones/inscripcion'

export interface CatalogadaAbierta {
  slug: string
  nombre: string
  plazas_libres: number | null
  inscription_deadline: string | null
  seguimiento_url: string | null
  subgrupo: string | null
}

export async function getCatalogadasAbiertas(): Promise<CatalogadaAbierta[]> {
  try {
    const rows = await getAdminDb().execute(sql`
      SELECT slug, nombre, plazas_libres,
             inscription_start::text AS inscription_start,
             inscription_deadline::text AS inscription_deadline,
             seguimiento_url, subgrupo
      FROM oposiciones_ssot
      WHERE is_active = false
      ORDER BY inscription_deadline ASC NULLS LAST
    `)
    const results = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []) as unknown as (CatalogadaAbierta & { inscription_start: string | null })[]
    return results.filter(o => isShowableCatalogada({ ...o, is_active: false }))
  } catch (e) {
    console.warn('[oposiciones/catalogadas] getCatalogadasAbiertas falló:', (e as Error).message)
    return []
  }
}
