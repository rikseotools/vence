// lib/services/notificationTracker.d.ts - Type declarations for notification tracker

/** User data - accepts any object with an id property */
interface UserData {
  id: string
  email?: string
}

interface TrackingData {
  deviceType?: string
  customData?: Record<string, unknown>
  [key: string]: unknown
}

interface NotificationTracker {
  setSupabaseInstance(supabase: unknown): void
  getDeviceType(): string
  trackPushEvent(
    eventType: string,
    userData?: UserData | null,
    data?: TrackingData
  ): Promise<void>
  trackPermissionChange(
    permission: NotificationPermission | string,
    userData?: UserData | null
  ): Promise<void>
  trackPermissionRequested(userData?: UserData | null, data?: TrackingData): Promise<void>
  trackPermissionGranted(userData?: UserData | null, data?: TrackingData): Promise<void>
  trackPermissionDenied(userData?: UserData | null, data?: TrackingData): Promise<void>
  trackSubscriptionChange(
    subscription: PushSubscription | null,
    userData?: UserData | null
  ): Promise<void>
  trackSubscriptionCreated(userData?: UserData | null, subscription?: PushSubscription | TrackingData | null): Promise<void>
  trackNotificationClick(
    notificationId: string,
    userData?: UserData | null,
    data?: TrackingData
  ): Promise<void>
  trackNotificationAction(
    action: string,
    userData?: UserData | null,
    data?: TrackingData
  ): Promise<void>
  trackSettingsUpdated(userData?: UserData | null, data?: TrackingData): Promise<void>
  trackNotificationSent(userData?: UserData | null, data?: TrackingData): Promise<void>
  trackSubscriptionDeleted(userData?: UserData | null, data?: TrackingData): Promise<void>
}

declare const notificationTracker: NotificationTracker
export default notificationTracker
