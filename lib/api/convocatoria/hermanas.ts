// lib/api/convocatoria/hermanas.ts
//
// Las otras convocatorias VIVAS de la misma oposición, cuando el temario difiere.
//
// La relación vive en `oposiciones.grupo_convocatoria` (columna, no fichero de config: el
// catálogo está en la base de datos y una copia en código se desincronizaría en la siguiente
// renovación de convocatoria). Aquí solo está el acceso a datos; la decisión de avisar y el
// texto son puros y viven en `lib/convocatoria/convocatoriasHermanas.ts`, con sus tests.
//
// Origen: caso Ana Isabel (30/07/2026) — estudió el temario de la convocatoria equivocada
// porque, una vez dentro de la oposición, nada decía que existiera otra. Ver [T-063].
import { sql } from 'drizzle-orm'
import { getDb, getPoolerDb } from '@/db/client'
import type { OposicionHermana } from '@/lib/convocatoria/convocatoriasHermanas'

function getHermanasDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

/**
 * Devuelve TODAS las oposiciones activas del grupo de `slug` (incluida ella misma, marcada
 * con `actual: true`). Lista vacía si la oposición no tiene grupo, que es lo normal.
 *
 * Nunca lanza: un fallo aquí no puede tumbar la página de tests. Sin datos no se pinta el
 * aviso, que es el estado seguro — un aviso de menos molesta; una página caída, más.
 */
export async function getConvocatoriasHermanas(slug: string): Promise<OposicionHermana[]> {
  try {
    const db = getHermanasDb()
    const rows = await db.execute(sql`
      SELECT o.slug, o.nombre, c.exam_date
        FROM oposiciones o
        LEFT JOIN LATERAL (
          SELECT exam_date FROM convocatorias
           WHERE oposicion_id = o.id AND is_current
           ORDER BY exam_date NULLS LAST LIMIT 1
        ) c ON true
       WHERE o.is_active
         AND o.grupo_convocatoria IS NOT NULL
         AND o.grupo_convocatoria = (
           SELECT grupo_convocatoria FROM oposiciones WHERE slug = ${slug}
         )
       ORDER BY c.exam_date NULLS LAST
    `)
    const arr = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[])
    return (arr as Record<string, unknown>[]).map((r) => ({
      slug: String(r.slug),
      nombre: String(r.nombre ?? r.slug),
      examDate: (r.exam_date as string) ?? null,
      actual: String(r.slug) === slug,
    }))
  } catch {
    return []
  }
}
