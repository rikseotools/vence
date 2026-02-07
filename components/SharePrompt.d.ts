// components/SharePrompt.d.ts - Type declarations

import type { FC } from 'react'

export interface SharePromptProps {
  /** User's exam score (out of 10) */
  score: number
  /** Test session ID for tracking */
  testSessionId?: string | null
  /** Callback when prompt is closed */
  onClose?: () => void
  /** Force show prompt (for testing) */
  forceShow?: boolean
}

declare const SharePrompt: FC<SharePromptProps>
export default SharePrompt
