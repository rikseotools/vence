// app/api/finance/transfers/confirm/route.ts
// POST → marca payout como manuel_confirmed (confirmación manual desde /admin/cobros).
// Acceso: SOLO admin Supabase auth (Manuel ya no usa /armando para esto).

import { NextResponse, type NextRequest } from 'next/server'
import { authenticateFinanceRequest } from '@/lib/finance/auth'
import { getArmandoSupabaseAdmin } from '@/lib/armando/supabaseAdmin'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

interface ConfirmBody {
  stripe_payout_id?: unknown
}

async function _POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateFinanceRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  if (auth.caller!.kind !== 'admin') {
    return NextResponse.json({ success: false, error: 'Solo admins pueden confirmar' }, { status: 403 })
  }

  let body: ConfirmBody
  try {
    body = (await req.json()) as ConfirmBody
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body.stripe_payout_id !== 'string' || body.stripe_payout_id.length === 0) {
    return NextResponse.json({ success: false, error: 'stripe_payout_id requerido' }, { status: 400 })
  }

  const supabase = getArmandoSupabaseAdmin()
  const { error } = await supabase
    .from('payout_transfers')
    .update({
      manuel_confirmed: true,
      manuel_confirmed_date: new Date().toISOString(),
    })
    .eq('stripe_payout_id', body.stripe_payout_id)

  if (error) {
    console.error('[finance/transfers/confirm] DB error:', error)
    return NextResponse.json({ success: false, error: 'Error de base de datos' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/finance/transfers/confirm', _POST)
