import 'server-only'
// lib/api/oposicionPersonalizada/consultas.ts — leer y REEMPLAZAR un temario propio. (T-327)
//
// La escritura inicial vive en `./guardar.ts`. Aquí van las tres operaciones que hacen falta para
// poder EDITAR: listar las mías, cargar una entera, y reemplazar su temario.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { construirPlan, positionTypeDe, type TemarioEntrada, type ErrorPlan } from './plan'
import { idCustomDe } from '@/lib/oposicion/objetivoPersonalizado'
import { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'

export interface PersonalizadaResuelta {
  nombre: string
  /** Temas activos de su `position_type`. 0 = la fila es solo una etiqueta, no un temario. */
  temas: number
}

/**
 * La personalizada, con el TAMAÑO REAL de su temario, en una sola consulta. [T-508]
 *
 * Extraída de `app/api/profile/target/route.ts` a este fichero compartido en [T-339]: había un
 * SEGUNDO punto de escritura del objetivo (`/api/v2/onboarding/save-field`, el guardado
 * progresivo del onboarding) que no la conocía y por tanto no podía aplicar el mismo criterio —
 * exactamente la forma en que esto se rompió la primera vez (dos puertas, dos criterios).
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

export interface ResumenOposicion {
  id: string
  nombre: string
  temas: number
  articulos: number
  /** Cuánta gente la ha elegido como objetivo. Es lo que convierte editar en un acto con
   *  consecuencias: si no se enseña, se edita creyendo que solo te afecta a ti. */
  vecesElegida: number
  actualizada: string | null
}

/** Las oposiciones personalizadas de un usuario, con el tamaño real de su temario. */
export async function misOposiciones(userId: string): Promise<ResumenOposicion[]> {
  const filas = (await getAdminDb().execute(sql`
    SELECT co.id,
           co.nombre,
           co.times_selected,
           co.updated_at,
           (SELECT count(*)::int FROM topics t
             WHERE t.position_type = 'personalizada_' || replace(co.id::text, '-', '')) AS temas,
           -- Los artículos se cuentan de verdad, incluidas las leyes enteras (que valen 1 fila
           -- con NULL). Enseñar «0 artículos» en una oposición que entra una ley completa sería
           -- decirle al usuario que su temario está vacío cuando no lo está.
           (SELECT coalesce(sum(CASE WHEN s.article_numbers IS NULL THEN 1
                                     ELSE cardinality(s.article_numbers) END), 0)::int
              FROM topic_scope s JOIN topics t ON t.id = s.topic_id
             WHERE t.position_type = 'personalizada_' || replace(co.id::text, '-', '')) AS articulos
      FROM custom_oposiciones co
     WHERE co.user_id = ${userId}::uuid AND co.is_active = true
     ORDER BY co.updated_at DESC NULLS LAST, co.created_at DESC
  `)) as unknown as Array<{
    id: string
    nombre: string
    times_selected: number | null
    updated_at: string | null
    temas: number
    articulos: number
  }>

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    temas: Number(f.temas ?? 0),
    articulos: Number(f.articulos ?? 0),
    vecesElegida: Number(f.times_selected ?? 0),
    actualizada: f.updated_at,
  }))
}

export interface TemarioCargado {
  id: string
  nombre: string
  temas: Array<{
    titulo: string
    articulos: Array<{ lawId: string; shortName: string; articleNumber: string | null }>
  }>
}

/**
 * Carga una oposición para editarla. Devuelve `null` si no existe **o no es del usuario** — se
 * comprueba la propiedad EN LA CONSULTA, no después: son públicas y elegibles por cualquiera,
 * así que sin este filtro cualquiera podría abrir el editor de la de otro.
 */
export async function cargarOposicion(
  userId: string,
  id: string,
): Promise<TemarioCargado | null> {
  const db = getAdminDb()
  const cab = (await db.execute(sql`
    SELECT id, nombre FROM custom_oposiciones
     WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND is_active = true
     LIMIT 1
  `)) as unknown as Array<{ id: string; nombre: string }>
  if (!cab[0]) return null

  const pt = positionTypeDe(id)
  const filas = (await db.execute(sql`
    SELECT t.topic_number, t.title, s.law_id, l.short_name, s.article_numbers
      FROM topics t
      LEFT JOIN topic_scope s ON s.topic_id = t.id
      LEFT JOIN laws l ON l.id = s.law_id
     WHERE t.position_type = ${pt}
     ORDER BY t.topic_number, l.short_name
  `)) as unknown as Array<{
    topic_number: number
    title: string
    law_id: string | null
    short_name: string | null
    article_numbers: string[] | null
  }>

  const porTema = new Map<number, TemarioCargado['temas'][number]>()
  for (const f of filas) {
    if (!porTema.has(f.topic_number)) {
      porTema.set(f.topic_number, { titulo: f.title, articulos: [] })
    }
    if (!f.law_id) continue // tema sin scope: se carga vacío, no se pierde su título
    const t = porTema.get(f.topic_number)!
    if (f.article_numbers === null) {
      // La ley entera se reconstruye como tal (articleNumber null), no como sus artículos de
      // hoy: si se expandiera aquí, editar y volver a guardar convertiría «toda la ley» en una
      // foto congelada sin que el usuario haya pedido ese cambio.
      t.articulos.push({ lawId: f.law_id, shortName: f.short_name ?? '', articleNumber: null })
    } else {
      for (const n of f.article_numbers) {
        t.articulos.push({ lawId: f.law_id, shortName: f.short_name ?? '', articleNumber: n })
      }
    }
  }

  return {
    id: cab[0].id,
    nombre: cab[0].nombre,
    temas: [...porTema.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v),
  }
}

export interface ResultadoActualizar {
  ok: boolean
  temas?: number
  errores?: ErrorPlan[]
  motivo?: 'no_es_tuya' | 'nombre_repetido' | 'error_bd'
  detalle?: string
}

const UNIQUE_VIOLATION = '23505'
const esViolacionUnica = (err: unknown) =>
  (err as { code?: unknown })?.code === UNIQUE_VIOLATION ||
  (err as { cause?: { code?: unknown } })?.cause?.code === UNIQUE_VIOLATION

/**
 * Reemplaza el temario de una oposición propia.
 *
 * ── POR QUÉ SE BORRA Y SE VUELVE A ESCRIBIR ─────────────────────────────────────────────────
 *
 * Un temario no es una lista de filas independientes: es una estructura donde los temas se
 * numeran del 1 al N y el scope cuelga de ellos. Intentar «actualizar lo que cambió» exigiría
 * emparejar temas viejos con nuevos, y no hay forma de saber si el «Tema 2» de ahora es el mismo
 * que el de antes o uno nuevo que ocupa su sitio. Reemplazar es la única operación que no puede
 * dejar un estado intermedio raro.
 *
 * Todo en UNA transacción: borrar y no llegar a escribir dejaría al usuario **sin temario**, que
 * es peor que no haber editado.
 */
export async function reemplazarTemario(
  userId: string,
  id: string,
  entrada: TemarioEntrada,
): Promise<ResultadoActualizar> {
  const { plan, errores } = construirPlan(entrada, id)
  if (!plan) return { ok: false, errores }

  const db = getAdminDb()
  try {
    return await db.transaction(async (tx) => {
      // Propiedad comprobada DENTRO de la transacción y como parte del UPDATE: comprobarlo antes
      // en una consulta aparte deja una rendija entre el «es tuya» y el «escribo».
      const upd = (await tx.execute(sql`
        UPDATE custom_oposiciones
           SET nombre = ${plan.nombre}, updated_at = now()
         WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND is_active = true
        RETURNING id
      `)) as unknown as Array<{ id: string }>
      if (!upd[0]) return { ok: false, motivo: 'no_es_tuya' as const }

      const pt = plan.positionType
      await tx.execute(sql`
        DELETE FROM topic_scope
         WHERE topic_id IN (SELECT id FROM topics WHERE position_type = ${pt})
      `)
      await tx.execute(sql`DELETE FROM topics WHERE position_type = ${pt}`)

      // El bloque se reescribe igual que los temas: si la oposición se creó antes de que esto
      // existiera, editarla la repara sola en vez de dejarla con el temario en 404 para siempre.
      await tx.execute(sql`DELETE FROM oposicion_bloques WHERE position_type = ${pt}`)
      await tx.execute(sql`
        INSERT INTO oposicion_bloques (position_type, bloque_number, titulo, icon, sort_order)
        VALUES (${pt}, 1, 'Tu temario', '✏️', 0)
      `)

      for (const tema of plan.temas) {
        const t = (await tx.execute(sql`
          INSERT INTO topics (position_type, topic_number, title, description, descripcion_corta, bloque_number, is_active, disponible)
          VALUES (${pt}, ${tema.topicNumber}, ${tema.titulo}, ${tema.titulo}, ${tema.titulo}, 1, true, true)
          RETURNING id
        `)) as unknown as Array<{ id: string }>
        const topicId = t[0]?.id
        if (!topicId) throw new Error('no se pudo crear el tema')

        for (const fila of tema.scope) {
          if (fila.articleNumbers === null) {
            await tx.execute(sql`
              INSERT INTO topic_scope (topic_id, law_id, article_numbers)
              VALUES (${topicId}::uuid, ${fila.lawId}::uuid, NULL)
            `)
          } else {
            // Mismo motivo que en `guardar.ts`: un array de JS interpolado en `sql` se expande
            // en una tupla y el INSERT revienta.
            await tx.execute(sql`
              INSERT INTO topic_scope (topic_id, law_id, article_numbers)
              VALUES (
                ${topicId}::uuid,
                ${fila.lawId}::uuid,
                ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(fila.articleNumbers)}::jsonb))
              )
            `)
          }
        }
      }
      return { ok: true, temas: plan.temas.length }
    })
  } catch (err) {
    if (esViolacionUnica(err)) {
      return {
        ok: false,
        motivo: 'nombre_repetido',
        errores: [{ campo: 'nombre', mensaje: 'Ya tienes otra oposición con ese nombre.' }],
      }
    }
    return {
      ok: false,
      motivo: 'error_bd',
      detalle: (err instanceof Error ? err.message : String(err)).slice(0, 200),
    }
  }
}
