// app/api/finance/transfers/route.ts
// GET → lista todos los payouts ordenados por fecha desc.
// Acceso: armando cookie OR admin Supabase auth.

import { NextResponse, type NextRequest } from 'next/server'
import { authenticateFinanceRequest } from '@/lib/finance/auth'
import { getArmandoSupabaseAdmin } from '@/lib/armando/supabaseAdmin'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateFinanceRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const supabase = getArmandoSupabaseAdmin()
  const { data, error } = await supabase
    .from('payout_transfers')
    .select('*')
    .order('payout_date', { ascending: false })

  if (error) {
    console.error('[finance/transfers GET] DB error:', error)
    return NextResponse.json({ success: false, error: 'Error de base de datos' }, { status: 500 })
  }

  return NextResponse.json({ success: true, transfers: data ?? [] })
}
