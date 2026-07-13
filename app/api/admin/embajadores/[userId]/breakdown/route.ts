// app/api/admin/embajadores/[userId]/breakdown/route.ts
// DESGLOSE ADMIN de un embajador: TODAS sus recompensas (bug/opinión/referido/
// pago) con importe, estado, fecha y ASUNTO, en línea de tiempo + totales.
// Es la vista de CONTROL (distinta del panel "como lo ve el usuario"). Read-only,
// requiere admin. Usa getAdminDb (dato en vivo, no la réplica).
import { NextRequest, NextResponse } from 'next/server'
import { getEmbajadorBreakdown } from '@/lib/referrals/queries'
import { summarizeBreakdown } from '@/lib/referrals/breakdown'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { userId } = await params
  if (!UUID_RE.test(userId || '')) {
    return NextResponse.json({ success: false, error: 'userId inválido' }, { status: 400 })
  }

  const db = getAdminDb()
  const prof = await db.execute(sql`select full_name, email from user_profiles where id = ${userId} limit 1`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pr: any[] = Array.isArray(prof) ? prof : ((prof as any)?.rows ?? [])
  if (!pr.length) return NextResponse.json({ success: false, error: 'usuario no encontrado' }, { status: 404 })

  const rows = await getEmbajadorBreakdown(userId, db)
  const totals = summarizeBreakdown(rows)
  return NextResponse.json({
    success: true,
    user: { name: pr[0]?.full_name ?? null, email: pr[0]?.email ?? null },
    totals,
    rows,
  })
}

export const GET = withErrorLogging('/api/admin/embajadores/[userId]/breakdown', _GET)
export { _GET }
