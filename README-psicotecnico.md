# README - Sistema de Tests Psicotécnicos

## Descripción General
Este documento describe la estructura de base de datos para el nuevo sistema de tests psicotécnicos implementado en Vence. El sistema permite la creación y gestión de preguntas psicotécnicas variadas, incluyendo gráficos, tablas, analogías, secuencias numéricas, y otras categorías especializadas.

## Arquitectura del Sistema

### Estructura de Datos JSONB
El sistema utiliza campos JSONB para almacenar contenido flexible que se adapta a diferentes tipos de preguntas psicotécnicas:
- **Gráficos de tarta**: Datos de porcentajes y valores
- **Tablas de datos**: Matrices de información para cross-referencing
- **Secuencias**: Números, letras o alfanuméricas
- **Detección de errores**: Comparación entre original y copia
- **Clasificación**: Agrupación de elementos

## Tablas del Sistema

### 1. psychometric_categories
**Descripción**: Define las 8 categorías principales de tests psicotécnicos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único (PK) |
| `category_key` | text | Clave única de categoría (e.g., 'capacidad_administrativa') |
| `display_name` | text | Nombre para mostrar en UI |
| `has_sections` | boolean | Si la categoría tiene subsecciones |
| `section_count` | integer | Número de subsecciones (default: 0) |
| `is_active` | boolean | Estado activo de la categoría |
| `display_order` | integer | Orden de visualización |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última actualización |

**Índices**: 
- `idx_psychometric_categories_key` en `category_key`
- `idx_psychometric_categories_active_order` en `(is_active, display_order)`

**RLS**: Habilitado con política de solo lectura para usuarios autenticados.

### 2. psychometric_sections
**Descripción**: Define las subsecciones dentro de cada categoría psicotécnica.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único (PK) |
| `category_id` | uuid | Referencia a psychometric_categories (FK) |
| `section_key` | text | Clave única de sección |
| `display_name` | text | Nombre para mostrar en UI |
| `question_type` | text | Tipo de pregunta (pie_chart, data_tables, etc.) |
| `is_active` | boolean | Estado activo de la sección |
| `display_order` | integer | Orden dentro de la categoría |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última actualización |

**Índices**:
- `idx_psychometric_sections_category` en `category_id`
- `idx_psychometric_sections_key` en `section_key`
- `idx_psychometric_sections_type` en `question_type`

**Constraints**: 
- FK hacia `psychometric_categories(id)` con CASCADE
- UNIQUE en `(category_id, section_key)`

**RLS**: Habilitado con política de solo lectura para usuarios autenticados.

### 3. psychometric_questions
**Descripción**: Almacena las preguntas psicotécnicas con contenido flexible en JSONB.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único (PK) |
| `section_id` | uuid | Referencia a psychometric_sections (FK) |
| `question_text` | text | Texto de la pregunta |
| `content_data` | jsonb | Datos específicos del tipo de pregunta |
| `option_a` | text | Opción A |
| `option_b` | text | Opción B |
| `option_c` | text | Opción C |
| `option_d` | text | Opción D |
| `correct_option` | integer | Opción correcta (0=A, 1=B, 2=C, 3=D) |
| `explanation` | text | Explicación de la respuesta |
| `difficulty_level` | integer | Nivel de dificultad (1-5) |
| `estimated_time_seconds` | integer | Tiempo estimado en segundos |
| `is_active` | boolean | Estado activo de la pregunta |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última actualización |

**Índices**:
- `idx_psychometric_questions_section` en `section_id`
- `idx_psychometric_questions_difficulty` en `difficulty_level`
- `idx_psychometric_questions_active` en `is_active`
- `idx_psychometric_questions_content` GIN en `content_data`

**Constraints**:
- FK hacia `psychometric_sections(id)` con CASCADE
- CHECK en `correct_option` (0-3)
- CHECK en `difficulty_level` (1-5)

**RLS**: Habilitado con política de solo lectura para usuarios autenticados.

### 4. psychometric_test_sessions
**Descripción**: Gestiona las sesiones de tests psicotécnicos de los usuarios.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único (PK) |
| `user_id` | uuid | Referencia al usuario |
| `category_id` | uuid | Categoría del test (FK) |
| `section_id` | uuid | Sección específica (opcional, FK) |
| `session_type` | text | Tipo de sesión (random, custom, quick, etc.) |
| `total_questions` | integer | Total de preguntas en la sesión |
| `current_question` | integer | Pregunta actual (default: 1) |
| `questions_data` | jsonb | Array de IDs de preguntas |
| `start_time` | timestamptz | Hora de inicio |
| `end_time` | timestamptz | Hora de finalización |
| `is_completed` | boolean | Estado de completado |
| `score` | integer | Puntuación obtenida |
| `total_time_seconds` | integer | Tiempo total empleado |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última actualización |

**Índices**:
- `idx_psychometric_sessions_user` en `user_id`
- `idx_psychometric_sessions_category` en `category_id`
- `idx_psychometric_sessions_completed` en `is_completed`
- `idx_psychometric_sessions_questions` GIN en `questions_data`

**Constraints**:
- FK hacia `psychometric_categories(id)` con CASCADE
- FK hacia `psychometric_sections(id)` con SET NULL
- CHECK en `current_question` (>= 1)
- CHECK en `score` (>= 0)

**RLS**: Habilitado - usuarios solo pueden ver sus propias sesiones.

### 5. psychometric_test_answers
**Descripción**: Almacena las respuestas detalladas de los usuarios con analytics.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único (PK) |
| `session_id` | uuid | Referencia a la sesión (FK) |
| `question_id` | uuid | Referencia a la pregunta (FK) |
| `user_id` | uuid | Referencia al usuario |
| `user_answer` | integer | Respuesta del usuario (0-3) |
| `is_correct` | boolean | Si la respuesta es correcta |
| `time_taken_seconds` | integer | Tiempo empleado en segundos |
| `question_order` | integer | Orden en la sesión |
| `interaction_data` | jsonb | Datos de interacción adicionales |
| `answered_at` | timestamptz | Momento de la respuesta |
| `created_at` | timestamptz | Fecha de creación |

**Índices**:
- `idx_psychometric_answers_session` en `session_id`
- `idx_psychometric_answers_question` en `question_id`
- `idx_psychometric_answers_user` en `user_id`
- `idx_psychometric_answers_correct` en `is_correct`
- `idx_psychometric_answers_interaction` GIN en `interaction_data`

**Constraints**:
- FK hacia `psychometric_test_sessions(id)` con CASCADE
- FK hacia `psychometric_questions(id)` con CASCADE
- CHECK en `user_answer` (0-3)
- CHECK en `time_taken_seconds` (>= 0)
- UNIQUE en `(session_id, question_id)`

**RLS**: Habilitado - usuarios solo pueden ver sus propias respuestas.

### 6. user_psychometric_preferences
**Descripción**: Preferencias y configuraciones personalizadas de usuarios para tests psicotécnicos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único (PK) |
| `user_id` | uuid | Referencia al usuario |
| `preferred_categories` | jsonb | Array de categorías preferidas |
| `difficulty_preference` | integer | Dificultad preferida (1-5) |
| `time_limit_enabled` | boolean | Si usar límite de tiempo |
| `default_question_count` | integer | Número predeterminado de preguntas |
| `auto_next_question` | boolean | Avance automático a siguiente pregunta |
| `show_explanations` | boolean | Mostrar explicaciones |
| `notification_preferences` | jsonb | Configuración de notificaciones |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última actualización |

**Índices**:
- `idx_user_psychometric_prefs_user` UNIQUE en `user_id`
- `idx_user_psychometric_prefs_categories` GIN en `preferred_categories`

**Constraints**:
- CHECK en `difficulty_preference` (1-5)
- CHECK en `default_question_count` (>= 1)

**RLS**: Habilitado - usuarios solo pueden ver y modificar sus preferencias.

## Categorías y Secciones del Sistema

### 1. Capacidad Administrativa
- **tablas**: Manejo de datos tabulares
- **graficos**: Interpretación de gráficos
- **pruebas_clasificacion**: Tests de clasificación
- **pruebas_atencion_percepcion**: Tests de atención y percepción

### 2. Capacidad Ortográfica
- **deteccion_errores**: Detección de errores ortográficos
- **correccion_textos**: Corrección de textos

### 3. Pruebas de Instrucciones
- **seguimiento_instrucciones**: Seguimiento de instrucciones complejas
- **interpretacion_ordenes**: Interpretación de órdenes

### 4. Razonamiento Numérico
- **numeros_enteros**: Operaciones con números enteros
- **numeros_decimales**: Operaciones con números decimales
- **numeros_romanos**: Conversión y operaciones con números romanos
- **fracciones**: Operaciones con fracciones
- **sistema_metrico**: Sistema métrico decimal
- **sistema_sexagesimal**: Sistema sexagesimal
- **potencias**: Cálculo de potencias
- **raices**: Cálculo de raíces
- **reglas_tres**: Reglas de tres
- **ecuaciones**: Resolución de ecuaciones
- **porcentajes**: Cálculo de porcentajes
- **intervalos**: Cálculo de intervalos
- **operaciones_combinadas**: Operaciones matemáticas combinadas

### 5. Razonamiento Verbal
- **sinonimos_antonimos**: Sinónimos y antónimos
- **analogias_verbales**: Analogías verbales
- **definiciones**: Definiciones
- **organizacion_frases**: Organización de frases

### 6. Series Alfanuméricas
- **series_numericas**: Continuación de series numéricas
- **series_alfabeticas**: Continuación de series alfabéticas
- **series_alfanumericas**: Series mixtas

### 7. Series de Letras
- **continuacion_series**: Continuación de series de letras
- **patrones_alfabeticos**: Reconocimiento de patrones

### 8. Series Numéricas
- **secuencias_aritmeticas**: Secuencias aritméticas
- **secuencias_geometricas**: Secuencias geométricas
- **patrones_complejos**: Patrones numéricos complejos

## Tipos de Contenido JSONB

### Para Gráficos de Tarta (pie_chart)
```json
{
  "chart_data": [
    {"label": "Categoría A", "value": 30, "percentage": 25},
    {"label": "Categoría B", "value": 45, "percentage": 37.5}
  ],
  "total_value": 120,
  "chart_title": "Distribución de datos"
}
```

### Para Tablas de Datos (data_tables)
```json
{
  "tables": [
    {
      "title": "Tabla Original",
      "headers": ["Columna 1", "Columna 2"],
      "rows": [["Dato A", "Dato B"], ["Dato C", "Dato D"]]
    }
  ],
  "operation_type": "cross_reference"
}
```

### Para Detección de Errores (error_detection)
```json
{
  "original_text": "Texto original correcto",
  "modified_text": "Texto con errores introducidos",
  "error_count": 3,
  "error_types": ["ortografia", "puntuacion"]
}
```

### Para Secuencias (sequence_*)
```json
{
  "sequence": ["A", "C", "E", "G", "?"],
  "pattern_type": "arithmetic",
  "step": 2,
  "sequence_type": "alphabetic"
}
```

## Funcionalidades del Sistema

### Gestión de Sesiones
- Creación de tests personalizados por categoría/sección
- Seguimiento de progreso en tiempo real
- Guardado automático de respuestas
- Cálculo de puntuaciones y estadísticas

### Analytics y Tracking
- Tiempo de respuesta por pregunta
- Patrones de interacción del usuario
- Análisis de áreas fuertes/débiles
- Historial de rendimiento

### Configuraciones de Usuario
- Preferencias de categorías
- Nivel de dificultad personalizado
- Configuración de tiempo límite
- Opciones de notificaciones

## Triggers y Automatizaciones

Todos los triggers `updated_at` están configurados para actualizar automáticamente la fecha de modificación:
- `trigger_updated_at_psychometric_categories`
- `trigger_updated_at_psychometric_sections`
- `trigger_updated_at_psychometric_questions`
- `trigger_updated_at_psychometric_test_sessions`
- `trigger_updated_at_user_psychometric_preferences`

## Seguridad (RLS)

Todas las tablas tienen Row Level Security habilitado con políticas específicas:
- **Lectura pública**: Categories, sections, questions (contenido público)
- **Acceso restringido**: Sessions, answers, preferences (solo propietario)
- **Usuarios autenticados**: Requiere autenticación válida de Supabase

## Integración con Sistema Existente

Este sistema psicotécnico está diseñado para funcionar junto al sistema existente de preguntas legales/administrativas, manteniendo:
- Consistencia en numeración de opciones (0,1,2,3)
- Estructura similar de sesiones y respuestas
- Compatibilidad con sistema de autenticación existente
- Reutilización de patrones de tracking y analytics