/**
 * Tipos de base de datos generados desde db/schema.ts
 *
 * USO CON SUPABASE CLIENT:
 * const supabase = createClient<Database>(url, key)
 *
 * Esto habilita autocompletado y type-checking en queries:
 * supabase.from('user_profiles').select('email, full_name')
 */

import { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import * as schema from '@/db/schema'

// Tipos de SELECT (lectura)
export type UserProfile = InferSelectModel<typeof schema.userProfiles>
export type Question = InferSelectModel<typeof schema.questions>
export type Test = InferSelectModel<typeof schema.tests>
export type TestQuestion = InferSelectModel<typeof schema.testQuestions>
export type Topic = InferSelectModel<typeof schema.topics>
export type Law = InferSelectModel<typeof schema.laws>
export type Article = InferSelectModel<typeof schema.articles>
export type UserFeedback = InferSelectModel<typeof schema.userFeedback>
export type FeedbackConversation = InferSelectModel<typeof schema.feedbackConversations>
export type FeedbackMessage = InferSelectModel<typeof schema.feedbackMessages>
export type QuestionDispute = InferSelectModel<typeof schema.questionDisputes>
export type PsychometricQuestion = InferSelectModel<typeof schema.psychometricQuestions>
export type PsychometricQuestionDispute = InferSelectModel<typeof schema.psychometricQuestionDisputes>
export type EmailLog = InferSelectModel<typeof schema.emailLogs>
export type EmailEvent = InferSelectModel<typeof schema.emailEvents>
export type NotificationEvent = InferSelectModel<typeof schema.notificationEvents>
export type UserSubscription = InferSelectModel<typeof schema.userSubscriptions>
export type ConversionEvent = InferSelectModel<typeof schema.conversionEvents>
export type FraudAlert = InferSelectModel<typeof schema.fraudAlerts>
export type AiVerificationResult = InferSelectModel<typeof schema.aiVerificationResults>
export type HotArticle = InferSelectModel<typeof schema.hotArticles>
export type UserQuestionHistory = InferSelectModel<typeof schema.userQuestionHistory>
export type DeletedUsersLog = InferSelectModel<typeof schema.deletedUsersLog>
export type AiChatLog = InferSelectModel<typeof schema.aiChatLogs>
export type VerificationQueue = InferSelectModel<typeof schema.verificationQueue>

// Tipos de INSERT (escritura)
export type NewUserProfile = InferInsertModel<typeof schema.userProfiles>
export type NewQuestion = InferInsertModel<typeof schema.questions>
export type NewTest = InferInsertModel<typeof schema.tests>
export type NewTestQuestion = InferInsertModel<typeof schema.testQuestions>
export type NewUserFeedback = InferInsertModel<typeof schema.userFeedback>
export type NewQuestionDispute = InferInsertModel<typeof schema.questionDisputes>
export type NewEmailLog = InferInsertModel<typeof schema.emailLogs>
export type NewConversionEvent = InferInsertModel<typeof schema.conversionEvents>
export type NewFraudAlert = InferInsertModel<typeof schema.fraudAlerts>
export type NewDeletedUsersLog = InferInsertModel<typeof schema.deletedUsersLog>
export type NewAiChatLog = InferInsertModel<typeof schema.aiChatLogs>

// Tipo Database para Supabase client
// Nota: Este es un subset - añadir más tablas según necesidad
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile
        Insert: NewUserProfile
        Update: Partial<NewUserProfile>
      }
      questions: {
        Row: Question
        Insert: NewQuestion
        Update: Partial<NewQuestion>
      }
      tests: {
        Row: Test
        Insert: NewTest
        Update: Partial<NewTest>
      }
      test_questions: {
        Row: TestQuestion
        Insert: NewTestQuestion
        Update: Partial<NewTestQuestion>
      }
      topics: {
        Row: Topic
        Insert: Partial<Topic>
        Update: Partial<Topic>
      }
      laws: {
        Row: Law
        Insert: Partial<Law>
        Update: Partial<Law>
      }
      articles: {
        Row: Article
        Insert: Partial<Article>
        Update: Partial<Article>
      }
      user_feedback: {
        Row: UserFeedback
        Insert: NewUserFeedback
        Update: Partial<NewUserFeedback>
      }
      feedback_conversations: {
        Row: FeedbackConversation
        Insert: Partial<FeedbackConversation>
        Update: Partial<FeedbackConversation>
      }
      feedback_messages: {
        Row: FeedbackMessage
        Insert: Partial<FeedbackMessage>
        Update: Partial<FeedbackMessage>
      }
      question_disputes: {
        Row: QuestionDispute
        Insert: NewQuestionDispute
        Update: Partial<NewQuestionDispute>
      }
      psychometric_questions: {
        Row: PsychometricQuestion
        Insert: Partial<PsychometricQuestion>
        Update: Partial<PsychometricQuestion>
      }
      psychometric_question_disputes: {
        Row: PsychometricQuestionDispute
        Insert: Partial<PsychometricQuestionDispute>
        Update: Partial<PsychometricQuestionDispute>
      }
      email_logs: {
        Row: EmailLog
        Insert: NewEmailLog
        Update: Partial<NewEmailLog>
      }
      email_events: {
        Row: EmailEvent
        Insert: Partial<EmailEvent>
        Update: Partial<EmailEvent>
      }
      notification_events: {
        Row: NotificationEvent
        Insert: Partial<NotificationEvent>
        Update: Partial<NotificationEvent>
      }
      user_subscriptions: {
        Row: UserSubscription
        Insert: Partial<UserSubscription>
        Update: Partial<UserSubscription>
      }
      conversion_events: {
        Row: ConversionEvent
        Insert: NewConversionEvent
        Update: Partial<NewConversionEvent>
      }
      fraud_alerts: {
        Row: FraudAlert
        Insert: NewFraudAlert
        Update: Partial<NewFraudAlert>
      }
      ai_verification_results: {
        Row: AiVerificationResult
        Insert: Partial<AiVerificationResult>
        Update: Partial<AiVerificationResult>
      }
      hot_articles: {
        Row: HotArticle
        Insert: Partial<HotArticle>
        Update: Partial<HotArticle>
      }
      user_question_history: {
        Row: UserQuestionHistory
        Insert: Partial<UserQuestionHistory>
        Update: Partial<UserQuestionHistory>
      }
      deleted_users_log: {
        Row: DeletedUsersLog
        Insert: NewDeletedUsersLog
        Update: Partial<NewDeletedUsersLog>
      }
      ai_chat_logs: {
        Row: AiChatLog
        Insert: NewAiChatLog
        Update: Partial<NewAiChatLog>
      }
      verification_queue: {
        Row: VerificationQueue
        Insert: Partial<VerificationQueue>
        Update: Partial<VerificationQueue>
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
