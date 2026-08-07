// lib/api/oposicion/buscarPersonalizada.ts
//
// Extraído de `app/api/profile/target/route.ts` (T-077, 07/08): esta consulta la necesitan
// los DOS puntos de escritura reales de `target_oposicion` — el cambio manual
// (`/api/profile/target`) y la asignación automática por URL (`/api/v2/oposicion/assign`,
// `components/OposicionDetector`) — y solo el primero la tenía. El segundo escribía
// personalizadas sin pasar por el guardarraíl de [T-508] (una personalizada sin temario da
// 404 al usuario), simplemente porque nadie había extraído esta función la primera vez: dos
// escritores independientes con el mismo criterio es como se pierden guardarraíles.

import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { idCustomDe } from '@/lib/oposicion/objetivoPersonalizado'
import { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'

/**
 * Shape CANÓNICO de target_oposicion_data. Superset de todas las variantes que leen los
 * consumidores (unos usan `name`, otros `nombre`; todos id/slug/categoria/administracion) →
 * no rompe ningún lector existente.
 */
export interface PersonalizadaResuelta {
  nombre: string
  /** Temas activos de su `position_type`. 0 = la fila es solo una etiqueta, no un temario. */
  temas: number
}

/**
 * La personalizada, con el TAMAÑO REAL de su temario, en una sola consulta. [T-508]
 *
 * El `temas` viaja junto al nombre y no en una consulta aparte a propósito: son la misma
 * decisión («¿puede esta persona estudiar esto?») y separarlas deja que una diga que sí y la
 * otra que no según cuál corra primero.
 *
 * Devuelve `null` tanto si no hay fila como si la consulta falla. Los dos casos se tratan
 * igual —seguir adelante— porque el guardarraíl que se apoya en esto tiene que ser FAIL-OPEN:
 * bloquear el cambio de objetivo porque la base de datos tosió sería peor que el fallo que
 * viene a evitar.
 */
export async function buscarPersonalizada(
  oposicionId: string,
  userId: string,
): Promise<PersonalizadaResuelta | null> {
  const idCustom = idCustomDe(oposicionId)
  try {
    // ACOTADA: pública O tuya. Sin la condición, cualquiera podría fijar como objetivo la
    // oposición PRIVADA de otra persona con solo conocer su id — y de paso leer su nombre.
    // Que sean elegibles por otros es el diseño (`is_public`), pero solo las públicas.
    // Lo pilló el guardarraíl C2 de scoping por usuario, que hizo bien en preguntar.
    const filas = (await getAdminDb().execute(sql`
      SELECT co.nombre,
             co.created_by_username,
             (SELECT count(*)::int FROM topics t
               WHERE t.position_type = ${oposicionId} AND t.is_active = true) AS temas
        FROM custom_oposiciones co
       WHERE replace(co.id::text, '-', '') = ${idCustom}
         AND co.is_active = true
         AND (co.is_public = true OR co.user_id = ${userId}::uuid)
       LIMIT 1
    `)) as unknown as Array<{ nombre: string; created_by_username: string | null; temas: number }>
    const fila = filas[0]
    if (!fila) return null
    return { nombre: nombrePublico(fila.nombre, fila.created_by_username), temas: Number(fila.temas ?? 0) }
  } catch {
    // Si la consulta falla se cae al fallback: guardar el objetivo con un nombre feo es malo,
    // pero perder el cambio que el usuario acaba de pedir es peor.
    return null
  }
}
