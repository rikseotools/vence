// lib/services/pwaTracker.d.ts - Type declarations for PWA tracker

/** User data - accepts any object with an id property */
interface UserData {
  id: string
  email?: string
}

interface TrackingData {
  [key: string]: unknown
}

interface PWATracker {
  setSupabaseInstance(supabase: unknown): void
  startSession(): void
  detectExistingPWAUser(): Promise<void>
  trackInstallPrompt(userData?: UserData | null, data?: TrackingData): Promise<void>
  trackInstallOutcome(
    outcome: 'accepted' | 'dismissed' | 'unknown',
    userData?: UserData | null,
    data?: TrackingData
  ): Promise<void>
  trackPWALaunch(userData?: UserData | null, data?: TrackingData): Promise<void>
  trackEvent(
    eventType: string,
    userData?: UserData | null,
    data?: TrackingData
  ): Promise<void>
  trackAction(action: string, userData?: UserData | null, data?: TrackingData): void
}

declare const pwaTracker: PWATracker
export default pwaTracker
