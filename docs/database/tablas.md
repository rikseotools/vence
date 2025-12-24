# 📊 README Completo - Base de Datos Sistema iLoveTest

## 🗄️ **ESTRUCTURA COMPLETA DE TABLAS - TODAS LAS 35 TABLAS**

---

## 🏛️ **SISTEMA DE OPOSICIONES**

### **TABLA: `oposiciones`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `nombre` | text | NO | null |
| `tipo_acceso` | text | NO | null |
| `administracion` | text | NO | null |
| `categoria` | text | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `oposicion_articles`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `oposicion_id` | uuid | YES | null |
| `article_id` | uuid | YES | null |
| `importancia` | text | YES | 'media'::text |
| `observaciones` | text | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `oposicion_topics`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `oposicion_id` | uuid | YES | null |
| `topic_id` | uuid | YES | null |
| `peso` | numeric | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `convocatorias`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

---

## 📚 **SISTEMA DE LEYES Y ARTÍCULOS**

### **TABLA: `laws`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `name` | text | NO | null |
| `short_name` | text | NO | null |
| `description` | text | YES | null |
| `year` | integer | YES | null |
| `type` | text | NO | null |
| `scope` | text | YES | null |
| `is_active` | boolean | YES | true |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |
| `current_version` | text | YES | null |
| `last_consolidation_date` | date | YES | null |
| `boe_consolidation_url` | text | YES | null |
| `next_verification_date` | date | YES | null |
| `verification_status` | text | YES | null |

### **TABLA: `articles`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `law_id` | uuid | YES | null |
| `article_number` | text | NO | null |
| `title` | text | YES | null |
| `content` | text | YES | null |
| `section` | text | YES | null |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |
| `title_number` | text | YES | null |
| `chapter_number` | text | YES | null |
| `section_number` | text | YES | null |
| `is_active` | boolean | YES | true |
| `content_hash` | text | YES | null |
| `last_modification_date` | date | YES | null |
| `verification_date` | date | YES | null |
| `is_verified` | boolean | YES | true |

### **TABLA: `law_sections`** ⭐ NUEVA (26/10/2025)
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `law_id` | uuid | YES | REFERENCES laws(id) |
| `section_type` | text | YES | null |
| `section_number` | text | YES | null |
| `title` | text | YES | null |
| `description` | text | YES | null |
| `article_range_start` | integer | YES | null |
| `article_range_end` | integer | YES | null |
| `slug` | text | YES | null |
| `order_position` | integer | YES | null |
| `is_active` | boolean | YES | true |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

**🎯 PROPÓSITO:** Sistema de navegación por títulos/capítulos de leyes. Permite filtrar artículos por secciones específicas de la legislación.

### **TABLA: `law_versions`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

### **TABLA: `article_versions`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

### **TABLA: `legal_modifications`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

### **TABLA: `verification_schedule`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

### **TABLA: `article_exam_stats`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

---

## 📖 **SISTEMA DE TEMAS**

### **TABLA: `topics`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `position_type` | text | NO | null |
| `topic_number` | integer | NO | null |
| `title` | text | NO | null |
| `description` | text | YES | null |
| `difficulty` | text | YES | null |
| `estimated_hours` | integer | YES | 10 |
| `is_active` | boolean | YES | true |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

### **TABLA: `topic_scope`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `topic_id` | uuid | YES | null |
| `law_id` | uuid | YES | null |
| `article_numbers` | text[] | YES | null |
| `title_numbers` | text[] | YES | null |
| `chapter_numbers` | text[] | YES | null |
| `include_full_title` | boolean | YES | false |
| `include_full_chapter` | boolean | YES | false |
| `weight` | numeric | YES | null |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

---

## ❓ **SISTEMA DE PREGUNTAS**

### **TABLA: `questions`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `question_text` | text | NO | null |
| `option_a` | text | NO | null |
| `option_b` | text | NO | null |
| `option_c` | text | NO | null |
| `option_d` | text | NO | null |
| `correct_option` | integer | NO | null |
| `explanation` | text | NO | null |
| `difficulty` | text | YES | 'auto' |
| `question_type` | text | YES | 'single' |
| `tags` | text[] | YES | null |
| `is_active` | boolean | YES | true |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |
| `primary_article_id` | uuid | YES | null |
| `is_official_exam` | boolean | YES | false |
| `exam_source` | text | YES | null |
| `exam_date` | date | YES | null |
| `exam_entity` | text | YES | null |
| `exam_position` | text | YES | null |
| `official_difficulty_level` | text | YES | null |
| `content_hash` | text | YES | null |
| `topic_review_status` | text | YES | null |
| `verified_at` | timestamp with time zone | YES | null |
| `verification_status` | text | YES | null |

**📝 CAMPOS DE VERIFICACIÓN DE TEMAS:**
- `topic_review_status`: Estado de revisión por IA. Valores posibles:
  - **Estados legales (8):** `perfect`, `bad_explanation`, `bad_answer`, `bad_answer_and_explanation`, `wrong_article`, `wrong_article_bad_explanation`, `wrong_article_bad_answer`, `all_wrong`
  - **Estados técnicos (4):** `tech_perfect`, `tech_bad_explanation`, `tech_bad_answer`, `tech_bad_answer_and_explanation`
  - **Pendiente:** `pending` (no verificada)
- `verified_at`: Fecha de última verificación
- `verification_status`: Estado legacy (`ok`, `problem`, `pending`)

---

### **TABLA: `ai_verification_results`** ⭐ Sistema de Verificación IA
| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | ID único |
| `question_id` | uuid | NO | null | FK a questions |
| `article_id` | uuid | YES | null | FK a articles |
| `law_id` | uuid | YES | null | FK a laws |
| `article_ok` | boolean | YES | null | ¿Artículo vinculado correcto? |
| `answer_ok` | boolean | YES | null | ¿Respuesta marcada correcta? |
| `explanation_ok` | boolean | YES | null | ¿Explicación correcta? |
| `is_correct` | boolean | YES | null | Legacy: respuesta correcta |
| `confidence` | text | YES | null | Nivel confianza: alta/media/baja |
| `explanation` | text | YES | null | Análisis de la IA |
| `article_quote` | text | YES | null | Cita del artículo |
| `suggested_fix` | jsonb | YES | null | Corrección sugerida |
| `correct_option_should_be` | text | YES | null | Opción correcta si hay error |
| `correct_article_suggestion` | text | YES | null | Artículo correcto si está mal vinculado |
| `explanation_fix` | text | YES | null | Corrección para la explicación |
| `ai_provider` | text | YES | null | Proveedor IA (openai, anthropic, google) |
| `ai_model` | text | YES | null | Modelo usado |
| `verified_at` | timestamp | YES | now() | Fecha verificación |
| `fix_applied` | boolean | YES | false | ¿Se aplicó la corrección? |
| `fix_applied_at` | timestamp | YES | null | Fecha aplicación corrección |
| `discarded` | boolean | YES | false | ¿Verificación descartada (override manual)? |
| `discarded_at` | timestamp | YES | null | Fecha descarte |

**🔍 QUERIES ÚTILES PARA VERIFICACIÓN:**

```sql
-- Preguntas con problemas (verificadas mal por IA)
SELECT q.id, q.question_text, q.topic_review_status, l.short_name
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
WHERE q.topic_review_status IN (
  'bad_explanation', 'bad_answer', 'bad_answer_and_explanation',
  'wrong_article', 'wrong_article_bad_explanation',
  'wrong_article_bad_answer', 'all_wrong',
  'tech_bad_explanation', 'tech_bad_answer', 'tech_bad_answer_and_explanation'
)
ORDER BY l.short_name, q.topic_review_status;

-- Resumen por estado
SELECT topic_review_status, COUNT(*) as total
FROM questions
WHERE topic_review_status IS NOT NULL
GROUP BY topic_review_status
ORDER BY total DESC;

-- Preguntas pendientes de verificar
SELECT COUNT(*) as pendientes
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
WHERE (q.topic_review_status IS NULL OR q.topic_review_status = 'pending')
  AND q.is_active = true;

-- Detalle de verificación IA con problemas
SELECT
  q.id,
  q.question_text,
  q.topic_review_status,
  av.article_ok,
  av.answer_ok,
  av.explanation_ok,
  av.explanation as ai_analysis,
  av.explanation_fix,
  l.short_name as ley
FROM questions q
JOIN ai_verification_results av ON q.id = av.question_id
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
WHERE (av.article_ok = false OR av.answer_ok = false OR av.explanation_ok = false)
  AND av.discarded = false
ORDER BY l.short_name;
```

---

### **TABLA: `preguntas_examenes_oficiales`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

### **TABLA: `question_articles`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

### **TABLA: `articulos_examenes`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

### **TABLA: `question_disputes`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `question_id` | uuid | YES | null |
| `user_id` | uuid | NO | null |
| `dispute_type` | text | NO | null |
| `description` | text | NO | null |
| `status` | text | YES | 'pending' |
| `admin_response` | text | YES | null |
| `admin_user_id` | uuid | YES | null |
| `created_at` | timestamp with time zone | YES | now() |
| `reviewed_at` | timestamp with time zone | YES | null |
| `resolved_at` | timestamp with time zone | YES | null |
| `feedback_reference_id` | uuid | YES | REFERENCES user_feedback(id) |
| `updated_at` | timestamp with time zone | YES | now() |

### **TABLA: `problematic_questions_tracking`** ⭐ NUEVA (17/09/2025)
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `question_id` | uuid | YES | REFERENCES questions(id) |
| `detection_type` | varchar(50) | NO | null |
| `failure_rate` | decimal(5,2) | YES | null |
| `abandonment_rate` | decimal(5,2) | YES | null |
| `users_affected` | integer | YES | null |
| `total_attempts` | integer | YES | null |
| `status` | varchar(20) | YES | 'pending' |
| `resolved_at` | timestamp | YES | null |
| `resolved_by` | uuid | YES | REFERENCES auth.users(id) |
| `admin_notes` | text | YES | null |
| `resolution_action` | varchar(50) | YES | null |
| `redetection_threshold_users` | integer | YES | 5 |
| `detected_at` | timestamp | YES | now() |
| `created_at` | timestamp | YES | now() |

**🎯 PROPÓSITO:** Sistema de tracking y revisión de preguntas problemáticas detectadas automáticamente por analytics

---

## 🔥 **SISTEMA HOT ARTICLES**

### **TABLA: `hot_articles`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `article_id` | uuid | NO | null |
| `law_id` | uuid | NO | null |
| `target_oposicion` | text | YES | null |
| `oposicion_level` | text | YES | null |
| `total_official_appearances` | integer | YES | 0 |
| `unique_exams_count` | integer | YES | 0 |
| `first_appearance_date` | date | YES | null |
| `last_appearance_date` | date | YES | null |
| `hotness_score` | numeric | YES | 0 |
| `frequency_trend` | text | YES | 'stable' |
| `priority_level` | text | YES | 'low' |
| `article_number` | text | YES | null |
| `law_name` | text | YES | null |
| `article_title` | text | YES | null |
| `entities_breakdown` | jsonb | YES | null |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |
| `last_calculation_date` | timestamp with time zone | YES | null |

---

## 📊 **SISTEMA DE TESTS**

### **TABLA: `tests`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | YES | null |
| `title` | text | NO | null |
| `test_type` | text | YES | 'practice' |
| `total_questions` | integer | NO | null |
| `score` | numeric | YES | null |
| `time_limit_minutes` | integer | YES | null |
| `started_at` | timestamp with time zone | YES | null |
| `completed_at` | timestamp with time zone | YES | null |
| `is_completed` | boolean | YES | false |
| `created_at` | timestamp with time zone | YES | now() |
| `total_time_seconds` | integer | YES | null |
| `average_time_per_question` | numeric | YES | null |
| `tema_number` | integer | YES | null |
| `test_number` | integer | YES | null |
| `detailed_analytics` | jsonb | YES | null |
| `questions_metadata` | jsonb | YES | null |
| `performance_metrics` | jsonb | YES | null |
| `user_session_data` | jsonb | YES | null |

### **TABLA: `test_questions`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `test_id` | uuid | YES | null |
| `question_id` | uuid | YES | null |
| `article_id` | uuid | YES | null |
| `question_order` | integer | NO | null |
| `question_text` | text | NO | null |
| `user_answer` | text | NO | null |
| `correct_answer` | text | NO | null |
| `is_correct` | boolean | NO | null |
| `confidence_level` | text | YES | null |
| `time_spent_seconds` | integer | YES | null |
| `time_to_first_interaction` | integer | YES | null |
| `time_hesitation` | integer | YES | null |
| `interaction_count` | integer | YES | null |
| `article_number` | text | YES | null |
| `law_name` | text | YES | null |
| `tema_number` | integer | YES | null |
| `difficulty` | text | YES | null |
| `question_type` | text | YES | null |
| `tags` | text[] | YES | null |
| `previous_attempts_this_article` | integer | YES | 0 |
| `historical_accuracy_this_article` | numeric | YES | null |
| `knowledge_retention_score` | numeric | YES | null |
| `learning_efficiency_score` | numeric | YES | null |
| `user_agent` | text | YES | null |
| `screen_resolution` | text | YES | null |
| `device_type` | text | YES | null |
| `browser_language` | text | YES | null |
| `timezone` | text | YES | null |
| `full_question_context` | jsonb | YES | null |
| `user_behavior_data` | jsonb | YES | null |
| `learning_analytics` | jsonb | YES | null |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

### **TABLA: `test_configurations`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

### **TABLA: `user_test_sessions`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

---

## 👤 **SISTEMA DE USUARIOS**

### **TABLA: `user_profiles`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `email` | text | NO | null |
| `full_name` | text | YES | null |
| `nickname` | text | YES | null |
| `avatar_url` | text | YES | null |
| `preferred_language` | text | YES | 'es' |
| `study_goal` | integer | YES | 25 |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |
| `target_oposicion` | text | YES | null |
| `target_oposicion_data` | jsonb | YES | null |
| `first_oposicion_detected_at` | timestamp with time zone | YES | null |
| `is_active_student` | boolean | YES | false |
| `first_test_completed_at` | timestamp with time zone | YES | null |

### **TABLA: `public_user_profiles`** ⭐ NUEVA (07/08/2025)
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | REFERENCES auth.users(id) ON DELETE CASCADE |
| `display_name` | text | NO | null |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

### **TABLA: `user_roles`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | NO | null |
| `granted_by` | uuid | YES | null |
| `role` | text | NO | null |
| `is_active` | boolean | YES | true |
| `expires_at` | timestamp with time zone | YES | null |
| `notes` | text | YES | null |
| `granted_at` | timestamp with time zone | YES | now() |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

### **TABLA: `user_sessions`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | YES | null |
| `session_token` | text | YES | null |
| `ip_address` | inet | YES | null |
| `user_agent` | text | YES | null |
| `device_fingerprint` | text | YES | null |
| `screen_resolution` | text | YES | null |
| `viewport_size` | text | YES | null |
| `browser_name` | text | YES | null |
| `browser_version` | text | YES | null |
| `operating_system` | text | YES | null |
| `device_model` | text | YES | null |
| `browser_language` | text | YES | null |
| `timezone` | text | YES | null |
| `color_depth` | integer | YES | null |
| `pixel_ratio` | numeric | YES | null |
| `country_code` | text | YES | null |
| `region` | text | YES | null |
| `city` | text | YES | null |
| `coordinates` | point | YES | null |
| `isp` | text | YES | null |
| `connection_type` | text | YES | null |
| `session_start` | timestamp with time zone | YES | null |
| `session_end` | timestamp with time zone | YES | null |
| `total_duration_minutes` | integer | YES | null |
| `active_time_minutes` | integer | YES | null |
| `idle_time_minutes` | integer | YES | null |
| `pages_visited` | text[] | YES | null |
| `page_view_count` | integer | YES | null |
| `tests_attempted` | integer | YES | null |
| `tests_completed` | integer | YES | null |
| `questions_answered` | integer | YES | null |
| `questions_correct` | integer | YES | null |
| `topics_studied` | text[] | YES | null |
| `time_spent_studying_minutes` | integer | YES | null |
| `entry_page` | text | YES | null |
| `exit_page` | text | YES | null |
| `referrer_url` | text | YES | null |
| `utm_source` | text | YES | null |
| `utm_campaign` | text | YES | null |
| `utm_medium` | text | YES | null |
| `search_queries` | text[] | YES | null |
| `navigation_pattern` | jsonb | YES | null |
| `click_count` | integer | YES | null |
| `scroll_depth_max` | numeric | YES | null |
| `form_interactions` | integer | YES | null |
| `search_interactions` | integer | YES | null |
| `download_actions` | integer | YES | null |
| `engagement_score` | numeric | YES | null |
| `interaction_rate` | numeric | YES | null |
| `content_consumption_rate` | numeric | YES | null |
| `bounce_indicator` | boolean | YES | null |
| `conversion_events` | text[] | YES | null |
| `learning_session_type` | text | YES | null |
| `session_goal` | text | YES | null |
| `session_outcome` | text | YES | null |
| `satisfaction_indicator` | text | YES | null |
| `technical_details` | jsonb | YES | null |
| `interaction_events` | jsonb | YES | null |
| `performance_metrics` | jsonb | YES | null |
| `accessibility_data` | jsonb | YES | null |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

---

## 🏆 **SISTEMA DE MEDALLAS Y RANKING** ⭐ NUEVO (07/08/2025)

### **TABLA: `user_medals`** ⭐ NUEVA
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | uuid | NO | REFERENCES auth.users(id) ON DELETE CASCADE |
| `medal_id` | text | NO | null |
| `medal_data` | jsonb | NO | '{}' |
| `unlocked_at` | timestamp with time zone | YES | now() |
| `viewed` | boolean | YES | false |
| `created_at` | timestamp with time zone | YES | now() |

**🔐 CONSTRAINT:** `user_medals_unique` UNIQUE(user_id, medal_id)
**🎯 PROPÓSITO:** Sistema de logros y medallas de ranking para competencia entre usuarios

---

## 📈 **SISTEMA DE ANALYTICS**

### **TABLA: `user_learning_analytics`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | NO | null |
| `total_tests_completed` | integer | YES | 0 |
| `total_questions_answered` | integer | YES | 0 |
| `overall_accuracy` | numeric | YES | 0 |
| `total_study_time_hours` | numeric | YES | 0 |
| `current_streak_days` | integer | YES | 0 |
| `longest_streak_days` | integer | YES | 0 |
| `article_id` | uuid | YES | null |
| `article_number` | text | YES | null |
| `law_name` | text | YES | null |
| `tema_number` | integer | YES | null |
| `oposicion_type` | text | YES | null |
| `mastery_level` | text | YES | 'beginner' |
| `mastery_score` | numeric | YES | 0 |
| `confidence_score` | numeric | YES | 0 |
| `consistency_score` | numeric | YES | 0 |
| `learning_style` | text | YES | 'mixed' |
| `optimal_session_duration_minutes` | integer | YES | 30 |
| `retention_rate` | numeric | YES | 0 |
| `improvement_velocity` | numeric | YES | 0 |
| `fatigue_threshold_minutes` | integer | YES | 60 |
| `peak_performance_hours` | integer[] | YES | null |
| `worst_performance_hours` | integer[] | YES | null |
| `optimal_study_frequency_days` | integer | YES | 3 |
| `best_day_of_week` | integer | YES | null |
| `current_weak_areas` | text[] | YES | null |
| `recommended_focus_articles` | text[] | YES | null |
| `predicted_exam_readiness` | numeric | YES | 0 |
| `estimated_hours_to_mastery` | numeric | YES | 100 |
| `next_review_date` | timestamp with time zone | YES | null |
| `article_performance_history` | jsonb | YES | null |
| `difficulty_progression` | jsonb | YES | null |
| `time_efficiency_trends` | jsonb | YES | null |
| `error_pattern_analysis` | jsonb | YES | null |
| `last_analysis_date` | timestamp with time zone | YES | null |
| `analysis_confidence` | numeric | YES | 0.5 |
| `data_points_count` | integer | YES | 0 |
| `algorithm_version` | text | YES | '1.0' |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

### **TABLA: `user_progress`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | YES | null |
| `topic_id` | uuid | YES | null |
| `law_id` | uuid | YES | null |
| `article_id` | uuid | YES | null |
| `total_attempts` | integer | YES | 0 |
| `correct_attempts` | integer | YES | 0 |
| `last_attempt_date` | timestamp with time zone | YES | now() |
| `accuracy_percentage` | numeric | YES | 0.00 |
| `needs_review` | boolean | YES | false |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

**🎯 PROPÓSITO:** Seguimiento del progreso de usuarios por tema/ley/artículo. Almacena estadísticas de precisión y marca temas que necesitan revisión.

### **TABLA: `topics`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `position_type` | text | NO | null |
| `topic_number` | integer | NO | null |
| `title` | text | NO | null |
| `description` | text | YES | null |
| `difficulty` | text | YES | 'medium'::text |
| `estimated_hours` | integer | YES | 10 |
| `is_active` | boolean | YES | true |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

**🎯 PROPÓSITO:** Definición de temas de estudio. `topic_number` se relaciona con `tema_number` en `test_questions`.

### **TABLA: `user_recommendations`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|

---

## 💬 **SISTEMA DE FEEDBACK DE USUARIOS** ⭐ NUEVO

### **TABLA: `user_feedback`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | YES | null |
| `email` | text | YES | null |
| `type` | text | NO | null |
| `message` | text | NO | null |
| `url` | text | YES | null |
| `user_agent` | text | YES | null |
| `viewport` | text | YES | null |
| `referrer` | text | YES | null |
| `wants_response` | boolean | YES | false |
| `status` | text | YES | 'pending' |
| `priority` | text | YES | 'medium' |
| `is_read` | boolean | YES | false |
| `admin_notes` | text | YES | null |
| `admin_user_id` | uuid | YES | null |
| `resolved_at` | timestamp with time zone | YES | null |
| `question_id` | uuid | YES | REFERENCES questions(id) |
| `dispute_type` | text | YES | null |
| `theme_context` | jsonb | YES | null |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

**🎯 PROPÓSITO:** Sistema completo de feedback de usuarios con gestión admin. Campos `question_id`, `dispute_type` y `theme_context` opcionales para capturar contexto completo. Campo `theme_context` almacena información del tema estudiado (number, name). Mantiene compatibilidad con sistema `question_disputes` existente.

### **TABLA: `feedback_conversations`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `feedback_id` | uuid | YES | REFERENCES user_feedback(id) |
| `user_id` | uuid | YES | null |
| `status` | text | YES | 'waiting_admin' |
| `last_message_at` | timestamp with time zone | YES | now() |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

**🎯 PROPÓSITO:** Conversaciones de chat asociadas al feedback

### **TABLA: `feedback_messages`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `conversation_id` | uuid | YES | REFERENCES feedback_conversations(id) |
| `sender_type` | text | NO | null |
| `sender_id` | uuid | YES | null |
| `message` | text | NO | null |
| `is_read` | boolean | YES | false |
| `read_at` | timestamp with time zone | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

**🎯 PROPÓSITO:** Mensajes individuales dentro de conversaciones de feedback

---

## 📧 **SISTEMA DE EMAILS**

### **TABLA: `email_logs`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | YES | null |
| `email_type` | text | NO | null |
| `subject` | text | NO | null |
| `sent_at` | timestamp with time zone | YES | null |
| `opened_at` | timestamp with time zone | YES | null |
| `clicked_at` | timestamp with time zone | YES | null |
| `status` | text | YES | 'sent' |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `email_unsubscribe_tokens` ⭐ NUEVA**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | NO | null |
| `token` | text | NO | null |
| `email` | text | NO | null |
| `email_type` | text | NO | null |
| `expires_at` | timestamp with time zone | NO | now() + interval '30 days' |
| `used_at` | timestamp with time zone | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

---

## 🔔 **SISTEMA DE NOTIFICACIONES PUSH** ⭐ NUEVO

### **TABLA: `user_notification_settings`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | NO | REFERENCES auth.users(id) |
| `push_enabled` | boolean | YES | false |
| `push_subscription` | jsonb | YES | null |
| `preferred_times` | jsonb | YES | '["09:00", "14:00", "20:00"]' |
| `timezone` | text | YES | 'Europe/Madrid' |
| `frequency` | text | YES | 'smart' |
| `oposicion_type` | text | YES | 'auxiliar-administrativo' |
| `exam_date` | date | YES | null |
| `motivation_level` | text | YES | 'medium' |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

### **TABLA: `user_activity_patterns`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | NO | REFERENCES auth.users(id) |
| `preferred_hours` | integer[] | YES | ARRAY[9, 14, 20] |
| `active_days` | integer[] | YES | ARRAY[1,2,3,4,5,6,7] |
| `avg_session_duration` | integer | YES | 15 |
| `peak_performance_time` | time | YES | null |
| `streak_pattern` | text | YES | null |
| `last_calculated` | timestamp with time zone | YES | now() |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `notification_templates`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `category` | text | NO | null |
| `subcategory` | text | YES | null |
| `message_variants` | jsonb | NO | null |
| `target_conditions` | jsonb | YES | null |
| `oposicion_context` | boolean | YES | true |
| `urgency_level` | integer | YES | 1 |
| `active` | boolean | YES | true |
| `success_metrics` | jsonb | YES | '{}' |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `notification_logs`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | NO | REFERENCES auth.users(id) |
| `template_id` | uuid | YES | REFERENCES notification_templates(id) |
| `message_sent` | text | NO | null |
| `message_variant` | integer | YES | null |
| `sent_at` | timestamp with time zone | YES | now() |
| `scheduled_for` | timestamp with time zone | YES | null |
| `delivery_status` | text | YES | 'sent' |
| `opened_at` | timestamp with time zone | YES | null |
| `clicked_at` | timestamp with time zone | YES | null |
| `resulted_in_session` | boolean | YES | false |
| `session_started_at` | timestamp with time zone | YES | null |
| `context_data` | jsonb | YES | null |
| `device_info` | jsonb | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `notification_metrics`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `template_id` | uuid | YES | REFERENCES notification_templates(id) |
| `user_segment` | text | YES | null |
| `period_start` | timestamp with time zone | YES | null |
| `period_end` | timestamp with time zone | YES | null |
| `total_sent` | integer | YES | 0 |
| `total_delivered` | integer | YES | 0 |
| `total_opened` | integer | YES | 0 |
| `total_clicked` | integer | YES | 0 |
| `total_sessions_generated` | integer | YES | 0 |
| `avg_time_to_click` | interval | YES | null |
| `conversion_rate` | decimal(5,4) | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `user_smart_scheduling`**
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | uuid_generate_v4() |
| `user_id` | uuid | NO | REFERENCES auth.users(id) |
| `next_notification_time` | timestamp with time zone | YES | null |
| `notification_frequency_hours` | integer | YES | 24 |
| `last_session_time` | timestamp with time zone | YES | null |
| `streak_status` | integer | YES | 0 |
| `risk_level` | text | YES | 'low' |
| `last_risk_calculation` | timestamp with time zone | YES | now() |
| `pause_until` | timestamp with time zone | YES | null |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

---

## 🔔 **SISTEMA DE TRACKING DE NOTIFICACIONES** ⭐ NUEVO (04/08/2025)

### **TABLA: `notification_events`** ⭐ NUEVA
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | uuid | YES | REFERENCES auth.users(id) ON DELETE CASCADE |
| `event_type` | text | NO | CHECK IN ('permission_requested', 'permission_granted', 'permission_denied', 'subscription_created', 'subscription_updated', 'subscription_deleted', 'notification_sent', 'notification_delivered', 'notification_clicked', 'notification_dismissed', 'notification_failed', 'settings_updated') |
| `notification_type` | text | YES | CHECK IN ('motivation', 'streak_reminder', 'achievement', 'study_reminder', 'reactivation', 'urgent') |
| `device_info` | jsonb | YES | '{}' |
| `browser_info` | jsonb | YES | '{}' |
| `push_subscription` | jsonb | YES | null |
| `notification_data` | jsonb | YES | '{}' |
| `response_time_ms` | integer | YES | null |
| `error_details` | text | YES | null |
| `ip_address` | inet | YES | null |
| `user_agent` | text | YES | null |
| `referrer` | text | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `email_events`** ⭐ NUEVA
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | uuid | YES | REFERENCES auth.users(id) ON DELETE CASCADE |
| `email_type` | text | NO | CHECK IN ('welcome', 'reactivation', 'urgent_reactivation', 'motivation', 'achievement', 'streak_danger', 'newsletter', 'system') |
| `event_type` | text | NO | CHECK IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed') |
| `email_address` | text | NO | null |
| `subject` | text | YES | null |
| `template_id` | text | YES | null |
| `campaign_id` | text | YES | null |
| `email_content_preview` | text | YES | null |
| `link_clicked` | text | YES | null |
| `click_count` | integer | YES | 0 |
| `open_count` | integer | YES | 0 |
| `device_type` | text | YES | null |
| `client_name` | text | YES | null |
| `ip_address` | inet | YES | null |
| `user_agent` | text | YES | null |
| `geolocation` | jsonb | YES | '{}' |
| `error_details` | text | YES | null |
| `created_at` | timestamp with time zone | YES | now() |

### **TABLA: `user_notification_metrics`** ⭐ NUEVA
| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | uuid | YES | REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE |
| `push_permission_status` | text | YES | 'not_requested' |
| `push_subscriptions_count` | integer | YES | 0 |
| `push_notifications_sent` | integer | YES | 0 |
| `push_notifications_clicked` | integer | YES | 0 |
| `push_notifications_dismissed` | integer | YES | 0 |
| `push_click_rate` | decimal(5,2) | YES | 0.00 |
| `last_push_interaction` | timestamp with time zone | YES | null |
| `emails_sent` | integer | YES | 0 |
| `emails_delivered` | integer | YES | 0 |
| `emails_opened` | integer | YES | 0 |
| `emails_clicked` | integer | YES | 0 |
| `emails_bounced` | integer | YES | 0 |
| `email_open_rate` | decimal(5,2) | YES | 0.00 |
| `email_click_rate` | decimal(5,2) | YES | 0.00 |
| `last_email_opened` | timestamp with time zone | YES | null |
| `last_email_clicked` | timestamp with time zone | YES | null |
| `primary_device_type` | text | YES | null |
| `primary_browser` | text | YES | null |
| `notification_engagement_score` | integer | YES | 0 |
| `email_engagement_score` | integer | YES | 0 |
| `overall_engagement_score` | integer | YES | 0 |
| `created_at` | timestamp with time zone | YES | now() |
| `updated_at` | timestamp with time zone | YES | now() |

### **VISTAS DE ANALYTICS PARA TRACKING** ⭐ NUEVAS

#### **VISTA: `admin_notification_analytics`**
- Métricas generales de notificaciones push por día
- Tasas de click, dismiss, permisos concedidos/denegados
- Desglose por dispositivo y navegador
- Tendencias de los últimos 30 días

#### **VISTA: `admin_email_analytics`**
- Métricas de emails por tipo (bienvenida, reactivación, etc.)
- Tasas de apertura, click, rebote por tipo de email
- Análisis de efectividad por campaña
- Tendencias de los últimos 30 días

---

## 📊 **FUNCIONES SQL IMPLEMENTADAS (57 FUNCIONES)**

### 🛡️ **SISTEMA DE ROLES Y SEGURIDAD (4 FUNCIONES)**

#### 1. **`assign_role(p_user_id uuid, p_role text, p_notes text)`**
- **Tipo:** Gestión de roles
- **Retorna:** `uuid`
- **Descripción:** Asigna roles a usuarios (solo admins)
- **Seguridad:** Verifica que quien llama sea admin

#### 2. **`get_current_user_roles()`**
- **Tipo:** Consulta de roles
- **Retorna:** `text[]`
- **Descripción:** Obtiene roles activos del usuario actual
- **Filtros:** Solo roles activos y no expirados

#### 3. **`is_current_user_admin()`**
- **Tipo:** Verificación de permisos
- **Retorna:** `boolean`
- **Descripción:** Verifica si el usuario actual es admin o super_admin

#### 4. **`user_has_role(p_user_id uuid, p_role text)`**
- **Tipo:** Verificación de roles
- **Retorna:** `boolean`
- **Descripción:** Verifica si un usuario tiene un rol específico

---

### 🔥 **SISTEMA HOT ARTICLES INTELIGENTE (3 FUNCIONES)**

#### 5. **`calculate_article_hotness_by_oposicion()` ⭐ TRIGGER REVOLUCIONARIO**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Calcula automáticamente hotness por oposición específica
- **Algoritmo:** Multifactorial (frecuencia + recencia + diversidad + consistencia)
- **Ejecución:** Automática al insertar preguntas oficiales

#### 6. **`check_hot_article_for_current_user(article_id_param uuid, user_id_param uuid)`**
- **Tipo:** Consulta inteligente
- **Retorna:** `record`
- **Descripción:** Verifica si artículo es hot para la oposición del usuario
- **Features:** Normalización flexible + mensajes personalizados + curiosidades

#### 7. **`check_if_article_is_hot_for_user_oposicion(article_id_param uuid, user_oposicion text)`**
- **Tipo:** Consulta con curiosidades
- **Retorna:** `record`
- **Descripción:** Detección hot + análisis cruzado entre oposiciones
- **Output:** Mensaje principal + curiosidades + datos JSON

---

### 🧠 **SISTEMA DE INTELIGENCIA ARTIFICIAL (8 FUNCIONES)**

#### 8. **`update_question_difficulty_immediate()` ⭐ TRIGGER IA PRINCIPAL**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Calcula dificultad automáticamente desde primera respuesta
- **Algoritmo:** 50% aciertos + 25% tiempo + 25% confianza
- **Resultado:** Dificultad automática (easy, medium, hard, extreme)

#### 9. **`calculate_knowledge_retention_score(time_spent_sec integer, is_correct boolean, difficulty_level text)`**
- **Tipo:** Cálculo de aprendizaje
- **Retorna:** `numeric`
- **Descripción:** Puntuación de retención 0-150
- **Factores:** Tiempo vs óptimo + correctitud + multiplicador dificultad

#### 10. **`detect_learning_style(user_uuid uuid)`**
- **Tipo:** Análisis de comportamiento
- **Retorna:** `text`
- **Descripción:** Detecta estilo: analytical, visual, repetitive, mixed
- **Basado en:** Tiempo promedio + interacciones + consistencia

#### 11. **`update_user_learning_analytics(user_uuid uuid, article_uuid uuid, tema_num integer, opos_type text)`**
- **Tipo:** Actualización automática
- **Retorna:** `void`
- **Descripción:** Actualiza todas las métricas de aprendizaje
- **Calcula:** Accuracy + estilo + maestría + preparación para examen

#### 12. **`get_complete_test_analytics(test_session_id uuid)`**
- **Tipo:** Analytics completos
- **Retorna:** `jsonb`
- **Descripción:** Análisis completo de un test específico
- **Incluye:** Desglose por dificultad + artículo + confianza + patrones

#### 13. **`predict_exam_readiness(user_uuid uuid, oposicion_type text)`**
- **Tipo:** Predicción IA
- **Retorna:** `jsonb`
- **Descripción:** Predicción de preparación para examen
- **Componentes:** Accuracy + consistencia + eficiencia temporal

#### 14. **`trigger_calculate_retention_score()` ⭐ TRIGGER AUTOMÁTICO**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Calcula scores de retención y eficiencia automáticamente
- **Ejecución:** BEFORE INSERT/UPDATE en test_questions

#### 15. **`verify_triggers_working()`**
- **Tipo:** Diagnóstico del sistema
- **Retorna:** `jsonb`
- **Descripción:** Verifica que todos los triggers estén funcionando
- **Monitorea:** Triggers activos + funciones disponibles

---

### 📊 **SISTEMA DE GENERACIÓN DE TESTS (6 FUNCIONES)**

#### 16. **`generate_test_by_topic(p_topic_id uuid, p_total_questions integer, p_difficulty_filter text)`**
- **Tipo:** Generador dinámico
- **Retorna:** `record`
- **Descripción:** Genera tests por tema con filtros
- **Aleatorización:** ORDER BY RANDOM()

#### 17. **`check_questions_availability(p_tema_number integer, p_difficulty_filter text)`**
- **Tipo:** Verificación de disponibilidad
- **Retorna:** `record`
- **Descripción:** Verifica cuántas preguntas están disponibles
- **Filtros:** Por tema + dificultad

#### 18. **`get_questions_by_tema_and_difficulty(p_tema_number integer, p_total_questions integer, p_difficulty_filter text)`**
- **Tipo:** Consulta principal de tests
- **Retorna:** `record`
- **Descripción:** Obtiene preguntas para tests con filtros
- **Incluye:** Contenido completo del artículo

#### 19. **`get_tema_stats(p_tema_number integer)`**
- **Tipo:** Estadísticas de tema
- **Retorna:** `record`
- **Descripción:** Estadísticas completas por tema
- **Desglose:** Total preguntas + artículos + por dificultad

#### 20. **`get_topic_questions_simple(p_topic_id uuid)`**
- **Tipo:** Consulta simple
- **Retorna:** `uuid`
- **Descripción:** IDs de preguntas por topic_id

#### 21. **`get_topic_questions_v2(p_topic_id uuid)`**
- **Tipo:** Consulta avanzada
- **Retorna:** `record`
- **Descripción:** Preguntas con información de artículos
- **Incluye:** Títulos + capítulos completos

---

### 🏛️ **SISTEMA DE OPOSICIONES (6 FUNCIONES)**

#### 22. **`get_oposicion_articles(p_oposicion_id uuid)`**
- **Tipo:** Mapeo de artículos
- **Retorna:** `record`
- **Descripción:** Artículos de una oposición (via topic_scope + directos)
- **Fuentes:** topic_scope + oposicion_articles

#### 23. **`get_oposicion_coverage_stats(p_oposicion_id uuid)`**
- **Tipo:** Estadísticas de cobertura
- **Retorna:** `record`
- **Descripción:** Cobertura de preguntas y exámenes por oposición
- **Métricas:** % artículos con preguntas + % en exámenes

#### 24. **`get_question_stats_by_position(p_position_type text)`**
- **Tipo:** Estadísticas por posición
- **Retorna:** `record`
- **Descripción:** Estadísticas de preguntas por tipo de oposición
- **Desglose:** Por tema + dificultad

#### 25. **`get_estadisticas_examenes_oficiales(p_oposicion_id uuid)`**
- **Tipo:** Estadísticas oficiales
- **Retorna:** `record`
- **Descripción:** Estadísticas de exámenes oficiales por año
- **Incluye:** Preguntas por parte + anuladas + artículos/leyes

#### 26. **`get_examen_oficial_exacto(p_convocatoria_id uuid, p_parte_examen text)`**
- **Tipo:** Examen completo
- **Retorna:** `record`
- **Descripción:** Examen oficial completo de una convocatoria
- **Filtros:** Por parte del examen

#### 27. **`get_preguntas_oficiales_por_tema(p_oposicion_id uuid, p_topic_name text, p_num_questions integer)`**
- **Tipo:** Preguntas oficiales por tema
- **Retorna:** `record`
- **Descripción:** Preguntas oficiales filtradas por tema
- **Aleatorización:** Con límite de cantidad

---

### 📚 **SISTEMA DE ARTÍCULOS Y CONTEXTO (6 FUNCIONES)**

#### 28. **`get_article_context_clean(p_article_number text, p_oposicion_name text)`**
- **Tipo:** Contexto de artículo
- **Retorna:** `record`
- **Descripción:** Contexto limpio de apariciones en exámenes

#### 29. **`get_article_context_final(p_article_number text, p_oposicion_name text)`**
- **Tipo:** Contexto final
- **Retorna:** `record`
- **Descripción:** Contexto definitivo con DISTINCT ON

#### 30. **`get_article_exam_history(p_article_id uuid, p_oposicion_id uuid)`**
- **Tipo:** Historial de exámenes
- **Retorna:** `record`
- **Descripción:** Historial completo de apariciones en exámenes

#### 31. **`get_article_exam_stats(p_article_id uuid, p_oposicion_id uuid)`**
- **Tipo:** Estadísticas de artículo
- **Retorna:** `record`
- **Descripción:** Estadísticas completas de apariciones
- **Incluye:** Nivel de importancia calculado

#### 32. **`get_article_questions(p_article_id uuid)`**
- **Tipo:** Preguntas de artículo
- **Retorna:** `record`
- **Descripción:** Todas las preguntas de un artículo específico

#### 33. **`get_question_exam_context_v2(p_question_id uuid, p_user_oposicion_id uuid)`**
- **Tipo:** Contexto inteligente
- **Retorna:** `record`
- **Descripción:** Contexto de pregunta para oposición específica
- **Validación:** Solo artículos válidos para la oposición

---

### 📧 **SISTEMA DE EMAILS AUTOMÁTICOS (3 FUNCIONES)**

#### 34. **`get_inactive_users_for_emails()`**
- **Tipo:** Detección de usuarios inactivos
- **Retorna:** `record`
- **Descripción:** Usuarios inactivos 7+ días que ya completaron tests
- **Protecciones:** Anti-spam + exclusión de admins + límites

#### 35. **`get_unmotivated_new_users()`**
- **Tipo:** Detección de usuarios nuevos
- **Retorna:** `record`
- **Descripción:** Usuarios registrados 3-30 días que NUNCA completaron test
- **Ventana:** Oportunidad de motivación en primeros 30 días

#### 36. **`get_email_campaign_stats(days_back integer)`** - **NO IMPLEMENTADA AÚN**
- **Tipo:** Analytics de emails
- **Retorna:** `record`
- **Descripción:** Estadísticas de efectividad de campañas
- **Métricas:** Tasas de apertura + clicks + conversión

---

### 🔧 **SISTEMA TÉCNICO Y UTILIDADES (8 FUNCIONES)**

#### 37. **`handle_new_user()` ⭐ TRIGGER AUTH**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Crea perfil automáticamente al registrarse
- **Integración:** Con sistema de autenticación

#### 38. **`generate_content_hash(content_text text)`**
- **Tipo:** Utilidad de integridad
- **Retorna:** `text`
- **Descripción:** Genera hash SHA-256 para control de versiones

#### 39. **`trigger_update_timestamp()`**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Actualiza updated_at automáticamente

#### 40. **`trigger_cleanup_old_sessions()`**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Limpieza automática GDPR (sesiones > 1 año)

#### 41. **`trigger_update_article_stats()`**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Actualiza estadísticas de artículos por usuario

#### 42. **`trigger_update_user_analytics()` ⭐ TRIGGER PRINCIPAL**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Actualiza analytics al completar test + marca is_active_student

#### 43. **`update_user_roles_updated_at()`**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Actualiza timestamp en cambios de roles

#### 44. **`update_user_progress(p_user_id uuid, p_test_id uuid)`**
- **Tipo:** Seguimiento de progreso
- **Retorna:** `void`
- **Descripción:** Actualiza progreso del usuario por tema/ley/artículo

#### 45. **`verify_triggers_working()`**
- **Tipo:** Diagnóstico
- **Retorna:** `jsonb`
- **Descripción:** Verificación completa del sistema de triggers

#### 46. **`get_user_recommendations()` - FUNCIÓN PLACEHOLDER**
- **Tipo:** Recomendaciones
- **Retorna:** `record`
- **Descripción:** Sistema de recomendaciones personalizadas (pendiente implementación)

---

## ⚡ **TRIGGERS AUTOMÁTICOS IMPLEMENTADOS (15 TRIGGERS)**

### 🔥 **TRIGGERS DE INTELIGENCIA ARTIFICIAL**

#### 1. **`update_article_hotness_by_oposicion_trigger`** ⭐ REVOLUCIONARIO
- **Tabla:** `questions`
- **Eventos:** INSERT, UPDATE
- **Timing:** AFTER
- **Función:** `calculate_article_hotness_by_oposicion()`
- **Descripción:** Calcula hotness automáticamente al insertar preguntas oficiales

#### 2. **`auto_update_difficulty_immediate_trigger`** ⭐ REVOLUCIONARIO
- **Tabla:** `test_questions`
- **Eventos:** INSERT
- **Timing:** AFTER
- **Función:** `update_question_difficulty_immediate()`
- **Descripción:** Calcula dificultad desde primera respuesta automáticamente

#### 3. **`calculate_retention_score_trigger`**
- **Tabla:** `test_questions`
- **Eventos:** INSERT, UPDATE
- **Timing:** BEFORE
- **Función:** `trigger_calculate_retention_score()`
- **Descripción:** Calcula scores de retención y eficiencia automáticamente

#### 4. **`update_article_stats_trigger`**
- **Tabla:** `test_questions`
- **Eventos:** INSERT
- **Timing:** AFTER
- **Función:** `trigger_update_article_stats()`
- **Descripción:** Actualiza estadísticas de artículos por usuario

#### 5. **`update_user_analytics_on_test_completion`** ⭐ PRINCIPAL
- **Tabla:** `tests`
- **Eventos:** UPDATE
- **Timing:** AFTER
- **Función:** `trigger_update_user_analytics()`
- **Descripción:** Actualiza analytics completos al completar test + marca is_active_student

---

### 🕒 **TRIGGERS DE TIMESTAMPS**

#### 6. **`update_timestamp_trigger_test_questions`**
- **Tabla:** `test_questions`
- **Eventos:** UPDATE
- **Timing:** BEFORE
- **Función:** `trigger_update_timestamp()`

#### 7. **`update_timestamp_trigger_user_analytics`**
- **Tabla:** `user_learning_analytics`
- **Eventos:** UPDATE
- **Timing:** BEFORE
- **Función:** `trigger_update_timestamp()`

#### 8. **`update_timestamp_trigger_user_sessions`**
- **Tabla:** `user_sessions`
- **Eventos:** UPDATE
- **Timing:** BEFORE
- **Función:** `trigger_update_timestamp()`

#### 9. **`user_roles_updated_at_trigger`**
- **Tabla:** `user_roles`
- **Eventos:** UPDATE
- **Timing:** BEFORE
- **Función:** `update_user_roles_updated_at()`

---

### 🛡️ **TRIGGERS DE SEGURIDAD Y LIMPIEZA**

#### 10. **`cleanup_old_sessions_trigger`**
- **Tabla:** `user_sessions`
- **Eventos:** INSERT
- **Timing:** AFTER
- **Función:** `trigger_cleanup_old_sessions()`
- **Descripción:** Limpieza automática GDPR (elimina sesiones > 1 año)

---

### 🔔 **TRIGGERS DE TRACKING DE NOTIFICACIONES** ⭐ NUEVO (04/08/2025)

#### 11. **`trigger_update_notification_metrics`** ⭐ TRACKING AUTOMÁTICO
- **Tabla:** `notification_events`
- **Eventos:** INSERT
- **Timing:** AFTER
- **Función:** `update_user_notification_metrics()`
- **Descripción:** Actualiza métricas de push notifications automáticamente

#### 12. **`trigger_update_email_metrics`** ⭐ TRACKING AUTOMÁTICO
- **Tabla:** `email_events`
- **Eventos:** INSERT
- **Timing:** AFTER
- **Función:** `update_user_notification_metrics()`
- **Descripción:** Actualiza métricas de emails automáticamente

---

### 🛡️ **TRIGGERS DE AUTENTICACIÓN** ⭐ ACTUALIZADO

#### 13. **`handle_new_user_trigger`**
- **Tabla:** `auth.users`
- **Eventos:** INSERT
- **Timing:** AFTER
- **Función:** `handle_new_user()`
- **Descripción:** Crea perfil automáticamente al registrarse

#### 14. **`handle_user_delete_trigger`** - **SI EXISTE**
- **Tabla:** `auth.users`
- **Eventos:** DELETE
- **Timing:** BEFORE
- **Función:** `cleanup_user_data()`
- **Descripción:** Limpieza GDPR al eliminar usuario

---

### 🏆 **TRIGGERS DEL SISTEMA DE MEDALLAS** ⭐ NUEVO (07/08/2025)

#### 15. **`sync_nickname_trigger`** ⭐ SINCRONIZACIÓN AUTOMÁTICA
- **Tabla:** `user_profiles`
- **Eventos:** UPDATE
- **Timing:** AFTER
- **Función:** `sync_nickname_simple()`
- **Descripción:** Sincroniza nickname automáticamente a public_user_profiles
- **Propósito:** Mantener nombres actualizados en ranking y medallas

---

### 📧 **SISTEMA DE EMAILS AUTOMÁTICOS (7 FUNCIONES)** ⭐ ACTUALIZADO

#### 34. **`get_inactive_users_for_emails()`**
- **Tipo:** Detección de usuarios inactivos
- **Retorna:** `record`
- **Descripción:** Usuarios inactivos 7+ días que ya completaron tests
- **Protecciones:** Anti-spam + exclusión de admins + límites

#### 35. **`get_unmotivated_new_users()`**
- **Tipo:** Detección de usuarios nuevos
- **Retorna:** `record`
- **Descripción:** Usuarios registrados 3-30 días que NUNCA completaron test
- **Ventana:** Oportunidad de motivación en primeros 30 días

#### 36. **`get_email_campaign_stats(days_back integer)`** - **NO IMPLEMENTADA AÚN**
- **Tipo:** Analytics de emails
- **Retorna:** `record`
- **Descripción:** Estadísticas de efectividad de campañas
- **Métricas:** Tasas de apertura + clicks + conversión

#### 37. **`generate_unsubscribe_token(user_uuid uuid, user_email text, email_type_param text)` ⭐ NUEVA**
- **Tipo:** Generación de tokens
- **Retorna:** `text`
- **Descripción:** Genera token único para unsubscribe sin login
- **Seguridad:** Token aleatorio de 64 caracteres + expiración 30 días
- **Uso:** Integrado automáticamente en emailService.js

#### 38. **`validate_unsubscribe_token(token_param text)` ⭐ NUEVA**
- **Tipo:** Validación de tokens
- **Retorna:** `TABLE(user_id uuid, email text, email_type text, full_name text)`
- **Descripción:** Valida token y retorna información del usuario
- **Verificaciones:** Token no usado + no expirado + existe en BD
- **Uso:** API /api/unsubscribe/validate

#### 39. **`process_unsubscribe_by_token(token_param text, unsubscribe_all_param boolean, specific_types_param text[])` ⭐ NUEVA**
- **Tipo:** Procesamiento de unsubscribe
- **Retorna:** `TABLE(success boolean, message text, email text)`
- **Descripción:** Procesa unsubscribe y actualiza preferencias
- **Funcionalidades:**
  - Desactivar todos los emails (unsubscribe_all = true)
  - Desactivar tipos específicos (array de tipos)
  - Marca token como usado automáticamente
  - Actualiza email_preferences vía UPSERT
- **Uso:** API /api/unsubscribe

#### 40. **`cleanup_expired_unsubscribe_tokens()` ⭐ NUEVA**
- **Tipo:** Limpieza automática
- **Retorna:** `integer`
- **Descripción:** Elimina tokens expirados (GDPR compliance)
- **Programación:** Ejecutar automáticamente o vía cron job
- **Retorna:** Número de tokens eliminados

**🔧 FUNCIONES TÉCNICAS Y UTILIDADES ACTUALIZADAS (8 → 12 FUNCIONES)**

#### 41. **`handle_new_user()` ⭐ TRIGGER AUTH**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Crea perfil automáticamente al registrarse
- **Integración:** Con sistema de autenticación

#### 42. **`generate_content_hash(content_text text)`**
- **Tipo:** Utilidad de integridad
- **Retorna:** `text`
- **Descripción:** Genera hash SHA-256 para control de versiones

#### 43. **`trigger_update_timestamp()`**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Actualiza updated_at automáticamente

#### 44. **`trigger_cleanup_old_sessions()`**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Limpieza automática GDPR (sesiones > 1 año)

#### 45. **`trigger_update_article_stats()`**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Actualiza estadísticas de artículos por usuario

#### 46. **`trigger_update_user_analytics()` ⭐ TRIGGER PRINCIPAL**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Actualiza analytics al completar test + marca is_active_student

#### 47. **`update_user_roles_updated_at()`**
- **Tipo:** `trigger`
- **Retorna:** `trigger`
- **Descripción:** Actualiza timestamp en cambios de roles

#### 48. **`update_user_progress(p_user_id uuid, p_test_id uuid)`**
- **Tipo:** Seguimiento de progreso
- **Retorna:** `void`
- **Descripción:** Actualiza progreso del usuario por tema/ley/artículo

#### 49. **`verify_triggers_working()`**
- **Tipo:** Diagnóstico
- **Retorna:** `jsonb`
- **Descripción:** Verificación completa del sistema de triggers

#### 50. **`get_user_recommendations()` - FUNCIÓN PLACEHOLDER**
- **Tipo:** Recomendaciones
- **Retorna:** `record`
- **Descripción:** Sistema de recomendaciones personalizadas (pendiente implementación)

---

## 🔔 **SISTEMA DE TRACKING DE NOTIFICACIONES (3 FUNCIONES)** ⭐ NUEVO (04/08/2025)

#### 51. **`update_user_notification_metrics()` ⭐ TRIGGER AUTOMÁTICO**
- **Tipo:** `trigger function`
- **Retorna:** `trigger`
- **Descripción:** Actualiza métricas automáticamente al insertar eventos
- **Tablas:** `notification_events`, `email_events` → `user_notification_metrics`
- **Funcionalidades:**
  - Contadores automáticos (sent, clicked, opened, dismissed)
  - Cálculo de tasas (click_rate, open_rate)
  - Actualización de timestamps (last_interaction, last_opened)
  - Upsert automático (crea registro si no existe)

#### 52. **`admin_notification_analytics` ⭐ VISTA ANALÍTICA**
- **Tipo:** Vista materializada
- **Retorna:** Agregaciones por día
- **Descripción:** Métricas consolidadas para panel de admin
- **Incluye:**
  - Total usuarios con notificaciones
  - Eventos de push (permisos, envíos, clicks, dismissals)
  - Tasas de conversión (click_rate)
  - Desglose por dispositivo/navegador
  - Datos de los últimos 30 días

#### 53. **`admin_email_analytics` ⭐ VISTA ANALÍTICA**
- **Tipo:** Vista materializada  
- **Retorna:** Agregaciones por email_type y día
- **Descripción:** Métricas consolidadas de emails
- **Incluye:**
  - Emails sent/delivered/opened/clicked por tipo
  - Tasas de apertura y click por tipo
  - Análisis de rebotes y unsubscribes
  - Tendencias temporales por tipo de email

---

## 🎯 **RESUMEN DE IMPLEMENTACIONES RECIENTES**

### 🏆 **SISTEMA DE MEDALLAS Y RANKING (07/08/2025)** ⭐ COMPLETADO

**📋 Características principales:**
- **8 tipos de medallas**: Campeón diario/semanal/mensual, Podio diario/semanal/mensual, Alta Precisión, Volumen líder
- **Cálculo inteligente**: Basado en accuracy y volumen de preguntas con algoritmo de ordenación
- **Competencia real**: Ranking actualizado en tiempo real entre usuarios
- **Notificaciones inteligentes**: NO envía email si usuario está activo (últimos 5 minutos)
- **Integración completa**: Modal de ranking, badges en header, visualización en estadísticas

**🔧 Componentes técnicos:**
- **Nueva tabla**: `user_medals` con tracking de visualización
- **Tabla de sincronización**: `public_user_profiles` para nombres seguros
- **Trigger automático**: Sincronización de nicknames en tiempo real
- **API de emails**: Sistema de felicitación por medallas con templates personalizados
- **Hook React**: `useNewMedalsBadge` para badge parpadeante en header
- **Hook de verificación**: `useMedalChecker` integrado en completion de tests

**🎨 Funcionalidades UX:**
- **Badge visual**: Trofeo parpadeante solo cuando hay medallas nuevas
- **Modal de ranking**: Filtros por tiempo (Hoy, Ayer, Esta semana, Este mes)  
- **Nombres reales**: Sistema seguro de mostrar nicknames sin exponer datos privados
- **Auto-ocultación**: Badge desaparece automáticamente al ver las medallas
- **Integración en estadísticas**: Sección "Medallas Recientes" en "Mis Estadísticas"

**🛡️ Seguridad y rendimiento:**
- **RLS policies**: Políticas correctas para lectura/escritura de perfiles públicos
- **Triggers optimizados**: Solo se ejecutan en cambios reales de nickname
- **Detección de actividad**: Evita spam de emails verificando actividad reciente
- **Sistema robusto**: Manejo de errores y fallbacks en todas las funciones

**✅ Estado**: **TOTALMENTE FUNCIONAL** - Sistema completo de medallas operativo con sincronización automática de nombres y emails inteligentes.

---

## 🏆 **SISTEMA DE MEDALLAS Y RANKING (4 FUNCIONES)** ⭐ NUEVO (07/08/2025)

#### 54. **`get_user_display_name(user_id UUID, user_metadata JSONB, user_email TEXT)` ⭐ NUEVA**
- **Tipo:** Función de nombres
- **Retorna:** `text`
- **Descripción:** Obtiene nombre para mostrar siguiendo prioridades
- **Lógica:** 1) nickname de user_profiles → 2) primer nombre de full_name → 3) email antes del @
- **Uso:** Sistema de sincronización de perfiles públicos

#### 55. **`sync_nickname_simple()` ⭐ TRIGGER FUNCTION**
- **Tipo:** `trigger function`
- **Retorna:** `trigger`
- **Descripción:** Sincroniza nickname automáticamente entre tablas
- **Tablas:** `user_profiles` → `public_user_profiles`
- **Ejecución:** AFTER UPDATE en user_profiles

#### 56. **`getUserRankingMedals(supabase, userId)` ⭐ FUNCIÓN JAVASCRIPT**
- **Tipo:** Función de medallas (JavaScript)
- **Retorna:** `Array<Medal>`
- **Descripción:** Calcula medallas de ranking en tiempo real
- **Algoritmo:** Basado en accuracy y volumen de preguntas
- **Períodos:** Diario, semanal, mensual
- **Medallas:** 8 tipos (Campeón, Podio, Alta Precisión, Volumen)

#### 57. **`checkAndNotifyNewMedals(supabase, userId)` ⭐ FUNCIÓN JAVASCRIPT**
- **Tipo:** Función de notificaciones (JavaScript)  
- **Retorna:** `Array<Medal>`
- **Descripción:** Detecta medallas nuevas y envía emails inteligentes
- **Features:**
  - Detección de actividad del usuario (últimos 5 minutos)
  - NO envía email si usuario está activo (solo notificación in-app)
  - SÍ envía email si usuario está inactivo
  - Almacena medallas en `user_medals` con flag `viewed: false`

---

## 📚 **SISTEMA DE NAVEGACIÓN DE LEYES** ⭐ NUEVO (26/10/2025)

#### 58. **`fetchLawSections(lawSlug)` ⭐ NUEVA**
- **Tipo:** Navegación por títulos/capítulos
- **Retorna:** `record`
- **Descripción:** Obtiene secciones (títulos/capítulos) de una ley específica
- **Funcionalidades:**
  - Mapeo automático de slug → short_name
  - Filtrado por secciones activas (is_active = true)
  - Ordenación por order_position
  - Retorna información de artículo ranges (start-end)
  - Validación de existencia de ley
- **Uso:** Modal "Filtrar por Títulos" en sistema de teoría de leyes
- **Tabla:** `law_sections`