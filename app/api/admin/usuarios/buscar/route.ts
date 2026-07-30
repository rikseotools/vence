// app/api/admin/usuarios/buscar/route.ts — buscador de usuarios por NOMBRE o CORREO (T-289).
//
// Existe para elegir a quién ver desde la pestaña de suplantación: hasta ahora había que
// conocer el UUID de memoria o sacarlo de una consulta a mano, lo que en la práctica
// significaba no usar la función.
//
// Solo lectura y tras `requireAdmin`. Devuelve lo justo para decidir a quién entrar (nombre,
// correo, plan, CIUDAD, oposición, alta, última actividad) — no es un volcado del perfil.
//
// La ciudad y el plan están porque son los dos datos con los que se desempata en la vida real:
// las búsquedas por nombre devuelven varias personas homónimas (cinco «Maria Luisa»), y quien
// escribe suele ser identificable por su oposición Y su ciudad. Cubren 11.205 de 11.610
// perfiles (96,5%), así que casi nunca sale el hueco.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { isAdminEmail } from '@/lib/auth/adminEmails'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMITE = 25

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  // Con menos de 2 caracteres la búsqueda devolvería medio banco: no es un límite técnico,
  // es que una lista de 25 personas al azar no ayuda a elegir a nadie.
  if (q.length < 2) return NextResponse.json({ usuarios: [], mensaje: 'Escribe al menos 2 letras' })

  const patron = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`
  const db = getAdminDb()
  const res = await db.execute(sql`
    select id, email, full_name, plan_type, ciudad, target_oposicion, created_at, updated_at
    from user_profiles
    where email ilike ${patron} or full_name ilike ${patron}
    order by
      -- Primero lo que empieza por lo tecleado (buscar "ana" no debería enterrar a Ana
      -- detrás de cinco "mariana"), y dentro de eso lo más reciente.
      case when email ilike ${q + '%'} or full_name ilike ${q + '%'} then 0 else 1 end,
      updated_at desc nulls last
    limit ${LIMITE}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])

  return NextResponse.json({
    usuarios: filas.map((f) => ({
      id: f.id,
      email: f.email,
      nombre: f.full_name,
      // `plan_type` solo toma dos valores en el banco (free/premium, sin nulos); se
      // normaliza igualmente para que la interfaz nunca tenga que adivinar por ausencia.
      plan: f.plan_type === 'premium' ? 'premium' : 'free',
      // Cadena vacía = no hay dato. Devolverla como `null` evita pintar un separador suelto.
      ciudad: typeof f.ciudad === 'string' && f.ciudad.trim() ? f.ciudad.trim() : null,
      oposicion: f.target_oposicion,
      alta: f.created_at,
      ultimaActividad: f.updated_at,
      // Se marca aquí para que la interfaz no ofrezca un botón que el servidor va a
      // rechazar: no se suplanta a otro admin.
      esAdmin: isAdminEmail(f.email),
    })),
    truncado: filas.length === LIMITE,
  })
}

export const GET = withErrorLogging('/api/admin/usuarios/buscar', _GET)
export { _GET }
