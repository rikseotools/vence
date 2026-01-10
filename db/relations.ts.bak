import { relations } from "drizzle-orm/relations";
import { usersInAuth, conversionEvents, questions, problematicQuestionsTracking, userProfiles, telegramSession, articles, userProgress, laws, topics, userRecommendations, testConfigurations, topicScope, aiVerificationResults, userFeedback, questionArticles, oposiciones, convocatorias, userRoles, articulosExamenes, oposicionTopics, oposicionArticles, preguntasExamenesOficiales, lawVersions, articleVersions, legalModifications, testQuestions, tests, verificationSchedule, userTestSessions, feedbackConversations, articleExamStats, userLearningAnalytics, feedbackMessages, emailLogs, hotArticles, emailPreferences, emailUnsubscribeTokens, userSubscriptions, userQuestionHistory, userDifficultyMetrics, pwaSessions, pwaEvents, userStreaks, psychometricCategories, psychometricSections, psychometricQuestions, userNotificationSettings, userActivityPatterns, notificationTemplates, notificationLogs, notificationMetrics, userSmartScheduling, userMedals, questionDisputes, userNotificationMetrics, notificationEvents, customOposiciones, emailEvents, userPsychometricPreferences, psychometricTestSessions, psychometricTestAnswers, aiApiUsage, lawSections, telegramGroups, telegramAlerts, publicUserProfiles, psychometricUserQuestionHistory, upgradeMessages, upgradeMessageImpressions, contentCollections, contentSections, contentScope, motivationalMessages, userMessageInteractions, shareEvents, articleUpdateLogs, aiVerificationErrors, dailyQuestionUsage, questionFirstAttempts, psychometricFirstAttempts, lawQuestionFirstAttempts } from "./schema";

export const conversionEventsRelations = relations(conversionEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [conversionEvents.userId],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	conversionEvents: many(conversionEvents),
	problematicQuestionsTrackings: many(problematicQuestionsTracking),
	userProfiles: many(userProfiles),
	telegramSessions: many(telegramSession),
	aiVerificationResults: many(aiVerificationResults),
	userFeedbacks_adminUserId: many(userFeedback, {
		relationName: "userFeedback_adminUserId_usersInAuth_id"
	}),
	userFeedbacks_userId: many(userFeedback, {
		relationName: "userFeedback_userId_usersInAuth_id"
	}),
	userTestSessions: many(userTestSessions),
	emailPreferences: many(emailPreferences),
	userQuestionHistories: many(userQuestionHistory),
	userDifficultyMetrics: many(userDifficultyMetrics),
	pwaSessions: many(pwaSessions),
	pwaEvents: many(pwaEvents),
	userStreaks: many(userStreaks),
	userNotificationSettings: many(userNotificationSettings),
	userActivityPatterns: many(userActivityPatterns),
	notificationLogs: many(notificationLogs),
	userSmartSchedulings: many(userSmartScheduling),
	userMedals: many(userMedals),
	userNotificationMetrics: many(userNotificationMetrics),
	notificationEvents: many(notificationEvents),
	customOposiciones: many(customOposiciones),
	emailEvents: many(emailEvents),
	userPsychometricPreferences: many(userPsychometricPreferences),
	psychometricTestSessions: many(psychometricTestSessions),
	psychometricTestAnswers: many(psychometricTestAnswers),
	publicUserProfiles: many(publicUserProfiles),
	psychometricUserQuestionHistories: many(psychometricUserQuestionHistory),
	upgradeMessageImpressions: many(upgradeMessageImpressions),
	userMessageInteractions: many(userMessageInteractions),
	shareEvents: many(shareEvents),
	dailyQuestionUsages: many(dailyQuestionUsage),
	questionFirstAttempts: many(questionFirstAttempts),
	psychometricFirstAttempts: many(psychometricFirstAttempts),
	lawQuestionFirstAttempts: many(lawQuestionFirstAttempts),
}));

export const problematicQuestionsTrackingRelations = relations(problematicQuestionsTracking, ({one}) => ({
	question: one(questions, {
		fields: [problematicQuestionsTracking.questionId],
		references: [questions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [problematicQuestionsTracking.resolvedBy],
		references: [usersInAuth.id]
	}),
}));

export const questionsRelations = relations(questions, ({one, many}) => ({
	problematicQuestionsTrackings: many(problematicQuestionsTracking),
	aiVerificationResults: many(aiVerificationResults),
	questionArticles: many(questionArticles),
	testQuestions: many(testQuestions),
	userQuestionHistories: many(userQuestionHistory),
	questionDisputes: many(questionDisputes),
	article: one(articles, {
		fields: [questions.primaryArticleId],
		references: [articles.id]
	}),
	questionFirstAttempts: many(questionFirstAttempts),
	lawQuestionFirstAttempts: many(lawQuestionFirstAttempts),
}));

export const userProfilesRelations = relations(userProfiles, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userProfiles.id],
		references: [usersInAuth.id]
	}),
	userProgresses: many(userProgress),
	userRecommendations: many(userRecommendations),
	testConfigurations: many(testConfigurations),
	userRoles_grantedBy: many(userRoles, {
		relationName: "userRoles_grantedBy_userProfiles_id"
	}),
	userRoles_userId: many(userRoles, {
		relationName: "userRoles_userId_userProfiles_id"
	}),
	feedbackConversations_adminUserId: many(feedbackConversations, {
		relationName: "feedbackConversations_adminUserId_userProfiles_id"
	}),
	feedbackConversations_userId: many(feedbackConversations, {
		relationName: "feedbackConversations_userId_userProfiles_id"
	}),
	feedbackMessages: many(feedbackMessages),
	emailLogs: many(emailLogs),
	emailUnsubscribeTokens: many(emailUnsubscribeTokens),
	userSubscriptions: many(userSubscriptions),
	questionDisputes_adminUserId: many(questionDisputes, {
		relationName: "questionDisputes_adminUserId_userProfiles_id"
	}),
	questionDisputes_userId: many(questionDisputes, {
		relationName: "questionDisputes_userId_userProfiles_id"
	}),
	emailEvents: many(emailEvents),
	tests: many(tests),
}));

export const telegramSessionRelations = relations(telegramSession, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [telegramSession.userId],
		references: [usersInAuth.id]
	}),
}));

export const userProgressRelations = relations(userProgress, ({one}) => ({
	article: one(articles, {
		fields: [userProgress.articleId],
		references: [articles.id]
	}),
	law: one(laws, {
		fields: [userProgress.lawId],
		references: [laws.id]
	}),
	topic: one(topics, {
		fields: [userProgress.topicId],
		references: [topics.id]
	}),
	userProfile: one(userProfiles, {
		fields: [userProgress.userId],
		references: [userProfiles.id]
	}),
}));

export const articlesRelations = relations(articles, ({one, many}) => ({
	userProgresses: many(userProgress),
	userRecommendations: many(userRecommendations),
	law: one(laws, {
		fields: [articles.lawId],
		references: [laws.id]
	}),
	aiVerificationResults: many(aiVerificationResults),
	questionArticles: many(questionArticles),
	articulosExamenes: many(articulosExamenes),
	oposicionArticles: many(oposicionArticles),
	preguntasExamenesOficiales: many(preguntasExamenesOficiales),
	articleVersions: many(articleVersions),
	testQuestions: many(testQuestions),
	articleExamStats: many(articleExamStats),
	userLearningAnalytics: many(userLearningAnalytics),
	hotArticles: many(hotArticles),
	questions: many(questions),
	articleUpdateLogs: many(articleUpdateLogs),
}));

export const lawsRelations = relations(laws, ({many}) => ({
	userProgresses: many(userProgress),
	articles: many(articles),
	topicScopes: many(topicScope),
	aiVerificationResults: many(aiVerificationResults),
	lawVersions: many(lawVersions),
	verificationSchedules: many(verificationSchedule),
	hotArticles: many(hotArticles),
	aiApiUsages: many(aiApiUsage),
	lawSections: many(lawSections),
	contentScopes: many(contentScope),
	articleUpdateLogs: many(articleUpdateLogs),
	aiVerificationErrors: many(aiVerificationErrors),
}));

export const topicsRelations = relations(topics, ({many}) => ({
	userProgresses: many(userProgress),
	userRecommendations: many(userRecommendations),
	testConfigurations: many(testConfigurations),
	topicScopes: many(topicScope),
	oposicionTopics: many(oposicionTopics),
}));

export const userRecommendationsRelations = relations(userRecommendations, ({one}) => ({
	article: one(articles, {
		fields: [userRecommendations.articleId],
		references: [articles.id]
	}),
	topic: one(topics, {
		fields: [userRecommendations.topicId],
		references: [topics.id]
	}),
	userProfile: one(userProfiles, {
		fields: [userRecommendations.userId],
		references: [userProfiles.id]
	}),
}));

export const testConfigurationsRelations = relations(testConfigurations, ({one}) => ({
	topic: one(topics, {
		fields: [testConfigurations.topicId],
		references: [topics.id]
	}),
	userProfile: one(userProfiles, {
		fields: [testConfigurations.userId],
		references: [userProfiles.id]
	}),
}));

export const topicScopeRelations = relations(topicScope, ({one}) => ({
	law: one(laws, {
		fields: [topicScope.lawId],
		references: [laws.id]
	}),
	topic: one(topics, {
		fields: [topicScope.topicId],
		references: [topics.id]
	}),
}));

export const aiVerificationResultsRelations = relations(aiVerificationResults, ({one}) => ({
	article: one(articles, {
		fields: [aiVerificationResults.articleId],
		references: [articles.id]
	}),
	law: one(laws, {
		fields: [aiVerificationResults.lawId],
		references: [laws.id]
	}),
	question: one(questions, {
		fields: [aiVerificationResults.questionId],
		references: [questions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [aiVerificationResults.verifiedBy],
		references: [usersInAuth.id]
	}),
}));

export const userFeedbackRelations = relations(userFeedback, ({one, many}) => ({
	usersInAuth_adminUserId: one(usersInAuth, {
		fields: [userFeedback.adminUserId],
		references: [usersInAuth.id],
		relationName: "userFeedback_adminUserId_usersInAuth_id"
	}),
	usersInAuth_userId: one(usersInAuth, {
		fields: [userFeedback.userId],
		references: [usersInAuth.id],
		relationName: "userFeedback_userId_usersInAuth_id"
	}),
	feedbackConversations: many(feedbackConversations),
}));

export const questionArticlesRelations = relations(questionArticles, ({one}) => ({
	article: one(articles, {
		fields: [questionArticles.articleId],
		references: [articles.id]
	}),
	question: one(questions, {
		fields: [questionArticles.questionId],
		references: [questions.id]
	}),
}));

export const convocatoriasRelations = relations(convocatorias, ({one, many}) => ({
	oposicione: one(oposiciones, {
		fields: [convocatorias.oposicionId],
		references: [oposiciones.id]
	}),
	articulosExamenes: many(articulosExamenes),
	preguntasExamenesOficiales: many(preguntasExamenesOficiales),
}));

export const oposicionesRelations = relations(oposiciones, ({many}) => ({
	convocatorias: many(convocatorias),
	oposicionTopics: many(oposicionTopics),
	oposicionArticles: many(oposicionArticles),
	articleExamStats: many(articleExamStats),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	userProfile_grantedBy: one(userProfiles, {
		fields: [userRoles.grantedBy],
		references: [userProfiles.id],
		relationName: "userRoles_grantedBy_userProfiles_id"
	}),
	userProfile_userId: one(userProfiles, {
		fields: [userRoles.userId],
		references: [userProfiles.id],
		relationName: "userRoles_userId_userProfiles_id"
	}),
}));

export const articulosExamenesRelations = relations(articulosExamenes, ({one}) => ({
	article: one(articles, {
		fields: [articulosExamenes.articleId],
		references: [articles.id]
	}),
	convocatoria: one(convocatorias, {
		fields: [articulosExamenes.convocatoriaId],
		references: [convocatorias.id]
	}),
}));

export const oposicionTopicsRelations = relations(oposicionTopics, ({one}) => ({
	oposicione: one(oposiciones, {
		fields: [oposicionTopics.oposicionId],
		references: [oposiciones.id]
	}),
	topic: one(topics, {
		fields: [oposicionTopics.topicId],
		references: [topics.id]
	}),
}));

export const oposicionArticlesRelations = relations(oposicionArticles, ({one}) => ({
	article: one(articles, {
		fields: [oposicionArticles.articleId],
		references: [articles.id]
	}),
	oposicione: one(oposiciones, {
		fields: [oposicionArticles.oposicionId],
		references: [oposiciones.id]
	}),
}));

export const preguntasExamenesOficialesRelations = relations(preguntasExamenesOficiales, ({one}) => ({
	article: one(articles, {
		fields: [preguntasExamenesOficiales.articleId],
		references: [articles.id]
	}),
	convocatoria: one(convocatorias, {
		fields: [preguntasExamenesOficiales.convocatoriaId],
		references: [convocatorias.id]
	}),
}));

export const lawVersionsRelations = relations(lawVersions, ({one, many}) => ({
	law: one(laws, {
		fields: [lawVersions.lawId],
		references: [laws.id]
	}),
	articleVersions: many(articleVersions),
	legalModifications: many(legalModifications),
}));

export const articleVersionsRelations = relations(articleVersions, ({one}) => ({
	article: one(articles, {
		fields: [articleVersions.articleId],
		references: [articles.id]
	}),
	lawVersion: one(lawVersions, {
		fields: [articleVersions.lawVersionId],
		references: [lawVersions.id]
	}),
}));

export const legalModificationsRelations = relations(legalModifications, ({one}) => ({
	lawVersion: one(lawVersions, {
		fields: [legalModifications.lawVersionId],
		references: [lawVersions.id]
	}),
}));

export const testQuestionsRelations = relations(testQuestions, ({one}) => ({
	article: one(articles, {
		fields: [testQuestions.articleId],
		references: [articles.id]
	}),
	question: one(questions, {
		fields: [testQuestions.questionId],
		references: [questions.id]
	}),
	test: one(tests, {
		fields: [testQuestions.testId],
		references: [tests.id]
	}),
}));

export const testsRelations = relations(tests, ({one, many}) => ({
	testQuestions: many(testQuestions),
	userProfile: one(userProfiles, {
		fields: [tests.userId],
		references: [userProfiles.id]
	}),
}));

export const verificationScheduleRelations = relations(verificationSchedule, ({one}) => ({
	law: one(laws, {
		fields: [verificationSchedule.lawId],
		references: [laws.id]
	}),
}));

export const userTestSessionsRelations = relations(userTestSessions, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userTestSessions.userId],
		references: [usersInAuth.id]
	}),
}));

export const feedbackConversationsRelations = relations(feedbackConversations, ({one, many}) => ({
	userProfile_adminUserId: one(userProfiles, {
		fields: [feedbackConversations.adminUserId],
		references: [userProfiles.id],
		relationName: "feedbackConversations_adminUserId_userProfiles_id"
	}),
	userFeedback: one(userFeedback, {
		fields: [feedbackConversations.feedbackId],
		references: [userFeedback.id]
	}),
	userProfile_userId: one(userProfiles, {
		fields: [feedbackConversations.userId],
		references: [userProfiles.id],
		relationName: "feedbackConversations_userId_userProfiles_id"
	}),
	feedbackMessages: many(feedbackMessages),
}));

export const articleExamStatsRelations = relations(articleExamStats, ({one}) => ({
	article: one(articles, {
		fields: [articleExamStats.articleId],
		references: [articles.id]
	}),
	oposicione: one(oposiciones, {
		fields: [articleExamStats.oposicionId],
		references: [oposiciones.id]
	}),
}));

export const userLearningAnalyticsRelations = relations(userLearningAnalytics, ({one}) => ({
	article: one(articles, {
		fields: [userLearningAnalytics.articleId],
		references: [articles.id]
	}),
}));

export const feedbackMessagesRelations = relations(feedbackMessages, ({one}) => ({
	feedbackConversation: one(feedbackConversations, {
		fields: [feedbackMessages.conversationId],
		references: [feedbackConversations.id]
	}),
	userProfile: one(userProfiles, {
		fields: [feedbackMessages.senderId],
		references: [userProfiles.id]
	}),
}));

export const emailLogsRelations = relations(emailLogs, ({one}) => ({
	userProfile: one(userProfiles, {
		fields: [emailLogs.userId],
		references: [userProfiles.id]
	}),
}));

export const hotArticlesRelations = relations(hotArticles, ({one}) => ({
	article: one(articles, {
		fields: [hotArticles.articleId],
		references: [articles.id]
	}),
	law: one(laws, {
		fields: [hotArticles.lawId],
		references: [laws.id]
	}),
}));

export const emailPreferencesRelations = relations(emailPreferences, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [emailPreferences.userId],
		references: [usersInAuth.id]
	}),
}));

export const emailUnsubscribeTokensRelations = relations(emailUnsubscribeTokens, ({one}) => ({
	userProfile: one(userProfiles, {
		fields: [emailUnsubscribeTokens.userId],
		references: [userProfiles.id]
	}),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({one}) => ({
	userProfile: one(userProfiles, {
		fields: [userSubscriptions.userId],
		references: [userProfiles.id]
	}),
}));

export const userQuestionHistoryRelations = relations(userQuestionHistory, ({one}) => ({
	question: one(questions, {
		fields: [userQuestionHistory.questionId],
		references: [questions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [userQuestionHistory.userId],
		references: [usersInAuth.id]
	}),
}));

export const userDifficultyMetricsRelations = relations(userDifficultyMetrics, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userDifficultyMetrics.userId],
		references: [usersInAuth.id]
	}),
}));

export const pwaSessionsRelations = relations(pwaSessions, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [pwaSessions.userId],
		references: [usersInAuth.id]
	}),
}));

export const pwaEventsRelations = relations(pwaEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [pwaEvents.userId],
		references: [usersInAuth.id]
	}),
}));

export const userStreaksRelations = relations(userStreaks, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userStreaks.userId],
		references: [usersInAuth.id]
	}),
}));

export const psychometricSectionsRelations = relations(psychometricSections, ({one, many}) => ({
	psychometricCategory: one(psychometricCategories, {
		fields: [psychometricSections.categoryId],
		references: [psychometricCategories.id]
	}),
	psychometricQuestions: many(psychometricQuestions),
}));

export const psychometricCategoriesRelations = relations(psychometricCategories, ({many}) => ({
	psychometricSections: many(psychometricSections),
	psychometricQuestions: many(psychometricQuestions),
}));

export const psychometricQuestionsRelations = relations(psychometricQuestions, ({one, many}) => ({
	psychometricCategory: one(psychometricCategories, {
		fields: [psychometricQuestions.categoryId],
		references: [psychometricCategories.id]
	}),
	psychometricSection: one(psychometricSections, {
		fields: [psychometricQuestions.sectionId],
		references: [psychometricSections.id]
	}),
	psychometricTestAnswers: many(psychometricTestAnswers),
	psychometricUserQuestionHistories: many(psychometricUserQuestionHistory),
	psychometricFirstAttempts: many(psychometricFirstAttempts),
}));

export const userNotificationSettingsRelations = relations(userNotificationSettings, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userNotificationSettings.userId],
		references: [usersInAuth.id]
	}),
}));

export const userActivityPatternsRelations = relations(userActivityPatterns, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userActivityPatterns.userId],
		references: [usersInAuth.id]
	}),
}));

export const notificationLogsRelations = relations(notificationLogs, ({one}) => ({
	notificationTemplate: one(notificationTemplates, {
		fields: [notificationLogs.templateId],
		references: [notificationTemplates.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [notificationLogs.userId],
		references: [usersInAuth.id]
	}),
}));

export const notificationTemplatesRelations = relations(notificationTemplates, ({many}) => ({
	notificationLogs: many(notificationLogs),
	notificationMetrics: many(notificationMetrics),
}));

export const notificationMetricsRelations = relations(notificationMetrics, ({one}) => ({
	notificationTemplate: one(notificationTemplates, {
		fields: [notificationMetrics.templateId],
		references: [notificationTemplates.id]
	}),
}));

export const userSmartSchedulingRelations = relations(userSmartScheduling, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userSmartScheduling.userId],
		references: [usersInAuth.id]
	}),
}));

export const userMedalsRelations = relations(userMedals, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userMedals.userId],
		references: [usersInAuth.id]
	}),
}));

export const questionDisputesRelations = relations(questionDisputes, ({one}) => ({
	userProfile_adminUserId: one(userProfiles, {
		fields: [questionDisputes.adminUserId],
		references: [userProfiles.id],
		relationName: "questionDisputes_adminUserId_userProfiles_id"
	}),
	question: one(questions, {
		fields: [questionDisputes.questionId],
		references: [questions.id]
	}),
	userProfile_userId: one(userProfiles, {
		fields: [questionDisputes.userId],
		references: [userProfiles.id],
		relationName: "questionDisputes_userId_userProfiles_id"
	}),
}));

export const userNotificationMetricsRelations = relations(userNotificationMetrics, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userNotificationMetrics.userId],
		references: [usersInAuth.id]
	}),
}));

export const notificationEventsRelations = relations(notificationEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [notificationEvents.userId],
		references: [usersInAuth.id]
	}),
}));

export const customOposicionesRelations = relations(customOposiciones, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [customOposiciones.userId],
		references: [usersInAuth.id]
	}),
}));

export const emailEventsRelations = relations(emailEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [emailEvents.userId],
		references: [usersInAuth.id]
	}),
	userProfile: one(userProfiles, {
		fields: [emailEvents.userId],
		references: [userProfiles.id]
	}),
}));

export const userPsychometricPreferencesRelations = relations(userPsychometricPreferences, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userPsychometricPreferences.userId],
		references: [usersInAuth.id]
	}),
}));

export const psychometricTestSessionsRelations = relations(psychometricTestSessions, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [psychometricTestSessions.userId],
		references: [usersInAuth.id]
	}),
	psychometricTestAnswers: many(psychometricTestAnswers),
}));

export const psychometricTestAnswersRelations = relations(psychometricTestAnswers, ({one}) => ({
	psychometricQuestion: one(psychometricQuestions, {
		fields: [psychometricTestAnswers.questionId],
		references: [psychometricQuestions.id]
	}),
	psychometricTestSession: one(psychometricTestSessions, {
		fields: [psychometricTestAnswers.testSessionId],
		references: [psychometricTestSessions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [psychometricTestAnswers.userId],
		references: [usersInAuth.id]
	}),
}));

export const aiApiUsageRelations = relations(aiApiUsage, ({one}) => ({
	law: one(laws, {
		fields: [aiApiUsage.lawId],
		references: [laws.id]
	}),
}));

export const lawSectionsRelations = relations(lawSections, ({one}) => ({
	law: one(laws, {
		fields: [lawSections.lawId],
		references: [laws.id]
	}),
}));

export const telegramAlertsRelations = relations(telegramAlerts, ({one}) => ({
	telegramGroup: one(telegramGroups, {
		fields: [telegramAlerts.groupId],
		references: [telegramGroups.id]
	}),
}));

export const telegramGroupsRelations = relations(telegramGroups, ({many}) => ({
	telegramAlerts: many(telegramAlerts),
}));

export const publicUserProfilesRelations = relations(publicUserProfiles, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [publicUserProfiles.id],
		references: [usersInAuth.id]
	}),
}));

export const psychometricUserQuestionHistoryRelations = relations(psychometricUserQuestionHistory, ({one}) => ({
	psychometricQuestion: one(psychometricQuestions, {
		fields: [psychometricUserQuestionHistory.questionId],
		references: [psychometricQuestions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [psychometricUserQuestionHistory.userId],
		references: [usersInAuth.id]
	}),
}));

export const upgradeMessageImpressionsRelations = relations(upgradeMessageImpressions, ({one}) => ({
	upgradeMessage: one(upgradeMessages, {
		fields: [upgradeMessageImpressions.messageId],
		references: [upgradeMessages.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [upgradeMessageImpressions.userId],
		references: [usersInAuth.id]
	}),
}));

export const upgradeMessagesRelations = relations(upgradeMessages, ({many}) => ({
	upgradeMessageImpressions: many(upgradeMessageImpressions),
}));

export const contentSectionsRelations = relations(contentSections, ({one, many}) => ({
	contentCollection: one(contentCollections, {
		fields: [contentSections.collectionId],
		references: [contentCollections.id]
	}),
	contentScopes: many(contentScope),
}));

export const contentCollectionsRelations = relations(contentCollections, ({many}) => ({
	contentSections: many(contentSections),
	contentScopes: many(contentScope),
}));

export const contentScopeRelations = relations(contentScope, ({one}) => ({
	contentCollection: one(contentCollections, {
		fields: [contentScope.collectionId],
		references: [contentCollections.id]
	}),
	law: one(laws, {
		fields: [contentScope.lawId],
		references: [laws.id]
	}),
	contentSection: one(contentSections, {
		fields: [contentScope.sectionId],
		references: [contentSections.id]
	}),
}));

export const userMessageInteractionsRelations = relations(userMessageInteractions, ({one}) => ({
	motivationalMessage: one(motivationalMessages, {
		fields: [userMessageInteractions.messageId],
		references: [motivationalMessages.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [userMessageInteractions.userId],
		references: [usersInAuth.id]
	}),
}));

export const motivationalMessagesRelations = relations(motivationalMessages, ({many}) => ({
	userMessageInteractions: many(userMessageInteractions),
}));

export const shareEventsRelations = relations(shareEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [shareEvents.userId],
		references: [usersInAuth.id]
	}),
}));

export const articleUpdateLogsRelations = relations(articleUpdateLogs, ({one}) => ({
	article: one(articles, {
		fields: [articleUpdateLogs.articleId],
		references: [articles.id]
	}),
	law: one(laws, {
		fields: [articleUpdateLogs.lawId],
		references: [laws.id]
	}),
}));

export const aiVerificationErrorsRelations = relations(aiVerificationErrors, ({one}) => ({
	law: one(laws, {
		fields: [aiVerificationErrors.lawId],
		references: [laws.id]
	}),
}));

export const dailyQuestionUsageRelations = relations(dailyQuestionUsage, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [dailyQuestionUsage.userId],
		references: [usersInAuth.id]
	}),
}));

export const questionFirstAttemptsRelations = relations(questionFirstAttempts, ({one}) => ({
	question: one(questions, {
		fields: [questionFirstAttempts.questionId],
		references: [questions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [questionFirstAttempts.userId],
		references: [usersInAuth.id]
	}),
}));

export const psychometricFirstAttemptsRelations = relations(psychometricFirstAttempts, ({one}) => ({
	psychometricQuestion: one(psychometricQuestions, {
		fields: [psychometricFirstAttempts.questionId],
		references: [psychometricQuestions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [psychometricFirstAttempts.userId],
		references: [usersInAuth.id]
	}),
}));

export const lawQuestionFirstAttemptsRelations = relations(lawQuestionFirstAttempts, ({one}) => ({
	question: one(questions, {
		fields: [lawQuestionFirstAttempts.questionId],
		references: [questions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [lawQuestionFirstAttempts.userId],
		references: [usersInAuth.id]
	}),
}));