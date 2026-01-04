-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."difficulty_level" AS ENUM('easy', 'medium', 'hard', 'extreme');--> statement-breakpoint
CREATE TABLE "conversion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"days_since_registration" integer DEFAULT 0,
	"registration_source" text,
	"plan_type" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "conversion_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"position_type" text NOT NULL,
	"topic_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" text DEFAULT 'medium',
	"estimated_hours" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "topics_position_type_topic_number_key" UNIQUE("position_type","topic_number"),
	CONSTRAINT "topics_difficulty_check" CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text, 'extreme'::text]))
);
--> statement-breakpoint
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "problematic_questions_tracking" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"question_id" uuid,
	"detection_type" varchar(50) NOT NULL,
	"failure_rate" numeric(5, 2),
	"abandonment_rate" numeric(5, 2),
	"users_affected" integer,
	"total_attempts" integer,
	"status" varchar(20) DEFAULT 'pending',
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"admin_notes" text,
	"resolution_action" varchar(50),
	"redetection_threshold_users" integer DEFAULT 5,
	"detected_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"preferred_language" text DEFAULT 'es',
	"study_goal" integer DEFAULT 25,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"target_oposicion" text,
	"target_oposicion_data" jsonb,
	"first_oposicion_detected_at" timestamp with time zone,
	"is_active_student" boolean DEFAULT false,
	"first_test_completed_at" timestamp with time zone,
	"plan_type" text DEFAULT 'free',
	"registration_date" timestamp with time zone DEFAULT now(),
	"trial_end_date" timestamp with time zone,
	"stripe_customer_id" text,
	"registration_source" text DEFAULT 'organic',
	"requires_payment" boolean DEFAULT false,
	"nickname" text,
	"age" integer,
	"gender" text,
	"daily_study_hours" integer,
	"onboarding_completed_at" timestamp with time zone,
	"ciudad" text,
	"onboarding_skip_count" integer DEFAULT 0,
	"onboarding_last_skip_at" timestamp with time zone,
	"registration_ip" varchar(45),
	CONSTRAINT "user_profiles_email_key" UNIQUE("email"),
	CONSTRAINT "user_profiles_daily_study_hours_check" CHECK ((daily_study_hours >= 0) AND (daily_study_hours <= 12)),
	CONSTRAINT "user_profiles_gender_check" CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_say'::text])),
	CONSTRAINT "user_profiles_preferred_language_check" CHECK (preferred_language = ANY (ARRAY['es'::text, 'en'::text]))
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "telegram_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_string" text NOT NULL,
	"phone_number" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "telegram_session_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"topic_id" uuid,
	"law_id" uuid,
	"article_id" uuid,
	"total_attempts" integer DEFAULT 0,
	"correct_attempts" integer DEFAULT 0,
	"last_attempt_date" timestamp with time zone DEFAULT now(),
	"accuracy_percentage" numeric(5, 2) DEFAULT '0.00',
	"needs_review" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_progress_user_id_topic_id_law_id_article_id_key" UNIQUE("user_id","topic_id","law_id","article_id")
);
--> statement-breakpoint
ALTER TABLE "user_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"recommendation_type" text,
	"title" text NOT NULL,
	"description" text,
	"topic_id" uuid,
	"article_id" uuid,
	"priority" integer DEFAULT 1,
	"is_dismissed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone,
	CONSTRAINT "user_recommendations_priority_check" CHECK (priority = ANY (ARRAY[1, 2, 3, 4, 5])),
	CONSTRAINT "user_recommendations_recommendation_type_check" CHECK (recommendation_type = ANY (ARRAY['review_topic'::text, 'review_article'::text, 'practice_more'::text, 'take_break'::text]))
);
--> statement-breakpoint
ALTER TABLE "user_recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "test_configurations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"topic_id" uuid,
	"total_questions" integer DEFAULT 25,
	"question_distribution" jsonb DEFAULT '{"failed":0,"random":25,"correct":0}'::jsonb,
	"only_unseen_questions" boolean DEFAULT false,
	"times_used" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "test_configurations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"law_id" uuid,
	"article_number" text NOT NULL,
	"title" text,
	"content" text,
	"section" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"title_number" text,
	"chapter_number" text,
	"section_number" text,
	"is_active" boolean DEFAULT true,
	"content_hash" text,
	"last_modification_date" date,
	"verification_date" date DEFAULT CURRENT_DATE,
	"is_verified" boolean DEFAULT false,
	CONSTRAINT "articles_law_id_article_number_key" UNIQUE("law_id","article_number")
);
--> statement-breakpoint
ALTER TABLE "articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "topic_scope" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"topic_id" uuid,
	"law_id" uuid,
	"article_numbers" text[],
	"title_numbers" text[],
	"chapter_numbers" text[],
	"include_full_title" boolean DEFAULT false,
	"include_full_chapter" boolean DEFAULT false,
	"weight" numeric(3, 2) DEFAULT '1.0',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "topic_scope" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_verification_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid,
	"article_id" uuid,
	"law_id" uuid,
	"is_correct" boolean,
	"confidence" text,
	"explanation" text,
	"article_quote" text,
	"suggested_fix" text,
	"correct_option_should_be" text,
	"ai_provider" text NOT NULL,
	"ai_model" text,
	"verified_at" timestamp with time zone DEFAULT now(),
	"verified_by" uuid,
	"fix_applied" boolean DEFAULT false,
	"fix_applied_at" timestamp with time zone,
	"new_explanation" text,
	"discarded" boolean DEFAULT false,
	"discarded_at" timestamp with time zone,
	"article_ok" boolean,
	"answer_ok" boolean,
	"explanation_ok" boolean,
	"correct_article_suggestion" text,
	"explanation_fix" text,
	CONSTRAINT "ai_verification_results_question_id_ai_provider_key" UNIQUE("question_id","ai_provider")
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"url" text NOT NULL,
	"user_agent" text,
	"viewport" text,
	"referrer" text,
	"screenshot_url" text,
	"status" text DEFAULT 'pending',
	"priority" text DEFAULT 'medium',
	"admin_response" text,
	"admin_user_id" uuid,
	"wants_response" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "question_articles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"question_id" uuid,
	"article_id" uuid,
	"relevance" text DEFAULT 'primary',
	"created_at" timestamp with time zone DEFAULT now(),
	"is_primary" boolean DEFAULT false,
	CONSTRAINT "question_articles_question_id_article_id_key" UNIQUE("question_id","article_id"),
	CONSTRAINT "question_articles_relevance_check" CHECK (relevance = ANY (ARRAY['primary'::text, 'secondary'::text, 'reference'::text]))
);
--> statement-breakpoint
CREATE TABLE "convocatorias" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"oposicion_id" uuid,
	"año" integer NOT NULL,
	"fecha_examen" date,
	"tipo_examen" text DEFAULT 'ordinaria',
	"boe_numero" text,
	"boe_fecha" date,
	"plazas_convocadas" integer,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "convocatorias_oposicion_id_año_tipo_examen_key" UNIQUE("oposicion_id","año","tipo_examen"),
	CONSTRAINT "convocatorias_año_check" CHECK (("año" >= 2000) AND ("año" <= 2030)),
	CONSTRAINT "convocatorias_tipo_examen_check" CHECK (tipo_examen = ANY (ARRAY['ordinaria'::text, 'extraordinaria'::text, 'estabilizacion'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now(),
	"granted_by" uuid,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_roles_role_check" CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'super_admin'::text]))
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "articulos_examenes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"convocatoria_id" uuid,
	"article_id" uuid,
	"frecuencia_aparicion" integer DEFAULT 1,
	"tipo_pregunta" text,
	"puntos_pregunta" numeric(4, 2),
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "articulos_examenes_convocatoria_id_article_id_key" UNIQUE("convocatoria_id","article_id"),
	CONSTRAINT "articulos_examenes_tipo_pregunta_check" CHECK (tipo_pregunta = ANY (ARRAY['teorica'::text, 'practica'::text, 'caso'::text, 'test'::text]))
);
--> statement-breakpoint
CREATE TABLE "oposicion_topics" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"oposicion_id" uuid,
	"topic_id" uuid,
	"peso_examen" numeric(5, 2) DEFAULT '1.0',
	"es_tema_principal" boolean DEFAULT true,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "oposicion_topics_oposicion_id_topic_id_key" UNIQUE("oposicion_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "oposicion_articles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"oposicion_id" uuid,
	"article_id" uuid,
	"importancia" text DEFAULT 'media',
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "oposicion_articles_oposicion_id_article_id_key" UNIQUE("oposicion_id","article_id"),
	CONSTRAINT "oposicion_articles_importancia_check" CHECK (importancia = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text, 'critica'::text]))
);
--> statement-breakpoint
CREATE TABLE "preguntas_examenes_oficiales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"convocatoria_id" uuid,
	"numero_pregunta" integer NOT NULL,
	"parte_examen" text NOT NULL,
	"pregunta_text" text NOT NULL,
	"opcion_a" text NOT NULL,
	"opcion_b" text NOT NULL,
	"opcion_c" text NOT NULL,
	"opcion_d" text NOT NULL,
	"respuesta_correcta" text NOT NULL,
	"article_id" uuid,
	"topic_estimado" text,
	"explicacion" text,
	"fue_anulada" boolean DEFAULT false,
	"observaciones" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "preguntas_examenes_oficiales_convocatoria_id_parte_examen_n_key" UNIQUE("convocatoria_id","numero_pregunta","parte_examen"),
	CONSTRAINT "preguntas_examenes_oficiales_parte_examen_check" CHECK (parte_examen = ANY (ARRAY['organizacion_publica'::text, 'ofimatica'::text, 'psicotecnico'::text])),
	CONSTRAINT "preguntas_examenes_oficiales_respuesta_correcta_check" CHECK (respuesta_correcta = ANY (ARRAY['a'::text, 'b'::text, 'c'::text, 'd'::text]))
);
--> statement-breakpoint
CREATE TABLE "law_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_id" uuid,
	"version_number" text NOT NULL,
	"consolidation_date" date NOT NULL,
	"boe_number" text,
	"boe_url" text,
	"modification_type" text,
	"description" text,
	"source_verification_date" date DEFAULT CURRENT_DATE NOT NULL,
	"is_current_version" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "law_versions_modification_type_check" CHECK (modification_type = ANY (ARRAY['promulgacion'::text, 'reforma'::text, 'consolidacion'::text, 'correccion'::text]))
);
--> statement-breakpoint
CREATE TABLE "article_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid,
	"law_version_id" uuid,
	"version_number" text NOT NULL,
	"content_hash" text NOT NULL,
	"previous_content" text,
	"change_description" text,
	"verification_date" date DEFAULT CURRENT_DATE NOT NULL,
	"is_current_version" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_modifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_version_id" uuid,
	"article_numbers" text[],
	"modification_date" date NOT NULL,
	"modification_law" text,
	"boe_reference" text,
	"impact_level" text,
	"summary" text NOT NULL,
	"full_description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "legal_modifications_impact_level_check" CHECK (impact_level = ANY (ARRAY['mayor'::text, 'menor'::text, 'tecnica'::text, 'correccion'::text]))
);
--> statement-breakpoint
CREATE TABLE "test_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid,
	"question_id" uuid,
	"article_id" uuid,
	"question_order" integer NOT NULL,
	"question_text" text NOT NULL,
	"user_answer" text NOT NULL,
	"correct_answer" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"confidence_level" text,
	"time_spent_seconds" integer DEFAULT 0,
	"time_to_first_interaction" integer DEFAULT 0,
	"time_hesitation" integer DEFAULT 0,
	"interaction_count" integer DEFAULT 1,
	"article_number" text,
	"law_name" text,
	"tema_number" integer,
	"difficulty" text,
	"question_type" text,
	"tags" text[] DEFAULT '{""}',
	"previous_attempts_this_article" integer DEFAULT 0,
	"historical_accuracy_this_article" numeric DEFAULT '0',
	"knowledge_retention_score" numeric,
	"learning_efficiency_score" numeric,
	"user_agent" text,
	"screen_resolution" text,
	"device_type" text,
	"browser_language" text,
	"timezone" text,
	"full_question_context" jsonb DEFAULT '{}'::jsonb,
	"user_behavior_data" jsonb DEFAULT '{}'::jsonb,
	"learning_analytics" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_test_question" UNIQUE("test_id","question_order"),
	CONSTRAINT "check_confidence_level" CHECK (confidence_level = ANY (ARRAY['very_sure'::text, 'sure'::text, 'unsure'::text, 'guessing'::text, 'unknown'::text])),
	CONSTRAINT "check_device_type" CHECK (device_type = ANY (ARRAY['mobile'::text, 'tablet'::text, 'desktop'::text, 'unknown'::text])),
	CONSTRAINT "check_difficulty" CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text, 'extreme'::text]))
);
--> statement-breakpoint
ALTER TABLE "test_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_id" uuid,
	"verification_frequency" interval DEFAULT '3 mons' NOT NULL,
	"last_verification_date" date,
	"next_verification_date" date,
	"verification_source" text,
	"verification_status" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "verification_schedule_verification_status_check" CHECK (verification_status = ANY (ARRAY['pendiente'::text, 'en_proceso'::text, 'completada'::text, 'error'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_test_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tema_number" integer NOT NULL,
	"test_number" integer,
	"score" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"time_seconds" integer DEFAULT 0,
	"questions_answered" jsonb DEFAULT '[]'::jsonb,
	"failed_questions" integer[] DEFAULT '{RAY}',
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_test_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid,
	"user_id" uuid,
	"admin_user_id" uuid,
	"status" varchar(20) DEFAULT 'open',
	"last_message_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"admin_viewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "article_exam_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid,
	"oposicion_id" uuid,
	"total_appearances" integer DEFAULT 0,
	"years_appeared" integer[] DEFAULT '{RAY}',
	"first_appearance" date,
	"last_appearance" date,
	"classification" text,
	"user_message" text,
	"source_table" text DEFAULT 'migrated',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "article_exam_stats_article_id_oposicion_id_key" UNIQUE("article_id","oposicion_id"),
	CONSTRAINT "article_exam_stats_classification_check" CHECK (classification = ANY (ARRAY['VERY_FREQUENT'::text, 'FREQUENT'::text, 'OCCASIONAL'::text, 'NEVER'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_token" text,
	"ip_address" "inet",
	"user_agent" text,
	"device_fingerprint" text,
	"screen_resolution" text,
	"viewport_size" text,
	"browser_name" text,
	"browser_version" text,
	"operating_system" text,
	"device_model" text,
	"browser_language" text,
	"timezone" text,
	"color_depth" integer,
	"pixel_ratio" numeric,
	"country_code" text,
	"region" text,
	"city" text,
	"coordinates" "point",
	"isp" text,
	"connection_type" text,
	"session_start" timestamp with time zone DEFAULT now(),
	"session_end" timestamp with time zone,
	"total_duration_minutes" integer DEFAULT 0,
	"active_time_minutes" integer DEFAULT 0,
	"idle_time_minutes" integer DEFAULT 0,
	"pages_visited" text[] DEFAULT '{""}',
	"page_view_count" integer DEFAULT 0,
	"tests_attempted" integer DEFAULT 0,
	"tests_completed" integer DEFAULT 0,
	"questions_answered" integer DEFAULT 0,
	"questions_correct" integer DEFAULT 0,
	"topics_studied" text[] DEFAULT '{""}',
	"time_spent_studying_minutes" integer DEFAULT 0,
	"entry_page" text,
	"exit_page" text,
	"referrer_url" text,
	"utm_source" text,
	"utm_campaign" text,
	"utm_medium" text,
	"search_queries" text[] DEFAULT '{""}',
	"navigation_pattern" jsonb DEFAULT '{}'::jsonb,
	"click_count" integer DEFAULT 0,
	"scroll_depth_max" numeric DEFAULT '0',
	"form_interactions" integer DEFAULT 0,
	"search_interactions" integer DEFAULT 0,
	"download_actions" integer DEFAULT 0,
	"engagement_score" numeric DEFAULT '0',
	"interaction_rate" numeric DEFAULT '0',
	"content_consumption_rate" numeric DEFAULT '0',
	"bounce_indicator" boolean DEFAULT false,
	"conversion_events" text[] DEFAULT '{""}',
	"learning_session_type" text,
	"session_goal" text,
	"session_outcome" text,
	"satisfaction_indicator" text,
	"technical_details" jsonb DEFAULT '{}'::jsonb,
	"interaction_events" jsonb DEFAULT '{}'::jsonb,
	"performance_metrics" jsonb DEFAULT '{}'::jsonb,
	"accessibility_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_sessions_session_token_key" UNIQUE("session_token"),
	CONSTRAINT "check_engagement_score" CHECK ((engagement_score >= (0)::numeric) AND (engagement_score <= (100)::numeric)),
	CONSTRAINT "check_learning_session_type" CHECK (learning_session_type = ANY (ARRAY['practice'::text, 'review'::text, 'exploration'::text, 'focused_study'::text, 'exam_prep'::text])),
	CONSTRAINT "check_satisfaction_indicator" CHECK (satisfaction_indicator = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text, 'unknown'::text])),
	CONSTRAINT "check_scroll_depth" CHECK ((scroll_depth_max >= (0)::numeric) AND (scroll_depth_max <= (100)::numeric))
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_learning_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_tests_completed" integer DEFAULT 0,
	"total_questions_answered" integer DEFAULT 0,
	"overall_accuracy" numeric DEFAULT '0',
	"total_study_time_hours" numeric DEFAULT '0',
	"current_streak_days" integer DEFAULT 0,
	"longest_streak_days" integer DEFAULT 0,
	"article_id" uuid,
	"article_number" text,
	"law_name" text,
	"tema_number" integer,
	"oposicion_type" text,
	"mastery_level" text DEFAULT 'beginner',
	"mastery_score" numeric DEFAULT '0',
	"confidence_score" numeric DEFAULT '0',
	"consistency_score" numeric DEFAULT '0',
	"learning_style" text DEFAULT 'unknown',
	"optimal_session_duration_minutes" integer DEFAULT 25,
	"retention_rate" numeric DEFAULT '0',
	"improvement_velocity" numeric DEFAULT '0',
	"fatigue_threshold_minutes" integer DEFAULT 60,
	"peak_performance_hours" integer[] DEFAULT '{}',
	"worst_performance_hours" integer[] DEFAULT '{}',
	"optimal_study_frequency_days" integer DEFAULT 3,
	"best_day_of_week" integer,
	"current_weak_areas" text[] DEFAULT '{""}',
	"recommended_focus_articles" text[] DEFAULT '{""}',
	"predicted_exam_readiness" numeric DEFAULT '0',
	"estimated_hours_to_mastery" numeric DEFAULT '0',
	"next_review_date" timestamp with time zone,
	"article_performance_history" jsonb DEFAULT '{}'::jsonb,
	"difficulty_progression" jsonb DEFAULT '{}'::jsonb,
	"time_efficiency_trends" jsonb DEFAULT '{}'::jsonb,
	"error_pattern_analysis" jsonb DEFAULT '{}'::jsonb,
	"last_analysis_date" timestamp with time zone DEFAULT now(),
	"analysis_confidence" numeric DEFAULT '0',
	"data_points_count" integer DEFAULT 0,
	"algorithm_version" text DEFAULT '1.0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_user_article_oposicion" UNIQUE("user_id","article_id","oposicion_type"),
	CONSTRAINT "check_exam_readiness" CHECK ((predicted_exam_readiness >= (0)::numeric) AND (predicted_exam_readiness <= (100)::numeric)),
	CONSTRAINT "check_learning_style" CHECK (learning_style = ANY (ARRAY['visual'::text, 'analytical'::text, 'repetitive'::text, 'mixed'::text, 'unknown'::text])),
	CONSTRAINT "check_mastery_level" CHECK (mastery_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'expert'::text]))
);
--> statement-breakpoint
ALTER TABLE "user_learning_analytics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"sender_id" uuid,
	"is_admin" boolean DEFAULT false,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email_type" text NOT NULL,
	"subject" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"status" text DEFAULT 'sent',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "email_logs_status_check" CHECK (status = ANY (ARRAY['sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text]))
);
--> statement-breakpoint
CREATE TABLE "trigger_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" uuid,
	"old_difficulty" text,
	"new_difficulty" text,
	"success_rate" numeric,
	"total_attempts" integer,
	"difficulty_score" numeric,
	"trigger_time" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hot_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"law_id" uuid NOT NULL,
	"target_oposicion" text,
	"oposicion_level" text,
	"total_official_appearances" integer DEFAULT 0,
	"unique_exams_count" integer DEFAULT 0,
	"hotness_score" numeric DEFAULT '0',
	"frequency_trend" text,
	"priority_level" text,
	"article_number" text,
	"law_name" text,
	"article_title" text,
	"first_appearance_date" date,
	"last_appearance_date" date,
	"entities_breakdown" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_calculation_date" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hot_articles_priority_level_check" CHECK (priority_level = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))
);
--> statement-breakpoint
CREATE TABLE "email_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_reactivacion" boolean DEFAULT true,
	"email_urgente" boolean DEFAULT true,
	"email_bienvenida_motivacional" boolean DEFAULT true,
	"unsubscribed_all" boolean DEFAULT false,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"email_bienvenida_inmediato" boolean DEFAULT true,
	"email_resumen_semanal" boolean DEFAULT true,
	CONSTRAINT "email_preferences_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "email_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_unsubscribe_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"email_type" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "email_unsubscribe_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text NOT NULL,
	"plan_type" text NOT NULL,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_subscriptions_plan_type_check" CHECK (plan_type = ANY (ARRAY['trial'::text, 'premium_semester'::text, 'premium_annual'::text])),
	CONSTRAINT "user_subscriptions_status_check" CHECK (status = ANY (ARRAY['trialing'::text, 'active'::text, 'canceled'::text, 'past_due'::text, 'unpaid'::text]))
);
--> statement-breakpoint
ALTER TABLE "user_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_question_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"total_attempts" integer DEFAULT 0,
	"correct_attempts" integer DEFAULT 0,
	"success_rate" numeric(3, 2) DEFAULT '0.00',
	"personal_difficulty" "difficulty_level" DEFAULT 'medium',
	"first_attempt_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"trend" varchar(20) DEFAULT 'stable',
	"trend_calculated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_question_history_user_id_question_id_key" UNIQUE("user_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "user_question_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_difficulty_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"avg_personal_difficulty" numeric(3, 2) DEFAULT '2.50',
	"total_questions_attempted" integer DEFAULT 0,
	"questions_mastered" integer DEFAULT 0,
	"questions_struggling" integer DEFAULT 0,
	"difficulty_improved_this_week" integer DEFAULT 0,
	"difficulty_declined_this_week" integer DEFAULT 0,
	"last_calculated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_difficulty_metrics_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_difficulty_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pwa_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_start" timestamp DEFAULT now(),
	"session_end" timestamp,
	"session_duration_minutes" integer,
	"device_info" jsonb,
	"is_standalone" boolean DEFAULT false,
	"pages_visited" integer DEFAULT 1,
	"actions_performed" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "pwa_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pwa_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"device_info" jsonb,
	"browser_info" jsonb,
	"user_agent" text,
	"referrer" text,
	"created_at" timestamp DEFAULT now(),
	"displaymode" text DEFAULT 'browser',
	"confidence" text DEFAULT 'low',
	"displayMode" text,
	"detectionMethod" text,
	"isStandalone" boolean,
	"installMethod" text
);
--> statement-breakpoint
ALTER TABLE "pwa_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_activity_date" date,
	"streak_updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_streaks_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_streaks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "psychometric_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"has_sections" boolean DEFAULT false,
	"section_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "psychometric_categories_category_key_key" UNIQUE("category_key")
);
--> statement-breakpoint
CREATE TABLE "psychometric_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "psychometric_sections_category_id_section_key_key" UNIQUE("category_id","section_key")
);
--> statement-breakpoint
CREATE TABLE "psychometric_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"section_id" uuid,
	"question_subtype" text NOT NULL,
	"question_text" text NOT NULL,
	"option_a" text,
	"option_b" text,
	"option_c" text,
	"option_d" text,
	"correct_option" integer,
	"content_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"explanation" text,
	"solution_steps" text,
	"difficulty" text DEFAULT 'medium',
	"time_limit_seconds" integer DEFAULT 120,
	"cognitive_skills" text[],
	"is_active" boolean DEFAULT true,
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"global_difficulty" numeric,
	"difficulty_sample_size" integer DEFAULT 0,
	"last_difficulty_update" timestamp with time zone,
	CONSTRAINT "psychometric_questions_correct_option_check" CHECK (correct_option = ANY (ARRAY[0, 1, 2, 3])),
	CONSTRAINT "psychometric_questions_difficulty_check" CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text, 'expert'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"push_enabled" boolean DEFAULT false,
	"push_subscription" jsonb,
	"preferred_times" jsonb DEFAULT '["09:00","14:00","20:00"]'::jsonb,
	"timezone" text DEFAULT 'Europe/Madrid',
	"frequency" text DEFAULT 'smart',
	"oposicion_type" text DEFAULT 'auxiliar-administrativo',
	"exam_date" date,
	"motivation_level" text DEFAULT 'medium',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_notification_settings_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_notification_settings_frequency_check" CHECK (frequency = ANY (ARRAY['daily'::text, 'smart'::text, 'minimal'::text, 'off'::text])),
	CONSTRAINT "user_notification_settings_motivation_level_check" CHECK (motivation_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'extreme'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_activity_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"preferred_hours" integer[] DEFAULT '{RAY[9,14,2}',
	"active_days" integer[] DEFAULT '{RAY[1,2,3,4,5,6,}',
	"avg_session_duration" integer DEFAULT 15,
	"peak_performance_time" time,
	"streak_pattern" text,
	"last_calculated" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"template_id" uuid,
	"message_sent" text NOT NULL,
	"message_variant" integer,
	"sent_at" timestamp with time zone DEFAULT now(),
	"scheduled_for" timestamp with time zone,
	"delivery_status" text DEFAULT 'sent',
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"resulted_in_session" boolean DEFAULT false,
	"session_started_at" timestamp with time zone,
	"context_data" jsonb,
	"device_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "notification_logs_delivery_status_check" CHECK (delivery_status = ANY (ARRAY['sent'::text, 'delivered'::text, 'failed'::text, 'clicked'::text, 'dismissed'::text]))
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"subcategory" text,
	"message_variants" jsonb NOT NULL,
	"target_conditions" jsonb,
	"oposicion_context" boolean DEFAULT true,
	"urgency_level" integer DEFAULT 1,
	"active" boolean DEFAULT true,
	"success_metrics" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "notification_templates_urgency_level_check" CHECK ((urgency_level >= 1) AND (urgency_level <= 5))
);
--> statement-breakpoint
CREATE TABLE "notification_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"user_segment" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"total_sent" integer DEFAULT 0,
	"total_delivered" integer DEFAULT 0,
	"total_opened" integer DEFAULT 0,
	"total_clicked" integer DEFAULT 0,
	"total_sessions_generated" integer DEFAULT 0,
	"avg_time_to_click" interval,
	"conversion_rate" numeric(5, 4),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_smart_scheduling" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"next_notification_time" timestamp with time zone,
	"notification_frequency_hours" integer DEFAULT 24,
	"last_session_time" timestamp with time zone,
	"streak_status" integer DEFAULT 0,
	"risk_level" text DEFAULT 'low',
	"last_risk_calculation" timestamp with time zone DEFAULT now(),
	"pause_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_smart_scheduling_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_smart_scheduling_risk_level_check" CHECK (risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_medals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"medal_id" text NOT NULL,
	"medal_data" jsonb NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"viewed" boolean DEFAULT false,
	CONSTRAINT "user_medals_user_id_medal_id_key" UNIQUE("user_id","medal_id")
);
--> statement-breakpoint
ALTER TABLE "user_medals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid,
	"user_id" uuid,
	"dispute_type" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending',
	"admin_response" text,
	"admin_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	"is_read" boolean DEFAULT false,
	"appeal_text" text,
	"appeal_submitted_at" timestamp with time zone,
	CONSTRAINT "question_disputes_dispute_type_check" CHECK (dispute_type = ANY (ARRAY['no_literal'::text, 'respuesta_incorrecta'::text, 'otro'::text])),
	CONSTRAINT "question_disputes_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "user_notification_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"push_permission_status" text DEFAULT 'not_requested',
	"push_subscriptions_count" integer DEFAULT 0,
	"push_notifications_sent" integer DEFAULT 0,
	"push_notifications_clicked" integer DEFAULT 0,
	"push_notifications_dismissed" integer DEFAULT 0,
	"push_click_rate" numeric(5, 2) DEFAULT '0.00',
	"last_push_interaction" timestamp with time zone,
	"emails_sent" integer DEFAULT 0,
	"emails_delivered" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"emails_bounced" integer DEFAULT 0,
	"email_open_rate" numeric(5, 2) DEFAULT '0.00',
	"email_click_rate" numeric(5, 2) DEFAULT '0.00',
	"last_email_opened" timestamp with time zone,
	"last_email_clicked" timestamp with time zone,
	"primary_device_type" text,
	"primary_browser" text,
	"notification_engagement_score" integer DEFAULT 0,
	"email_engagement_score" integer DEFAULT 0,
	"overall_engagement_score" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_notification_metrics_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_notification_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"notification_type" text,
	"device_info" jsonb DEFAULT '{}'::jsonb,
	"browser_info" jsonb DEFAULT '{}'::jsonb,
	"push_subscription" jsonb,
	"notification_data" jsonb DEFAULT '{}'::jsonb,
	"response_time_ms" integer,
	"error_details" text,
	"ip_address" "inet",
	"user_agent" text,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "notification_events_event_type_check" CHECK (event_type = ANY (ARRAY['permission_requested'::text, 'permission_granted'::text, 'permission_denied'::text, 'subscription_created'::text, 'subscription_updated'::text, 'subscription_deleted'::text, 'notification_sent'::text, 'notification_delivered'::text, 'notification_clicked'::text, 'notification_dismissed'::text, 'notification_failed'::text, 'settings_updated'::text])),
	CONSTRAINT "notification_events_notification_type_check" CHECK (notification_type = ANY (ARRAY['motivation'::text, 'streak_reminder'::text, 'achievement'::text, 'study_reminder'::text, 'reactivation'::text, 'urgent'::text, 'welcome'::text, 'test'::text]))
);
--> statement-breakpoint
ALTER TABLE "notification_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "custom_oposiciones" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text,
	"administracion" text,
	"descripcion" text,
	"is_active" boolean DEFAULT true,
	"is_public" boolean DEFAULT true,
	"times_selected" integer DEFAULT 1,
	"created_by_username" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_user_custom_oposicion" UNIQUE("user_id","nombre")
);
--> statement-breakpoint
ALTER TABLE "custom_oposiciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email_type" text NOT NULL,
	"event_type" text NOT NULL,
	"email_address" text NOT NULL,
	"subject" text,
	"template_id" text,
	"campaign_id" text,
	"email_content_preview" text,
	"link_clicked" text,
	"click_count" integer DEFAULT 0,
	"open_count" integer DEFAULT 0,
	"device_type" text,
	"client_name" text,
	"ip_address" "inet",
	"user_agent" text,
	"geolocation" jsonb DEFAULT '{}'::jsonb,
	"error_details" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "email_events_email_type_check" CHECK (email_type = ANY (ARRAY['welcome'::text, 'reactivation'::text, 'urgent_reactivation'::text, 'motivation'::text, 'achievement'::text, 'streak_danger'::text, 'newsletter'::text, 'system'::text, 'bienvenida_inmediato'::text, 'impugnacion_respuesta'::text, 'soporte_respuesta'::text])),
	CONSTRAINT "email_events_event_type_check" CHECK (event_type = ANY (ARRAY['sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'complained'::text, 'unsubscribed'::text]))
);
--> statement-breakpoint
ALTER TABLE "email_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_streaks_backup_20241208" (
	"id" uuid,
	"user_id" uuid,
	"current_streak" integer,
	"longest_streak" integer,
	"last_activity_date" date,
	"streak_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"backup_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_psychometric_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preferred_categories" jsonb DEFAULT '{}'::jsonb,
	"default_test_length" integer DEFAULT 20,
	"preferred_difficulty" text DEFAULT 'mixed',
	"preferred_time_limit" integer DEFAULT 120,
	"categories_mastered" text[] DEFAULT '{""}',
	"weak_areas" text[] DEFAULT '{""}',
	"favorite_question_types" text[] DEFAULT '{""}',
	"total_tests_completed" integer DEFAULT 0,
	"best_category" text,
	"average_accuracy" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_psychometric_preferences_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_psychometric_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"test_type" text DEFAULT 'topic',
	"total_questions" integer NOT NULL,
	"time_limit_minutes" integer DEFAULT 60,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"is_completed" boolean DEFAULT false,
	"score" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"total_time_seconds" integer DEFAULT 0,
	"average_time_per_question" numeric DEFAULT '0',
	"tema_number" integer,
	"test_number" integer,
	"detailed_analytics" jsonb DEFAULT '{}'::jsonb,
	"questions_metadata" jsonb DEFAULT '{}'::jsonb,
	"performance_metrics" jsonb DEFAULT '{}'::jsonb,
	"user_session_data" jsonb DEFAULT '{}'::jsonb,
	"test_url" varchar(500),
	CONSTRAINT "tests_test_type_check" CHECK (test_type = ANY (ARRAY['practice'::text, 'exam'::text]))
);
--> statement-breakpoint
ALTER TABLE "tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "psychometric_test_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_type" text DEFAULT 'mixed_test' NOT NULL,
	"categories_selected" uuid[],
	"sections_selected" uuid[],
	"total_questions" integer NOT NULL,
	"time_limit_minutes" integer,
	"questions_answered" integer DEFAULT 0,
	"correct_answers" integer DEFAULT 0,
	"accuracy_percentage" numeric(5, 2) DEFAULT '0',
	"average_time_per_question" numeric(8, 2),
	"total_time_seconds" integer,
	"is_completed" boolean DEFAULT false,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cognitive_performance_score" numeric(5, 2),
	"pattern_recognition_score" numeric(5, 2),
	"logical_reasoning_score" numeric(5, 2),
	"attention_score" numeric(5, 2),
	"device_info" jsonb DEFAULT '{}'::jsonb,
	"session_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"category_id" uuid,
	"questions_data" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
ALTER TABLE "psychometric_test_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "psychometric_test_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"question_order" integer NOT NULL,
	"user_answer" integer,
	"is_correct" boolean NOT NULL,
	"time_spent_seconds" integer,
	"hesitation_time" integer,
	"answer_changes_count" integer DEFAULT 0,
	"confidence_level" text,
	"question_subtype" text,
	"cognitive_skills_tested" text[],
	"device_type" text,
	"screen_resolution" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"user_id" uuid,
	"time_taken_seconds" integer,
	"interaction_data" jsonb DEFAULT '{}'::jsonb,
	"session_id" uuid,
	"answered_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "psychometric_test_answers_confidence_level_check" CHECK (confidence_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
	CONSTRAINT "psychometric_test_answers_user_answer_check" CHECK (user_answer = ANY (ARRAY[0, 1, 2, 3]))
);
--> statement-breakpoint
ALTER TABLE "psychometric_test_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "laws" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"description" text,
	"year" integer,
	"type" text NOT NULL,
	"scope" text DEFAULT 'national',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"current_version" text DEFAULT '1.0',
	"last_consolidation_date" date,
	"boe_consolidation_url" text,
	"next_verification_date" date DEFAULT (CURRENT_DATE + '3 mons'::interval),
	"verification_status" text DEFAULT 'pendiente',
	"boe_url" text,
	"boe_id" text,
	"content_hash" text,
	"last_checked" timestamp,
	"last_modified_boe" date,
	"version_boe" text,
	"change_status" text,
	"change_detected_at" timestamp,
	"reviewed_at" timestamp,
	"last_update_boe" text,
	"last_verification_summary" jsonb,
	"video_url" text,
	CONSTRAINT "laws_scope_check" CHECK (scope = ANY (ARRAY['national'::text, 'regional'::text, 'local'::text, 'eu'::text])),
	CONSTRAINT "laws_type_check" CHECK (type = ANY (ARRAY['constitution'::text, 'code'::text, 'law'::text, 'regulation'::text])),
	CONSTRAINT "laws_verification_status_check" CHECK (verification_status = ANY (ARRAY['actualizada'::text, 'pendiente'::text, 'desactualizada'::text, 'error'::text]))
);
--> statement-breakpoint
ALTER TABLE "laws" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"endpoint" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"feature" text,
	"law_id" uuid,
	"article_number" text,
	"questions_count" integer,
	"estimated_cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "law_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_id" uuid NOT NULL,
	"section_type" text NOT NULL,
	"section_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"article_range_start" integer,
	"article_range_end" integer,
	"slug" text NOT NULL,
	"order_position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "law_sections_slug_key" UNIQUE("slug"),
	CONSTRAINT "check_article_range" CHECK ((article_range_start IS NULL) OR (article_range_end IS NULL) OR (article_range_start <= article_range_end)),
	CONSTRAINT "check_section_type" CHECK (section_type = ANY (ARRAY['titulo'::text, 'capitulo'::text, 'seccion'::text, 'libro'::text, 'parte'::text, 'anexo'::text]))
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"question_text" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text NOT NULL,
	"option_d" text NOT NULL,
	"correct_option" integer NOT NULL,
	"explanation" text NOT NULL,
	"difficulty" text DEFAULT 'medium',
	"question_type" text DEFAULT 'single',
	"tags" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"primary_article_id" uuid NOT NULL,
	"is_official_exam" boolean DEFAULT false,
	"exam_source" text,
	"exam_date" date,
	"exam_entity" text,
	"exam_position" text,
	"official_difficulty_level" text,
	"content_hash" text,
	"global_difficulty" numeric,
	"difficulty_confidence" numeric DEFAULT '0',
	"difficulty_sample_size" integer DEFAULT 0,
	"last_difficulty_update" timestamp with time zone,
	"global_difficulty_category" text,
	"verified_at" timestamp with time zone,
	"verification_status" text,
	"topic_review_status" text,
	CONSTRAINT "questions_correct_option_check" CHECK ((correct_option >= 0) AND (correct_option <= 3)),
	CONSTRAINT "questions_question_type_check" CHECK (question_type = ANY (ARRAY['single'::text, 'multiple'::text, 'true_false'::text]))
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "content_collections_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "telegram_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" bigint,
	"message_id" bigint NOT NULL,
	"message_text" text NOT NULL,
	"sender_id" bigint,
	"sender_name" text,
	"sender_username" text,
	"matched_keywords" text[] NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_replied" boolean DEFAULT false,
	"reply_text" text,
	"replied_at" timestamp with time zone,
	"detected_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "telegram_alerts_group_id_message_id_key" UNIQUE("group_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "public_user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"ciudad" text,
	"avatar_type" varchar(50),
	"avatar_emoji" varchar(10),
	"avatar_color" varchar(100),
	"avatar_name" varchar(50),
	"avatar_url" text
);
--> statement-breakpoint
ALTER TABLE "public_user_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oposiciones" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"nombre" text NOT NULL,
	"tipo_acceso" text NOT NULL,
	"administracion" text NOT NULL,
	"categoria" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"slug" text,
	"short_name" text,
	"grupo" text,
	"exam_date" date,
	"inscription_start" date,
	"inscription_deadline" date,
	"boe_publication_date" date,
	"boe_reference" text,
	"plazas_libres" integer,
	"plazas_promocion_interna" integer,
	"plazas_discapacidad" integer,
	"temas_count" integer,
	"bloques_count" integer,
	"titulo_requerido" text,
	"salario_min" integer,
	"salario_max" integer,
	"is_active" boolean DEFAULT true,
	"is_convocatoria_activa" boolean DEFAULT false,
	CONSTRAINT "oposiciones_tipo_acceso_check" CHECK (tipo_acceso = ANY (ARRAY['libre'::text, 'promocion_interna'::text, 'discapacidad'::text]))
);
--> statement-breakpoint
CREATE TABLE "telegram_groups" (
	"id" bigint PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"username" text,
	"member_count" integer,
	"is_monitoring" boolean DEFAULT true,
	"keywords" text[] DEFAULT '{"RAY['test'::text","'vence'::text","'oposiciones'::text","'auxiliar'::tex"}',
	"added_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "psychometric_user_question_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"attempts" integer DEFAULT 1,
	"correct_attempts" integer DEFAULT 0,
	"total_time_seconds" integer DEFAULT 0,
	"personal_difficulty" numeric,
	"first_attempt_at" timestamp with time zone DEFAULT now(),
	"last_attempt_at" timestamp with time zone DEFAULT now(),
	"trend" text DEFAULT 'stable',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "psychometric_user_question_history_user_id_question_id_key" UNIQUE("user_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "psychometric_user_question_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "upgrade_message_impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"message_id" uuid,
	"shown_at" timestamp with time zone DEFAULT now(),
	"clicked_upgrade" boolean DEFAULT false,
	"clicked_at" timestamp with time zone,
	"dismissed" boolean DEFAULT false,
	"dismissed_at" timestamp with time zone,
	"converted_to_premium" boolean DEFAULT false,
	"converted_at" timestamp with time zone,
	"trigger_type" text DEFAULT 'daily_limit',
	"questions_answered" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "upgrade_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_key" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"body_message" text NOT NULL,
	"highlight" text NOT NULL,
	"icon" text DEFAULT 'money',
	"gradient" text DEFAULT 'from-amber-500 via-orange-500 to-red-500',
	"is_active" boolean DEFAULT true,
	"weight" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "upgrade_messages_message_key_key" UNIQUE("message_key")
);
--> statement-breakpoint
CREATE TABLE "content_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"section_number" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"order_position" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "content_sections_collection_id_slug_key" UNIQUE("collection_id","slug"),
	CONSTRAINT "content_sections_collection_id_section_number_key" UNIQUE("collection_id","section_number")
);
--> statement-breakpoint
CREATE TABLE "content_scope" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"section_id" uuid,
	"law_id" uuid NOT NULL,
	"article_numbers" text[] NOT NULL,
	"weight" numeric DEFAULT '1.0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "content_scope_collection_id_section_id_law_id_key" UNIQUE("collection_id","section_id","law_id")
);
--> statement-breakpoint
CREATE TABLE "user_message_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"shown_in" text,
	"message_text" text,
	"share_platform" text,
	"device_info" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_message_interactions_user_id_message_id_action_type_key" UNIQUE("user_id","message_id","action_type")
);
--> statement-breakpoint
ALTER TABLE "user_message_interactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "motivational_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"subcategory" text,
	"message_variants" jsonb NOT NULL,
	"gender_target" text DEFAULT 'neutral',
	"region_target" text[],
	"min_accuracy" numeric,
	"max_accuracy" numeric,
	"min_streak" integer,
	"max_streak" integer,
	"time_of_day" text[],
	"day_of_week" integer[],
	"emoji" text DEFAULT '💪' NOT NULL,
	"tone" text DEFAULT 'motivational' NOT NULL,
	"color_scheme" text DEFAULT 'blue',
	"priority" integer DEFAULT 1,
	"max_shows_per_user" integer,
	"cooldown_hours" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"total_views" integer DEFAULT 0,
	"total_likes" integer DEFAULT 0,
	"total_shares" integer DEFAULT 0,
	"like_rate" numeric DEFAULT '0.00',
	"share_rate" numeric DEFAULT '0.00',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "motivational_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "share_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"share_type" text DEFAULT 'exam_result' NOT NULL,
	"platform" text NOT NULL,
	"score" numeric(4, 2),
	"test_session_id" uuid,
	"share_text" text,
	"share_url" text,
	"device_info" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "share_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "article_update_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_id" uuid,
	"article_id" uuid,
	"article_number" text NOT NULL,
	"old_title" text,
	"new_title" text,
	"change_type" text DEFAULT 'title_update',
	"source" text DEFAULT 'boe_verification',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_api_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"api_key_encrypted" text,
	"api_key_hint" text,
	"is_active" boolean DEFAULT true,
	"default_model" text,
	"last_verified_at" timestamp with time zone,
	"last_verification_status" text,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_api_config_provider_key" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "ai_verification_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_id" uuid,
	"article_number" text,
	"provider" text NOT NULL,
	"model" text,
	"prompt" text,
	"raw_response" text,
	"error_message" text NOT NULL,
	"error_type" text,
	"questions_count" integer,
	"tokens_used" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_question_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"questions_answered" integer DEFAULT 0,
	"last_question_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_user_date" UNIQUE("user_id","usage_date")
);
--> statement-breakpoint
ALTER TABLE "daily_question_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_first_attempts" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"time_spent_seconds" integer,
	"confidence_level" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "question_first_attempts_pkey" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "psychometric_first_attempts" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"time_taken_seconds" integer,
	"interaction_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "psychometric_first_attempts_pkey" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "psychometric_first_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "law_question_first_attempts" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"time_taken_seconds" integer,
	"confidence_level" text,
	"interaction_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "law_question_first_attempts_pkey" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "law_question_first_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problematic_questions_tracking" ADD CONSTRAINT "problematic_questions_tracking_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problematic_questions_tracking" ADD CONSTRAINT "problematic_questions_tracking_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_session" ADD CONSTRAINT "telegram_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_configurations" ADD CONSTRAINT "test_configurations_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_configurations" ADD CONSTRAINT "test_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_scope" ADD CONSTRAINT "topic_scope_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_scope" ADD CONSTRAINT "topic_scope_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_verification_results" ADD CONSTRAINT "ai_verification_results_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_verification_results" ADD CONSTRAINT "ai_verification_results_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_verification_results" ADD CONSTRAINT "ai_verification_results_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_verification_results" ADD CONSTRAINT "ai_verification_results_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_articles" ADD CONSTRAINT "question_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_articles" ADD CONSTRAINT "question_articles_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convocatorias" ADD CONSTRAINT "convocatorias_oposicion_id_fkey" FOREIGN KEY ("oposicion_id") REFERENCES "public"."oposiciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articulos_examenes" ADD CONSTRAINT "articulos_examenes_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articulos_examenes" ADD CONSTRAINT "articulos_examenes_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "public"."convocatorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oposicion_topics" ADD CONSTRAINT "oposicion_topics_oposicion_id_fkey" FOREIGN KEY ("oposicion_id") REFERENCES "public"."oposiciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oposicion_topics" ADD CONSTRAINT "oposicion_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oposicion_articles" ADD CONSTRAINT "oposicion_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oposicion_articles" ADD CONSTRAINT "oposicion_articles_oposicion_id_fkey" FOREIGN KEY ("oposicion_id") REFERENCES "public"."oposiciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preguntas_examenes_oficiales" ADD CONSTRAINT "preguntas_examenes_oficiales_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preguntas_examenes_oficiales" ADD CONSTRAINT "preguntas_examenes_oficiales_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "public"."convocatorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_versions" ADD CONSTRAINT "law_versions_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_law_version_id_fkey" FOREIGN KEY ("law_version_id") REFERENCES "public"."law_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_modifications" ADD CONSTRAINT "legal_modifications_law_version_id_fkey" FOREIGN KEY ("law_version_id") REFERENCES "public"."law_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_schedule" ADD CONSTRAINT "verification_schedule_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_test_sessions" ADD CONSTRAINT "user_test_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_conversations" ADD CONSTRAINT "feedback_conversations_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_conversations" ADD CONSTRAINT "feedback_conversations_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."user_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_conversations" ADD CONSTRAINT "feedback_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_exam_stats" ADD CONSTRAINT "article_exam_stats_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_exam_stats" ADD CONSTRAINT "article_exam_stats_oposicion_id_fkey" FOREIGN KEY ("oposicion_id") REFERENCES "public"."oposiciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_learning_analytics" ADD CONSTRAINT "user_learning_analytics_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."feedback_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hot_articles" ADD CONSTRAINT "hot_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hot_articles" ADD CONSTRAINT "hot_articles_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_unsubscribe_tokens" ADD CONSTRAINT "email_unsubscribe_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_history" ADD CONSTRAINT "user_question_history_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_history" ADD CONSTRAINT "user_question_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_difficulty_metrics" ADD CONSTRAINT "user_difficulty_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pwa_sessions" ADD CONSTRAINT "pwa_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pwa_events" ADD CONSTRAINT "pwa_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_sections" ADD CONSTRAINT "psychometric_sections_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."psychometric_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_questions" ADD CONSTRAINT "psychometric_questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."psychometric_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_questions" ADD CONSTRAINT "psychometric_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."psychometric_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_patterns" ADD CONSTRAINT "user_activity_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_metrics" ADD CONSTRAINT "notification_metrics_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_smart_scheduling" ADD CONSTRAINT "user_smart_scheduling_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_medals" ADD CONSTRAINT "user_medals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_disputes" ADD CONSTRAINT "question_disputes_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_disputes" ADD CONSTRAINT "question_disputes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_disputes" ADD CONSTRAINT "question_disputes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_metrics" ADD CONSTRAINT "user_notification_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_oposiciones" ADD CONSTRAINT "custom_oposiciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_user_id_user_profiles_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_psychometric_preferences" ADD CONSTRAINT "user_psychometric_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_test_sessions" ADD CONSTRAINT "psychometric_test_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_test_answers" ADD CONSTRAINT "psychometric_test_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."psychometric_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_test_answers" ADD CONSTRAINT "psychometric_test_answers_test_session_id_fkey" FOREIGN KEY ("test_session_id") REFERENCES "public"."psychometric_test_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_test_answers" ADD CONSTRAINT "psychometric_test_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_api_usage" ADD CONSTRAINT "ai_api_usage_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_sections" ADD CONSTRAINT "law_sections_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_primary_article_id_fkey" FOREIGN KEY ("primary_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_alerts" ADD CONSTRAINT "telegram_alerts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."telegram_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_user_profiles" ADD CONSTRAINT "public_user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_user_question_history" ADD CONSTRAINT "psychometric_user_question_history_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."psychometric_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_user_question_history" ADD CONSTRAINT "psychometric_user_question_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_message_impressions" ADD CONSTRAINT "upgrade_message_impressions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."upgrade_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_message_impressions" ADD CONSTRAINT "upgrade_message_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sections" ADD CONSTRAINT "content_sections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."content_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_scope" ADD CONSTRAINT "content_scope_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."content_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_scope" ADD CONSTRAINT "content_scope_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_scope" ADD CONSTRAINT "content_scope_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."content_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_message_interactions" ADD CONSTRAINT "user_message_interactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."motivational_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_message_interactions" ADD CONSTRAINT "user_message_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_update_logs" ADD CONSTRAINT "article_update_logs_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_update_logs" ADD CONSTRAINT "article_update_logs_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_verification_errors" ADD CONSTRAINT "ai_verification_errors_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_question_usage" ADD CONSTRAINT "daily_question_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_first_attempts" ADD CONSTRAINT "question_first_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_first_attempts" ADD CONSTRAINT "question_first_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_first_attempts" ADD CONSTRAINT "psychometric_first_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."psychometric_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_first_attempts" ADD CONSTRAINT "psychometric_first_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_question_first_attempts" ADD CONSTRAINT "law_question_first_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_question_first_attempts" ADD CONSTRAINT "law_question_first_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_conversion_created_at" ON "conversion_events" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_conversion_event_type" ON "conversion_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_conversion_limit_reached_user" ON "conversion_events" USING btree ("user_id" timestamptz_ops,"created_at" uuid_ops) WHERE (event_type = 'limit_reached'::text);--> statement-breakpoint
CREATE INDEX "idx_conversion_source" ON "conversion_events" USING btree ("registration_source" text_ops);--> statement-breakpoint
CREATE INDEX "idx_conversion_user_id" ON "conversion_events" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_active_student" ON "user_profiles" USING btree ("is_active_student" bool_ops) WHERE (is_active_student = true);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_ciudad" ON "user_profiles" USING btree ("ciudad" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_onboarding" ON "user_profiles" USING btree ("onboarding_completed_at" timestamptz_ops) WHERE (onboarding_completed_at IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_onboarding_skip" ON "user_profiles" USING btree ("onboarding_skip_count" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_profiles_target_oposicion" ON "user_profiles" USING btree ("target_oposicion" text_ops) WHERE (target_oposicion IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_user_progress_accuracy" ON "user_progress" USING btree ("accuracy_percentage" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_user_progress_user_topic" ON "user_progress" USING btree ("user_id" uuid_ops,"topic_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_test_configs_user" ON "test_configurations" USING btree ("user_id" uuid_ops,"topic_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_articles_structure" ON "articles" USING btree ("law_id" text_ops,"title_number" text_ops,"chapter_number" text_ops);--> statement-breakpoint
CREATE INDEX "idx_topic_scope_topic" ON "topic_scope" USING btree ("topic_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_verification_article" ON "ai_verification_results" USING btree ("article_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_verification_law" ON "ai_verification_results" USING btree ("law_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_verification_question" ON "ai_verification_results" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_question_articles_primary" ON "question_articles" USING btree ("is_primary" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_convocatorias_oposicion_año" ON "convocatorias" USING btree ("oposicion_id" int4_ops,"año" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_roles_granted_at" ON "user_roles" USING btree ("granted_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_roles_role_active" ON "user_roles" USING btree ("role" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_roles_unique_active" ON "user_roles" USING btree ("user_id" uuid_ops,"role" uuid_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_user_roles_user_id_active" ON "user_roles" USING btree ("user_id" uuid_ops,"is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_articulos_examenes_article" ON "articulos_examenes" USING btree ("article_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_articulos_examenes_convocatoria" ON "articulos_examenes" USING btree ("convocatoria_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_preguntas_oficiales_article" ON "preguntas_examenes_oficiales" USING btree ("article_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_preguntas_oficiales_convocatoria" ON "preguntas_examenes_oficiales" USING btree ("convocatoria_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_preguntas_oficiales_parte" ON "preguntas_examenes_oficiales" USING btree ("parte_examen" text_ops);--> statement-breakpoint
CREATE INDEX "idx_test_questions_article_performance" ON "test_questions" USING btree ("article_id" bool_ops,"is_correct" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_test_questions_confidence_accuracy" ON "test_questions" USING btree ("confidence_level" text_ops,"is_correct" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_test_questions_created_at" ON "test_questions" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_test_questions_difficulty_time" ON "test_questions" USING btree ("difficulty" int4_ops,"time_spent_seconds" text_ops);--> statement-breakpoint
CREATE INDEX "idx_test_questions_question_user" ON "test_questions" USING btree ("question_id" uuid_ops,"test_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_test_questions_tema_stats" ON "test_questions" USING btree ("tema_number" bool_ops,"is_correct" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_test_questions_test_id" ON "test_questions" USING btree ("test_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_test_sessions_completed" ON "user_test_sessions" USING btree ("completed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_test_sessions_tema" ON "user_test_sessions" USING btree ("tema_number" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_test_sessions_user_id" ON "user_test_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_conversations_admin_viewed" ON "feedback_conversations" USING btree ("status" text_ops,"admin_viewed_at" text_ops) WHERE (admin_viewed_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_article_exam_stats_article" ON "article_exam_stats" USING btree ("article_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_article_exam_stats_classification" ON "article_exam_stats" USING btree ("classification" text_ops);--> statement-breakpoint
CREATE INDEX "idx_article_exam_stats_oposicion" ON "article_exam_stats" USING btree ("oposicion_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_behavior" ON "user_sessions" USING gin ("navigation_pattern" jsonb_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_date" ON "user_sessions" USING btree ("session_start" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_device" ON "user_sessions" USING btree ("device_model" text_ops,"operating_system" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_duration" ON "user_sessions" USING btree ("total_duration_minutes" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_engagement" ON "user_sessions" USING btree ("engagement_score" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_learning_type" ON "user_sessions" USING btree ("learning_session_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_performance" ON "user_sessions" USING gin ("performance_metrics" jsonb_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_analytics_article" ON "user_learning_analytics" USING btree ("article_id" uuid_ops,"mastery_level" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_analytics_learning_style" ON "user_learning_analytics" USING btree ("learning_style" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_analytics_mastery" ON "user_learning_analytics" USING btree ("mastery_level" numeric_ops,"predicted_exam_readiness" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_analytics_performance" ON "user_learning_analytics" USING gin ("article_performance_history" jsonb_ops);--> statement-breakpoint
CREATE INDEX "idx_user_analytics_tema" ON "user_learning_analytics" USING btree ("tema_number" int4_ops,"oposicion_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_analytics_user_id" ON "user_learning_analytics" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_email_logs_sent_at" ON "email_logs" USING btree ("sent_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_email_logs_type" ON "email_logs" USING btree ("email_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_logs_user_id" ON "email_logs" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "hot_articles_article_oposicion_unique" ON "hot_articles" USING btree ("article_id" text_ops,"target_oposicion" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_hot_articles_article_id" ON "hot_articles" USING btree ("article_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_hot_articles_hotness_score" ON "hot_articles" USING btree ("hotness_score" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_hot_articles_oposicion" ON "hot_articles" USING btree ("target_oposicion" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_unsubscribe_tokens_expires" ON "email_unsubscribe_tokens" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_email_unsubscribe_tokens_token" ON "email_unsubscribe_tokens" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_unsubscribe_tokens_user_id" ON "email_unsubscribe_tokens" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_stripe_customer" ON "user_subscriptions" USING btree ("stripe_customer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_stripe_subscription" ON "user_subscriptions" USING btree ("stripe_subscription_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_user_id" ON "user_subscriptions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_question_history_difficulty" ON "user_question_history" USING btree ("personal_difficulty" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_user_question_history_question_id" ON "user_question_history" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_question_history_success_rate" ON "user_question_history" USING btree ("success_rate" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_user_question_history_trend" ON "user_question_history" USING btree ("trend" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_question_history_user_id" ON "user_question_history" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_pwa_sessions_standalone" ON "pwa_sessions" USING btree ("is_standalone" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_pwa_sessions_start" ON "pwa_sessions" USING btree ("session_start" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_pwa_sessions_user_id" ON "pwa_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_pwa_events_created_at" ON "pwa_events" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_pwa_events_type" ON "pwa_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_pwa_events_user_id" ON "pwa_events" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_streaks_current_streak" ON "user_streaks" USING btree ("current_streak" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_streaks_user_id" ON "user_streaks" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_questions_active" ON "psychometric_questions" USING btree ("is_active" bool_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_psychometric_questions_category" ON "psychometric_questions" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_questions_content_gin" ON "psychometric_questions" USING gin ("content_data" jsonb_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_questions_difficulty" ON "psychometric_questions" USING btree ("difficulty" text_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_questions_section" ON "psychometric_questions" USING btree ("section_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_questions_subtype" ON "psychometric_questions" USING btree ("question_subtype" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notification_settings_push_enabled" ON "user_notification_settings" USING btree ("push_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notification_settings_user_id" ON "user_notification_settings" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_activity_patterns_user_id" ON "user_activity_patterns" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_logs_delivery_status" ON "notification_logs" USING btree ("delivery_status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_logs_sent_at" ON "notification_logs" USING btree ("sent_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_logs_template_id" ON "notification_logs" USING btree ("template_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_logs_user_id" ON "notification_logs" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_templates_active" ON "notification_templates" USING btree ("active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_templates_category" ON "notification_templates" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_metrics_period" ON "notification_metrics" USING btree ("period_start" timestamptz_ops,"period_end" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_metrics_template_id" ON "notification_metrics" USING btree ("template_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_smart_scheduling_next_notification" ON "user_smart_scheduling" USING btree ("next_notification_time" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_smart_scheduling_risk_level" ON "user_smart_scheduling" USING btree ("risk_level" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_smart_scheduling_user_id" ON "user_smart_scheduling" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_medals_user_id" ON "user_medals" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_medals_viewed" ON "user_medals" USING btree ("user_id" uuid_ops,"viewed" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_question_disputes_appeal_submitted" ON "question_disputes" USING btree ("appeal_submitted_at" timestamptz_ops) WHERE (appeal_text IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_user_notification_metrics_engagement" ON "user_notification_metrics" USING btree ("overall_engagement_score" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notification_metrics_updated" ON "user_notification_metrics" USING btree ("updated_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_notification_metrics_user_id" ON "user_notification_metrics" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_events_created_at" ON "notification_events" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_events_event_type" ON "notification_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_events_type_date" ON "notification_events" USING btree ("notification_type" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_events_user_event" ON "notification_events" USING btree ("user_id" text_ops,"event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_notification_events_user_id" ON "notification_events" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_custom_oposiciones_nombre" ON "custom_oposiciones" USING btree (lower(nombre) text_ops) WHERE ((is_public = true) AND (is_active = true));--> statement-breakpoint
CREATE INDEX "idx_custom_oposiciones_popular" ON "custom_oposiciones" USING btree ("times_selected" int4_ops) WHERE ((is_public = true) AND (is_active = true));--> statement-breakpoint
CREATE INDEX "idx_custom_oposiciones_user_id" ON "custom_oposiciones" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_email_events_campaign" ON "email_events" USING btree ("campaign_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_events_created_at" ON "email_events" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_email_events_email_address" ON "email_events" USING btree ("email_address" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_events_email_type" ON "email_events" USING btree ("email_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_events_event_type" ON "email_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_email_events_user_email_type" ON "email_events" USING btree ("user_id" text_ops,"email_type" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_email_events_user_id" ON "email_events" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_analytics" ON "tests" USING gin ("detailed_analytics" jsonb_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_completion_time" ON "tests" USING btree ("completed_at" timestamptz_ops) WHERE (is_completed = true);--> statement-breakpoint
CREATE INDEX "idx_tests_id_user_id" ON "tests" USING btree ("id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_performance" ON "tests" USING gin ("performance_metrics" jsonb_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_tema_number" ON "tests" USING btree ("tema_number" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_tema_test" ON "tests" USING btree ("tema_number" int4_ops,"test_number" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_test_url" ON "tests" USING btree ("test_url" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_user_completed" ON "tests" USING btree ("user_id" bool_ops,"is_completed" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_user_created" ON "tests" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_tests_user_id" ON "tests" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_sessions_user_id" ON "psychometric_test_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_test_sessions_completed" ON "psychometric_test_sessions" USING btree ("is_completed" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_test_sessions_user" ON "psychometric_test_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_answers_user_id" ON "psychometric_test_answers" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_test_answers_question" ON "psychometric_test_answers" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_test_answers_session" ON "psychometric_test_answers" USING btree ("test_session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_api_usage_feature" ON "ai_api_usage" USING btree ("feature" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_api_usage_provider" ON "ai_api_usage" USING btree ("provider" timestamptz_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_law_sections_active" ON "law_sections" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_law_sections_law_id" ON "law_sections" USING btree ("law_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_law_sections_order" ON "law_sections" USING btree ("order_position" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_law_sections_section_type" ON "law_sections" USING btree ("section_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_law_sections_slug" ON "law_sections" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_questions_content_hash" ON "questions" USING btree ("content_hash" text_ops) WHERE (content_hash IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_questions_difficulty" ON "questions" USING btree ("difficulty" text_ops);--> statement-breakpoint
CREATE INDEX "idx_questions_global_difficulty_category" ON "questions" USING btree ("global_difficulty_category" text_ops) WHERE (global_difficulty_category IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_questions_official_article" ON "questions" USING btree ("primary_article_id" bool_ops,"is_official_exam" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_questions_official_exam" ON "questions" USING btree ("is_official_exam" bool_ops) WHERE (is_official_exam = true);--> statement-breakpoint
CREATE INDEX "idx_questions_primary_article" ON "questions" USING btree ("primary_article_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_questions_verification_status" ON "questions" USING btree ("verification_status" text_ops) WHERE (verification_status IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_questions_verified_at" ON "questions" USING btree ("verified_at" timestamptz_ops) WHERE (verified_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_telegram_alerts_detected" ON "telegram_alerts" USING btree ("detected_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_telegram_alerts_unread" ON "telegram_alerts" USING btree ("is_read" bool_ops) WHERE (is_read = false);--> statement-breakpoint
CREATE INDEX "idx_public_user_profiles_display_name" ON "public_user_profiles" USING btree ("display_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_user_history_difficulty" ON "psychometric_user_question_history" USING btree ("personal_difficulty" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_user_history_question" ON "psychometric_user_question_history" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_user_history_user" ON "psychometric_user_question_history" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_upgrade_impressions_date" ON "upgrade_message_impressions" USING btree ("shown_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_upgrade_impressions_message" ON "upgrade_message_impressions" USING btree ("message_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_upgrade_impressions_user" ON "upgrade_message_impressions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_upgrade_messages_active" ON "upgrade_messages" USING btree ("is_active" bool_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_user_message_interactions_action" ON "user_message_interactions" USING btree ("action_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_message_interactions_message" ON "user_message_interactions" USING btree ("message_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_message_interactions_user" ON "user_message_interactions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_motivational_messages_active" ON "motivational_messages" USING btree ("is_active" bool_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_motivational_messages_category" ON "motivational_messages" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_share_events_platform" ON "share_events" USING btree ("platform" text_ops);--> statement-breakpoint
CREATE INDEX "idx_share_events_type" ON "share_events" USING btree ("share_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_share_events_user" ON "share_events" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_share_events_user_created" ON "share_events" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_article_update_logs_law" ON "article_update_logs" USING btree ("law_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_verification_errors_created_at" ON "ai_verification_errors" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_verification_errors_error_type" ON "ai_verification_errors" USING btree ("error_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_verification_errors_law_id" ON "ai_verification_errors" USING btree ("law_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_verification_errors_provider" ON "ai_verification_errors" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_usage_user_date" ON "daily_question_usage" USING btree ("user_id" date_ops,"usage_date" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_question_first_attempts_correct" ON "question_first_attempts" USING btree ("is_correct" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_question_first_attempts_created" ON "question_first_attempts" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_question_first_attempts_question" ON "question_first_attempts" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_question_first_attempts_user" ON "question_first_attempts" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_first_attempts_user_question" ON "psychometric_first_attempts" USING btree ("user_id" uuid_ops,"question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_first_attempts_correct" ON "psychometric_first_attempts" USING btree ("is_correct" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_first_attempts_created" ON "psychometric_first_attempts" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_first_attempts_question" ON "psychometric_first_attempts" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_psychometric_first_attempts_user" ON "psychometric_first_attempts" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_law_first_attempts_correct" ON "law_question_first_attempts" USING btree ("is_correct" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_law_first_attempts_created" ON "law_question_first_attempts" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_law_first_attempts_question" ON "law_question_first_attempts" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_law_first_attempts_user" ON "law_question_first_attempts" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."conversion_funnel_stats" AS (SELECT registration_source, count(DISTINCT CASE WHEN event_type = 'registration'::text THEN user_id ELSE NULL::uuid END) AS registrations, count(DISTINCT CASE WHEN event_type = 'first_test_completed'::text THEN user_id ELSE NULL::uuid END) AS completed_first_test, count(DISTINCT CASE WHEN event_type = 'limit_reached'::text THEN user_id ELSE NULL::uuid END) AS hit_limit, count(DISTINCT CASE WHEN event_type = 'upgrade_modal_viewed'::text THEN user_id ELSE NULL::uuid END) AS saw_modal, count(DISTINCT CASE WHEN event_type = 'upgrade_button_clicked'::text THEN user_id ELSE NULL::uuid END) AS clicked_upgrade, count(DISTINCT CASE WHEN event_type = 'premium_page_viewed'::text THEN user_id ELSE NULL::uuid END) AS visited_premium, count(DISTINCT CASE WHEN event_type = 'checkout_started'::text THEN user_id ELSE NULL::uuid END) AS started_checkout, count(DISTINCT CASE WHEN event_type = 'payment_completed'::text THEN user_id ELSE NULL::uuid END) AS paid, round(100.0 * count(DISTINCT CASE WHEN event_type = 'payment_completed'::text THEN user_id ELSE NULL::uuid END)::numeric / NULLIF(count(DISTINCT CASE WHEN event_type = 'registration'::text THEN user_id ELSE NULL::uuid END), 0)::numeric, 2) AS conversion_rate FROM conversion_events GROUP BY registration_source);--> statement-breakpoint
CREATE VIEW "public"."conversion_time_analysis" AS (SELECT registration_source, avg(days_since_registration) AS avg_days_to_convert, min(days_since_registration) AS min_days, max(days_since_registration) AS max_days, count(*) AS total_conversions FROM conversion_events WHERE event_type = 'payment_completed'::text GROUP BY registration_source);--> statement-breakpoint
CREATE VIEW "public"."admin_role_stats" AS (SELECT role, count(*) AS total_users, count(*) FILTER (WHERE is_active = true) AS active_users, min(granted_at) AS first_granted, max(granted_at) AS last_granted FROM user_roles GROUP BY role ORDER BY (count(*)) DESC);--> statement-breakpoint
CREATE VIEW "public"."hot_articles_dashboard" AS (SELECT ((article_number || ' ('::text) || law_name) || ')'::text AS articulo_completo, target_oposicion AS oposicion, hotness_score, priority_level, total_official_appearances AS apariciones, unique_exams_count AS examenes_distintos, CASE WHEN hotness_score >= 85::numeric THEN '🔥 CRÍTICO'::text WHEN hotness_score >= 65::numeric THEN '⚡ ALTO'::text WHEN hotness_score >= 40::numeric THEN '📌 MEDIO'::text ELSE '💡 BAJO'::text END AS nivel_visual, last_calculation_date AS ultima_actualizacion FROM hot_articles ha ORDER BY target_oposicion, hotness_score DESC);--> statement-breakpoint
CREATE VIEW "public"."admin_pwa_stats" AS (SELECT count(DISTINCT pe.user_id) FILTER (WHERE pe.event_type = 'pwa_installed'::text) AS total_installations, count(DISTINCT ps.user_id) FILTER (WHERE ps.is_standalone = true) AS active_pwa_users, count(DISTINCT pe.user_id) FILTER (WHERE pe.event_type = 'install_prompt_shown'::text) AS prompt_shows, count(*) FILTER (WHERE pe.event_type = 'pwa_installed'::text) AS total_installs, count(*) FILTER (WHERE pe.event_type = 'install_prompt_shown'::text) AS total_prompts, round(count(*) FILTER (WHERE pe.event_type = 'pwa_installed'::text)::numeric / NULLIF(count(*) FILTER (WHERE pe.event_type = 'install_prompt_shown'::text), 0)::numeric * 100::numeric, 2) AS conversion_rate_percentage FROM pwa_events pe LEFT JOIN pwa_sessions ps ON pe.user_id = ps.user_id WHERE pe.created_at >= (now() - '30 days'::interval));--> statement-breakpoint
CREATE VIEW "public"."users_needing_notifications" AS (SELECT uns.user_id, uns.push_subscription, uns.preferred_times, uns.timezone, uns.motivation_level, uns.exam_date, uss.next_notification_time, uss.risk_level, uss.streak_status, uap.preferred_hours, uap.peak_performance_time, EXTRACT(epoch FROM now() - uss.last_session_time) / 3600::numeric AS hours_since_last_session FROM user_notification_settings uns JOIN user_smart_scheduling uss ON uns.user_id = uss.user_id LEFT JOIN user_activity_patterns uap ON uns.user_id = uap.user_id WHERE uns.push_enabled = true AND uns.frequency <> 'off'::text AND (uss.pause_until IS NULL OR uss.pause_until < now()) AND uss.next_notification_time <= now());--> statement-breakpoint
CREATE VIEW "public"."admin_notification_analytics" AS (SELECT count(DISTINCT user_id) AS total_users_with_notifications, count(*) AS total_notification_events, count(*) FILTER (WHERE event_type = 'permission_granted'::text) AS push_permissions_granted, count(*) FILTER (WHERE event_type = 'permission_denied'::text) AS push_permissions_denied, count(*) FILTER (WHERE event_type = 'notification_sent'::text) AS push_notifications_sent, count(*) FILTER (WHERE event_type = 'notification_clicked'::text) AS push_notifications_clicked, count(*) FILTER (WHERE event_type = 'notification_dismissed'::text) AS push_notifications_dismissed, round(count(*) FILTER (WHERE event_type = 'notification_clicked'::text)::numeric / NULLIF(count(*) FILTER (WHERE event_type = 'notification_sent'::text), 0)::numeric * 100::numeric, 2) AS push_click_rate, device_info ->> 'platform'::text AS platform, browser_info ->> 'name'::text AS browser_name, date_trunc('day'::text, created_at) AS date FROM notification_events WHERE created_at >= (now() - '30 days'::interval) GROUP BY (date_trunc('day'::text, created_at)), (device_info ->> 'platform'::text), (browser_info ->> 'name'::text));--> statement-breakpoint
CREATE VIEW "public"."admin_email_analytics" AS (SELECT email_type, count(*) FILTER (WHERE event_type = 'sent'::text) AS emails_sent, count(*) FILTER (WHERE event_type = 'delivered'::text) AS emails_delivered, count(*) FILTER (WHERE event_type = 'opened'::text) AS emails_opened, count(*) FILTER (WHERE event_type = 'clicked'::text) AS emails_clicked, count(*) FILTER (WHERE event_type = 'bounced'::text) AS emails_bounced, count(*) FILTER (WHERE event_type = 'unsubscribed'::text) AS unsubscribed, round(count(*) FILTER (WHERE event_type = 'opened'::text)::numeric / NULLIF(count(*) FILTER (WHERE event_type = 'delivered'::text), 0)::numeric * 100::numeric, 2) AS open_rate, round(count(*) FILTER (WHERE event_type = 'clicked'::text)::numeric / NULLIF(count(*) FILTER (WHERE event_type = 'delivered'::text), 0)::numeric * 100::numeric, 2) AS click_rate, date_trunc('day'::text, created_at) AS date FROM email_events WHERE created_at >= (now() - '30 days'::interval) GROUP BY email_type, (date_trunc('day'::text, created_at)));--> statement-breakpoint
CREATE VIEW "public"."admin_disputes_dashboard" AS (SELECT qd.id, qd.dispute_type, qd.description, qd.status, qd.created_at, up.full_name AS reporter_name, q.question_text, a.article_number, l.short_name AS law_name, EXTRACT(days FROM now() - qd.created_at) AS days_since_created, CASE WHEN qd.status = 'pending'::text AND EXTRACT(days FROM now() - qd.created_at) > 7::numeric THEN 'urgent'::text WHEN qd.status = 'pending'::text THEN 'pending'::text ELSE qd.status END AS priority_status FROM question_disputes qd LEFT JOIN user_profiles up ON qd.user_id = up.id LEFT JOIN questions q ON qd.question_id = q.id LEFT JOIN articles a ON q.primary_article_id = a.id LEFT JOIN laws l ON a.law_id = l.id);--> statement-breakpoint
CREATE VIEW "public"."admin_users_with_roles" AS (SELECT up.id AS user_id, up.email, up.full_name, up.plan_type, up.registration_source, up.requires_payment, up.stripe_customer_id, up.created_at AS user_created_at, up.updated_at AS user_updated_at, CASE WHEN up.plan_type = ANY (ARRAY['legacy_free'::text, 'free'::text, 'trial'::text, 'premium'::text]) THEN true ELSE false END AS is_active_student, count(t.id) AS total_tests_30d, count( CASE WHEN t.is_completed = true THEN 1 ELSE NULL::integer END) AS completed_tests_30d, count( CASE WHEN t.is_completed = false THEN 1 ELSE NULL::integer END) AS abandoned_tests_30d, max(t.created_at) AS last_test_date, round(avg( CASE WHEN t.is_completed = true AND t.score IS NOT NULL THEN t.score ELSE NULL::numeric END), 1) AS avg_score_30d FROM user_profiles up LEFT JOIN tests t ON up.id = t.user_id AND t.created_at >= (now() - '30 days'::interval) GROUP BY up.id, up.email, up.full_name, up.plan_type, up.registration_source, up.requires_payment, up.stripe_customer_id, up.created_at, up.updated_at ORDER BY up.created_at DESC);--> statement-breakpoint
CREATE VIEW "public"."admin_upgrade_message_stats" AS (SELECT um.id, um.message_key, um.title, um.is_active, um.weight, count(umi.id) AS total_impressions, count(umi.id) FILTER (WHERE umi.clicked_upgrade) AS total_clicks, count(umi.id) FILTER (WHERE umi.dismissed) AS total_dismisses, count(umi.id) FILTER (WHERE umi.converted_to_premium) AS total_conversions, round(count(umi.id) FILTER (WHERE umi.clicked_upgrade)::numeric / NULLIF(count(umi.id), 0)::numeric * 100::numeric, 2) AS click_rate, round(count(umi.id) FILTER (WHERE umi.converted_to_premium)::numeric / NULLIF(count(umi.id), 0)::numeric * 100::numeric, 2) AS conversion_rate FROM upgrade_messages um LEFT JOIN upgrade_message_impressions umi ON umi.message_id = um.id GROUP BY um.id ORDER BY (count(umi.id)) DESC);--> statement-breakpoint
CREATE VIEW "public"."admin_share_analytics" AS (SELECT date_trunc('day'::text, created_at) AS fecha, share_type, platform, count(*) AS total_shares, count(DISTINCT user_id) AS usuarios_unicos, avg(score) AS nota_promedio_compartida FROM share_events GROUP BY (date_trunc('day'::text, created_at)), share_type, platform ORDER BY (date_trunc('day'::text, created_at)) DESC);--> statement-breakpoint
CREATE POLICY "Users can view own conversion events" ON "conversion_events" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Service can insert conversion events" ON "conversion_events" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Admins can view all conversion events" ON "conversion_events" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Enable read access for topics" ON "topics" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Users can insert their own profile" ON "user_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = id));--> statement-breakpoint
CREATE POLICY "Users can update own profile" ON "user_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view own profile" ON "user_profiles" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins can view all profiles" ON "user_profiles" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view own progress" ON "user_progress" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own progress" ON "user_progress" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own progress" ON "user_progress" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own recommendations" ON "user_recommendations" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can update own recommendations" ON "user_recommendations" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can manage own test configs" ON "test_configurations" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Enable read access for articles" ON "articles" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Anyone can read topic scope" ON "topic_scope" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Enable read access for topic_scope" ON "topic_scope" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own roles" ON "user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "Admins can view all roles" ON "user_roles" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Only admins can manage roles" ON "user_roles" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can insert their own test answers" ON "test_questions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((test_id IN ( SELECT tests.id
   FROM tests
  WHERE (tests.user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "Users can view their own test answers" ON "test_questions" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own test answers" ON "test_questions" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own test sessions" ON "user_test_sessions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own test sessions" ON "user_test_sessions" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own test sessions" ON "user_test_sessions" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own sessions" ON "user_sessions" AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can insert their own sessions" ON "user_sessions" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own sessions" ON "user_sessions" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own analytics" ON "user_learning_analytics" AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can manage their own analytics" ON "user_learning_analytics" AS PERMISSIVE FOR ALL TO public;--> statement-breakpoint
CREATE POLICY "Users can manage their own email preferences" ON "email_preferences" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can view own subscriptions" ON "user_subscriptions" AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "Service role can manage subscriptions" ON "user_subscriptions" AS PERMISSIVE FOR ALL TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own question history" ON "user_question_history" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Allow trigger inserts for question history" ON "user_question_history" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Allow trigger updates for question history" ON "user_question_history" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own difficulty metrics" ON "user_difficulty_metrics" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can view own PWA sessions" ON "pwa_sessions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own PWA sessions" ON "pwa_sessions" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own PWA sessions" ON "pwa_sessions" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Service role can manage all PWA sessions" ON "pwa_sessions" AS PERMISSIVE FOR ALL TO public;--> statement-breakpoint
CREATE POLICY "Users can view own PWA events" ON "pwa_events" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own PWA events" ON "pwa_events" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Service role can manage all PWA events" ON "pwa_events" AS PERMISSIVE FOR ALL TO public;--> statement-breakpoint
CREATE POLICY "Users can view own streaks" ON "user_streaks" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own streaks" ON "user_streaks" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own streaks" ON "user_streaks" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Anyone can view all streaks for ranking" ON "user_streaks" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own streak only" ON "user_streaks" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view own medals" ON "user_medals" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Admin can view all notification metrics" ON "user_notification_metrics" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text))))));--> statement-breakpoint
CREATE POLICY "Users can view own notification metrics" ON "user_notification_metrics" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Allow users to update own notification metrics" ON "user_notification_metrics" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Allow users to update notification metrics" ON "user_notification_metrics" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Admin can view all notification events" ON "notification_events" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text))))));--> statement-breakpoint
CREATE POLICY "Users can view own notification events" ON "notification_events" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Allow insert notification events" ON "notification_events" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can view own and public custom oposiciones" ON "custom_oposiciones" AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR (is_public = true)));--> statement-breakpoint
CREATE POLICY "Users can insert own custom oposiciones" ON "custom_oposiciones" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own custom oposiciones" ON "custom_oposiciones" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can delete own custom oposiciones" ON "custom_oposiciones" AS PERMISSIVE FOR DELETE TO public;--> statement-breakpoint
CREATE POLICY "Admin can view all email events" ON "email_events" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text))))));--> statement-breakpoint
CREATE POLICY "Users can view own email events" ON "email_events" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Allow insert email events" ON "email_events" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can view own preferences" ON "user_psychometric_preferences" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own preferences" ON "user_psychometric_preferences" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own preferences" ON "user_psychometric_preferences" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own tests" ON "tests" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own tests" ON "tests" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own tests" ON "tests" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Admins can view all tests" ON "tests" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view own psychometric sessions" ON "psychometric_test_sessions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can update own psychometric sessions" ON "psychometric_test_sessions" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can delete own psychometric sessions" ON "psychometric_test_sessions" AS PERMISSIVE FOR DELETE TO public;--> statement-breakpoint
CREATE POLICY "Users can insert own psychometric sessions" ON "psychometric_test_sessions" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can view own test answers" ON "psychometric_test_answers" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = ( SELECT psychometric_test_sessions.user_id
   FROM psychometric_test_sessions
  WHERE (psychometric_test_sessions.id = psychometric_test_answers.test_session_id))));--> statement-breakpoint
CREATE POLICY "Users can insert own test answers" ON "psychometric_test_answers" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Enable read access for laws" ON "laws" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Enable read access for questions" ON "questions" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Public profiles are viewable by authenticated users" ON "public_user_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can update own public profile" ON "public_user_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Perfiles públicos visibles para todos" ON "public_user_profiles" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own question history" ON "psychometric_user_question_history" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "System can manage question history" ON "psychometric_user_question_history" AS PERMISSIVE FOR ALL TO public;--> statement-breakpoint
CREATE POLICY "Users can read own interactions" ON "user_message_interactions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can create own interactions" ON "user_message_interactions" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own interactions" ON "user_message_interactions" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Admins can read all interactions" ON "user_message_interactions" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can insert their own message interactions" ON "user_message_interactions" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view their own message interactions" ON "user_message_interactions" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Anyone can read active messages" ON "motivational_messages" AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));--> statement-breakpoint
CREATE POLICY "Only admins can manage messages" ON "motivational_messages" AS PERMISSIVE FOR ALL TO public;--> statement-breakpoint
CREATE POLICY "Users can create own shares" ON "share_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can read own shares" ON "share_events" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can read own usage" ON "daily_question_usage" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own usage" ON "daily_question_usage" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own usage" ON "daily_question_usage" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own first attempts" ON "psychometric_first_attempts" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own first attempts" ON "psychometric_first_attempts" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own first attempts" ON "psychometric_first_attempts" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can delete own first attempts" ON "psychometric_first_attempts" AS PERMISSIVE FOR DELETE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own first attempts" ON "law_question_first_attempts" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own first attempts" ON "law_question_first_attempts" AS PERMISSIVE FOR INSERT TO public;
*/