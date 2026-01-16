// hooks/useIntelligentNotifications.types.ts - Tipos TypeScript para el sistema de notificaciones

import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TIPOS DE NOTIFICACIÓN
// ============================================

export type NotificationTypeId =
  | 'level_regression'
  | 'problematic_articles'
  | 'achievement'
  | 'improvement'
  | 'dispute_update'
  | 'feedback_response'
  | 'new_content'
  | 'avatar_rotation'
  | 'study_streak'
  | 'streak_broken'
  | 'progress_update'
  | 'daily_progress'
  | 'accuracy_improvement'
  | 'speed_improvement'
  | 'articles_mastered'
  | 'study_consistency'
  | 'learning_variety'
  | 'constructive_progress'

export type NotificationPriority = number // 0-100

export type NotificationColor = 'red' | 'orange' | 'yellow' | 'blue' | 'green' | 'purple' | 'gray'

// ============================================
// ESTRUCTURA DE ACCIÓN
// ============================================

export interface NotificationAction {
  label: string
  type: string
  url?: string
}

// ============================================
// CONFIGURACIÓN DE TIPO DE NOTIFICACIÓN
// ============================================

export interface NotificationTypeConfig {
  priority: NotificationPriority
  icon: string
  color: NotificationColor
  bgColor: string
  textColor: string
  borderColor: string
  primaryAction?: NotificationAction
  secondaryAction?: NotificationAction
}

// Mapa parcial - no todos los tipos necesitan estar definidos
export type NotificationTypesMap = Partial<Record<NotificationTypeId, NotificationTypeConfig>>

// ============================================
// NOTIFICACIÓN BASE - Con todos los campos posibles
// ============================================

export interface Notification {
  id: string
  type: NotificationTypeId | string
  title: string
  message?: string
  body?: string
  timestamp: string
  isRead: boolean
  isDismissed?: boolean
  priority: NotificationPriority
  icon?: string
  color?: NotificationColor
  bgColor?: string
  textColor?: string
  borderColor?: string
  primaryAction?: NotificationAction
  secondaryAction?: NotificationAction
  campaign?: string

  // Campos para artículos problemáticos
  article?: string
  article_id?: string
  law_short_name?: string
  law_full_name?: string
  accuracy?: number
  attempts?: number
  articlesCount?: number
  articlesList?: Array<{
    article_number: string
    accuracy_percentage: number
    law_short_name?: string
    [key: string]: unknown
  }>

  // Campos para logros y rachas
  streak_days?: number
  tests_count?: number
  avg_score?: number

  // Campos para impugnaciones
  disputeId?: string
  dispute_status?: 'resolved' | 'rejected' | 'pending' | string
  question_id?: string
  isPsychometric?: boolean
  canAppeal?: boolean
  status?: string

  // Campos para feedback
  context_data?: {
    conversation_id?: string
    title?: string
    type?: string
    [key: string]: unknown
  }
  data?: {
    conversation_id?: string
    [key: string]: unknown
  }

  // Campos para avatar
  avatarEmoji?: string
  avatarName?: string
  previousEmoji?: string | null

  // Campos adicionales genéricos
  [key: string]: unknown
}

// ============================================
// ALIAS PARA COMPATIBILIDAD
// ============================================

export type BaseNotification = Notification
export type ProblematicArticleNotification = Notification
export type AchievementNotification = Notification
export type DisputeNotification = Notification
export type FeedbackNotification = Notification
export type AvatarRotationNotification = Notification
export type StudyStreakNotification = Notification
export type MotivationalNotification = Notification
export type SystemNotification = Notification

// ============================================
// NOTIFICACIONES CATEGORIZADAS
// ============================================

export interface CategorizedNotifications {
  critical: Notification[]
  important: Notification[]
  recommendations: Notification[]
  info: Notification[]
}

// ============================================
// ESTADO DEL HOOK
// ============================================

export interface UseIntelligentNotificationsState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  categorizedNotifications: CategorizedNotifications
  lastUpdate: Date | null
}

// ============================================
// RETORNO DEL HOOK
// ============================================

export interface UseIntelligentNotificationsReturn {
  // Estados principales
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  lastUpdate: Date | null

  // Por categorías
  categorizedNotifications: CategorizedNotifications

  // Por tipo específico
  problematicArticles: Notification[]
  achievements: Notification[]
  studyReminders: Notification[]
  motivationalNotifications: Notification[]
  systemNotifications: Notification[]

  // Funciones de acción
  executeAction: (notification: Notification, actionType?: 'primary' | 'secondary') => Promise<void>
  getNotificationActions: (notification: Notification) => {
    primary?: NotificationAction & { url: string }
    secondary?: NotificationAction & { url: string } | null
  }
  generateActionUrl: (notification: Notification, actionType?: string) => string
  getActionStats: () => {
    totalNotifications: number
    criticalCount: number
    importantCount: number
    recommendationsCount: number
    infoCount: number
    hasActions: number
  }

  // Funciones existentes
  loadAllNotifications: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  dismissNotification: (notificationId: string) => void

  // Funciones de gestión
  clearDismissedNotifications: () => void
  getDismissedStats: () => Set<string>

  // Funciones de testing (solo desarrollo)
  injectTestNotification?: (notification: Partial<Notification>) => void
  clearAllNotifications?: () => void

  // Configuración
  notificationTypes: NotificationTypesMap
}

// ============================================
// DATOS DE COOLDOWN
// ============================================

export interface CooldownData {
  lastShown: number
  testsAtLastShown: number
  lawShortName?: string
  articleNumber?: string
  accuracy?: number
}

export interface AchievementCooldownData {
  dailyCount: number
  lastShownDate: string
}

export interface MotivationalCooldownData {
  [notificationType: string]: {
    lastShown: number
    userId: string
  }
}

// ============================================
// DATOS DE LOCALSTORAGE
// ============================================

export interface DismissedNotificationsData {
  notifications: string[]
  timestamp: number
}

export interface ReadNotificationsData {
  [notificationId: string]: {
    readAt: string
    userId?: string
  }
}

// ============================================
// PROPS Y PARÁMETROS
// ============================================

export interface NotificationEmailPayload {
  userEmail: string
  userName: string
  messageType: string
  title: string
  body: string
  primaryAction?: NotificationAction
  secondaryAction?: NotificationAction
  userId: string
}

// ============================================
// EXPORTS DE UTILIDADES
// ============================================

export interface ActionTimeEstimates {
  [actionType: string]: string
}

export interface ActionIcons {
  [actionType: string]: string
}
