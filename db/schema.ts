import { pgTable, pgSchema, index, foreignKey, pgPolicy, uuid, text, jsonb, integer, timestamp, unique, check, boolean, varchar, numeric, date, uniqueIndex, interval, inet, point, serial, time, bigint, primaryKey, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Referencia a la tabla auth.users de Supabase (schema auth)
const authSchema = pgSchema("auth")
export const users = authSchema.table("users", {
  id: uuid().primaryKey().notNull(),
})

export const difficultyLevel = pgEnum("difficulty_level", ['easy', 'medium', 'hard', 'extreme'])


export const conversionEvents = pgTable("conversion_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	eventType: text("event_type").notNull(),
	eventData: jsonb("event_data").default({}),
	daysSinceRegistration: integer("days_since_registration").default(0),
	registrationSource: text("registration_source"),
	planType: text("plan_type"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_conversion_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_conversion_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_conversion_limit_reached_user").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(event_type = 'limit_reached'::text)`),
	index("idx_conversion_source").using("btree", table.registrationSource.asc().nullsLast().op("text_ops")),
	index("idx_conversion_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "conversion_events_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view own conversion events", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Service can insert conversion events", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Admins can view all conversion events", { as: "permissive", for: "select", to: ["public"] }),
]);

export const topics = pgTable("topics", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	positionType: text("position_type").notNull(),
	topicNumber: integer("topic_number").notNull(),
	title: text().notNull(),
	description: text(),
	difficulty: text().default('medium'),
	estimatedHours: integer("estimated_hours").default(10),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("topics_position_type_topic_number_key").on(table.positionType, table.topicNumber),
	pgPolicy("Enable read access for topics", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	check("topics_difficulty_check", sql`difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text, 'extreme'::text])`),
]);

export const problematicQuestionsTracking = pgTable("problematic_questions_tracking", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	questionId: uuid("question_id"),
	detectionType: varchar("detection_type", { length: 50 }).notNull(),
	failureRate: numeric("failure_rate", { precision: 5, scale:  2 }),
	abandonmentRate: numeric("abandonment_rate", { precision: 5, scale:  2 }),
	usersAffected: integer("users_affected"),
	totalAttempts: integer("total_attempts"),
	status: varchar({ length: 20 }).default('pending'),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	resolvedBy: uuid("resolved_by"),
	adminNotes: text("admin_notes"),
	resolutionAction: varchar("resolution_action", { length: 50 }),
	redetectionThresholdUsers: integer("redetection_threshold_users").default(5),
	detectedAt: timestamp("detected_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "problematic_questions_tracking_question_id_fkey"
		}),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "problematic_questions_tracking_resolved_by_fkey"
		}),
]);

export const userProfiles = pgTable("user_profiles", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	preferredLanguage: text("preferred_language").default('es'),
	studyGoal: integer("study_goal").default(25),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	targetOposicion: text("target_oposicion"),
	targetOposicionData: jsonb("target_oposicion_data"),
	firstOposicionDetectedAt: timestamp("first_oposicion_detected_at", { withTimezone: true, mode: 'string' }),
	isActiveStudent: boolean("is_active_student").default(false),
	firstTestCompletedAt: timestamp("first_test_completed_at", { withTimezone: true, mode: 'string' }),
	planType: text("plan_type").default('free'),
	registrationDate: timestamp("registration_date", { withTimezone: true, mode: 'string' }).defaultNow(),
	trialEndDate: timestamp("trial_end_date", { withTimezone: true, mode: 'string' }),
	stripeCustomerId: text("stripe_customer_id"),
	registrationSource: text("registration_source").default('organic'),
	requiresPayment: boolean("requires_payment").default(false),
	nickname: text(),
	age: integer(),
	gender: text(),
	dailyStudyHours: integer("daily_study_hours"),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: 'string' }),
	ciudad: text(),
	onboardingSkipCount: integer("onboarding_skip_count").default(0),
	onboardingLastSkipAt: timestamp("onboarding_last_skip_at", { withTimezone: true, mode: 'string' }),
	registrationIp: varchar("registration_ip", { length: 45 }),
}, (table) => [
	index("idx_user_profiles_active_student").using("btree", table.isActiveStudent.asc().nullsLast().op("bool_ops")).where(sql`(is_active_student = true)`),
	index("idx_user_profiles_ciudad").using("btree", table.ciudad.asc().nullsLast().op("text_ops")),
	index("idx_user_profiles_onboarding").using("btree", table.onboardingCompletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(onboarding_completed_at IS NOT NULL)`),
	index("idx_user_profiles_onboarding_skip").using("btree", table.onboardingSkipCount.asc().nullsLast().op("int4_ops")),
	index("idx_user_profiles_target_oposicion").using("btree", table.targetOposicion.asc().nullsLast().op("text_ops")).where(sql`(target_oposicion IS NOT NULL)`),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "user_profiles_id_fkey"
		}).onDelete("cascade"),
	unique("user_profiles_email_key").on(table.email),
	pgPolicy("Users can insert their own profile", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(auth.uid() = id)`  }),
	pgPolicy("Users can update own profile", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can view own profile", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Admins can view all profiles", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("user_profiles_daily_study_hours_check", sql`(daily_study_hours >= 0) AND (daily_study_hours <= 12)`),
	check("user_profiles_gender_check", sql`gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_say'::text])`),
	check("user_profiles_preferred_language_check", sql`preferred_language = ANY (ARRAY['es'::text, 'en'::text])`),
]);

export const telegramSession = pgTable("telegram_session", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	sessionString: text("session_string").notNull(),
	phoneNumber: text("phone_number"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "telegram_session_user_id_fkey"
		}).onDelete("cascade"),
	unique("telegram_session_user_id_key").on(table.userId),
]);

export const userProgress = pgTable("user_progress", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	topicId: uuid("topic_id"),
	lawId: uuid("law_id"),
	articleId: uuid("article_id"),
	totalAttempts: integer("total_attempts").default(0),
	correctAttempts: integer("correct_attempts").default(0),
	lastAttemptDate: timestamp("last_attempt_date", { withTimezone: true, mode: 'string' }).defaultNow(),
	accuracyPercentage: numeric("accuracy_percentage", { precision: 5, scale:  2 }).default('0.00'),
	needsReview: boolean("needs_review").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_progress_accuracy").using("btree", table.accuracyPercentage.asc().nullsLast().op("numeric_ops")),
	index("idx_user_progress_user_topic").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.topicId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "user_progress_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "user_progress_law_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.topicId],
			foreignColumns: [topics.id],
			name: "user_progress_topic_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "user_progress_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_progress_user_id_topic_id_law_id_article_id_key").on(table.userId, table.topicId, table.lawId, table.articleId),
	pgPolicy("Users can view own progress", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own progress", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own progress", { as: "permissive", for: "update", to: ["public"] }),
]);

export const userRecommendations = pgTable("user_recommendations", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	recommendationType: text("recommendation_type"),
	title: text().notNull(),
	description: text(),
	topicId: uuid("topic_id"),
	articleId: uuid("article_id"),
	priority: integer().default(1),
	isDismissed: boolean("is_dismissed").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "user_recommendations_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.topicId],
			foreignColumns: [topics.id],
			name: "user_recommendations_topic_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "user_recommendations_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view own recommendations", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can update own recommendations", { as: "permissive", for: "update", to: ["public"] }),
	check("user_recommendations_priority_check", sql`priority = ANY (ARRAY[1, 2, 3, 4, 5])`),
	check("user_recommendations_recommendation_type_check", sql`recommendation_type = ANY (ARRAY['review_topic'::text, 'review_article'::text, 'practice_more'::text, 'take_break'::text])`),
]);

export const testConfigurations = pgTable("test_configurations", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	name: text().notNull(),
	topicId: uuid("topic_id"),
	totalQuestions: integer("total_questions").default(25),
	questionDistribution: jsonb("question_distribution").default({"failed":0,"random":25,"correct":0}),
	onlyUnseenQuestions: boolean("only_unseen_questions").default(false),
	timesUsed: integer("times_used").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_test_configs_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.topicId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.topicId],
			foreignColumns: [topics.id],
			name: "test_configurations_topic_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "test_configurations_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can manage own test configs", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const articles = pgTable("articles", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	lawId: uuid("law_id"),
	articleNumber: text("article_number").notNull(),
	title: text(),
	content: text(),
	section: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	titleNumber: text("title_number"),
	chapterNumber: text("chapter_number"),
	sectionNumber: text("section_number"),
	isActive: boolean("is_active").default(true),
	contentHash: text("content_hash"),
	lastModificationDate: date("last_modification_date"),
	verificationDate: date("verification_date").default(sql`CURRENT_DATE`),
	isVerified: boolean("is_verified").default(false),
}, (table) => [
	index("idx_articles_structure").using("btree", table.lawId.asc().nullsLast().op("text_ops"), table.titleNumber.asc().nullsLast().op("text_ops"), table.chapterNumber.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "articles_law_id_fkey"
		}).onDelete("cascade"),
	unique("articles_law_id_article_number_key").on(table.lawId, table.articleNumber),
	pgPolicy("Enable read access for articles", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const topicScope = pgTable("topic_scope", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	topicId: uuid("topic_id"),
	lawId: uuid("law_id"),
	articleNumbers: text("article_numbers").array(),
	titleNumbers: text("title_numbers").array(),
	chapterNumbers: text("chapter_numbers").array(),
	includeFullTitle: boolean("include_full_title").default(false),
	includeFullChapter: boolean("include_full_chapter").default(false),
	weight: numeric({ precision: 3, scale:  2 }).default('1.0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_topic_scope_topic").using("btree", table.topicId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "topic_scope_law_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.topicId],
			foreignColumns: [topics.id],
			name: "topic_scope_topic_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Anyone can read topic scope", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Enable read access for topic_scope", { as: "permissive", for: "select", to: ["public"] }),
]);

export const aiVerificationResults = pgTable("ai_verification_results", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionId: uuid("question_id"),
	articleId: uuid("article_id"),
	lawId: uuid("law_id"),
	isCorrect: boolean("is_correct"),
	confidence: text(),
	explanation: text(),
	articleQuote: text("article_quote"),
	suggestedFix: text("suggested_fix"),
	correctOptionShouldBe: text("correct_option_should_be"),
	aiProvider: text("ai_provider").notNull(),
	aiModel: text("ai_model"),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	verifiedBy: uuid("verified_by"),
	fixApplied: boolean("fix_applied").default(false),
	fixAppliedAt: timestamp("fix_applied_at", { withTimezone: true, mode: 'string' }),
	newExplanation: text("new_explanation"),
	discarded: boolean().default(false),
	discardedAt: timestamp("discarded_at", { withTimezone: true, mode: 'string' }),
	articleOk: boolean("article_ok"),
	answerOk: boolean("answer_ok"),
	explanationOk: boolean("explanation_ok"),
	correctArticleSuggestion: text("correct_article_suggestion"),
	explanationFix: text("explanation_fix"),
}, (table) => [
	index("idx_ai_verification_article").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
	index("idx_ai_verification_law").using("btree", table.lawId.asc().nullsLast().op("uuid_ops")),
	index("idx_ai_verification_question").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "ai_verification_results_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "ai_verification_results_law_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "ai_verification_results_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.verifiedBy],
			foreignColumns: [users.id],
			name: "ai_verification_results_verified_by_fkey"
		}),
	unique("ai_verification_results_question_id_ai_provider_key").on(table.questionId, table.aiProvider),
]);

export const userFeedback = pgTable("user_feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	email: text(),
	type: text().notNull(),
	message: text().notNull(),
	url: text().notNull(),
	userAgent: text("user_agent"),
	viewport: text(),
	referrer: text(),
	screenshotUrl: text("screenshot_url"),
	status: text().default('pending'),
	priority: text().default('medium'),
	adminResponse: text("admin_response"),
	adminUserId: uuid("admin_user_id"),
	wantsResponse: boolean("wants_response").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.adminUserId],
			foreignColumns: [users.id],
			name: "user_feedback_admin_user_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_feedback_user_id_fkey"
		}),
]);

export const questionArticles = pgTable("question_articles", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	questionId: uuid("question_id"),
	articleId: uuid("article_id"),
	relevance: text().default('primary'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isPrimary: boolean("is_primary").default(false),
}, (table) => [
	index("idx_question_articles_primary").using("btree", table.isPrimary.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "question_articles_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "question_articles_question_id_fkey"
		}).onDelete("cascade"),
	unique("question_articles_question_id_article_id_key").on(table.questionId, table.articleId),
	check("question_articles_relevance_check", sql`relevance = ANY (ARRAY['primary'::text, 'secondary'::text, 'reference'::text])`),
]);

export const convocatorias = pgTable("convocatorias", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	oposicionId: uuid("oposicion_id"),
	anio: integer("año").notNull(),
	fechaExamen: date("fecha_examen"),
	tipoExamen: text("tipo_examen").default('ordinaria'),
	boeNumero: text("boe_numero"),
	boeFecha: date("boe_fecha"),
	plazasConvocadas: integer("plazas_convocadas"),
	observaciones: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_convocatorias_oposicion_año").using("btree", table.oposicionId.asc().nullsLast().op("int4_ops"), table.anio.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.oposicionId],
			foreignColumns: [oposiciones.id],
			name: "convocatorias_oposicion_id_fkey"
		}).onDelete("cascade"),
	unique("convocatorias_oposicion_id_año_tipo_examen_key").on(table.oposicionId, table.anio, table.tipoExamen),
	check("convocatorias_año_check", sql`("año" >= 2000) AND ("año" <= 2030)`),
	check("convocatorias_tipo_examen_check", sql`tipo_examen = ANY (ARRAY['ordinaria'::text, 'extraordinaria'::text, 'estabilizacion'::text])`),
]);

export const userRoles = pgTable("user_roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	role: text().notNull(),
	grantedAt: timestamp("granted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	grantedBy: uuid("granted_by"),
	isActive: boolean("is_active").default(true),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_roles_granted_at").using("btree", table.grantedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_user_roles_role_active").using("btree", table.role.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_user_roles_unique_active").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.role.asc().nullsLast().op("uuid_ops")).where(sql`(is_active = true)`),
	index("idx_user_roles_user_id_active").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [userProfiles.id],
			name: "user_roles_granted_by_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "user_roles_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view their own roles", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("Admins can view all roles", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Only admins can manage roles", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("user_roles_role_check", sql`role = ANY (ARRAY['user'::text, 'admin'::text, 'super_admin'::text])`),
]);

export const articulosExamenes = pgTable("articulos_examenes", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	convocatoriaId: uuid("convocatoria_id"),
	articleId: uuid("article_id"),
	frecuenciaAparicion: integer("frecuencia_aparicion").default(1),
	tipoPregunta: text("tipo_pregunta"),
	puntosPregunta: numeric("puntos_pregunta", { precision: 4, scale:  2 }),
	observaciones: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_articulos_examenes_article").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
	index("idx_articulos_examenes_convocatoria").using("btree", table.convocatoriaId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "articulos_examenes_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.convocatoriaId],
			foreignColumns: [convocatorias.id],
			name: "articulos_examenes_convocatoria_id_fkey"
		}).onDelete("cascade"),
	unique("articulos_examenes_convocatoria_id_article_id_key").on(table.convocatoriaId, table.articleId),
	check("articulos_examenes_tipo_pregunta_check", sql`tipo_pregunta = ANY (ARRAY['teorica'::text, 'practica'::text, 'caso'::text, 'test'::text])`),
]);

export const oposicionTopics = pgTable("oposicion_topics", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	oposicionId: uuid("oposicion_id"),
	topicId: uuid("topic_id"),
	pesoExamen: numeric("peso_examen", { precision: 5, scale:  2 }).default('1.0'),
	esTemaPrincipal: boolean("es_tema_principal").default(true),
	observaciones: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.oposicionId],
			foreignColumns: [oposiciones.id],
			name: "oposicion_topics_oposicion_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.topicId],
			foreignColumns: [topics.id],
			name: "oposicion_topics_topic_id_fkey"
		}).onDelete("cascade"),
	unique("oposicion_topics_oposicion_id_topic_id_key").on(table.oposicionId, table.topicId),
]);

export const oposicionArticles = pgTable("oposicion_articles", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	oposicionId: uuid("oposicion_id"),
	articleId: uuid("article_id"),
	importancia: text().default('media'),
	observaciones: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "oposicion_articles_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.oposicionId],
			foreignColumns: [oposiciones.id],
			name: "oposicion_articles_oposicion_id_fkey"
		}).onDelete("cascade"),
	unique("oposicion_articles_oposicion_id_article_id_key").on(table.oposicionId, table.articleId),
	check("oposicion_articles_importancia_check", sql`importancia = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text, 'critica'::text])`),
]);

export const preguntasExamenesOficiales = pgTable("preguntas_examenes_oficiales", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	convocatoriaId: uuid("convocatoria_id"),
	numeroPregunta: integer("numero_pregunta").notNull(),
	parteExamen: text("parte_examen").notNull(),
	preguntaText: text("pregunta_text").notNull(),
	opcionA: text("opcion_a").notNull(),
	opcionB: text("opcion_b").notNull(),
	opcionC: text("opcion_c").notNull(),
	opcionD: text("opcion_d").notNull(),
	respuestaCorrecta: text("respuesta_correcta").notNull(),
	articleId: uuid("article_id"),
	topicEstimado: text("topic_estimado"),
	explicacion: text(),
	fueAnulada: boolean("fue_anulada").default(false),
	observaciones: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_preguntas_oficiales_article").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
	index("idx_preguntas_oficiales_convocatoria").using("btree", table.convocatoriaId.asc().nullsLast().op("uuid_ops")),
	index("idx_preguntas_oficiales_parte").using("btree", table.parteExamen.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "preguntas_examenes_oficiales_article_id_fkey"
		}),
	foreignKey({
			columns: [table.convocatoriaId],
			foreignColumns: [convocatorias.id],
			name: "preguntas_examenes_oficiales_convocatoria_id_fkey"
		}).onDelete("cascade"),
	unique("preguntas_examenes_oficiales_convocatoria_id_parte_examen_n_key").on(table.convocatoriaId, table.numeroPregunta, table.parteExamen),
	check("preguntas_examenes_oficiales_parte_examen_check", sql`parte_examen = ANY (ARRAY['organizacion_publica'::text, 'ofimatica'::text, 'psicotecnico'::text])`),
	check("preguntas_examenes_oficiales_respuesta_correcta_check", sql`respuesta_correcta = ANY (ARRAY['a'::text, 'b'::text, 'c'::text, 'd'::text])`),
]);

export const lawVersions = pgTable("law_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	lawId: uuid("law_id"),
	versionNumber: text("version_number").notNull(),
	consolidationDate: date("consolidation_date").notNull(),
	boeNumber: text("boe_number"),
	boeUrl: text("boe_url"),
	modificationType: text("modification_type"),
	description: text(),
	sourceVerificationDate: date("source_verification_date").default(sql`CURRENT_DATE`).notNull(),
	isCurrentVersion: boolean("is_current_version").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "law_versions_law_id_fkey"
		}).onDelete("cascade"),
	check("law_versions_modification_type_check", sql`modification_type = ANY (ARRAY['promulgacion'::text, 'reforma'::text, 'consolidacion'::text, 'correccion'::text])`),
]);

export const articleVersions = pgTable("article_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	articleId: uuid("article_id"),
	lawVersionId: uuid("law_version_id"),
	versionNumber: text("version_number").notNull(),
	contentHash: text("content_hash").notNull(),
	previousContent: text("previous_content"),
	changeDescription: text("change_description"),
	verificationDate: date("verification_date").default(sql`CURRENT_DATE`).notNull(),
	isCurrentVersion: boolean("is_current_version").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "article_versions_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lawVersionId],
			foreignColumns: [lawVersions.id],
			name: "article_versions_law_version_id_fkey"
		}).onDelete("cascade"),
]);

export const legalModifications = pgTable("legal_modifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	lawVersionId: uuid("law_version_id"),
	articleNumbers: text("article_numbers").array(),
	modificationDate: date("modification_date").notNull(),
	modificationLaw: text("modification_law"),
	boeReference: text("boe_reference"),
	impactLevel: text("impact_level"),
	summary: text().notNull(),
	fullDescription: text("full_description"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.lawVersionId],
			foreignColumns: [lawVersions.id],
			name: "legal_modifications_law_version_id_fkey"
		}).onDelete("cascade"),
	check("legal_modifications_impact_level_check", sql`impact_level = ANY (ARRAY['mayor'::text, 'menor'::text, 'tecnica'::text, 'correccion'::text])`),
]);

export const testQuestions = pgTable("test_questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	testId: uuid("test_id"),
	questionId: uuid("question_id"),
	articleId: uuid("article_id"),
	questionOrder: integer("question_order").notNull(),
	questionText: text("question_text").notNull(),
	userAnswer: text("user_answer").notNull(),
	correctAnswer: text("correct_answer").notNull(),
	isCorrect: boolean("is_correct").notNull(),
	confidenceLevel: text("confidence_level"),
	timeSpentSeconds: integer("time_spent_seconds").default(0),
	timeToFirstInteraction: integer("time_to_first_interaction").default(0),
	timeHesitation: integer("time_hesitation").default(0),
	interactionCount: integer("interaction_count").default(1),
	articleNumber: text("article_number"),
	lawName: text("law_name"),
	temaNumber: integer("tema_number"),
	difficulty: text(),
	questionType: text("question_type"),
	tags: text().array().default([""]),
	previousAttemptsThisArticle: integer("previous_attempts_this_article").default(0),
	historicalAccuracyThisArticle: numeric("historical_accuracy_this_article").default('0'),
	knowledgeRetentionScore: numeric("knowledge_retention_score"),
	learningEfficiencyScore: numeric("learning_efficiency_score"),
	userAgent: text("user_agent"),
	screenResolution: text("screen_resolution"),
	deviceType: text("device_type"),
	browserLanguage: text("browser_language"),
	timezone: text(),
	fullQuestionContext: jsonb("full_question_context").default({}),
	userBehaviorData: jsonb("user_behavior_data").default({}),
	learningAnalytics: jsonb("learning_analytics").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_test_questions_article_performance").using("btree", table.articleId.asc().nullsLast().op("bool_ops"), table.isCorrect.asc().nullsLast().op("bool_ops")),
	index("idx_test_questions_confidence_accuracy").using("btree", table.confidenceLevel.asc().nullsLast().op("text_ops"), table.isCorrect.asc().nullsLast().op("bool_ops")),
	index("idx_test_questions_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_test_questions_difficulty_time").using("btree", table.difficulty.asc().nullsLast().op("int4_ops"), table.timeSpentSeconds.asc().nullsLast().op("text_ops")),
	index("idx_test_questions_question_user").using("btree", table.questionId.asc().nullsLast().op("uuid_ops"), table.testId.asc().nullsLast().op("uuid_ops")),
	index("idx_test_questions_tema_stats").using("btree", table.temaNumber.asc().nullsLast().op("bool_ops"), table.isCorrect.asc().nullsLast().op("int4_ops")),
	index("idx_test_questions_test_id").using("btree", table.testId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "test_questions_article_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "test_questions_question_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.testId],
			foreignColumns: [tests.id],
			name: "test_questions_test_id_fkey"
		}).onDelete("cascade"),
	unique("unique_test_question").on(table.testId, table.questionOrder),
	pgPolicy("Users can insert their own test answers", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(test_id IN ( SELECT tests.id
   FROM tests
  WHERE (tests.user_id = auth.uid())))`  }),
	pgPolicy("Users can view their own test answers", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can update their own test answers", { as: "permissive", for: "update", to: ["public"] }),
	check("check_confidence_level", sql`confidence_level = ANY (ARRAY['very_sure'::text, 'sure'::text, 'unsure'::text, 'guessing'::text, 'unknown'::text])`),
	check("check_device_type", sql`device_type = ANY (ARRAY['mobile'::text, 'tablet'::text, 'desktop'::text, 'unknown'::text])`),
	check("check_difficulty", sql`difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text, 'extreme'::text])`),
]);

export const verificationSchedule = pgTable("verification_schedule", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	lawId: uuid("law_id"),
	verificationFrequency: interval("verification_frequency").default('3 mons').notNull(),
	lastVerificationDate: date("last_verification_date"),
	nextVerificationDate: date("next_verification_date"),
	verificationSource: text("verification_source"),
	verificationStatus: text("verification_status"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "verification_schedule_law_id_fkey"
		}).onDelete("cascade"),
	check("verification_schedule_verification_status_check", sql`verification_status = ANY (ARRAY['pendiente'::text, 'en_proceso'::text, 'completada'::text, 'error'::text])`),
]);

export const userTestSessions = pgTable("user_test_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	temaNumber: integer("tema_number").notNull(),
	testNumber: integer("test_number"),
	score: integer().notNull(),
	totalQuestions: integer("total_questions").notNull(),
	timeSeconds: integer("time_seconds").default(0),
	questionsAnswered: jsonb("questions_answered").default([]),
	failedQuestions: integer("failed_questions").array().default([]),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_test_sessions_completed").using("btree", table.completedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_user_test_sessions_tema").using("btree", table.temaNumber.asc().nullsLast().op("int4_ops")),
	index("idx_user_test_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_test_sessions_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view their own test sessions", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert their own test sessions", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own test sessions", { as: "permissive", for: "update", to: ["public"] }),
]);

export const feedbackConversations = pgTable("feedback_conversations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	feedbackId: uuid("feedback_id"),
	userId: uuid("user_id"),
	adminUserId: uuid("admin_user_id"),
	status: varchar({ length: 20 }).default('open'),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	adminViewedAt: timestamp("admin_viewed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_feedback_conversations_admin_viewed").using("btree", table.status.asc().nullsLast().op("text_ops"), table.adminViewedAt.asc().nullsLast().op("text_ops")).where(sql`(admin_viewed_at IS NULL)`),
	foreignKey({
			columns: [table.adminUserId],
			foreignColumns: [userProfiles.id],
			name: "feedback_conversations_admin_user_id_fkey"
		}),
	foreignKey({
			columns: [table.feedbackId],
			foreignColumns: [userFeedback.id],
			name: "feedback_conversations_feedback_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "feedback_conversations_user_id_fkey"
		}),
]);

export const articleExamStats = pgTable("article_exam_stats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	articleId: uuid("article_id"),
	oposicionId: uuid("oposicion_id"),
	totalAppearances: integer("total_appearances").default(0),
	yearsAppeared: integer("years_appeared").array().default([]),
	firstAppearance: date("first_appearance"),
	lastAppearance: date("last_appearance"),
	classification: text(),
	userMessage: text("user_message"),
	sourceTable: text("source_table").default('migrated'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_article_exam_stats_article").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
	index("idx_article_exam_stats_classification").using("btree", table.classification.asc().nullsLast().op("text_ops")),
	index("idx_article_exam_stats_oposicion").using("btree", table.oposicionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "article_exam_stats_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.oposicionId],
			foreignColumns: [oposiciones.id],
			name: "article_exam_stats_oposicion_id_fkey"
		}).onDelete("cascade"),
	unique("article_exam_stats_article_id_oposicion_id_key").on(table.articleId, table.oposicionId),
	check("article_exam_stats_classification_check", sql`classification = ANY (ARRAY['VERY_FREQUENT'::text, 'FREQUENT'::text, 'OCCASIONAL'::text, 'NEVER'::text])`),
]);

export const userSessions = pgTable("user_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	sessionToken: text("session_token"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	deviceFingerprint: text("device_fingerprint"),
	screenResolution: text("screen_resolution"),
	viewportSize: text("viewport_size"),
	browserName: text("browser_name"),
	browserVersion: text("browser_version"),
	operatingSystem: text("operating_system"),
	deviceModel: text("device_model"),
	browserLanguage: text("browser_language"),
	timezone: text(),
	colorDepth: integer("color_depth"),
	pixelRatio: numeric("pixel_ratio"),
	countryCode: text("country_code"),
	region: text(),
	city: text(),
	coordinates: point(),
	isp: text(),
	connectionType: text("connection_type"),
	sessionStart: timestamp("session_start", { withTimezone: true, mode: 'string' }).defaultNow(),
	sessionEnd: timestamp("session_end", { withTimezone: true, mode: 'string' }),
	totalDurationMinutes: integer("total_duration_minutes").default(0),
	activeTimeMinutes: integer("active_time_minutes").default(0),
	idleTimeMinutes: integer("idle_time_minutes").default(0),
	pagesVisited: text("pages_visited").array().default([""]),
	pageViewCount: integer("page_view_count").default(0),
	testsAttempted: integer("tests_attempted").default(0),
	testsCompleted: integer("tests_completed").default(0),
	questionsAnswered: integer("questions_answered").default(0),
	questionsCorrect: integer("questions_correct").default(0),
	topicsStudied: text("topics_studied").array().default([""]),
	timeSpentStudyingMinutes: integer("time_spent_studying_minutes").default(0),
	entryPage: text("entry_page"),
	exitPage: text("exit_page"),
	referrerUrl: text("referrer_url"),
	utmSource: text("utm_source"),
	utmCampaign: text("utm_campaign"),
	utmMedium: text("utm_medium"),
	searchQueries: text("search_queries").array().default([""]),
	navigationPattern: jsonb("navigation_pattern").default({}),
	clickCount: integer("click_count").default(0),
	scrollDepthMax: numeric("scroll_depth_max").default('0'),
	formInteractions: integer("form_interactions").default(0),
	searchInteractions: integer("search_interactions").default(0),
	downloadActions: integer("download_actions").default(0),
	engagementScore: numeric("engagement_score").default('0'),
	interactionRate: numeric("interaction_rate").default('0'),
	contentConsumptionRate: numeric("content_consumption_rate").default('0'),
	bounceIndicator: boolean("bounce_indicator").default(false),
	conversionEvents: text("conversion_events").array().default([""]),
	learningSessionType: text("learning_session_type"),
	sessionGoal: text("session_goal"),
	sessionOutcome: text("session_outcome"),
	satisfactionIndicator: text("satisfaction_indicator"),
	technicalDetails: jsonb("technical_details").default({}),
	interactionEvents: jsonb("interaction_events").default({}),
	performanceMetrics: jsonb("performance_metrics").default({}),
	accessibilityData: jsonb("accessibility_data").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_sessions_behavior").using("gin", table.navigationPattern.asc().nullsLast().op("jsonb_ops")),
	index("idx_user_sessions_date").using("btree", table.sessionStart.asc().nullsLast().op("timestamptz_ops")),
	index("idx_user_sessions_device").using("btree", table.deviceModel.asc().nullsLast().op("text_ops"), table.operatingSystem.asc().nullsLast().op("text_ops")),
	index("idx_user_sessions_duration").using("btree", table.totalDurationMinutes.asc().nullsLast().op("int4_ops")),
	index("idx_user_sessions_engagement").using("btree", table.engagementScore.asc().nullsLast().op("numeric_ops")),
	index("idx_user_sessions_learning_type").using("btree", table.learningSessionType.asc().nullsLast().op("text_ops")),
	index("idx_user_sessions_performance").using("gin", table.performanceMetrics.asc().nullsLast().op("jsonb_ops")),
	index("idx_user_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	unique("user_sessions_session_token_key").on(table.sessionToken),
	pgPolicy("Users can view their own sessions", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("Users can insert their own sessions", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own sessions", { as: "permissive", for: "update", to: ["public"] }),
	check("check_engagement_score", sql`(engagement_score >= (0)::numeric) AND (engagement_score <= (100)::numeric)`),
	check("check_learning_session_type", sql`learning_session_type = ANY (ARRAY['practice'::text, 'review'::text, 'exploration'::text, 'focused_study'::text, 'exam_prep'::text])`),
	check("check_satisfaction_indicator", sql`satisfaction_indicator = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text, 'unknown'::text])`),
	check("check_scroll_depth", sql`(scroll_depth_max >= (0)::numeric) AND (scroll_depth_max <= (100)::numeric)`),
]);

export const userLearningAnalytics = pgTable("user_learning_analytics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	totalTestsCompleted: integer("total_tests_completed").default(0),
	totalQuestionsAnswered: integer("total_questions_answered").default(0),
	overallAccuracy: numeric("overall_accuracy").default('0'),
	totalStudyTimeHours: numeric("total_study_time_hours").default('0'),
	currentStreakDays: integer("current_streak_days").default(0),
	longestStreakDays: integer("longest_streak_days").default(0),
	articleId: uuid("article_id"),
	articleNumber: text("article_number"),
	lawName: text("law_name"),
	temaNumber: integer("tema_number"),
	oposicionType: text("oposicion_type"),
	masteryLevel: text("mastery_level").default('beginner'),
	masteryScore: numeric("mastery_score").default('0'),
	confidenceScore: numeric("confidence_score").default('0'),
	consistencyScore: numeric("consistency_score").default('0'),
	learningStyle: text("learning_style").default('unknown'),
	optimalSessionDurationMinutes: integer("optimal_session_duration_minutes").default(25),
	retentionRate: numeric("retention_rate").default('0'),
	improvementVelocity: numeric("improvement_velocity").default('0'),
	fatigueThresholdMinutes: integer("fatigue_threshold_minutes").default(60),
	peakPerformanceHours: integer("peak_performance_hours").array().default([]),
	worstPerformanceHours: integer("worst_performance_hours").array().default([]),
	optimalStudyFrequencyDays: integer("optimal_study_frequency_days").default(3),
	bestDayOfWeek: integer("best_day_of_week"),
	currentWeakAreas: text("current_weak_areas").array().default([""]),
	recommendedFocusArticles: text("recommended_focus_articles").array().default([""]),
	predictedExamReadiness: numeric("predicted_exam_readiness").default('0'),
	estimatedHoursToMastery: numeric("estimated_hours_to_mastery").default('0'),
	nextReviewDate: timestamp("next_review_date", { withTimezone: true, mode: 'string' }),
	articlePerformanceHistory: jsonb("article_performance_history").default({}),
	difficultyProgression: jsonb("difficulty_progression").default({}),
	timeEfficiencyTrends: jsonb("time_efficiency_trends").default({}),
	errorPatternAnalysis: jsonb("error_pattern_analysis").default({}),
	lastAnalysisDate: timestamp("last_analysis_date", { withTimezone: true, mode: 'string' }).defaultNow(),
	analysisConfidence: numeric("analysis_confidence").default('0'),
	dataPointsCount: integer("data_points_count").default(0),
	algorithmVersion: text("algorithm_version").default('1.0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_analytics_article").using("btree", table.articleId.asc().nullsLast().op("uuid_ops"), table.masteryLevel.asc().nullsLast().op("text_ops")),
	index("idx_user_analytics_learning_style").using("btree", table.learningStyle.asc().nullsLast().op("text_ops")),
	index("idx_user_analytics_mastery").using("btree", table.masteryLevel.asc().nullsLast().op("numeric_ops"), table.predictedExamReadiness.asc().nullsLast().op("text_ops")),
	index("idx_user_analytics_performance").using("gin", table.articlePerformanceHistory.asc().nullsLast().op("jsonb_ops")),
	index("idx_user_analytics_tema").using("btree", table.temaNumber.asc().nullsLast().op("int4_ops"), table.oposicionType.asc().nullsLast().op("text_ops")),
	index("idx_user_analytics_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "user_learning_analytics_article_id_fkey"
		}),
	unique("unique_user_article_oposicion").on(table.userId, table.articleId, table.oposicionType),
	pgPolicy("Users can view their own analytics", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("Users can manage their own analytics", { as: "permissive", for: "all", to: ["public"] }),
	check("check_exam_readiness", sql`(predicted_exam_readiness >= (0)::numeric) AND (predicted_exam_readiness <= (100)::numeric)`),
	check("check_learning_style", sql`learning_style = ANY (ARRAY['visual'::text, 'analytical'::text, 'repetitive'::text, 'mixed'::text, 'unknown'::text])`),
	check("check_mastery_level", sql`mastery_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'expert'::text])`),
]);

export const feedbackMessages = pgTable("feedback_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversationId: uuid("conversation_id"),
	senderId: uuid("sender_id"),
	isAdmin: boolean("is_admin").default(false),
	message: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [feedbackConversations.id],
			name: "feedback_messages_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [userProfiles.id],
			name: "feedback_messages_sender_id_fkey"
		}),
]);

export const emailLogs = pgTable("email_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	emailType: text("email_type").notNull(),
	subject: text().notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	openedAt: timestamp("opened_at", { withTimezone: true, mode: 'string' }),
	clickedAt: timestamp("clicked_at", { withTimezone: true, mode: 'string' }),
	status: text().default('sent'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_email_logs_sent_at").using("btree", table.sentAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_email_logs_type").using("btree", table.emailType.asc().nullsLast().op("text_ops")),
	index("idx_email_logs_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "email_logs_user_id_fkey"
		}).onDelete("cascade"),
	check("email_logs_status_check", sql`status = ANY (ARRAY['sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text])`),
]);

export const triggerLogs = pgTable("trigger_logs", {
	id: serial().primaryKey().notNull(),
	questionId: uuid("question_id"),
	oldDifficulty: text("old_difficulty"),
	newDifficulty: text("new_difficulty"),
	successRate: numeric("success_rate"),
	totalAttempts: integer("total_attempts"),
	difficultyScore: numeric("difficulty_score"),
	triggerTime: timestamp("trigger_time", { mode: 'string' }).defaultNow(),
});

export const hotArticles = pgTable("hot_articles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	articleId: uuid("article_id").notNull(),
	lawId: uuid("law_id").notNull(),
	targetOposicion: text("target_oposicion"),
	oposicionLevel: text("oposicion_level"),
	totalOfficialAppearances: integer("total_official_appearances").default(0),
	uniqueExamsCount: integer("unique_exams_count").default(0),
	hotnessScore: numeric("hotness_score").default('0'),
	frequencyTrend: text("frequency_trend"),
	priorityLevel: text("priority_level"),
	articleNumber: text("article_number"),
	lawName: text("law_name"),
	articleTitle: text("article_title"),
	firstAppearanceDate: date("first_appearance_date"),
	lastAppearanceDate: date("last_appearance_date"),
	entitiesBreakdown: jsonb("entities_breakdown").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	lastCalculationDate: timestamp("last_calculation_date", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("hot_articles_article_oposicion_unique").using("btree", table.articleId.asc().nullsLast().op("text_ops"), table.targetOposicion.asc().nullsLast().op("uuid_ops")),
	index("idx_hot_articles_article_id").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
	index("idx_hot_articles_hotness_score").using("btree", table.hotnessScore.desc().nullsFirst().op("numeric_ops")),
	index("idx_hot_articles_oposicion").using("btree", table.targetOposicion.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "hot_articles_article_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "hot_articles_law_id_fkey"
		}).onDelete("cascade"),
	check("hot_articles_priority_level_check", sql`priority_level = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text])`),
]);

export const emailPreferences = pgTable("email_preferences", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	emailReactivacion: boolean("email_reactivacion").default(true),
	emailUrgente: boolean("email_urgente").default(true),
	emailBienvenidaMotivacional: boolean("email_bienvenida_motivacional").default(true),
	unsubscribedAll: boolean("unsubscribed_all").default(false),
	unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	emailBienvenidaInmediato: boolean("email_bienvenida_inmediato").default(true),
	emailResumenSemanal: boolean("email_resumen_semanal").default(true),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "email_preferences_user_id_fkey"
		}).onDelete("cascade"),
	unique("email_preferences_user_id_key").on(table.userId),
	pgPolicy("Users can manage their own email preferences", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const emailUnsubscribeTokens = pgTable("email_unsubscribe_tokens", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	email: text().notNull(),
	emailType: text("email_type").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '30 days'::interval)`).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_email_unsubscribe_tokens_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_email_unsubscribe_tokens_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("idx_email_unsubscribe_tokens_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "email_unsubscribe_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("email_unsubscribe_tokens_token_key").on(table.token),
]);

export const userSubscriptions = pgTable("user_subscriptions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	status: text().notNull(),
	planType: text("plan_type").notNull(),
	trialStart: timestamp("trial_start", { withTimezone: true, mode: 'string' }),
	trialEnd: timestamp("trial_end", { withTimezone: true, mode: 'string' }),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_subscriptions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_user_subscriptions_stripe_customer").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	index("idx_user_subscriptions_stripe_subscription").using("btree", table.stripeSubscriptionId.asc().nullsLast().op("text_ops")),
	index("idx_user_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "user_subscriptions_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view own subscriptions", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("Service role can manage subscriptions", { as: "permissive", for: "all", to: ["public"] }),
	check("user_subscriptions_plan_type_check", sql`plan_type = ANY (ARRAY['trial'::text, 'premium_semester'::text, 'premium_annual'::text])`),
	check("user_subscriptions_status_check", sql`status = ANY (ARRAY['trialing'::text, 'active'::text, 'canceled'::text, 'past_due'::text, 'unpaid'::text])`),
]);

export const userQuestionHistory = pgTable("user_question_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	questionId: uuid("question_id").notNull(),
	totalAttempts: integer("total_attempts").default(0),
	correctAttempts: integer("correct_attempts").default(0),
	successRate: numeric("success_rate", { precision: 3, scale:  2 }).default('0.00'),
	personalDifficulty: difficultyLevel("personal_difficulty").default('medium'),
	firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true, mode: 'string' }),
	lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: 'string' }),
	trend: varchar({ length: 20 }).default('stable'),
	trendCalculatedAt: timestamp("trend_calculated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_question_history_difficulty").using("btree", table.personalDifficulty.asc().nullsLast().op("enum_ops")),
	index("idx_user_question_history_question_id").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_question_history_success_rate").using("btree", table.successRate.asc().nullsLast().op("numeric_ops")),
	index("idx_user_question_history_trend").using("btree", table.trend.asc().nullsLast().op("text_ops")),
	index("idx_user_question_history_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "user_question_history_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_question_history_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_question_history_user_id_question_id_key").on(table.userId, table.questionId),
	pgPolicy("Users can view their own question history", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Allow trigger inserts for question history", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Allow trigger updates for question history", { as: "permissive", for: "update", to: ["public"] }),
]);

export const userDifficultyMetrics = pgTable("user_difficulty_metrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	avgPersonalDifficulty: numeric("avg_personal_difficulty", { precision: 3, scale:  2 }).default('2.50'),
	totalQuestionsAttempted: integer("total_questions_attempted").default(0),
	questionsMastered: integer("questions_mastered").default(0),
	questionsStruggling: integer("questions_struggling").default(0),
	difficultyImprovedThisWeek: integer("difficulty_improved_this_week").default(0),
	difficultyDeclinedThisWeek: integer("difficulty_declined_this_week").default(0),
	lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_difficulty_metrics_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_difficulty_metrics_user_id_key").on(table.userId),
	pgPolicy("Users can view their own difficulty metrics", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const pwaSessions = pgTable("pwa_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	sessionStart: timestamp("session_start", { mode: 'string' }).defaultNow(),
	sessionEnd: timestamp("session_end", { mode: 'string' }),
	sessionDurationMinutes: integer("session_duration_minutes"),
	deviceInfo: jsonb("device_info"),
	isStandalone: boolean("is_standalone").default(false),
	pagesVisited: integer("pages_visited").default(1),
	actionsPerformed: integer("actions_performed").default(0),
}, (table) => [
	index("idx_pwa_sessions_standalone").using("btree", table.isStandalone.asc().nullsLast().op("bool_ops")),
	index("idx_pwa_sessions_start").using("btree", table.sessionStart.asc().nullsLast().op("timestamp_ops")),
	index("idx_pwa_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "pwa_sessions_user_id_fkey"
		}),
	pgPolicy("Users can view own PWA sessions", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own PWA sessions", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own PWA sessions", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Service role can manage all PWA sessions", { as: "permissive", for: "all", to: ["public"] }),
]);

export const pwaEvents = pgTable("pwa_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	eventType: text("event_type").notNull(),
	deviceInfo: jsonb("device_info"),
	browserInfo: jsonb("browser_info"),
	userAgent: text("user_agent"),
	referrer: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	displaymode: text().default('browser'),
	confidence: text().default('low'),
	displayMode: text(),
	detectionMethod: text(),
	isStandalone: boolean(),
	installMethod: text(),
}, (table) => [
	index("idx_pwa_events_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_pwa_events_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_pwa_events_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "pwa_events_user_id_fkey"
		}),
	pgPolicy("Users can view own PWA events", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own PWA events", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Service role can manage all PWA events", { as: "permissive", for: "all", to: ["public"] }),
]);

export const userInteractions = pgTable("user_interactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	sessionId: uuid("session_id"),
	eventType: text("event_type").notNull(),
	eventCategory: text("event_category").notNull(),
	component: text(),
	action: text(),
	label: text(),
	value: jsonb().default({}),
	pageUrl: text("page_url"),
	elementId: text("element_id"),
	elementText: text("element_text"),
	responseTimeMs: integer("response_time_ms"),
	deviceInfo: jsonb("device_info").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_interactions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_interactions_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_user_interactions_category").using("btree", table.eventCategory.asc().nullsLast().op("text_ops")),
	index("idx_user_interactions_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_user_interactions_component").using("btree", table.component.asc().nullsLast().op("text_ops")),
	index("idx_user_interactions_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_interactions_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view own interactions", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own interactions", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id OR user_id IS NULL)` }),
	pgPolicy("Admins can view all interactions", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text)))))` }),
	pgPolicy("Service role full access", { as: "permissive", for: "all", to: ["public"] }),
	check("user_interactions_category_check", sql`event_category = ANY (ARRAY['test'::text, 'chat'::text, 'navigation'::text, 'ui'::text, 'auth'::text, 'error'::text, 'conversion'::text, 'psychometric'::text])`),
]);

export const userStreaks = pgTable("user_streaks", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	currentStreak: integer("current_streak").default(0),
	longestStreak: integer("longest_streak").default(0),
	lastActivityDate: date("last_activity_date"),
	streakUpdatedAt: timestamp("streak_updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_streaks_current_streak").using("btree", table.currentStreak.desc().nullsFirst().op("int4_ops")),
	index("idx_user_streaks_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_streaks_user_id_fkey"
		}),
	unique("user_streaks_user_id_key").on(table.userId),
	pgPolicy("Users can view own streaks", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own streaks", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own streaks", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Anyone can view all streaks for ranking", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can update own streak only", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const psychometricCategories = pgTable("psychometric_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	categoryKey: text("category_key").notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	hasSections: boolean("has_sections").default(false),
	sectionCount: integer("section_count").default(0),
	isActive: boolean("is_active").default(true),
	displayOrder: integer("display_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("psychometric_categories_category_key_key").on(table.categoryKey),
]);

export const psychometricSections = pgTable("psychometric_sections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	categoryId: uuid("category_id").notNull(),
	sectionKey: text("section_key").notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	displayOrder: integer("display_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [psychometricCategories.id],
			name: "psychometric_sections_category_id_fkey"
		}).onDelete("cascade"),
	unique("psychometric_sections_category_id_section_key_key").on(table.categoryId, table.sectionKey),
]);

export const psychometricQuestions = pgTable("psychometric_questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	categoryId: uuid("category_id").notNull(),
	sectionId: uuid("section_id"),
	questionSubtype: text("question_subtype").notNull(),
	questionText: text("question_text").notNull(),
	optionA: text("option_a"),
	optionB: text("option_b"),
	optionC: text("option_c"),
	optionD: text("option_d"),
	correctOption: integer("correct_option"),
	contentData: jsonb("content_data").default({}).notNull(),
	explanation: text(),
	solutionSteps: text("solution_steps"),
	difficulty: text().default('medium'),
	timeLimitSeconds: integer("time_limit_seconds").default(120),
	cognitiveSkills: text("cognitive_skills").array(),
	isActive: boolean("is_active").default(true),
	isVerified: boolean("is_verified").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	globalDifficulty: numeric("global_difficulty"),
	difficultySampleSize: integer("difficulty_sample_size").default(0),
	lastDifficultyUpdate: timestamp("last_difficulty_update", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_psychometric_questions_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_psychometric_questions_category").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	index("idx_psychometric_questions_content_gin").using("gin", table.contentData.asc().nullsLast().op("jsonb_ops")),
	index("idx_psychometric_questions_difficulty").using("btree", table.difficulty.asc().nullsLast().op("text_ops")),
	index("idx_psychometric_questions_section").using("btree", table.sectionId.asc().nullsLast().op("uuid_ops")),
	index("idx_psychometric_questions_subtype").using("btree", table.questionSubtype.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [psychometricCategories.id],
			name: "psychometric_questions_category_id_fkey"
		}),
	foreignKey({
			columns: [table.sectionId],
			foreignColumns: [psychometricSections.id],
			name: "psychometric_questions_section_id_fkey"
		}),
	check("psychometric_questions_correct_option_check", sql`correct_option = ANY (ARRAY[0, 1, 2, 3])`),
	check("psychometric_questions_difficulty_check", sql`difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text, 'expert'::text])`),
]);

export const userNotificationSettings = pgTable("user_notification_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	pushEnabled: boolean("push_enabled").default(false),
	pushSubscription: jsonb("push_subscription"),
	preferredTimes: jsonb("preferred_times").default(["09:00","14:00","20:00"]),
	timezone: text().default('Europe/Madrid'),
	frequency: text().default('smart'),
	oposicionType: text("oposicion_type").default('auxiliar-administrativo'),
	examDate: date("exam_date"),
	motivationLevel: text("motivation_level").default('medium'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_notification_settings_push_enabled").using("btree", table.pushEnabled.asc().nullsLast().op("bool_ops")),
	index("idx_user_notification_settings_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_notification_settings_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_notification_settings_user_id_unique").on(table.userId),
	check("user_notification_settings_frequency_check", sql`frequency = ANY (ARRAY['daily'::text, 'smart'::text, 'minimal'::text, 'off'::text])`),
	check("user_notification_settings_motivation_level_check", sql`motivation_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'extreme'::text])`),
]);

export const userActivityPatterns = pgTable("user_activity_patterns", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	preferredHours: integer("preferred_hours").array().default([9, 14, 20]),
	activeDays: integer("active_days").array().default([1, 2, 3, 4, 5, 6]),
	avgSessionDuration: integer("avg_session_duration").default(15),
	peakPerformanceTime: time("peak_performance_time"),
	streakPattern: text("streak_pattern"),
	lastCalculated: timestamp("last_calculated", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_activity_patterns_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_activity_patterns_user_id_fkey"
		}).onDelete("cascade"),
]);

export const notificationLogs = pgTable("notification_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	templateId: uuid("template_id"),
	messageSent: text("message_sent").notNull(),
	messageVariant: integer("message_variant"),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: 'string' }),
	deliveryStatus: text("delivery_status").default('sent'),
	openedAt: timestamp("opened_at", { withTimezone: true, mode: 'string' }),
	clickedAt: timestamp("clicked_at", { withTimezone: true, mode: 'string' }),
	resultedInSession: boolean("resulted_in_session").default(false),
	sessionStartedAt: timestamp("session_started_at", { withTimezone: true, mode: 'string' }),
	contextData: jsonb("context_data"),
	deviceInfo: jsonb("device_info"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_notification_logs_delivery_status").using("btree", table.deliveryStatus.asc().nullsLast().op("text_ops")),
	index("idx_notification_logs_sent_at").using("btree", table.sentAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_notification_logs_template_id").using("btree", table.templateId.asc().nullsLast().op("uuid_ops")),
	index("idx_notification_logs_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [notificationTemplates.id],
			name: "notification_logs_template_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_logs_user_id_fkey"
		}).onDelete("cascade"),
	check("notification_logs_delivery_status_check", sql`delivery_status = ANY (ARRAY['sent'::text, 'delivered'::text, 'failed'::text, 'clicked'::text, 'dismissed'::text])`),
]);

export const notificationTemplates = pgTable("notification_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	category: text().notNull(),
	subcategory: text(),
	messageVariants: jsonb("message_variants").notNull(),
	targetConditions: jsonb("target_conditions"),
	oposicionContext: boolean("oposicion_context").default(true),
	urgencyLevel: integer("urgency_level").default(1),
	active: boolean().default(true),
	successMetrics: jsonb("success_metrics").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_notification_templates_active").using("btree", table.active.asc().nullsLast().op("bool_ops")),
	index("idx_notification_templates_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	check("notification_templates_urgency_level_check", sql`(urgency_level >= 1) AND (urgency_level <= 5)`),
]);

export const notificationMetrics = pgTable("notification_metrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	templateId: uuid("template_id"),
	userSegment: text("user_segment"),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }),
	totalSent: integer("total_sent").default(0),
	totalDelivered: integer("total_delivered").default(0),
	totalOpened: integer("total_opened").default(0),
	totalClicked: integer("total_clicked").default(0),
	totalSessionsGenerated: integer("total_sessions_generated").default(0),
	avgTimeToClick: interval("avg_time_to_click"),
	conversionRate: numeric("conversion_rate", { precision: 5, scale:  4 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_notification_metrics_period").using("btree", table.periodStart.asc().nullsLast().op("timestamptz_ops"), table.periodEnd.asc().nullsLast().op("timestamptz_ops")),
	index("idx_notification_metrics_template_id").using("btree", table.templateId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [notificationTemplates.id],
			name: "notification_metrics_template_id_fkey"
		}),
]);

export const userSmartScheduling = pgTable("user_smart_scheduling", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	nextNotificationTime: timestamp("next_notification_time", { withTimezone: true, mode: 'string' }),
	notificationFrequencyHours: integer("notification_frequency_hours").default(24),
	lastSessionTime: timestamp("last_session_time", { withTimezone: true, mode: 'string' }),
	streakStatus: integer("streak_status").default(0),
	riskLevel: text("risk_level").default('low'),
	lastRiskCalculation: timestamp("last_risk_calculation", { withTimezone: true, mode: 'string' }).defaultNow(),
	pauseUntil: timestamp("pause_until", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_smart_scheduling_next_notification").using("btree", table.nextNotificationTime.asc().nullsLast().op("timestamptz_ops")),
	index("idx_user_smart_scheduling_risk_level").using("btree", table.riskLevel.asc().nullsLast().op("text_ops")),
	index("idx_user_smart_scheduling_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_smart_scheduling_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_smart_scheduling_user_id_unique").on(table.userId),
	check("user_smart_scheduling_risk_level_check", sql`risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])`),
]);

export const userMedals = pgTable("user_medals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	medalId: text("medal_id").notNull(),
	medalData: jsonb("medal_data").notNull(),
	unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	viewed: boolean().default(false),
}, (table) => [
	index("idx_user_medals_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_medals_viewed").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.viewed.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_medals_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_medals_user_id_medal_id_key").on(table.userId, table.medalId),
	pgPolicy("Users can view own medals", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(auth.uid() = user_id)` }),
]);

export const questionDisputes = pgTable("question_disputes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionId: uuid("question_id"),
	userId: uuid("user_id"),
	disputeType: text("dispute_type").notNull(),
	description: text().notNull(),
	status: text().default('pending'),
	adminResponse: text("admin_response"),
	adminUserId: uuid("admin_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isRead: boolean("is_read").default(false),
	appealText: text("appeal_text"),
	appealSubmittedAt: timestamp("appeal_submitted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_question_disputes_appeal_submitted").using("btree", table.appealSubmittedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(appeal_text IS NOT NULL)`),
	foreignKey({
			columns: [table.adminUserId],
			foreignColumns: [userProfiles.id],
			name: "question_disputes_admin_user_id_fkey"
		}),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "question_disputes_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "question_disputes_user_id_fkey"
		}).onDelete("cascade"),
	check("question_disputes_dispute_type_check", sql`dispute_type = ANY (ARRAY['no_literal'::text, 'respuesta_incorrecta'::text, 'otro'::text])`),
	check("question_disputes_status_check", sql`status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'rejected'::text])`),
]);

export const psychometricQuestionDisputes = pgTable("psychometric_question_disputes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionId: uuid("question_id"),
	userId: uuid("user_id"),
	disputeType: text("dispute_type").notNull(),
	description: text().notNull(),
	status: text().default('pending'),
	adminResponse: text("admin_response"),
	adminUserId: uuid("admin_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isRead: boolean("is_read").default(false),
}, (table) => [
	index("idx_psych_disputes_question").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	index("idx_psych_disputes_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_psych_disputes_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [psychometricQuestions.id],
			name: "psychometric_question_disputes_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "psychometric_question_disputes_user_id_fkey"
		}).onDelete("set null"),
	check("psychometric_question_disputes_dispute_type_check", sql`dispute_type = ANY (ARRAY['ai_detected_error'::text, 'respuesta_incorrecta'::text, 'explicacion_confusa'::text, 'datos_erroneos'::text, 'otro'::text])`),
	check("psychometric_question_disputes_status_check", sql`status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'rejected'::text])`),
]);

export const userNotificationMetrics = pgTable("user_notification_metrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	pushPermissionStatus: text("push_permission_status").default('not_requested'),
	pushSubscriptionsCount: integer("push_subscriptions_count").default(0),
	pushNotificationsSent: integer("push_notifications_sent").default(0),
	pushNotificationsClicked: integer("push_notifications_clicked").default(0),
	pushNotificationsDismissed: integer("push_notifications_dismissed").default(0),
	pushClickRate: numeric("push_click_rate", { precision: 5, scale:  2 }).default('0.00'),
	lastPushInteraction: timestamp("last_push_interaction", { withTimezone: true, mode: 'string' }),
	emailsSent: integer("emails_sent").default(0),
	emailsDelivered: integer("emails_delivered").default(0),
	emailsOpened: integer("emails_opened").default(0),
	emailsClicked: integer("emails_clicked").default(0),
	emailsBounced: integer("emails_bounced").default(0),
	emailOpenRate: numeric("email_open_rate", { precision: 5, scale:  2 }).default('0.00'),
	emailClickRate: numeric("email_click_rate", { precision: 5, scale:  2 }).default('0.00'),
	lastEmailOpened: timestamp("last_email_opened", { withTimezone: true, mode: 'string' }),
	lastEmailClicked: timestamp("last_email_clicked", { withTimezone: true, mode: 'string' }),
	primaryDeviceType: text("primary_device_type"),
	primaryBrowser: text("primary_browser"),
	notificationEngagementScore: integer("notification_engagement_score").default(0),
	emailEngagementScore: integer("email_engagement_score").default(0),
	overallEngagementScore: integer("overall_engagement_score").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_notification_metrics_engagement").using("btree", table.overallEngagementScore.asc().nullsLast().op("int4_ops")),
	index("idx_user_notification_metrics_updated").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_user_notification_metrics_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_notification_metrics_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_notification_metrics_user_id_key").on(table.userId),
	pgPolicy("Admin can view all notification metrics", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text)))))` }),
	pgPolicy("Users can view own notification metrics", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Allow users to update own notification metrics", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Allow users to update notification metrics", { as: "permissive", for: "update", to: ["public"] }),
]);

export const notificationEvents = pgTable("notification_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	eventType: text("event_type").notNull(),
	notificationType: text("notification_type"),
	deviceInfo: jsonb("device_info").default({}),
	browserInfo: jsonb("browser_info").default({}),
	pushSubscription: jsonb("push_subscription"),
	notificationData: jsonb("notification_data").default({}),
	responseTimeMs: integer("response_time_ms"),
	errorDetails: text("error_details"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	referrer: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_notification_events_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_notification_events_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_notification_events_type_date").using("btree", table.notificationType.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_notification_events_user_event").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_notification_events_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_events_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Admin can view all notification events", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text)))))` }),
	pgPolicy("Users can view own notification events", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Allow insert notification events", { as: "permissive", for: "insert", to: ["public"] }),
	check("notification_events_event_type_check", sql`event_type = ANY (ARRAY['permission_requested'::text, 'permission_granted'::text, 'permission_denied'::text, 'subscription_created'::text, 'subscription_updated'::text, 'subscription_deleted'::text, 'notification_sent'::text, 'notification_delivered'::text, 'notification_clicked'::text, 'notification_dismissed'::text, 'notification_failed'::text, 'settings_updated'::text])`),
	check("notification_events_notification_type_check", sql`notification_type = ANY (ARRAY['motivation'::text, 'streak_reminder'::text, 'achievement'::text, 'study_reminder'::text, 'reactivation'::text, 'urgent'::text, 'welcome'::text, 'test'::text])`),
]);

export const customOposiciones = pgTable("custom_oposiciones", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	nombre: text().notNull(),
	categoria: text(),
	administracion: text(),
	descripcion: text(),
	isActive: boolean("is_active").default(true),
	isPublic: boolean("is_public").default(true),
	timesSelected: integer("times_selected").default(1),
	createdByUsername: text("created_by_username"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_custom_oposiciones_nombre").using("btree", sql`lower(nombre)`).where(sql`((is_public = true) AND (is_active = true))`),
	index("idx_custom_oposiciones_popular").using("btree", table.timesSelected.desc().nullsFirst().op("int4_ops")).where(sql`((is_public = true) AND (is_active = true))`),
	index("idx_custom_oposiciones_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "custom_oposiciones_user_id_fkey"
		}).onDelete("cascade"),
	unique("unique_user_custom_oposicion").on(table.userId, table.nombre),
	pgPolicy("Users can view own and public custom oposiciones", { as: "permissive", for: "select", to: ["public"], using: sql`((auth.uid() = user_id) OR (is_public = true))` }),
	pgPolicy("Users can insert own custom oposiciones", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own custom oposiciones", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can delete own custom oposiciones", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const emailEvents = pgTable("email_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	emailType: text("email_type").notNull(),
	eventType: text("event_type").notNull(),
	emailAddress: text("email_address").notNull(),
	subject: text(),
	templateId: text("template_id"),
	campaignId: text("campaign_id"),
	emailContentPreview: text("email_content_preview"),
	linkClicked: text("link_clicked"),
	clickCount: integer("click_count").default(0),
	openCount: integer("open_count").default(0),
	deviceType: text("device_type"),
	clientName: text("client_name"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	geolocation: jsonb().default({}),
	errorDetails: text("error_details"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_email_events_campaign").using("btree", table.campaignId.asc().nullsLast().op("text_ops")),
	index("idx_email_events_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_email_events_email_address").using("btree", table.emailAddress.asc().nullsLast().op("text_ops")),
	index("idx_email_events_email_type").using("btree", table.emailType.asc().nullsLast().op("text_ops")),
	index("idx_email_events_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_email_events_user_email_type").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.emailType.asc().nullsLast().op("uuid_ops")),
	index("idx_email_events_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "email_events_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "email_events_user_id_user_profiles_fkey"
		}).onDelete("cascade"),
	pgPolicy("Admin can view all email events", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text)))))` }),
	pgPolicy("Users can view own email events", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Allow insert email events", { as: "permissive", for: "insert", to: ["public"] }),
	check("email_events_email_type_check", sql`email_type = ANY (ARRAY['welcome'::text, 'reactivation'::text, 'urgent_reactivation'::text, 'motivation'::text, 'achievement'::text, 'streak_danger'::text, 'newsletter'::text, 'system'::text, 'bienvenida_inmediato'::text, 'impugnacion_respuesta'::text, 'soporte_respuesta'::text])`),
	check("email_events_event_type_check", sql`event_type = ANY (ARRAY['sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'complained'::text, 'unsubscribed'::text])`),
]);

export const userStreaksBackup20241208 = pgTable("user_streaks_backup_20241208", {
	id: uuid(),
	userId: uuid("user_id"),
	currentStreak: integer("current_streak"),
	longestStreak: integer("longest_streak"),
	lastActivityDate: date("last_activity_date"),
	streakUpdatedAt: timestamp("streak_updated_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	backupDate: timestamp("backup_date", { withTimezone: true, mode: 'string' }),
});

export const userPsychometricPreferences = pgTable("user_psychometric_preferences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	preferredCategories: jsonb("preferred_categories").default({}),
	defaultTestLength: integer("default_test_length").default(20),
	preferredDifficulty: text("preferred_difficulty").default('mixed'),
	preferredTimeLimit: integer("preferred_time_limit").default(120),
	categoriesMastered: text("categories_mastered").array().default([""]),
	weakAreas: text("weak_areas").array().default([""]),
	favoriteQuestionTypes: text("favorite_question_types").array().default([""]),
	totalTestsCompleted: integer("total_tests_completed").default(0),
	bestCategory: text("best_category"),
	averageAccuracy: numeric("average_accuracy", { precision: 5, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_psychometric_preferences_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_psychometric_preferences_user_id_key").on(table.userId),
	pgPolicy("Users can view own preferences", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own preferences", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own preferences", { as: "permissive", for: "update", to: ["public"] }),
]);

export const tests = pgTable("tests", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	title: text().notNull(),
	testType: text("test_type").default('topic'),
	totalQuestions: integer("total_questions").notNull(),
	timeLimitMinutes: integer("time_limit_minutes").default(60),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	isCompleted: boolean("is_completed").default(false),
	score: numeric({ precision: 5, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	totalTimeSeconds: integer("total_time_seconds").default(0),
	averageTimePerQuestion: numeric("average_time_per_question").default('0'),
	temaNumber: integer("tema_number"),
	testNumber: integer("test_number"),
	detailedAnalytics: jsonb("detailed_analytics").default({}),
	questionsMetadata: jsonb("questions_metadata").default({}),
	performanceMetrics: jsonb("performance_metrics").default({}),
	userSessionData: jsonb("user_session_data").default({}),
	testUrl: varchar("test_url", { length: 500 }),
}, (table) => [
	index("idx_tests_analytics").using("gin", table.detailedAnalytics.asc().nullsLast().op("jsonb_ops")),
	index("idx_tests_completion_time").using("btree", table.completedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(is_completed = true)`),
	index("idx_tests_id_user_id").using("btree", table.id.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_tests_performance").using("gin", table.performanceMetrics.asc().nullsLast().op("jsonb_ops")),
	index("idx_tests_tema_number").using("btree", table.temaNumber.asc().nullsLast().op("int4_ops")),
	index("idx_tests_tema_test").using("btree", table.temaNumber.asc().nullsLast().op("int4_ops"), table.testNumber.asc().nullsLast().op("int4_ops")),
	index("idx_tests_test_url").using("btree", table.testUrl.asc().nullsLast().op("text_ops")),
	index("idx_tests_user_completed").using("btree", table.userId.asc().nullsLast().op("bool_ops"), table.isCompleted.asc().nullsLast().op("bool_ops")),
	index("idx_tests_user_created").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_tests_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "tests_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view own tests", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own tests", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own tests", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Admins can view all tests", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("tests_test_type_check", sql`test_type = ANY (ARRAY['practice'::text, 'exam'::text])`),
]);

export const psychometricTestSessions = pgTable("psychometric_test_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	sessionType: text("session_type").default('mixed_test').notNull(),
	categoriesSelected: uuid("categories_selected").array(),
	sectionsSelected: uuid("sections_selected").array(),
	totalQuestions: integer("total_questions").notNull(),
	timeLimitMinutes: integer("time_limit_minutes"),
	questionsAnswered: integer("questions_answered").default(0),
	correctAnswers: integer("correct_answers").default(0),
	accuracyPercentage: numeric("accuracy_percentage", { precision: 5, scale:  2 }).default('0'),
	averageTimePerQuestion: numeric("average_time_per_question", { precision: 8, scale:  2 }),
	totalTimeSeconds: integer("total_time_seconds"),
	isCompleted: boolean("is_completed").default(false),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	cognitivePerformanceScore: numeric("cognitive_performance_score", { precision: 5, scale:  2 }),
	patternRecognitionScore: numeric("pattern_recognition_score", { precision: 5, scale:  2 }),
	logicalReasoningScore: numeric("logical_reasoning_score", { precision: 5, scale:  2 }),
	attentionScore: numeric("attention_score", { precision: 5, scale:  2 }),
	deviceInfo: jsonb("device_info").default({}),
	sessionMetadata: jsonb("session_metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	categoryId: uuid("category_id"),
	questionsData: jsonb("questions_data").default({}),
}, (table) => [
	index("idx_psychometric_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_psychometric_test_sessions_completed").using("btree", table.isCompleted.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_psychometric_test_sessions_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "psychometric_test_sessions_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view own psychometric sessions", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can update own psychometric sessions", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can delete own psychometric sessions", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Users can insert own psychometric sessions", { as: "permissive", for: "insert", to: ["public"] }),
]);

export const psychometricTestAnswers = pgTable("psychometric_test_answers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	testSessionId: uuid("test_session_id").notNull(),
	questionId: uuid("question_id").notNull(),
	questionOrder: integer("question_order").notNull(),
	userAnswer: integer("user_answer"),
	isCorrect: boolean("is_correct").notNull(),
	timeSpentSeconds: integer("time_spent_seconds"),
	hesitationTime: integer("hesitation_time"),
	answerChangesCount: integer("answer_changes_count").default(0),
	confidenceLevel: text("confidence_level"),
	questionSubtype: text("question_subtype"),
	cognitiveSkillsTested: text("cognitive_skills_tested").array(),
	deviceType: text("device_type"),
	screenResolution: text("screen_resolution"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userId: uuid("user_id"),
	timeTakenSeconds: integer("time_taken_seconds"),
	interactionData: jsonb("interaction_data").default({}),
	sessionId: uuid("session_id"),
	answeredAt: timestamp("answered_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_psychometric_answers_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_psychometric_test_answers_question").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	index("idx_psychometric_test_answers_session").using("btree", table.testSessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [psychometricQuestions.id],
			name: "psychometric_test_answers_question_id_fkey"
		}),
	foreignKey({
			columns: [table.testSessionId],
			foreignColumns: [psychometricTestSessions.id],
			name: "psychometric_test_answers_test_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "psychometric_test_answers_user_id_fkey"
		}),
	pgPolicy("Users can view own test answers", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = ( SELECT psychometric_test_sessions.user_id
   FROM psychometric_test_sessions
  WHERE (psychometric_test_sessions.id = psychometric_test_answers.test_session_id)))` }),
	pgPolicy("Users can insert own test answers", { as: "permissive", for: "insert", to: ["public"] }),
	check("psychometric_test_answers_confidence_level_check", sql`confidence_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])`),
	check("psychometric_test_answers_user_answer_check", sql`user_answer = ANY (ARRAY[0, 1, 2, 3])`),
]);

export const laws = pgTable("laws", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	shortName: text("short_name").notNull(),
	description: text(),
	year: integer(),
	type: text().notNull(),
	scope: text().default('national'),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	currentVersion: text("current_version").default('1.0'),
	lastConsolidationDate: date("last_consolidation_date"),
	boeConsolidationUrl: text("boe_consolidation_url"),
	nextVerificationDate: date("next_verification_date").default(sql`(CURRENT_DATE + '3 mons'::interval)`),
	verificationStatus: text("verification_status").default('pendiente'),
	boeUrl: text("boe_url"),
	boeId: text("boe_id"),
	contentHash: text("content_hash"),
	lastChecked: timestamp("last_checked", { mode: 'string' }),
	lastModifiedBoe: date("last_modified_boe"),
	versionBoe: text("version_boe"),
	changeStatus: text("change_status"),
	changeDetectedAt: timestamp("change_detected_at", { mode: 'string' }),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	lastUpdateBoe: text("last_update_boe"),
	lastVerificationSummary: jsonb("last_verification_summary"),
	videoUrl: text("video_url"),
}, (table) => [
	pgPolicy("Enable read access for laws", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	check("laws_scope_check", sql`scope = ANY (ARRAY['national'::text, 'regional'::text, 'local'::text, 'eu'::text])`),
	check("laws_type_check", sql`type = ANY (ARRAY['constitution'::text, 'code'::text, 'law'::text, 'regulation'::text])`),
	check("laws_verification_status_check", sql`verification_status = ANY (ARRAY['actualizada'::text, 'pendiente'::text, 'desactualizada'::text, 'error'::text])`),
]);

export const aiApiUsage = pgTable("ai_api_usage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	provider: text().notNull(),
	model: text().notNull(),
	endpoint: text(),
	inputTokens: integer("input_tokens"),
	outputTokens: integer("output_tokens"),
	totalTokens: integer("total_tokens"),
	feature: text(),
	lawId: uuid("law_id"),
	articleNumber: text("article_number"),
	questionsCount: integer("questions_count"),
	estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale:  6 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ai_api_usage_feature").using("btree", table.feature.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_ai_api_usage_provider").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "ai_api_usage_law_id_fkey"
		}),
]);

export const lawSections = pgTable("law_sections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	lawId: uuid("law_id").notNull(),
	sectionType: text("section_type").notNull(),
	sectionNumber: text("section_number").notNull(),
	title: text().notNull(),
	description: text(),
	articleRangeStart: integer("article_range_start"),
	articleRangeEnd: integer("article_range_end"),
	slug: text().notNull(),
	orderPosition: integer("order_position").default(0).notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_law_sections_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_law_sections_law_id").using("btree", table.lawId.asc().nullsLast().op("uuid_ops")),
	index("idx_law_sections_order").using("btree", table.orderPosition.asc().nullsLast().op("int4_ops")),
	index("idx_law_sections_section_type").using("btree", table.sectionType.asc().nullsLast().op("text_ops")),
	index("idx_law_sections_slug").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "law_sections_law_id_fkey"
		}).onDelete("cascade"),
	unique("law_sections_slug_key").on(table.slug),
	check("check_article_range", sql`(article_range_start IS NULL) OR (article_range_end IS NULL) OR (article_range_start <= article_range_end)`),
	check("check_section_type", sql`section_type = ANY (ARRAY['titulo'::text, 'capitulo'::text, 'seccion'::text, 'libro'::text, 'parte'::text, 'anexo'::text])`),
]);

export const questions = pgTable("questions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	questionText: text("question_text").notNull(),
	optionA: text("option_a").notNull(),
	optionB: text("option_b").notNull(),
	optionC: text("option_c").notNull(),
	optionD: text("option_d").notNull(),
	correctOption: integer("correct_option").notNull(),
	explanation: text().notNull(),
	difficulty: text().default('medium'),
	questionType: text("question_type").default('single'),
	tags: text().array(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	primaryArticleId: uuid("primary_article_id").notNull(),
	isOfficialExam: boolean("is_official_exam").default(false),
	examSource: text("exam_source"),
	examDate: date("exam_date"),
	examEntity: text("exam_entity"),
	examPosition: text("exam_position"),
	officialDifficultyLevel: text("official_difficulty_level"),
	contentHash: text("content_hash"),
	globalDifficulty: numeric("global_difficulty"),
	difficultyConfidence: numeric("difficulty_confidence").default('0'),
	difficultySampleSize: integer("difficulty_sample_size").default(0),
	lastDifficultyUpdate: timestamp("last_difficulty_update", { withTimezone: true, mode: 'string' }),
	globalDifficultyCategory: text("global_difficulty_category"),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	verificationStatus: text("verification_status"),
	topicReviewStatus: text("topic_review_status"),
}, (table) => [
	uniqueIndex("idx_questions_content_hash").using("btree", table.contentHash.asc().nullsLast().op("text_ops")).where(sql`(content_hash IS NOT NULL)`),
	index("idx_questions_difficulty").using("btree", table.difficulty.asc().nullsLast().op("text_ops")),
	index("idx_questions_global_difficulty_category").using("btree", table.globalDifficultyCategory.asc().nullsLast().op("text_ops")).where(sql`(global_difficulty_category IS NOT NULL)`),
	index("idx_questions_official_article").using("btree", table.primaryArticleId.asc().nullsLast().op("bool_ops"), table.isOfficialExam.asc().nullsLast().op("uuid_ops")),
	index("idx_questions_official_exam").using("btree", table.isOfficialExam.asc().nullsLast().op("bool_ops")).where(sql`(is_official_exam = true)`),
	index("idx_questions_primary_article").using("btree", table.primaryArticleId.asc().nullsLast().op("uuid_ops")),
	index("idx_questions_verification_status").using("btree", table.verificationStatus.asc().nullsLast().op("text_ops")).where(sql`(verification_status IS NOT NULL)`),
	index("idx_questions_verified_at").using("btree", table.verifiedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(verified_at IS NULL)`),
	foreignKey({
			columns: [table.primaryArticleId],
			foreignColumns: [articles.id],
			name: "questions_primary_article_id_fkey"
		}),
	pgPolicy("Enable read access for questions", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	check("questions_correct_option_check", sql`(correct_option >= 0) AND (correct_option <= 3)`),
	check("questions_question_type_check", sql`question_type = ANY (ARRAY['single'::text, 'multiple'::text, 'true_false'::text])`),
]);

export const contentCollections = pgTable("content_collections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	icon: text(),
	color: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("content_collections_slug_key").on(table.slug),
]);

export const telegramAlerts = pgTable("telegram_alerts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	groupId: bigint("group_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	messageId: bigint("message_id", { mode: "number" }).notNull(),
	messageText: text("message_text").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	senderId: bigint("sender_id", { mode: "number" }),
	senderName: text("sender_name"),
	senderUsername: text("sender_username"),
	matchedKeywords: text("matched_keywords").array().notNull(),
	isRead: boolean("is_read").default(false),
	isReplied: boolean("is_replied").default(false),
	replyText: text("reply_text"),
	repliedAt: timestamp("replied_at", { withTimezone: true, mode: 'string' }),
	detectedAt: timestamp("detected_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_telegram_alerts_detected").using("btree", table.detectedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_telegram_alerts_unread").using("btree", table.isRead.asc().nullsLast().op("bool_ops")).where(sql`(is_read = false)`),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [telegramGroups.id],
			name: "telegram_alerts_group_id_fkey"
		}).onDelete("cascade"),
	unique("telegram_alerts_group_id_message_id_key").on(table.groupId, table.messageId),
]);

export const publicUserProfiles = pgTable("public_user_profiles", {
	id: uuid().primaryKey().notNull(),
	displayName: text("display_name").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	ciudad: text(),
	avatarType: varchar("avatar_type", { length: 50 }),
	avatarEmoji: varchar("avatar_emoji", { length: 10 }),
	avatarColor: varchar("avatar_color", { length: 100 }),
	avatarName: varchar("avatar_name", { length: 50 }),
	avatarUrl: text("avatar_url"),
}, (table) => [
	index("idx_public_user_profiles_display_name").using("btree", table.displayName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "public_user_profiles_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Public profiles are viewable by authenticated users", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Users can update own public profile", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Perfiles públicos visibles para todos", { as: "permissive", for: "select", to: ["public"] }),
]);

export const oposiciones = pgTable("oposiciones", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	nombre: text().notNull(),
	tipoAcceso: text("tipo_acceso").notNull(),
	administracion: text().notNull(),
	categoria: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	slug: text(),
	shortName: text("short_name"),
	grupo: text(),
	examDate: date("exam_date"),
	inscriptionStart: date("inscription_start"),
	inscriptionDeadline: date("inscription_deadline"),
	boePublicationDate: date("boe_publication_date"),
	boeReference: text("boe_reference"),
	plazasLibres: integer("plazas_libres"),
	plazasPromocionInterna: integer("plazas_promocion_interna"),
	plazasDiscapacidad: integer("plazas_discapacidad"),
	temasCount: integer("temas_count"),
	bloquesCount: integer("bloques_count"),
	tituloRequerido: text("titulo_requerido"),
	salarioMin: integer("salario_min"),
	salarioMax: integer("salario_max"),
	isActive: boolean("is_active").default(true),
	isConvocatoriaActiva: boolean("is_convocatoria_activa").default(false),
}, (table) => [
	check("oposiciones_tipo_acceso_check", sql`tipo_acceso = ANY (ARRAY['libre'::text, 'promocion_interna'::text, 'discapacidad'::text])`),
]);

export const telegramGroups = pgTable("telegram_groups", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().notNull(),
	title: text().notNull(),
	username: text(),
	memberCount: integer("member_count"),
	isMonitoring: boolean("is_monitoring").default(true),
	keywords: text().array().default(["RAY['test'::text", "'vence'::text", "'oposiciones'::text", "'auxiliar'::tex"]),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const psychometricUserQuestionHistory = pgTable("psychometric_user_question_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	questionId: uuid("question_id").notNull(),
	attempts: integer().default(1),
	correctAttempts: integer("correct_attempts").default(0),
	totalTimeSeconds: integer("total_time_seconds").default(0),
	personalDifficulty: numeric("personal_difficulty"),
	firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	trend: text().default('stable'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_psychometric_user_history_difficulty").using("btree", table.personalDifficulty.asc().nullsLast().op("numeric_ops")),
	index("idx_psychometric_user_history_question").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	index("idx_psychometric_user_history_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [psychometricQuestions.id],
			name: "psychometric_user_question_history_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "psychometric_user_question_history_user_id_fkey"
		}).onDelete("cascade"),
	unique("psychometric_user_question_history_user_id_question_id_key").on(table.userId, table.questionId),
	pgPolicy("Users can view their own question history", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("System can manage question history", { as: "permissive", for: "all", to: ["public"] }),
]);

export const upgradeMessageImpressions = pgTable("upgrade_message_impressions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	messageId: uuid("message_id"),
	shownAt: timestamp("shown_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	clickedUpgrade: boolean("clicked_upgrade").default(false),
	clickedAt: timestamp("clicked_at", { withTimezone: true, mode: 'string' }),
	dismissed: boolean().default(false),
	dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: 'string' }),
	convertedToPremium: boolean("converted_to_premium").default(false),
	convertedAt: timestamp("converted_at", { withTimezone: true, mode: 'string' }),
	triggerType: text("trigger_type").default('daily_limit'),
	questionsAnswered: integer("questions_answered"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_upgrade_impressions_date").using("btree", table.shownAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_upgrade_impressions_message").using("btree", table.messageId.asc().nullsLast().op("uuid_ops")),
	index("idx_upgrade_impressions_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [upgradeMessages.id],
			name: "upgrade_message_impressions_message_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "upgrade_message_impressions_user_id_fkey"
		}).onDelete("set null"),
]);

export const upgradeMessages = pgTable("upgrade_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	messageKey: text("message_key").notNull(),
	title: text().notNull(),
	subtitle: text().notNull(),
	bodyMessage: text("body_message").notNull(),
	highlight: text().notNull(),
	icon: text().default('money'),
	gradient: text().default('from-amber-500 via-orange-500 to-red-500'),
	isActive: boolean("is_active").default(true),
	weight: integer().default(1),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_upgrade_messages_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	unique("upgrade_messages_message_key_key").on(table.messageKey),
]);

export const contentSections = pgTable("content_sections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	collectionId: uuid("collection_id").notNull(),
	sectionNumber: integer("section_number").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	icon: text(),
	orderPosition: integer("order_position").notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.collectionId],
			foreignColumns: [contentCollections.id],
			name: "content_sections_collection_id_fkey"
		}).onDelete("cascade"),
	unique("content_sections_collection_id_slug_key").on(table.collectionId, table.slug),
	unique("content_sections_collection_id_section_number_key").on(table.collectionId, table.sectionNumber),
]);

export const contentScope = pgTable("content_scope", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	collectionId: uuid("collection_id").notNull(),
	sectionId: uuid("section_id"),
	lawId: uuid("law_id").notNull(),
	articleNumbers: text("article_numbers").array().notNull(),
	weight: numeric().default('1.0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.collectionId],
			foreignColumns: [contentCollections.id],
			name: "content_scope_collection_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "content_scope_law_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sectionId],
			foreignColumns: [contentSections.id],
			name: "content_scope_section_id_fkey"
		}).onDelete("cascade"),
	unique("content_scope_collection_id_section_id_law_id_key").on(table.collectionId, table.sectionId, table.lawId),
]);

export const userMessageInteractions = pgTable("user_message_interactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	messageId: uuid("message_id").notNull(),
	actionType: text("action_type").notNull(),
	shownIn: text("shown_in"),
	messageText: text("message_text"),
	sharePlatform: text("share_platform"),
	deviceInfo: jsonb("device_info").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_message_interactions_action").using("btree", table.actionType.asc().nullsLast().op("text_ops")),
	index("idx_user_message_interactions_message").using("btree", table.messageId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_message_interactions_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [motivationalMessages.id],
			name: "user_message_interactions_message_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_message_interactions_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_message_interactions_user_id_message_id_action_type_key").on(table.userId, table.messageId, table.actionType),
	pgPolicy("Users can read own interactions", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can create own interactions", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own interactions", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Admins can read all interactions", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can insert their own message interactions", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can view their own message interactions", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const motivationalMessages = pgTable("motivational_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	category: text().notNull(),
	subcategory: text(),
	messageVariants: jsonb("message_variants").notNull(),
	genderTarget: text("gender_target").default('neutral'),
	regionTarget: text("region_target").array(),
	minAccuracy: numeric("min_accuracy"),
	maxAccuracy: numeric("max_accuracy"),
	minStreak: integer("min_streak"),
	maxStreak: integer("max_streak"),
	timeOfDay: text("time_of_day").array(),
	dayOfWeek: integer("day_of_week").array(),
	emoji: text().default('💪').notNull(),
	tone: text().default('motivational').notNull(),
	colorScheme: text("color_scheme").default('blue'),
	priority: integer().default(1),
	maxShowsPerUser: integer("max_shows_per_user"),
	cooldownHours: integer("cooldown_hours").default(0),
	isActive: boolean("is_active").default(true),
	totalViews: integer("total_views").default(0),
	totalLikes: integer("total_likes").default(0),
	totalShares: integer("total_shares").default(0),
	likeRate: numeric("like_rate").default('0.00'),
	shareRate: numeric("share_rate").default('0.00'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_motivational_messages_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_motivational_messages_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	pgPolicy("Anyone can read active messages", { as: "permissive", for: "select", to: ["public"], using: sql`(is_active = true)` }),
	pgPolicy("Only admins can manage messages", { as: "permissive", for: "all", to: ["public"] }),
]);

export const shareEvents = pgTable("share_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	shareType: text("share_type").default('exam_result').notNull(),
	platform: text().notNull(),
	score: numeric({ precision: 4, scale:  2 }),
	testSessionId: uuid("test_session_id"),
	shareText: text("share_text"),
	shareUrl: text("share_url"),
	deviceInfo: jsonb("device_info").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_share_events_platform").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	index("idx_share_events_type").using("btree", table.shareType.asc().nullsLast().op("text_ops")),
	index("idx_share_events_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_share_events_user_created").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "share_events_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can create own shares", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id)`  }),
	pgPolicy("Users can read own shares", { as: "permissive", for: "select", to: ["public"] }),
]);

export const articleUpdateLogs = pgTable("article_update_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	lawId: uuid("law_id"),
	articleId: uuid("article_id"),
	articleNumber: text("article_number").notNull(),
	oldTitle: text("old_title"),
	newTitle: text("new_title"),
	changeType: text("change_type").default('title_update'),
	source: text().default('boe_verification'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_article_update_logs_law").using("btree", table.lawId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.articleId],
			foreignColumns: [articles.id],
			name: "article_update_logs_article_id_fkey"
		}),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "article_update_logs_law_id_fkey"
		}),
]);

export const aiApiConfig = pgTable("ai_api_config", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	provider: text().notNull(),
	apiKeyEncrypted: text("api_key_encrypted"),
	apiKeyHint: text("api_key_hint"),
	isActive: boolean("is_active").default(true),
	defaultModel: text("default_model"),
	lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: 'string' }),
	lastVerificationStatus: text("last_verification_status"),
	lastErrorMessage: text("last_error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("ai_api_config_provider_key").on(table.provider),
]);

export const aiVerificationErrors = pgTable("ai_verification_errors", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	lawId: uuid("law_id"),
	articleNumber: text("article_number"),
	provider: text().notNull(),
	model: text(),
	prompt: text(),
	rawResponse: text("raw_response"),
	errorMessage: text("error_message").notNull(),
	errorType: text("error_type"),
	questionsCount: integer("questions_count"),
	tokensUsed: jsonb("tokens_used"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ai_verification_errors_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_ai_verification_errors_error_type").using("btree", table.errorType.asc().nullsLast().op("text_ops")),
	index("idx_ai_verification_errors_law_id").using("btree", table.lawId.asc().nullsLast().op("uuid_ops")),
	index("idx_ai_verification_errors_provider").using("btree", table.provider.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.lawId],
			foreignColumns: [laws.id],
			name: "ai_verification_errors_law_id_fkey"
		}),
]);

export const dailyQuestionUsage = pgTable("daily_question_usage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	usageDate: date("usage_date").notNull(),
	questionsAnswered: integer("questions_answered").default(0),
	lastQuestionAt: timestamp("last_question_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_daily_usage_user_date").using("btree", table.userId.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "daily_question_usage_user_id_fkey"
		}).onDelete("cascade"),
	unique("unique_user_date").on(table.userId, table.usageDate),
	pgPolicy("Users can read own usage", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own usage", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own usage", { as: "permissive", for: "update", to: ["public"] }),
]);

export const questionFirstAttempts = pgTable("question_first_attempts", {
	userId: uuid("user_id").notNull(),
	questionId: uuid("question_id").notNull(),
	isCorrect: boolean("is_correct").notNull(),
	timeSpentSeconds: integer("time_spent_seconds"),
	confidenceLevel: text("confidence_level"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_question_first_attempts_correct").using("btree", table.isCorrect.asc().nullsLast().op("bool_ops")),
	index("idx_question_first_attempts_created").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_question_first_attempts_question").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	index("idx_question_first_attempts_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "question_first_attempts_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "question_first_attempts_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.questionId], name: "question_first_attempts_pkey"}),
]);

export const psychometricFirstAttempts = pgTable("psychometric_first_attempts", {
	userId: uuid("user_id").notNull(),
	questionId: uuid("question_id").notNull(),
	isCorrect: boolean("is_correct").notNull(),
	timeTakenSeconds: integer("time_taken_seconds"),
	interactionData: jsonb("interaction_data").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_first_attempts_user_question").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.questionId.asc().nullsLast().op("uuid_ops")),
	index("idx_psychometric_first_attempts_correct").using("btree", table.isCorrect.asc().nullsLast().op("bool_ops")),
	index("idx_psychometric_first_attempts_created").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_psychometric_first_attempts_question").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	index("idx_psychometric_first_attempts_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [psychometricQuestions.id],
			name: "psychometric_first_attempts_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "psychometric_first_attempts_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.questionId], name: "psychometric_first_attempts_pkey"}),
	pgPolicy("Users can view own first attempts", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own first attempts", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own first attempts", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can delete own first attempts", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const lawQuestionFirstAttempts = pgTable("law_question_first_attempts", {
	userId: uuid("user_id").notNull(),
	questionId: uuid("question_id").notNull(),
	isCorrect: boolean("is_correct").notNull(),
	timeTakenSeconds: integer("time_taken_seconds"),
	confidenceLevel: text("confidence_level"),
	interactionData: jsonb("interaction_data").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_law_first_attempts_correct").using("btree", table.isCorrect.asc().nullsLast().op("bool_ops")),
	index("idx_law_first_attempts_created").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_law_first_attempts_question").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	index("idx_law_first_attempts_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "law_question_first_attempts_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "law_question_first_attempts_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.questionId], name: "law_question_first_attempts_pkey"}),
	pgPolicy("Users can view their own first attempts", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert their own first attempts", { as: "permissive", for: "insert", to: ["public"] }),
]);
export const conversionFunnelStats = pgView("conversion_funnel_stats", {	registrationSource: text("registration_source"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	registrations: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	completedFirstTest: bigint("completed_first_test", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	hitLimit: bigint("hit_limit", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sawModal: bigint("saw_modal", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clickedUpgrade: bigint("clicked_upgrade", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	visitedPremium: bigint("visited_premium", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startedCheckout: bigint("started_checkout", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	paid: bigint({ mode: "number" }),
	conversionRate: numeric("conversion_rate"),
}).as(sql`SELECT registration_source, count(DISTINCT CASE WHEN event_type = 'registration'::text THEN user_id ELSE NULL::uuid END) AS registrations, count(DISTINCT CASE WHEN event_type = 'first_test_completed'::text THEN user_id ELSE NULL::uuid END) AS completed_first_test, count(DISTINCT CASE WHEN event_type = 'limit_reached'::text THEN user_id ELSE NULL::uuid END) AS hit_limit, count(DISTINCT CASE WHEN event_type = 'upgrade_modal_viewed'::text THEN user_id ELSE NULL::uuid END) AS saw_modal, count(DISTINCT CASE WHEN event_type = 'upgrade_button_clicked'::text THEN user_id ELSE NULL::uuid END) AS clicked_upgrade, count(DISTINCT CASE WHEN event_type = 'premium_page_viewed'::text THEN user_id ELSE NULL::uuid END) AS visited_premium, count(DISTINCT CASE WHEN event_type = 'checkout_started'::text THEN user_id ELSE NULL::uuid END) AS started_checkout, count(DISTINCT CASE WHEN event_type = 'payment_completed'::text THEN user_id ELSE NULL::uuid END) AS paid, round(100.0 * count(DISTINCT CASE WHEN event_type = 'payment_completed'::text THEN user_id ELSE NULL::uuid END)::numeric / NULLIF(count(DISTINCT CASE WHEN event_type = 'registration'::text THEN user_id ELSE NULL::uuid END), 0)::numeric, 2) AS conversion_rate FROM conversion_events GROUP BY registration_source`);

export const conversionTimeAnalysis = pgView("conversion_time_analysis", {	registrationSource: text("registration_source"),
	avgDaysToConvert: numeric("avg_days_to_convert"),
	minDays: integer("min_days"),
	maxDays: integer("max_days"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalConversions: bigint("total_conversions", { mode: "number" }),
}).as(sql`SELECT registration_source, avg(days_since_registration) AS avg_days_to_convert, min(days_since_registration) AS min_days, max(days_since_registration) AS max_days, count(*) AS total_conversions FROM conversion_events WHERE event_type = 'payment_completed'::text GROUP BY registration_source`);

export const adminRoleStats = pgView("admin_role_stats", {	role: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalUsers: bigint("total_users", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activeUsers: bigint("active_users", { mode: "number" }),
	firstGranted: timestamp("first_granted", { withTimezone: true, mode: 'string' }),
	lastGranted: timestamp("last_granted", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT role, count(*) AS total_users, count(*) FILTER (WHERE is_active = true) AS active_users, min(granted_at) AS first_granted, max(granted_at) AS last_granted FROM user_roles GROUP BY role ORDER BY (count(*)) DESC`);

export const hotArticlesDashboard = pgView("hot_articles_dashboard", {	articuloCompleto: text("articulo_completo"),
	oposicion: text(),
	hotnessScore: numeric("hotness_score"),
	priorityLevel: text("priority_level"),
	apariciones: integer(),
	examenesDistintos: integer("examenes_distintos"),
	nivelVisual: text("nivel_visual"),
	ultimaActualizacion: timestamp("ultima_actualizacion", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT ((article_number || ' ('::text) || law_name) || ')'::text AS articulo_completo, target_oposicion AS oposicion, hotness_score, priority_level, total_official_appearances AS apariciones, unique_exams_count AS examenes_distintos, CASE WHEN hotness_score >= 85::numeric THEN '🔥 CRÍTICO'::text WHEN hotness_score >= 65::numeric THEN '⚡ ALTO'::text WHEN hotness_score >= 40::numeric THEN '📌 MEDIO'::text ELSE '💡 BAJO'::text END AS nivel_visual, last_calculation_date AS ultima_actualizacion FROM hot_articles ha ORDER BY target_oposicion, hotness_score DESC`);

export const adminPwaStats = pgView("admin_pwa_stats", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalInstallations: bigint("total_installations", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activePwaUsers: bigint("active_pwa_users", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	promptShows: bigint("prompt_shows", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalInstalls: bigint("total_installs", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPrompts: bigint("total_prompts", { mode: "number" }),
	conversionRatePercentage: numeric("conversion_rate_percentage"),
}).as(sql`SELECT count(DISTINCT pe.user_id) FILTER (WHERE pe.event_type = 'pwa_installed'::text) AS total_installations, count(DISTINCT ps.user_id) FILTER (WHERE ps.is_standalone = true) AS active_pwa_users, count(DISTINCT pe.user_id) FILTER (WHERE pe.event_type = 'install_prompt_shown'::text) AS prompt_shows, count(*) FILTER (WHERE pe.event_type = 'pwa_installed'::text) AS total_installs, count(*) FILTER (WHERE pe.event_type = 'install_prompt_shown'::text) AS total_prompts, round(count(*) FILTER (WHERE pe.event_type = 'pwa_installed'::text)::numeric / NULLIF(count(*) FILTER (WHERE pe.event_type = 'install_prompt_shown'::text), 0)::numeric * 100::numeric, 2) AS conversion_rate_percentage FROM pwa_events pe LEFT JOIN pwa_sessions ps ON pe.user_id = ps.user_id WHERE pe.created_at >= (now() - '30 days'::interval)`);

export const usersNeedingNotifications = pgView("users_needing_notifications", {	userId: uuid("user_id"),
	pushSubscription: jsonb("push_subscription"),
	preferredTimes: jsonb("preferred_times"),
	timezone: text(),
	motivationLevel: text("motivation_level"),
	examDate: date("exam_date"),
	nextNotificationTime: timestamp("next_notification_time", { withTimezone: true, mode: 'string' }),
	riskLevel: text("risk_level"),
	streakStatus: integer("streak_status"),
	preferredHours: integer("preferred_hours"),
	peakPerformanceTime: time("peak_performance_time"),
	hoursSinceLastSession: numeric("hours_since_last_session"),
}).as(sql`SELECT uns.user_id, uns.push_subscription, uns.preferred_times, uns.timezone, uns.motivation_level, uns.exam_date, uss.next_notification_time, uss.risk_level, uss.streak_status, uap.preferred_hours, uap.peak_performance_time, EXTRACT(epoch FROM now() - uss.last_session_time) / 3600::numeric AS hours_since_last_session FROM user_notification_settings uns JOIN user_smart_scheduling uss ON uns.user_id = uss.user_id LEFT JOIN user_activity_patterns uap ON uns.user_id = uap.user_id WHERE uns.push_enabled = true AND uns.frequency <> 'off'::text AND (uss.pause_until IS NULL OR uss.pause_until < now()) AND uss.next_notification_time <= now()`);

export const adminNotificationAnalytics = pgView("admin_notification_analytics", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalUsersWithNotifications: bigint("total_users_with_notifications", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalNotificationEvents: bigint("total_notification_events", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pushPermissionsGranted: bigint("push_permissions_granted", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pushPermissionsDenied: bigint("push_permissions_denied", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pushNotificationsSent: bigint("push_notifications_sent", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pushNotificationsClicked: bigint("push_notifications_clicked", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pushNotificationsDismissed: bigint("push_notifications_dismissed", { mode: "number" }),
	pushClickRate: numeric("push_click_rate"),
	platform: text(),
	browserName: text("browser_name"),
	date: timestamp({ withTimezone: true, mode: 'string' }),
}).as(sql`SELECT count(DISTINCT user_id) AS total_users_with_notifications, count(*) AS total_notification_events, count(*) FILTER (WHERE event_type = 'permission_granted'::text) AS push_permissions_granted, count(*) FILTER (WHERE event_type = 'permission_denied'::text) AS push_permissions_denied, count(*) FILTER (WHERE event_type = 'notification_sent'::text) AS push_notifications_sent, count(*) FILTER (WHERE event_type = 'notification_clicked'::text) AS push_notifications_clicked, count(*) FILTER (WHERE event_type = 'notification_dismissed'::text) AS push_notifications_dismissed, round(count(*) FILTER (WHERE event_type = 'notification_clicked'::text)::numeric / NULLIF(count(*) FILTER (WHERE event_type = 'notification_sent'::text), 0)::numeric * 100::numeric, 2) AS push_click_rate, device_info ->> 'platform'::text AS platform, browser_info ->> 'name'::text AS browser_name, date_trunc('day'::text, created_at) AS date FROM notification_events WHERE created_at >= (now() - '30 days'::interval) GROUP BY (date_trunc('day'::text, created_at)), (device_info ->> 'platform'::text), (browser_info ->> 'name'::text)`);

export const adminEmailAnalytics = pgView("admin_email_analytics", {	emailType: text("email_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	emailsSent: bigint("emails_sent", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	emailsDelivered: bigint("emails_delivered", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	emailsOpened: bigint("emails_opened", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	emailsClicked: bigint("emails_clicked", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	emailsBounced: bigint("emails_bounced", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	unsubscribed: bigint({ mode: "number" }),
	openRate: numeric("open_rate"),
	clickRate: numeric("click_rate"),
	date: timestamp({ withTimezone: true, mode: 'string' }),
}).as(sql`SELECT email_type, count(*) FILTER (WHERE event_type = 'sent'::text) AS emails_sent, count(*) FILTER (WHERE event_type = 'delivered'::text) AS emails_delivered, count(*) FILTER (WHERE event_type = 'opened'::text) AS emails_opened, count(*) FILTER (WHERE event_type = 'clicked'::text) AS emails_clicked, count(*) FILTER (WHERE event_type = 'bounced'::text) AS emails_bounced, count(*) FILTER (WHERE event_type = 'unsubscribed'::text) AS unsubscribed, round(count(*) FILTER (WHERE event_type = 'opened'::text)::numeric / NULLIF(count(*) FILTER (WHERE event_type = 'delivered'::text), 0)::numeric * 100::numeric, 2) AS open_rate, round(count(*) FILTER (WHERE event_type = 'clicked'::text)::numeric / NULLIF(count(*) FILTER (WHERE event_type = 'delivered'::text), 0)::numeric * 100::numeric, 2) AS click_rate, date_trunc('day'::text, created_at) AS date FROM email_events WHERE created_at >= (now() - '30 days'::interval) GROUP BY email_type, (date_trunc('day'::text, created_at))`);

export const adminDisputesDashboard = pgView("admin_disputes_dashboard", {	id: uuid(),
	disputeType: text("dispute_type"),
	description: text(),
	status: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	reporterName: text("reporter_name"),
	questionText: text("question_text"),
	articleNumber: text("article_number"),
	lawName: text("law_name"),
	daysSinceCreated: numeric("days_since_created"),
	priorityStatus: text("priority_status"),
}).as(sql`SELECT qd.id, qd.dispute_type, qd.description, qd.status, qd.created_at, up.full_name AS reporter_name, q.question_text, a.article_number, l.short_name AS law_name, EXTRACT(days FROM now() - qd.created_at) AS days_since_created, CASE WHEN qd.status = 'pending'::text AND EXTRACT(days FROM now() - qd.created_at) > 7::numeric THEN 'urgent'::text WHEN qd.status = 'pending'::text THEN 'pending'::text ELSE qd.status END AS priority_status FROM question_disputes qd LEFT JOIN user_profiles up ON qd.user_id = up.id LEFT JOIN questions q ON qd.question_id = q.id LEFT JOIN articles a ON q.primary_article_id = a.id LEFT JOIN laws l ON a.law_id = l.id`);

export const adminUsersWithRoles = pgView("admin_users_with_roles", {	userId: uuid("user_id"),
	email: text(),
	fullName: text("full_name"),
	planType: text("plan_type"),
	registrationSource: text("registration_source"),
	requiresPayment: boolean("requires_payment"),
	stripeCustomerId: text("stripe_customer_id"),
	userCreatedAt: timestamp("user_created_at", { withTimezone: true, mode: 'string' }),
	userUpdatedAt: timestamp("user_updated_at", { withTimezone: true, mode: 'string' }),
	isActiveStudent: boolean("is_active_student"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalTests30D: bigint("total_tests_30d", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	completedTests30D: bigint("completed_tests_30d", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	abandonedTests30D: bigint("abandoned_tests_30d", { mode: "number" }),
	lastTestDate: timestamp("last_test_date", { withTimezone: true, mode: 'string' }),
	avgScore30D: numeric("avg_score_30d"),
}).as(sql`SELECT up.id AS user_id, up.email, up.full_name, up.plan_type, up.registration_source, up.requires_payment, up.stripe_customer_id, up.created_at AS user_created_at, up.updated_at AS user_updated_at, CASE WHEN up.plan_type = ANY (ARRAY['legacy_free'::text, 'free'::text, 'trial'::text, 'premium'::text]) THEN true ELSE false END AS is_active_student, count(t.id) AS total_tests_30d, count( CASE WHEN t.is_completed = true THEN 1 ELSE NULL::integer END) AS completed_tests_30d, count( CASE WHEN t.is_completed = false THEN 1 ELSE NULL::integer END) AS abandoned_tests_30d, max(t.created_at) AS last_test_date, round(avg( CASE WHEN t.is_completed = true AND t.score IS NOT NULL THEN t.score ELSE NULL::numeric END), 1) AS avg_score_30d FROM user_profiles up LEFT JOIN tests t ON up.id = t.user_id AND t.created_at >= (now() - '30 days'::interval) GROUP BY up.id, up.email, up.full_name, up.plan_type, up.registration_source, up.requires_payment, up.stripe_customer_id, up.created_at, up.updated_at ORDER BY up.created_at DESC`);

export const adminUpgradeMessageStats = pgView("admin_upgrade_message_stats", {	id: uuid(),
	messageKey: text("message_key"),
	title: text(),
	isActive: boolean("is_active"),
	weight: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalImpressions: bigint("total_impressions", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalClicks: bigint("total_clicks", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalDismisses: bigint("total_dismisses", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalConversions: bigint("total_conversions", { mode: "number" }),
	clickRate: numeric("click_rate"),
	conversionRate: numeric("conversion_rate"),
}).as(sql`SELECT um.id, um.message_key, um.title, um.is_active, um.weight, count(umi.id) AS total_impressions, count(umi.id) FILTER (WHERE umi.clicked_upgrade) AS total_clicks, count(umi.id) FILTER (WHERE umi.dismissed) AS total_dismisses, count(umi.id) FILTER (WHERE umi.converted_to_premium) AS total_conversions, round(count(umi.id) FILTER (WHERE umi.clicked_upgrade)::numeric / NULLIF(count(umi.id), 0)::numeric * 100::numeric, 2) AS click_rate, round(count(umi.id) FILTER (WHERE umi.converted_to_premium)::numeric / NULLIF(count(umi.id), 0)::numeric * 100::numeric, 2) AS conversion_rate FROM upgrade_messages um LEFT JOIN upgrade_message_impressions umi ON umi.message_id = um.id GROUP BY um.id ORDER BY (count(umi.id)) DESC`);

export const adminShareAnalytics = pgView("admin_share_analytics", {	fecha: timestamp({ withTimezone: true, mode: 'string' }),
	shareType: text("share_type"),
	platform: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalShares: bigint("total_shares", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usuariosUnicos: bigint("usuarios_unicos", { mode: "number" }),
	notaPromedioCompartida: numeric("nota_promedio_compartida"),
}).as(sql`SELECT date_trunc('day'::text, created_at) AS fecha, share_type, platform, count(*) AS total_shares, count(DISTINCT user_id) AS usuarios_unicos, avg(score) AS nota_promedio_compartida FROM share_events GROUP BY (date_trunc('day'::text, created_at)), share_type, platform ORDER BY (date_trunc('day'::text, created_at)) DESC`);

// Base de conocimiento para el chat IA: FAQs, info de planes, funcionalidades
export const aiKnowledgeBase = pgTable("ai_knowledge_base", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	category: text().notNull(), // 'planes', 'funcionalidades', 'faq', 'plataforma', 'oposiciones'
	subcategory: text(),
	title: text().notNull(), // Título/pregunta: "¿Qué incluye el plan Free?"
	content: text().notNull(), // Respuesta completa en markdown
	shortAnswer: text("short_answer"), // Respuesta corta para respuestas rápidas
	keywords: text().array().default([]), // Keywords para fallback sin embeddings
	// embedding: vector(1536) - Se añade con migración SQL (pgvector)
	priority: integer().default(0), // Mayor = más prioridad
	isActive: boolean("is_active").default(true),
	metadata: jsonb().default({}), // Info extra: precios, links, etc.
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ai_knowledge_base_category").using("btree", table.category.asc().nullsLast()),
	index("idx_ai_knowledge_base_active").using("btree", table.isActive.asc().nullsLast()),
	pgPolicy("Anyone can read knowledge base", { as: "permissive", for: "select", to: ["public"], using: sql`is_active = true` }),
]);

// Sistema de alertas de fraude: multi-cuentas, IPs compartidas, dispositivos duplicados
export const fraudAlerts = pgTable("fraud_alerts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	alertType: text("alert_type").notNull(), // 'same_ip', 'same_device', 'multi_account', 'suspicious_premium', 'location_anomaly'
	severity: text().notNull().default('medium'), // 'low', 'medium', 'high', 'critical'
	status: text().notNull().default('new'), // 'new', 'reviewed', 'dismissed', 'action_taken'
	userIds: uuid("user_ids").array().notNull(), // Array de user_ids involucrados
	details: jsonb().default({}), // Detalles: IPs, devices, locations, etc.
	matchCriteria: text("match_criteria"), // Qué criterios coincidieron: 'ip+device', 'name+device', etc.
	detectedAt: timestamp("detected_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewedBy: uuid("reviewed_by"),
	notes: text(), // Notas del admin
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_fraud_alerts_status").using("btree", table.status.asc().nullsLast()),
	index("idx_fraud_alerts_type").using("btree", table.alertType.asc().nullsLast()),
	index("idx_fraud_alerts_severity").using("btree", table.severity.asc().nullsLast()),
	index("idx_fraud_alerts_detected").using("btree", table.detectedAt.desc().nullsFirst()),
	foreignKey({
		columns: [table.reviewedBy],
		foreignColumns: [users.id],
		name: "fraud_alerts_reviewed_by_fkey"
	}).onDelete("set null"),
]);

// ============================================
// CONVOCATORIAS BOE
// Sistema de detección y almacenamiento de convocatorias del BOE
// ============================================

export const convocatoriasBoe = pgTable("convocatorias_boe", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),

	// Identificación BOE
	boeId: text("boe_id").unique().notNull(),
	boeFecha: date("boe_fecha").notNull(),
	boeUrlPdf: text("boe_url_pdf"),
	boeUrlHtml: text("boe_url_html"),
	boeUrlXml: text("boe_url_xml"),

	// Datos extraídos del sumario
	titulo: text().notNull(),
	tituloLimpio: text("titulo_limpio"),
	departamentoCodigo: text("departamento_codigo"),
	departamentoNombre: text("departamento_nombre"),
	epigrafe: text(),

	// Clasificación
	tipo: text(), // 'convocatoria'|'admitidos'|'tribunal'|'resultado'|'correccion'|'otro'
	categoria: text(), // 'A1'|'A2'|'B'|'C1'|'C2'
	cuerpo: text(),
	acceso: text(), // 'libre'|'promocion_interna'|'mixto'|'discapacidad'

	// Plazas
	numPlazas: integer("num_plazas"),
	numPlazasLibre: integer("num_plazas_libre"),
	numPlazasPi: integer("num_plazas_pi"),
	numPlazasDiscapacidad: integer("num_plazas_discapacidad"),

	// Fechas importantes
	fechaDisposicion: date("fecha_disposicion"),
	fechaLimiteInscripcion: date("fecha_limite_inscripcion"),
	fechaExamen: date("fecha_examen"),

	// Relaciones
	oposicionRelacionada: text("oposicion_relacionada"),
	convocatoriaOrigenId: uuid("convocatoria_origen_id"),

	// Contenido (desde XML)
	resumen: text(),
	contenidoTexto: text("contenido_texto"),
	rango: text(),
	paginaInicial: integer("pagina_inicial"),
	paginaFinal: integer("pagina_final"),

	// Datos extraídos del texto
	plazoInscripcionDias: integer("plazo_inscripcion_dias"),
	titulacionRequerida: text("titulacion_requerida"),
	tieneTemario: boolean("tiene_temario").default(false),
	urlBases: text("url_bases"),

	// Metadatos
	relevanciaScore: integer("relevancia_score").default(0),
	destacada: boolean().default(false),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_convocatorias_boe_fecha").using("btree", table.boeFecha.desc().nullsFirst()),
	index("idx_convocatorias_boe_tipo").using("btree", table.tipo.asc().nullsLast()),
	index("idx_convocatorias_boe_categoria").using("btree", table.categoria.asc().nullsLast()),
	index("idx_convocatorias_boe_departamento").using("btree", table.departamentoCodigo.asc().nullsLast()),
	index("idx_convocatorias_boe_oposicion").using("btree", table.oposicionRelacionada.asc().nullsLast()),
	index("idx_convocatorias_boe_relevancia").using("btree", table.relevanciaScore.desc().nullsFirst()),
	foreignKey({
		columns: [table.convocatoriaOrigenId],
		foreignColumns: [table.id],
		name: "convocatorias_boe_origen_fkey"
	}).onDelete("set null"),
	pgPolicy("Public can read active convocatorias", { as: "permissive", for: "select", to: ["public"], using: sql`(is_active = true)` }),
	check("convocatorias_boe_tipo_check", sql`tipo IS NULL OR tipo = ANY (ARRAY['convocatoria'::text, 'admitidos'::text, 'tribunal'::text, 'resultado'::text, 'correccion'::text, 'otro'::text])`),
	check("convocatorias_boe_categoria_check", sql`categoria IS NULL OR categoria = ANY (ARRAY['A1'::text, 'A2'::text, 'B'::text, 'C1'::text, 'C2'::text])`),
	check("convocatorias_boe_acceso_check", sql`acceso IS NULL OR acceso = ANY (ARRAY['libre'::text, 'promocion_interna'::text, 'mixto'::text, 'discapacidad'::text])`),
]);