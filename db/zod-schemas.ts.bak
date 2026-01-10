// db/zod-schemas.ts - Schemas de validación Zod generados desde Drizzle
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import {
  userProfiles,
  questions,
  testSessions,
  detailedAnswers,
  articles,
  laws,
  topics,
  disputes,
  feedback,
} from './schema'

// ============================================
// USER PROFILES
// ============================================
export const insertUserProfileSchema = createInsertSchema(userProfiles, {
  email: z.string().email('Email inválido'),
  fullName: z.string().min(2, 'Nombre muy corto').optional(),
  studyGoal: z.number().min(1).max(100).optional(),
})
export const selectUserProfileSchema = createSelectSchema(userProfiles)
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>
export type SelectUserProfile = z.infer<typeof selectUserProfileSchema>

// ============================================
// QUESTIONS
// ============================================
export const insertQuestionSchema = createInsertSchema(questions, {
  question: z.string().min(10, 'Pregunta muy corta'),
  optionA: z.string().min(1, 'Opción A requerida'),
  optionB: z.string().min(1, 'Opción B requerida'),
  optionC: z.string().min(1, 'Opción C requerida'),
  optionD: z.string().min(1, 'Opción D requerida'),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
})
export const selectQuestionSchema = createSelectSchema(questions)
export type InsertQuestion = z.infer<typeof insertQuestionSchema>
export type SelectQuestion = z.infer<typeof selectQuestionSchema>

// ============================================
// TEST SESSIONS
// ============================================
export const insertTestSessionSchema = createInsertSchema(testSessions)
export const selectTestSessionSchema = createSelectSchema(testSessions)
export type InsertTestSession = z.infer<typeof insertTestSessionSchema>
export type SelectTestSession = z.infer<typeof selectTestSessionSchema>

// ============================================
// DETAILED ANSWERS
// ============================================
export const insertDetailedAnswerSchema = createInsertSchema(detailedAnswers)
export const selectDetailedAnswerSchema = createSelectSchema(detailedAnswers)
export type InsertDetailedAnswer = z.infer<typeof insertDetailedAnswerSchema>
export type SelectDetailedAnswer = z.infer<typeof selectDetailedAnswerSchema>

// ============================================
// ARTICLES
// ============================================
export const insertArticleSchema = createInsertSchema(articles, {
  articleNumber: z.string().min(1, 'Número de artículo requerido'),
  title: z.string().min(3, 'Título muy corto'),
})
export const selectArticleSchema = createSelectSchema(articles)
export type InsertArticle = z.infer<typeof insertArticleSchema>
export type SelectArticle = z.infer<typeof selectArticleSchema>

// ============================================
// LAWS
// ============================================
export const insertLawSchema = createInsertSchema(laws, {
  name: z.string().min(3, 'Nombre muy corto'),
  slug: z.string().min(2, 'Slug muy corto'),
})
export const selectLawSchema = createSelectSchema(laws)
export type InsertLaw = z.infer<typeof insertLawSchema>
export type SelectLaw = z.infer<typeof selectLawSchema>

// ============================================
// TOPICS
// ============================================
export const insertTopicSchema = createInsertSchema(topics, {
  title: z.string().min(5, 'Título muy corto'),
  topicNumber: z.number().min(1).max(100),
})
export const selectTopicSchema = createSelectSchema(topics)
export type InsertTopic = z.infer<typeof insertTopicSchema>
export type SelectTopic = z.infer<typeof selectTopicSchema>

// ============================================
// DISPUTES (Impugnaciones)
// ============================================
export const insertDisputeSchema = createInsertSchema(disputes, {
  reason: z.string().min(10, 'Razón muy corta'),
})
export const selectDisputeSchema = createSelectSchema(disputes)
export type InsertDispute = z.infer<typeof insertDisputeSchema>
export type SelectDispute = z.infer<typeof selectDisputeSchema>

// ============================================
// FEEDBACK
// ============================================
export const insertFeedbackSchema = createInsertSchema(feedback, {
  message: z.string().min(5, 'Mensaje muy corto'),
})
export const selectFeedbackSchema = createSelectSchema(feedback)
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>
export type SelectFeedback = z.infer<typeof selectFeedbackSchema>
