// components/UpgradeLimitModal.d.ts - Type declarations

import type { FC } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface UpgradeLimitModalProps {
  isOpen: boolean
  onClose: () => void
  questionsAnswered?: number
  resetTime?: string | null
  supabase?: SupabaseClient | null
  userId?: string | null
  userName?: string | null
}

declare const UpgradeLimitModal: FC<UpgradeLimitModalProps>
export default UpgradeLimitModal
