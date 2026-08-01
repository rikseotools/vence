import 'server-only'
// lib/api/oposicionPersonalizada/guardar.ts — escribe el temario propio. (T-327)
//
// La DECISIÓN de qué se escribe está en `./plan.ts` (puro y testeado). Aquí solo se escribe.
//
// ── TODO EN UNA TRANSACCIÓN, Y NO ES CEREMONIA ──────────────────────────────────────────────
//
// Son tres escrituras encadenadas (la oposición, sus temas, el scope de cada tema) y fallar a la
// mitad deja el peor estado posible: una oposición **que existe y no tiene temario**, o temas sin
// scope. El usuario la vería en su lista, entraría y no habría nada — que es exactamente el
// problema que esta función viene a resolver (303 usuarios con una etiqueta sin temario detrás,
// 127 sin hacer un solo test). O entra entera o no entra.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { construirPlan, type TemarioEntrada, type ErrorPlan } from './plan'

export interface ResultadoGuardado {
  ok: boolean
  /** Id de la fila en `custom_oposiciones`. */
  id?: string
  positionType?: string
  nombre?: string
  temas?: number
  errores?: ErrorPlan[]
  /** Motivo técnico cuando `ok` es false y no es culpa de lo que mandó el usuario. */
  motivo?: 'nombre_repetido' | 'error_bd'
  detalle?: string
}

const UNIQUE_VIOLATION = '23505'

function esViolacionUnica(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code
  if (code === UNIQUE_VIOLATION) return true
  const causa = (err as { cause?: { code?: unknown } })?.cause
  return causa?.code === UNIQUE_VIOLATION
}

/**
 * Crea la oposición personalizada con su temario.
 *
 * @param userId  dueño (sale SIEMPRE del token, nunca del cuerpo de la petición)
 * @param autor   nombre público del creador, ya compuesto por quien llama
 */
export async function guardarOposicionPersonalizada(
  userId: string,
  entrada: TemarioEntrada,
  autor: string | null,
): Promise<ResultadoGuardado> {
  // 1. Se valida ANTES de tocar nada. El id real aún no existe, así que se planifica con uno
  //    provisional solo para comprobar la forma; el definitivo se calcula tras el INSERT.
  const previo = construirPlan(entrada, '00000000-0000-0000-0000-000000000000')
  if (previo.errores.length > 0) return { ok: false, errores: previo.errores }

  const db = getAdminDb()
  try {
    return await db.transaction(async (tx) => {
      // 2. La oposición. `is_public` a true: la decisión de producto es que se comparta (otros
      //    pueden elegirla, solo el dueño la edita).
      const filas = (await tx.execute(sql`
        INSERT INTO custom_oposiciones (user_id, nombre, is_public, is_active, created_by_username)
        VALUES (${userId}::uuid, ${previo.plan!.nombre}, true, true, ${autor})
        RETURNING id
      `)) as unknown as Array<{ id: string }>
      const id = filas[0]?.id
      if (!id) throw new Error('no se pudo crear la oposición')

      // 3. Ahora sí, el plan definitivo: el `position_type` DERIVA del id (ver `plan.ts` — dos
      //    usuarios pueden llamar igual a su oposición y un slug por nombre las mezclaría).
      const { plan } = construirPlan(entrada, id)

      for (const tema of plan!.temas) {
        // `descripcion_corta` es NOT NULL en la BD aunque `db/schema.ts` la declare opcional
        // (deriva del schema, comprobado el 01/08 contra RDS). Lo cazó la simulación, no los
        // unitarios: es un invariante que solo existe en Postgres. Se rellena con el título,
        // que es lo único que el usuario ha escrito y describe el tema de verdad.
        // `description` va rellena aunque el usuario no la escriba: hay una vigilancia de calidad
        // que exige que ningún tema activo la tenga vacía, y un temario propio no tiene por qué
        // ensuciar esa medición. Con el título es honesto (es lo único que ha escrito) y deja la
        // fila coherente con las del catálogo.
        const t = (await tx.execute(sql`
          INSERT INTO topics (position_type, topic_number, title, description, descripcion_corta, is_active, disponible)
          VALUES (${plan!.positionType}, ${tema.topicNumber}, ${tema.titulo}, ${tema.titulo}, ${tema.titulo}, true, true)
          RETURNING id
        `)) as unknown as Array<{ id: string }>
        const topicId = t[0]?.id
        if (!topicId) throw new Error('no se pudo crear el tema')

        for (const fila of tema.scope) {
          // `article_numbers` NULL = la ley entera. Se manda NULL de verdad, no un array vacío:
          // un `'{}'` es «ninguno», que sirve 0 preguntas — el opuesto exacto de lo que quiso el
          // usuario al pulsar «Añadir toda la ley».
          //
          // ⚠️ EL ARRAY VA COMO JSON Y SE CONVIERTE EN SQL, y no es rebuscado: interpolar un
          // array de JS en una plantilla `sql` de Drizzle lo EXPANDE en `($1, $2, $3…)`, o sea
          // una tupla, no un array — el INSERT revienta con un error de sintaxis. Cazado el
          // 01/08/2026 con el primer guardado real. `jsonb_array_elements_text` lo reconstruye
          // como `text[]` de verdad, con UN solo parámetro y sin escapar nada a mano.
          if (fila.articleNumbers === null) {
            await tx.execute(sql`
              INSERT INTO topic_scope (topic_id, law_id, article_numbers)
              VALUES (${topicId}::uuid, ${fila.lawId}::uuid, NULL)
            `)
          } else {
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

      return {
        ok: true,
        id,
        positionType: plan!.positionType,
        nombre: plan!.nombre,
        temas: plan!.temas.length,
      }
    })
  } catch (err) {
    // `unique_user_custom_oposicion` (user_id, nombre): ya tiene una con ese nombre. No es un
    // fallo del sistema, es algo que el usuario puede arreglar solo cambiando el nombre — así que
    // se distingue para poder decírselo en vez de un «error inesperado».
    if (esViolacionUnica(err)) {
      return {
        ok: false,
        motivo: 'nombre_repetido',
        errores: [{ campo: 'nombre', mensaje: 'Ya tienes una oposición con ese nombre.' }],
      }
    }
    return {
      ok: false,
      motivo: 'error_bd',
      detalle: (err instanceof Error ? err.message : String(err)).slice(0, 200),
    }
  }
}
