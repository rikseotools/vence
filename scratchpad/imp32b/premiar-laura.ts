#!/usr/bin/env npx tsx
// Recompensa A MANO de la impugnación 32b0d55e (motivo `otro` → no la concede el cierre solo).
// Orden explícita de Manuel (31/07/2026). Usa el mismo camino que la concesión automática, así que
// el anti-duplicado por dispute_id (índice único + check) sigue protegiendo.
import { createRewardSubmission } from '@/lib/referrals/queries'

const USER_ID = '85df6496-1e14-491e-9df6-39680329ce2f' // lzurdo67@gmail.com (premium)
const DISPUTE_ID = '32b0d55e-d917-4507-8254-4e83c56613f6'

;(async () => {
  const res = await createRewardSubmission({ userId: USER_ID, type: 'impugnacion', disputeId: DISPUTE_ID })
  console.log(res)
  process.exit(0)
})()
