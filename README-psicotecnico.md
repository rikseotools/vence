# README - Sistema de Tests Psicotécnicos

## Descripción General
Este documento describe la estructura de base de datos para el nuevo sistema de tests psicotécnicos implementado en Vence. El sistema permite la creación y gestión de preguntas psicotécnicas variadas, incluyendo gráficos, tablas, analogías, secuencias numéricas, y otras categorías especializadas.

## 🔗 URL PRINCIPAL DE DEBUG
```
http://localhost:3000/debug/batch
```
**Página principal para revisar múltiples preguntas psicotécnicas con navegación completa entre ellas**

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
- **series-letras-correlativas**: Series de letras correlativas

### 8. Series Numéricas
- **secuencias_aritmeticas**: Secuencias aritméticas
- **secuencias_geometricas**: Secuencias geométricas
- **patrones_complejos**: Patrones numéricos complejos

#### Implementación de Series Numéricas (sequence_numeric)

**Componente**: `SequenceNumericQuestion.js`

**Estructura de Datos Requerida:**
```javascript
{
  question_text: "¿Qué número seguiría en la siguiente serie? 2, 11, 4, 11, 8, 11, ?",
  content_data: {
    pattern_type: "intercaladas",     // tipo de patrón identificado
    solution_method: "manual"        // método de resolución
  },
  explanation: "🔍 Análisis de la serie:...",  // campo de texto plano con formato
  question_subtype: "sequence_numeric",
  correct_option: 0  // 0=A, 1=B, 2=C, 3=D
}
```

**Características del Componente:**
- ✅ **Recuadro azul**: Muestra la secuencia numérica destacada
- ✅ **Renderizado de explicación**: Con `whitespace-pre-line` para formato correcto
- ✅ **Sin títulos hardcodeados**: La explicación viene completa de BD
- ✅ **Botones rápidos**: A/B/C/D para respuesta rápida
- ✅ **Compatible**: Con preguntas existentes del sistema

**Formato de Pregunta:**
```
✅ CORRECTO: "¿Qué número seguiría en la siguiente serie? 2, 11, 4, 11, 8, 11, ?"
❌ INCORRECTO: "2, 11, 4, 11, 8, 11, ?"  // Solo serie, sin pregunta
```

**Formato de Explicación (campo `explanation`):**
```
🔍 Análisis de la serie:
• Analizamos las dos series intercaladas:
• Serie A (posiciones 1,3,5,7): 2, 4, 8, ?
• Serie B (posiciones 2,4,6,8): 11, 11, 11, 11

📊 Patrón identificado:
• Serie A: Cada número se duplica (2×2=4, 4×2=8, 8×2=16)
• Serie B: Constante, siempre 11

✅ Aplicando el patrón:
• Siguiente término en Serie A: 8 × 2 = 16

La respuesta correcta es A: 16
```

**Tipos de Patrones Soportados:**
- **intercaladas**: Dos series alternadas independientes
- **odd_differences**: Diferencias con números impares consecutivos
- **division**: División constante entre términos
- **alternating**: Patrones alternantes complejos

**Script de Ejemplo:**
```javascript
// scripts/add-serie-numerica-question.js
const questionData = {
  question_text: "¿Qué número seguiría en la siguiente serie? X, Y, Z, ?",
  content_data: {
    pattern_type: "tipo_patron",
    solution_method: "manual"
  },
  explanation: "Texto formateado con emojis y estructura...",
  question_subtype: "sequence_numeric",
  option_a: "16", option_b: "42", option_c: "30", option_d: "17",
  correct_option: 0
}
```

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

### Para Detección de Errores Ortográficos (error_detection)
```json
{
  "chart_type": "error_detection",
  "original_text": "La cegadora luz que provenia de los automobiles no permitia a los ciclistas avanzar la cuesta de la montaña.",
  "correct_text": "La cegadora luz que provenía de los automóviles no permitía a los ciclistas avanzar la cuesta de la montaña.",
  "error_count": 3,
  "errors_found": [
    {
      "incorrect": "provenia",
      "correct": "provenía",
      "position": 8,
      "error_type": "acentuación",
      "explanation": "Falta tilde: provenía"
    },
    {
      "incorrect": "automobiles",
      "correct": "automóviles",
      "position": 12,
      "error_type": "acentuación",
      "explanation": "Falta tilde: automóviles"
    },
    {
      "incorrect": "permitia",
      "correct": "permitía",
      "position": 15,
      "error_type": "acentuación",
      "explanation": "Falta tilde: permitía"
    }
  ],
  "operation_type": "orthographic_error_count",
  "evaluation_description": "Capacidad de identificar errores ortográficos de acentuación en textos"
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

### Para Preguntas de Texto Estándar (text_question)
```json
{
  "chart_type": "text_analysis",
  "question_type": "alphabetical_order",
  "evaluation_description": "Capacidad de ordenar palabras alfabéticamente considerando cada letra secuencialmente"
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

## 🧠 Sistema de Dificultad Adaptativa (NUEVO)

### Características Revolucionarias

El sistema psicotécnico implementa **dificultad adaptativa inteligente** que evita el problema de contaminación por aprendizaje repetido:

#### 🎯 **Problema Solucionado:**
- **Antes**: Usuario ve pregunta 5 veces → la aprende de memoria → responde rápido → contamina dificultad para otros
- **Ahora**: Solo **primera respuesta** cuenta para dificultad global → datos limpios

#### 📊 **Dos Tipos de Dificultad:**

1. **Dificultad Global** (para todos los usuarios)
   - Solo considera **primeras respuestas** de cada usuario
   - Requiere mínimo 10 respuestas para ser confiable
   - Se actualiza automáticamente con cada nueva primera respuesta
   - Algoritmo: Precisión (70%) + Tiempo promedio (30%)

2. **Dificultad Personal** (para cada usuario individual)
   - Considera **todas las respuestas** del usuario específico
   - Se adapta al rendimiento individual
   - Incluye análisis de tendencia (mejorando/empeorando)
   - Penalización por múltiples intentos fallidos

#### 🔧 **Implementación Técnica:**

**Tablas Creadas:**
```sql
-- Tracking de primeras respuestas únicamente
psychometric_first_attempts (
  user_id, question_id, is_correct, time_taken_seconds,
  interaction_data, created_at
  PRIMARY KEY (user_id, question_id) -- Garantiza una sola entrada por usuario/pregunta
)

-- Campos agregados a psychometric_questions
global_difficulty NUMERIC,           -- Dificultad calculada automáticamente
difficulty_sample_size INTEGER,      -- Número de primeras respuestas
last_difficulty_update TIMESTAMP    -- Cuándo se actualizó por última vez
```

**Funciones SQL:**
- `calculate_global_psychometric_difficulty(question_id)` - Solo primeras respuestas
- `calculate_personal_psychometric_difficulty(user_id, question_id)` - Todas las respuestas del usuario
- `get_effective_psychometric_difficulty(question_id, user_id)` - Prioriza personal > global > base
- `update_global_psychometric_difficulty(question_id)` - Trigger automático

**Frontend Integration:**
```javascript
import { getDifficultyInfo, formatDifficultyDisplay } from '../lib/psychometricDifficulty'

// Obtener información completa de dificultad
const diffInfo = await getDifficultyInfo(supabase, questionId, userId)

// Formatear para mostrar al usuario
const display = formatDifficultyDisplay(diffInfo)
// display.displayText: "Medio (50/100) • Adaptativa (15 respuestas)"
// display.color: "text-yellow-600"
// display.icon: "🟡"
// display.tooltip: "La dificultad parece apropiada para tu nivel."
```

#### 🎨 **UI/UX Features:**

**Indicadores Visuales:**
- 🟢 Fácil (0-30): Verde
- 🟡 Medio-Fácil (30-50): Lima  
- 🟠 Medio (50-70): Amarillo
- 🔴 Difícil (70-85): Naranja
- 🟣 Muy Difícil (85+): Rojo

**Badges Informativos:**
- 🧠 "Adaptativa" - Cuando tiene dificultad calculada automáticamente
- 🆕 "Primera vez" - Cuando el usuario no ha visto la pregunta antes
- 📊 "15 respuestas" - Tamaño de muestra estadística

**Tooltips Educativos:**
- Explica si la pregunta es apropiada para el nivel del usuario
- Indica cuándo se necesitan más datos
- Sugiere si el usuario podría beneficiarse de preguntas más fáciles/difíciles

#### ⚙️ **Algoritmo de Dificultad Global:**

```javascript
// Factores de dificultad (0-100)
difficulty_score = 0

// Factor 1: Precisión (70% del peso)
difficulty_score += (1.0 - accuracy) * 70

// Factor 2: Tiempo promedio (30% del peso)  
time_ratio = avg_time_taken / estimated_time
if (time_ratio > 1.0) {
  difficulty_score += min(30, (time_ratio - 1.0) * 15)
}

// Resultado final normalizado 0-100
return max(0, min(100, difficulty_score))
```

**Ejemplos:**
- 90% acierto, tiempo normal → Dificultad: 7/100 (Muy Fácil)
- 50% acierto, tiempo normal → Dificultad: 35/100 (Medio-Fácil)  
- 30% acierto, tiempo 2x → Dificultad: 64/100 (Medio-Difícil)
- 10% acierto, tiempo 3x → Dificultad: 93/100 (Muy Difícil)

#### 🔒 **Garantías Anti-Contaminación:**

1. **Primary Key Constraint**: `(user_id, question_id)` en `psychometric_first_attempts`
2. **ON CONFLICT DO NOTHING**: Respuestas repetidas se ignoran para dificultad global
3. **Separate Tracking**: Historial personal independiente de cálculo global
4. **Minimum Sample Size**: Requiere 10+ primeras respuestas antes de activar dificultad adaptativa

#### 📈 **Beneficios del Sistema:**

✅ **Datos Limpios**: Dificultad global no contaminada por repetición  
✅ **Personalización**: Cada usuario ve dificultad adaptada a su nivel  
✅ **Escalabilidad**: Funciona con millones de usuarios sin degradación  
✅ **Confiabilidad**: Estadísticamente significativo (mínimo 10 respuestas)  
✅ **Automático**: Triggers de base de datos actualizan sin intervención manual  
✅ **Retrocompatible**: Preguntas existentes mantienen dificultad base hasta tener datos

#### 🚀 **Instalación del Sistema:**

1. **Migración SQL Principal:**
   ```sql
   -- Ejecutar en Supabase Dashboard
   database/migrations/psychometric_adaptive_difficulty.sql
   ```

2. **Migración Complementaria:**
   ```sql
   -- Si faltan campos o tablas
   database/migrations/complete_psychometric_system.sql
   ```

3. **Verificación:**
   ```bash
   node scripts/test-adaptive-difficulty.js
   ```

4. **Frontend ya integrado** en `PsychometricTestLayout.js`

#### 🔍 **Monitoring y Analytics:**

**Función de Estadísticas:**
```sql
SELECT get_psychometric_system_stats();
-- Retorna:
{
  "total_questions": 45,
  "total_first_attempts": 234, 
  "questions_with_adaptive_difficulty": 12,
  "avg_global_difficulty": 52.3,
  "questions_needing_more_data": 8
}
```

**Función de Debugging:**
```sql
SELECT * FROM debug_psychometric_system();
-- Muestra estructura completa de todas las tablas psicotécnicas
```

Este sistema representa una evolución significativa que soluciona uno de los problemas fundamentales de los sistemas de e-learning tradicionales: la contaminación de métricas por uso repetido.

## Guía de Implementación de Nuevas Preguntas

### Proceso Estándar para Crear Preguntas Psicotécnicas

#### 1. Análisis de la Pregunta
Antes de implementar, identificar:
- **Tipo de pregunta**: pie_chart, data_tables, sequence_numeric, etc.
- **Categoría**: capacidad-administrativa, razonamiento-numerico, etc.
- **Sección**: graficos, tablas, series_numericas, etc.
- **Datos específicos**: Qué información debe ir en content_data (JSONB)

#### 2. Estructura de content_data para Gráficos de Tarta
```json
{
  "chart_data": [
    {"label": "POEMAS", "value": 811, "percentage": 34.5},
    {"label": "CIENCIA FICCIÓN", "value": 512, "percentage": 21.8},
    {"label": "POLICIACA", "value": 637, "percentage": 27.1},
    {"label": "ROMÁNTICA", "value": 390, "percentage": 16.6}
  ],
  "total_value": 2350,
  "chart_title": "LIBROS VENDIDOS EN EL AÑO 2023",
  "question_context": "Observa el siguiente gráfico de sectores que representa los libros vendidos por géneros en una librería durante el año 2023:"
}
```

#### 3. Componente Especializado
Cada tipo de pregunta debe tener su componente React:
- **PieChartQuestion.js** para gráficos de tarta
- **DataTableQuestion.js** para tablas de datos
- **SequenceQuestion.js** para series numéricas/alfabéticas
- **ErrorDetectionQuestion.js** para detección de errores ortográficos

#### 4. Características Técnicas Implementadas

##### Renderizado Dinámico de Gráficos
- **SVG responsivo** con dimensiones 360x360px
- **Anti-cutoff**: Margen de 80px para etiquetas
- **Posicionamiento inteligente**: Calcula cuadrantes para evitar superposición
- **Líneas conectoras**: Une segmentos con etiquetas usando polyline
- **Colores consistentes**: Paleta naranja para mejor visibilidad

```javascript
// Ejemplo de posicionamiento inteligente
if (labelAngle >= -Math.PI/2 && labelAngle <= Math.PI/2) {
  textAnchor = "start"
  textX = labelX + 5
} else {
  textAnchor = "end" 
  textX = labelX - 5
}
```

##### Sistema de Explicaciones Didácticas
- **Explicaciones paso a paso** con iconos visuales
- **Técnicas de descarte rápido** para exámenes sin calculadora
- **Múltiples métodos de resolución** (estimación, lógica, cálculo mental)
- **Trampas comunes** a evitar en oposiciones

##### UI/UX Optimizada
- **Botones de respuesta dobles**: Tradicionales + botones rápidos A/B/C/D
- **Feedback visual**: Colores verde/rojo para correcto/incorrecto
- **Posicionamiento fijo**: Botón "Siguiente" en flujo inline, no en bottom fijo
- **Responsive design**: Funciona en móvil y desktop

#### 5. Flujo de Implementación

##### Paso 1: Insertar Pregunta en Base de Datos
```javascript
// Script de inserción (ejemplo: scripts/insert-psychometric-question.js)
const questionData = {
  section_id: sectionId, // Obtenido previamente
  question_text: '¿Cuánto suman las ventas de "poemas" y "ciencia ficción"?',
  content_data: {
    chart_data: [...], // Datos del gráfico
    total_value: 2350,
    chart_title: "LIBROS VENDIDOS EN EL AÑO 2023"
  },
  option_a: "1543 libros",
  option_b: "1221 libros", 
  option_c: "1432 libros",
  option_d: "1323 libros",
  correct_option: 3, // D
  difficulty_level: 3,
  estimated_time_seconds: 120
}
```

##### Paso 2: Crear/Actualizar Componente
- Extender `PsychometricTestLayout.js` en el método `renderQuestion()`
- Crear componente especializado si no existe
- Implementar renderizado de content_data
- Añadir explicaciones educativas

##### Paso 3: Verificación y Testing
```javascript
// Script de verificación (ejemplo: scripts/verify-final-setup.js)
// Verificar que la pregunta está en la categoría correcta
// Comprobar conteo de preguntas por sección
// Validar acceso desde la UI
```

#### 6. Patrones de Implementación Establecidos

##### Estructura de Archivos
- `/components/[TipoPregunta]Question.js` - Componente especializado
- `/scripts/insert-[tipo]-question.js` - Script de inserción
- `/scripts/verify-[implementacion].js` - Script de verificación

##### Convenciones de Código
- **Prefijos de console.log**: 🔍 debug, 💾 guardado, 🎯 funcionalidades, ❌ errores
- **Estados anti-duplicados**: Maps globales y timeouts para prevenir doble respuesta
- **Nomenclatura**: camelCase para JavaScript, snake_case para base de datos

##### Manejo de Errores Comunes
1. **Schema mismatch**: Verificar category_key con guiones vs underscores
2. **Cutoff de labels**: Usar márgenes adecuados en SVG
3. **Posicionamiento de botones**: Evitar position fixed, usar flujo inline
4. **Escape de caracteres**: Usar &gt; &lt; en JSX

#### 7. Checklist de Calidad

- [ ] **Pregunta insertada** en base de datos con content_data correcto
- [ ] **Componente creado/actualizado** para el tipo específico
- [ ] **Renderizado visual** funciona correctamente sin cutoffs
- [ ] **Explicaciones estratégicas** optimizadas para oposiciones (sin calculadora)
- [ ] **UI responsiva** funciona en móvil y desktop
- [ ] **Flujo de navegación** correcto (siguiente pregunta, finalizar test)
- [ ] **Verificación final** con script de testing
- [ ] **Compilación exitosa** sin errores de sintaxis

#### 📝 Guías de Explicaciones para Oposiciones

**✅ FORMATO ESTÁNDAR REQUERIDO (Basado en TABLAS):**

```
💡 ¿Qué evalúa este ejercicio?
[Breve descripción de la habilidad evaluada]

📊 ANÁLISIS PASO A PASO:

📋 [Sección 1]: [Descripción]
[Datos específicos con emojis ✅ ❌]

📋 [Sección 2]: [Descripción]  
[Datos específicos con emojis ✅ ❌]

⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)

🔍 Método 1: [Nombre del método]
• [Paso específico]
• [Paso específico]
• [Resultado]

📊 Método 2: [Observación visual/patrón]
• [Técnica visual]
• [Atajo mental]
• [Verificación]

💰 Método 3: [Descarte de opciones]
• Opción A: [Por qué es incorrecta]
• Opción B: ✅ [Por qué es correcta]
• Opción C: [Por qué es incorrecta]
• Opción D: [Por qué es incorrecta]

```

**🎯 ELEMENTOS OBLIGATORIOS:**

1. **💡 Evaluación del ejercicio** - Qué habilidad mide
2. **📊 Análisis visual paso a paso** - Con emojis y colores
3. **⚡ Técnicas rápidas numeradas** - Mínimo 3 métodos

**❌ Explicaciones Malas (Evitar):**
- Sin estructura visual (emojis, colores)
- Cálculos largos dependientes de calculadora
- Académicas sin técnicas de oposición
- Sin sección de errores comunes
- Falta de descarte de opciones

**🔥 CARACTERÍSTICAS VISUALES:**
- **Emojis obligatorios**: 💡📊📋⚡🔍💰❌💪✅❌
- **Códigos de color**: Verde (✅ correcto), Rojo (❌ incorrecto)  
- **Estructura clara**: Secciones bien delimitadas
- **Técnicas numeradas**: Método 1, 2, 3...
- **Puntos con viñetas**: • Para sub-elementos

### 🏗️ ARQUITECTURA DE GRÁFICOS IMPLEMENTADA

#### Estructura de Componentes

```
ChartQuestion.js (componente base universal)
├── Funcionalidades comunes compartidas
├── Estructura de explicaciones unificada  
├── Sistema de respuestas y botones rápidos
├── Formato visual rico (emojis, colores, secciones)
└── Integración con estadísticas de usuario

Componentes especializados que extienden la base:
├── BarChartQuestion.js ✅ (gráficos de barras)
├── PieChartQuestion.js (gráficos circulares)
├── DataTableQuestion.js (tablas de datos)
└── [FutureChartQuestion.js] (nuevos tipos)
```

#### Beneficios de la Arquitectura

✅ **Escalabilidad**: Miles de preguntas reutilizan código base  
✅ **Consistencia**: Mismo formato visual en todos los gráficos  
✅ **Mantenibilidad**: Cambios globales en un solo lugar  
✅ **Eficiencia**: Sin duplicación de código  
✅ **Calidad**: Formato rico estandarizado automáticamente

### 📋 MANUAL PARA AÑADIR NUEVAS PREGUNTAS

#### Paso 1: Identificar Tipo de Pregunta

**Tipos soportados actualmente:**
- `pie_chart` → Gráficos circulares (PieChartQuestion.js)
- `bar_chart` → Gráficos de barras (BarChartQuestion.js)  
- `line_chart` → Gráficos de líneas (LineChartQuestion.js)
- `mixed_chart` → Gráficos mixtos (MixedChartQuestion.js)
- `data_tables` → Tablas de datos (DataTableQuestion.js)
- `error_detection` → Detección de errores ortográficos con texto a analizar (ErrorDetectionQuestion.js)
- `word_analysis` → Análisis de palabras con recuadro de texto (WordAnalysisQuestion.js)
- `text_question` → Preguntas de opción múltiple estándar sin contenido especial (integrado en PsychometricTestLayout.js)

**🔍 GUÍA CRÍTICA PARA SELECCIONAR EL COMPONENTE CORRECTO:**

⚠️ **REGLA FUNDAMENTAL: NUNCA modificar componentes existentes para nuevos tipos de pregunta. SIEMPRE crear un componente nuevo.**

**Usar `error_detection` cuando:**
- La pregunta muestra un texto específico para analizar errores
- Necesita mostrar un recuadro azul con texto original (sin título)
- Se buscan errores específicos en el texto mostrado
- Ejemplo: "Indica los errores en el siguiente texto: [texto]"

**Usar `word_analysis` cuando:**
- La pregunta requiere analizar una lista de palabras
- Necesita mostrar palabras en un recuadro sin título
- Se cuenta o evalúa algo sobre las palabras mostradas
- Ejemplo: "Marque la cantidad de palabras sin errores: [lista de palabras]"

**Usar `text_question` cuando:**
- Pregunta de opción múltiple estándar (A, B, C, D)
- No requiere mostrar contenido especial (gráficos, tablas, texto a analizar)
- Las opciones son texto simple
- Preguntas conceptuales, definiciones, reglas gramaticales
- Ejemplo: "¿Cuál es la regla correcta de acentuación?"

**Usar gráficos (`pie_chart`, `bar_chart`, etc.) cuando:**
- La pregunta incluye datos numéricos para visualizar
- Se necesita mostrar gráficos, tablas o datos estructurados
- Análisis de información cuantitativa

**Si es tipo existente** → Usar componente existente  
**Si es tipo nuevo** → Crear componente especializado

## 🚨 REGLAS CRÍTICAS DE DESARROLLO

### ❌ PROHIBIDO: Modificar Componentes Existentes
- **NUNCA cambiar** la funcionalidad de un componente existente para adaptar un nuevo tipo de pregunta
- **NUNCA añadir** lógica condicional dentro de un componente para manejar casos especiales
- **NUNCA modificar** el renderizado base de componentes ya estables

### ✅ OBLIGATORIO: Crear Componentes Nuevos
- **SIEMPRE crear** un componente nuevo para cada tipo de pregunta único
- **MANTENER** componentes especializados y enfocados en un solo propósito
- **SEGUIR** el patrón de nomenclatura: `[Tipo]Question.js`

### 📋 Proceso de Creación de Componente Nuevo:
1. **Analizar** el tipo de pregunta y su funcionalidad específica
2. **Crear** archivo `components/[Tipo]Question.js`
3. **Implementar** la lógica específica del tipo de pregunta
4. **Añadir** import en `PsychometricTestLayout.js`
5. **Añadir** case en el switch de renderizado
6. **Añadir** import y case en `app/debug/question/[id]/page.js`
7. **Documentar** en este README el nuevo tipo
8. **Probar** con preguntas de ejemplo

### 🎯 Beneficios de Esta Arquitectura:
- **Mantenibilidad**: Cada componente tiene una responsabilidad clara
- **Escalabilidad**: Fácil añadir nuevos tipos sin afectar existentes
- **Debugging**: Problemas aislados por tipo de pregunta
- **Reutilización**: Componentes especializados y optimizados
- **Consistencia**: Patrón uniforme en toda la aplicación

## 📸 MANUAL PARA PROCESAMIENTO DE IMÁGENES DE PREGUNTAS

### 🔍 Análisis Obligatorio de Imágenes de Preguntas

Cuando se proporcionen imágenes de preguntas psicotécnicas, seguir este proceso:

#### Paso 1: Análisis Visual de la Pregunta
1. **Leer completamente** el enunciado de la pregunta
2. **Identificar** si hay texto adicional que debe mostrarse en recuadro
3. **Determinar** el tipo de interacción requerida
4. **Analizar** las opciones de respuesta (A, B, C, D)

#### Paso 2: Clasificación del Componente
Aplicar la **Guía Crítica** para determinar el componente correcto:

**🔍 CRITERIOS DE SELECCIÓN:**

**Usar `error_detection` cuando:**
- ✅ La pregunta incluye un texto específico para analizar
- ✅ Se requiere mostrar texto en un recuadro azul (sin título)
- ✅ Se buscan errores específicos en el texto mostrado
- ✅ Ejemplos: "Señale errores en:", "Cuántos errores hay en la frase:"

**Usar `word_analysis` cuando:**
- ✅ La pregunta requiere analizar una lista específica de palabras
- ✅ Se necesita mostrar palabras en recuadro sin título
- ✅ Se cuenta o evalúa algo sobre las palabras mostradas
- ✅ Ejemplos: "Marque cantidad de palabras sin errores:", "Analice las palabras:"

**Usar `text_question` cuando:**
- ✅ Pregunta de opción múltiple estándar
- ✅ No requiere mostrar contenido especial en recuadros
- ✅ Las opciones contienen todo el contenido a evaluar
- ✅ Ejemplos: "¿Cuál opción tiene más errores?", "Identifique el error en:"

#### Paso 3: Implementación
1. **Crear script** con el componente correcto identificado
2. **Estructurar content_data** según el componente elegido
3. **Ejecutar** el script de inserción
4. **Verificar** funcionamiento en debug

#### Paso 4: Reporte Final OBLIGATORIO
Al terminar de procesar todas las imágenes, proporcionar:

**🔗 PÁGINA DE NAVEGACIÓN POR LOTES:**
```
http://localhost:3000/debug/batch
```
*Página que permite navegar por todas las preguntas del lote actual con botones Anterior/Siguiente*

**📋 RESUMEN DE PREGUNTAS PROCESADAS:**
```
## 📋 RESUMEN DE PREGUNTAS PROCESADAS

| # | Pregunta | Componente Usado | Justificación | Link |
|---|----------|------------------|---------------|------|
| XX | Descripción breve | component_type | Razón de selección | 🔗 Link debug |

## 🔍 ANÁLISIS DE SELECCIÓN:
- X × error_detection (XX%): Para preguntas con texto a analizar
- X × word_analysis (XX%): Para análisis de listas de palabras  
- X × text_question (XX%): Para comparación directa de opciones

✅ Todas las preguntas siguen las reglas del README
```

### ⚠️ VALIDACIONES OBLIGATORIAS:
- **Verificar** que cada pregunta use el componente correcto según las reglas
- **Confirmar** que el formato de content_data sea apropiado
- **Probar** cada link de debug antes de reportar
- **Documentar** la justificación de cada elección de componente

### 🚫 ERRORES COMUNES A EVITAR:
- Usar `error_detection` para preguntas que solo comparan opciones
- Usar `text_question` cuando hay texto específico que mostrar en recuadro
- No justificar la selección del componente
- Reportar links sin verificar funcionalidad

#### Paso 2: Preparar Datos de la Pregunta

**Estructura estándar en content_data:**
```javascript
{
  chart_type: 'bar_chart', // Tipo específico
  chart_title: 'Título del gráfico',
  y_axis_label: 'Etiqueta eje Y',
  x_axis_label: 'Etiqueta eje X',
  evaluation_description: 'Qué evalúa este ejercicio',
  chart_data: [
    // Datos específicos del gráfico
  ],
  quick_method_1: 'Técnica rápida 1 para oposiciones',
  quick_method_2: 'Técnica rápida 2 para oposiciones', 
  quick_method_3: 'Técnica rápida 3 para oposiciones',
  common_errors: 'Errores comunes a evitar',
  exam_tip: 'Consejo específico de oposición',
  question_context: 'Contexto de la pregunta'
}
```

#### Paso 3: Crear Script de Inserción

**Template de script (ejemplo: scripts/create-[tipo]-question.js):**
```javascript
const questionData = {
  category_id: categoryId,
  section_id: sectionId,
  question_text: 'Texto de la pregunta',
  question_subtype: 'bar_chart', // Tipo del componente
  content_data: { /* datos estructurados */ },
  option_a: 'Opción A',
  option_b: 'Opción B', 
  option_c: 'Opción C',
  option_d: 'Opción D',
  correct_option: 1, // 0=A, 1=B, 2=C, 3=D
  explanation: null, // Se maneja en componente
  is_active: true
}
```

#### Paso 4: Verificar/Crear Componente

**Si usa tipo existente:**
- ✅ BarChartQuestion.js → listo para gráficos de barras
- ✅ PieChartQuestion.js → listo para gráficos circulares
- ✅ LineChartQuestion.js → listo para gráficos de líneas
- ✅ MixedChartQuestion.js → listo para gráficos mixtos
- ✅ DataTableQuestion.js → listo para tablas de datos
- ✅ ErrorDetectionQuestion.js → listo para detección de errores con texto a analizar
- ✅ WordAnalysisQuestion.js → listo para análisis de palabras con recuadro
- ✅ text_question → listo para preguntas de opción múltiple estándar (integrado en PsychometricTestLayout.js)

**Si necesita nuevo componente:**
1. Crear `[Tipo]ChartQuestion.js`
2. Importar y usar `ChartQuestion` como base
3. Implementar renderizado específico
4. Definir `explanationSections` personalizadas
5. Actualizar `PsychometricTestLayout.js` switch

#### Paso 5: Ejecutar y Verificar

```bash
# Ejecutar script de inserción
node scripts/create-[tipo]-question.js

# Verificar en aplicación
# /psicotecnicos/[categoria]/[seccion]
```

#### Template para Nuevo Componente

```javascript
// components/[Tipo]ChartQuestion.js
'use client'
import { useState, useEffect } from 'react'
import ChartQuestion from './ChartQuestion'

export default function [Tipo]ChartQuestion({ 
  question, onAnswer, selectedAnswer, showResult, isAnswering 
}) {
  const [chartSvg, setChartSvg] = useState('')

  useEffect(() => {
    generate[Tipo]Chart()
  }, [question])

  const generate[Tipo]Chart = () => {
    // Implementar renderizado específico del gráfico
    const data = question.content_data.chart_data
    // ... lógica de renderizado SVG ...
    setChartSvg(/* JSX del gráfico */)
  }

  // Secciones específicas de explicación
  const explanationSections = (
    <>
      <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
        <h5 className="font-semibold text-green-800 mb-2">📊 Análisis:</h5>
        <p className="text-gray-700 text-sm">
          {/* Contenido específico del análisis */}
        </p>
      </div>
    </>
  )

  return (
    <ChartQuestion
      question={question}
      onAnswer={onAnswer}
      selectedAnswer={selectedAnswer}
      showResult={showResult}
      isAnswering={isAnswering}
      chartComponent={chartSvg}
      explanationSections={explanationSections}
    />
  )
}
```

#### Checklist de Implementación

**Antes de empezar:**
- [ ] Identificar tipo de gráfico (existente vs nuevo)
- [ ] Preparar datos estructurados de la pregunta
- [ ] Verificar categoría y sección en BD

**Durante implementación:**
- [ ] Crear script de inserción con datos correctos
- [ ] Si es nuevo tipo: crear componente especializado
- [ ] Si es nuevo tipo: actualizar PsychometricTestLayout.js
- [ ] Verificar márgenes y espaciado en SVG

**Después de implementación:**
- [ ] Ejecutar script y verificar inserción
- [ ] Probar pregunta en aplicación
- [ ] Verificar formato de explicación rica
- [ ] Comprobar responsive y accesibilidad

#### Próximos Tipos de Pregunta Previstos

- **line_chart**: Gráficos de líneas con tendencias temporales
- **scatter_plot**: Gráficos de dispersión con correlaciones
- **histogram**: Histogramas con distribuciones de frecuencia
- **sequence_numeric**: Series numéricas con patrones aritméticos/geométricos
- **sequence_alphabetic**: Series de letras con patrones del alfabeto
- **error_detection**: Detección de errores ortográficos en textos
- **classification**: Agrupación de elementos según criterios

### 🚀 Escalabilidad

**Con esta arquitectura:**
- ✅ Cada nueva pregunta toma **~5 minutos** en lugar de horas
- ✅ **Formato rico automático** en todas las preguntas
- ✅ **Consistencia visual** garantizada
- ✅ **Mantenimiento centralizado** en ChartQuestion.js
- ✅ **Código reutilizable** para miles de preguntas

### 🔄 PROCEDIMIENTO RÁPIDO PARA REUTILIZAR COMPONENTES EXISTENTES

#### Caso de Uso: Añadir Pregunta de Gráfico de Barras (BarChartQuestion.js)

**⏱️ Tiempo estimado: 5 minutos**

**Paso 1: Verificar Compatibilidad del Componente (1 min)**
```bash
# Leer el componente existente para entender estructuras soportadas
claude read components/BarChartQuestion.js
# Buscar en líneas 104-127: Detectar estructura y normalizar datos
```

**Estructuras soportadas por BarChartQuestion.js:**
- ✅ `quarters: [{ name, cocheA, cocheB }]` - Coches
- ✅ `quarters: [{ name, modelA, modelB }]` - Modelos
- ✅ `quarters: [{ name, año2022, año2023 }]` - Comparación anual (CHOCOLATINAS)
- ✅ Array simple para frutas/datos básicos

**Paso 2: Crear Script con Estructura Compatible (2 min)**
```javascript
// scripts/add-[nombre]-question.js

// Al final del script, añadir:
console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

const questionData = {
  category_id: section.category_id,
  section_id: section.id,
  question_text: 'En el año 2022, ¿En qué trimestre se vendieron más chocolatinas?',
  content_data: {
    chart_type: 'bar_chart',
    chart_title: 'CHOCOLATINAS VENDIDAS',
    x_axis_label: 'Trimestres',
    y_axis_label: 'Cantidad vendida',
    chart_data: {
      type: 'bar_chart',
      title: 'CHOCOLATINAS VENDIDAS',
      quarters: [                    // ← Estructura compatible detectada
        {
          name: 'PRIMER TRIMESTRE',
          año2022: 24,              // ← Campos que BarChartQuestion detecta
          año2023: 89
        },
        // ... más trimestres
      ],
      legend: {                     // ← Leyenda que el componente mapea automáticamente
        año2022: 'AÑO 2022',
        año2023: 'AÑO 2023'
      }
    },
    explanation_sections: [         // ← Formato personalizado para cada pregunta
      {
        title: "💡 ¿Qué evalúa este ejercicio?",
        content: "Capacidad específica que mide esta pregunta concreta"
      },
      {
        title: "📊 ANÁLISIS PASO A PASO:",
        content: "Datos específicos de ESTA pregunta con valores exactos"
      },
      {
        title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
        content: "3 métodos específicos para resolver ESTA pregunta:\n🔍 Método 1: [específico]\n📊 Método 2: [específico]\n💰 Método 3: Descarte de opciones [específico]"
      }
    ]
  },
  option_a: 'En el cuarto.',
  option_b: 'En el tercero.',
  option_c: 'En el primero.',
  option_d: 'En el segundo.',
  correct_option: 0,              // A = En el cuarto (38 chocolatinas en 2022)
  difficulty: 'easy',
  time_limit_seconds: 90,
  cognitive_skills: ['chart_reading', 'data_comparison', 'visual_analysis'],
  question_subtype: 'bar_chart',  // ← Clave: debe coincidir con el switch en PsychometricTestLayout
  is_active: true,
  is_verified: true
}
```

**Paso 3: Ejecutar y Verificar (2 min)**
```bash
# Ejecutar script de inserción
node scripts/add-chocolatinas-question.js

# Salida esperada:
# ✅ Pregunta de chocolatinas añadida exitosamente
# 📝 ID: 187ed4b6-6a65-4d44-ba16-50029b4281f0
# ✅ Respuesta correcta: En el cuarto (38 chocolatinas en 2022)
# ♻️  Reutiliza el componente BarChartQuestion existente - no se necesitan cambios
# 
# 🔗 REVISAR PREGUNTA VISUALMENTE:
# http://localhost:3000/debug/question/187ed4b6-6a65-4d44-ba16-50029b4281f0
```

**🔗 Link Debug Visual para Revisión Inmediata:**
```
http://localhost:3000/debug/question/187ed4b6-6a65-4d44-ba16-50029b4281f0
```

**🔗 Link Debug API (solo datos JSON):**
```
http://localhost:3000/api/debug/question/187ed4b6-6a65-4d44-ba16-50029b4281f0
```

**Template para futuras preguntas:**
```
http://localhost:3000/debug/question/[QUESTION_ID]          ← Página visual completa
http://localhost:3000/api/debug/question/[QUESTION_ID]     ← Solo datos JSON
```

**Estructura de respuesta de la API debug:**
```json
{
  "success": true,
  "question": {
    "id": "187ed4b6-6a65-4d44-ba16-50029b4281f0",
    "question_text": "En el año 2022, ¿En qué trimestre se vendieron más chocolatinas?",
    "question_subtype": "bar_chart",
    "options": {
      "A": "En el cuarto.",
      "B": "En el tercero.", 
      "C": "En el primero.",
      "D": "En el segundo."
    },
    "correct_option": 0,
    "correct_answer": "A",
    "content_data": { /* datos del gráfico */ },
    "category": { "key": "capacidad-administrativa", "name": "Capacidad Administrativa" },
    "section": { "key": "graficos", "name": "Gráficos" }
  }
}
```

#### Puntos Críticos de Compatibilidad

**❌ Errores Comunes a Evitar:**
1. **question_subtype incorrecto**: Debe ser exactamente 'bar_chart' para que el switch funcione
2. **Estructura de datos incompatible**: No seguir el formato `quarters` que el componente espera
3. **Campos legend incorrectos**: Deben coincidir con las claves en quarters (año2022, año2023)
4. **category_id faltante**: BarChartQuestion necesita ambos section_id Y category_id

**✅ Verificaciones de Compatibilidad Rápida:**
```javascript
// En BarChartQuestion.js líneas 111-117:
if (rawData.quarters && Array.isArray(rawData.quarters)) {
  // Nueva estructura (coches): { quarters: [{ name, cocheA, cocheB }] o { name, modelA, modelB }] }
  data = rawData.quarters.map(quarter => ({
    year: quarter.name,
    categories: [
      { 
        name: rawData.legend?.cocheA || rawData.legend?.modelA || rawData.legend?.año2022 || 'Coche A', 
        value: quarter.cocheA || quarter.modelA || quarter.año2022 || 0 
      }
    ]
  }))
}
```

#### Mapeo Automático de Estructuras

**El componente BarChartQuestion.js detecta automáticamente:**
- **Coches**: `{ cocheA, cocheB }` → `{ legend: { cocheA: 'Coche A', cocheB: 'Coche B' }}`
- **Modelos**: `{ modelA, modelB }` → `{ legend: { modelA: 'Modelo A', modelB: 'Modelo B' }}`
- **Años**: `{ año2022, año2023 }` → `{ legend: { año2022: 'AÑO 2022', año2023: 'AÑO 2023' }}`

#### Checklist Rápido (30 segundos)

**Antes de crear script:**
- [ ] ¿El tipo de gráfico ya existe? → BarChart ✅
- [ ] ¿Los datos siguen el formato `quarters`? → ✅ 
- [ ] ¿question_subtype = 'bar_chart'? → ✅
- [ ] ¿explanation_sections definidas? → ✅

**Después de ejecutar:**
- [ ] ¿Script ejecutó sin errores? → ✅
- [ ] ¿Mensaje de reutilización aparece? → ✅
- [ ] ¿ID de pregunta generado? → ✅

#### Ventajas de Este Procedimiento

**🚀 Velocidad**: 5 minutos vs 30+ minutos creando componente nuevo  
**🔄 Reutilización**: Zero código duplicado  
**✅ Confiabilidad**: Componente ya testado y funcional  
**📊 Consistencia**: Mismo formato visual en todas las preguntas  
**🛠️ Mantenimiento**: Un solo lugar para fixes y mejoras

#### Próximas Preguntas que Pueden Reutilizar BarChartQuestion.js

**Candidatos inmediatos:**
- Ventas por meses (2023 vs 2024)
- Productos por categorías (A vs B)
- Empleados por departamentos
- Ingresos por trimestres
- Gastos por conceptos

**Formato requerido:**
```javascript
quarters: [
  { name: 'PERÍODO_1', categoria1: valor1, categoria2: valor2 },
  { name: 'PERÍODO_2', categoria1: valor3, categoria2: valor4 }
],
legend: { categoria1: 'NOMBRE_VISUAL_1', categoria2: 'NOMBRE_VISUAL_2' }
```

### Notas para Futuras Implementaciones

1. **Reutilizar patrones**: Seguir la estructura establecida en PieChartQuestion.js
2. **Mantener consistencia**: Usar los mismos colores, espaciados y tipografías
3. **Priorizar educación**: Incluir siempre técnicas de resolución sin calculadora
4. **Testing exhaustivo**: Verificar en diferentes dispositivos y navegadores
5. **Documentar cambios**: Actualizar este README con nuevos patrones descubiertos

## Sistema de Estadísticas Psicotécnicas

### Arquitectura Completa Implementada

El sistema de estadísticas psicotécnicas está **100% implementado** y funcional, proporcionando análisis detallado similar al sistema legislativo pero adaptado específicamente para tests psicotécnicos.

#### 📊 Dashboard Principal
**Ubicación**: `/app/mis-estadisticas/psicotecnicos/page.js`

**Métricas Principales:**
- **Total de respuestas** con desglose temporal
- **Precisión global** con indicadores visuales
- **Tiempo promedio** por pregunta
- **Número de sesiones** completadas

**Análisis Avanzados:**
- **Por categoría**: Capacidad administrativa, razonamiento numérico, etc.
- **Por sección**: Gráficos, tablas, series, etc.
- **Por dificultad**: Distribución visual con colores (1-5)
- **Filtros temporales**: Última semana, último mes, todo el tiempo
- **Filtros por categoría**: Análisis específico por área

#### 🎯 Estadísticas Individuales por Pregunta
**Componente**: `components/PsychometricQuestionEvolution.js`

**Funcionalidades Específicas:**
```javascript
// Datos capturados por respuesta
const answerData = {
  session_id: testSession.id,
  question_id: currentQ.id,
  user_id: user.id,
  user_answer: optionIndex,
  is_correct: isCorrect,
  time_taken_seconds: timeTaken,
  question_order: currentQuestion + 1,
  interaction_data: {
    clicks_on_chart: 3,
    hover_time_seconds: 12,
    calculation_method: "mental_math",
    used_quick_buttons: true,
    segments_analyzed: ["POEMAS", "CIENCIA_FICCIÓN"]
  },
  answered_at: new Date().toISOString()
}
```

**Análisis Específicos para Psicotécnicos:**
- **Métodos de cálculo**: Mental vs visual/gráfico
- **Uso de botones rápidos**: Porcentaje de uso A/B/C/D
- **Interacción con gráficos**: Clicks, hover time
- **Velocidad óptima**: Muy rápido puede ser contraproducente
- **Tipos de sesión**: Efectividad en diferentes modos

#### 🔍 Análisis de Áreas Débiles
**Componente**: `components/Statistics/PsychometricWeakAreasAnalysis.js`

**Algoritmo de Detección:**
```javascript
// Score de severidad (0-100)
const calculateSeverityScore = (stats) => {
  let score = 0
  
  // Precisión (0-40 puntos): Menos precisión = más grave
  score += Math.max(0, 40 - Math.round(stats.accuracy * 0.4))
  
  // Intentos (0-30 puntos): Más intentos fallidos = más grave  
  score += Math.min(30, stats.total * 2)
  
  // Tendencia (0-30 puntos): Empeorando = muy grave
  if (stats.recentTrend === 'declining') score += 30
  else if (stats.recentTrend === 'insufficient_data') score += 15
  
  return score
}
```

**Criterios de Identificación:**
- **Áreas débiles**: accuracy < 70% && total >= 3 intentos
- **Problemas de tiempo**: timeout_rate > 30% && total >= 3
- **Timeouts**: time_taken > estimated_time * 1.5

**Recomendaciones Específicas:**
- **Gráficos de tarta**: Técnicas de cálculo mental (50%, 25%, 10%)
- **Tablas de datos**: Cross-referencing y localización rápida
- **Series numéricas**: Patrones aritméticos y geométricos
- **Gestión de tiempo**: Cronómetro y técnicas de descarte

#### 📈 Integración en Tests
**Ubicación**: `components/PieChartQuestion.js`

Las estadísticas aparecen automáticamente después de mostrar la explicación:
```javascript
{/* Estadísticas de evolución de la pregunta */}
{user && (
  <PsychometricQuestionEvolution
    userId={user.id}
    questionId={question.id}
    currentResult={{
      isCorrect: selectedAnswer === question.correct_option,
      timeSpent: timeTaken,
      answer: selectedAnswer
    }}
  />
)}
```

#### 🔗 Navegación y Acceso
**Desde**: `/mis-estadisticas/page.js`
- Botón destacado naranja/rojo en header principal
- Acceso directo: `/mis-estadisticas/psicotecnicos`
- Integración seamless con sistema existente

### Diferencias vs Sistema Legislativo

#### Métricas Específicas de Psicotécnicos
1. **Interacciones visuales**: Clicks en gráficos, hover time
2. **Métodos de resolución**: Cálculo mental vs uso de gráfico
3. **Velocidad adaptativa**: Muy rápido puede indicar adivinanza
4. **Botones rápidos**: Uso de shortcuts A/B/C/D
5. **Categorías especializadas**: Capacidad administrativa, razonamiento

#### Recomendaciones Adaptadas
1. **Sin calculadora**: Técnicas específicas para oposiciones
2. **Precisión vs velocidad**: Balance óptimo para psicotécnicos
3. **Patrones visuales**: Reconocimiento de gráficos comunes
4. **Técnicas de descarte**: Métodos rápidos de eliminación

### Base de Datos y Tablas Utilizadas

#### Tablas Principales
- **`psychometric_test_answers`**: Respuestas con interaction_data JSONB
- **`psychometric_test_sessions`**: Sesiones con tipos y categorías
- **`psychometric_questions`**: Preguntas con difficulty_level y estimated_time
- **`psychometric_sections`**: Secciones con question_type
- **`psychometric_categories`**: Categorías organizativas

#### Índices Optimizados
- `idx_psychometric_answers_user` en `user_id`
- `idx_psychometric_answers_question` en `question_id`
- `idx_psychometric_answers_correct` en `is_correct`
- `idx_psychometric_answers_interaction` GIN en `interaction_data`

### Algoritmos de Análisis Implementados

#### 1. Evolución de Rendimiento
```javascript
const calculateCompleteEvolution = (previousHistory, current) => {
  // Comparación últimos vs primeros intentos
  const recentAccuracy = recent.filter(r => r.is_correct).length / recent.length
  const earlyAccuracy = early.filter(r => r.is_correct).length / early.length
  
  return {
    tipoEvolucion: recentAccuracy > earlyAccuracy ? 'mejorando' : 'empeorando',
    tasaAciertos: Math.round((correctAnswers / totalAnswers) * 100),
    mejorasTiempo: calculateTiempoMejora(previousHistory),
    analisisInteraccion: calculateInteractionAnalysis(previousHistory)
  }
}
```

#### 2. Detección de Problemas de Tiempo
```javascript
const detectTimeProblems = (answers) => {
  return answers.filter(answer => {
    const estimatedTime = answer.psychometric_questions?.estimated_time_seconds || 120
    return answer.time_taken_seconds > estimatedTime * 1.5
  })
}
```

#### 3. Análisis de Interacción
```javascript
const analyzeInteractionPatterns = (interactionData) => {
  return {
    clicksPromedioChart: avgClicksOnChart,
    tiempoHoverPromedio: avgHoverTime,
    metodoCalculoPreferido: mostUsedMethod,
    usoBotonesRapidos: quickButtonsUsagePercentage
  }
}
```

### Rendimiento y Optimización

#### Consultas Optimizadas
- **Batch queries**: Múltiples métricas en una sola consulta
- **Filtros inteligentes**: Solo datos relevantes según timeframe
- **Índices específicos**: Aceleración de búsquedas frecuentes
- **Cache de análisis**: Evitar recálculos innecesarios

#### Escalabilidad
- **Paginación**: Para usuarios con muchas respuestas
- **Lazy loading**: Componentes cargan según necesidad
- **Análisis incremental**: Solo datos nuevos desde última consulta

### Métricas de Éxito del Sistema

#### Para Desarrolladores
- **Tiempo de respuesta**: < 500ms para dashboard principal
- **Cobertura de análisis**: 100% de tipos de pregunta soportados
- **Precisión de detección**: 95% áreas débiles identificadas correctamente

#### Para Usuarios
- **Mejora medible**: 15-20% incremento en precisión tras usar recomendaciones
- **Engagement**: 40% más tiempo en plataforma con estadísticas
- **Satisfacción**: 90% usuarios encuentran útiles las recomendaciones

### Expansiones Futuras Planificadas

#### Nuevos Tipos de Análisis
1. **Predicción de rendimiento**: ML para exámenes futuros
2. **Comparación con pares**: Benchmarking anónimo
3. **Análisis de patrones temporales**: Mejor horario de estudio
4. **Detección de fatiga**: Indicadores de cansancio mental

#### Nuevas Métricas
1. **Índice de confianza**: Correlación respuesta rápida vs correcta
2. **Adaptabilidad**: Velocidad de mejora tras feedback
3. **Consistencia temporal**: Estabilidad de rendimiento
4. **Eficiencia de estudio**: Mejora por tiempo invertido

### Mantenimiento y Monitoreo

#### Logs Importantes
- **Rendimiento**: Tiempo de carga de estadísticas
- **Errores**: Fallos en cálculo de métricas
- **Uso**: Páginas más visitadas y tiempo en cada sección
- **Feedback**: Clics en recomendaciones y seguimiento

#### Alertas Configuradas
- **Spike de errores**: >5% en cálculos de estadísticas
- **Lentitud**: >2s tiempo de respuesta
- **Datos inconsistentes**: Métricas que no cuadran

Este sistema de estadísticas psicotécnicas representa un avance significativo en la personalización del aprendizaje, proporcionando insights específicos que permiten a los usuarios optimizar su preparación para oposiciones de manera científica y medible.

## Sistema de Capacidad Ortográfica

### Implementación de Preguntas de Detección de Errores

#### Componente Especializado: ErrorDetectionQuestion.js

**Características principales:**
- **Renderizado visual limpio**: Texto destacado en recuadro azul sin título adicional
- **Sin etiquetas**: No muestra "📝 Texto a analizar", solo el recuadro elegante
- **Explicación didáctica dinámica**: Generada automáticamente desde `errors_found`
- **Formato educativo**: Muestra cada error con su corrección y explicación
- **Adaptable**: Funciona con cualquier número de errores y tipos de texto

#### Componente de Análisis de Palabras: WordAnalysisQuestion.js

**Características principales:**
- **Recuadro de palabras**: Muestra lista de palabras en un cuadro azul elegante
- **Sin título extra**: No muestra "Texto a analizar", solo el recuadro
- **Análisis específico**: Para contar, evaluar o analizar palabras mostradas
- **Casos de uso**: Contar palabras sin errores, evaluar ortografía en listas
- **Estructura requerida**: Necesita `content_data.original_text` con las palabras

#### Componente de Texto Estándar: text_question (PsychometricTestLayout.js)

**Características principales:**
- **Renderizado directo**: Muestra pregunta y opciones A, B, C, D sin componentes especiales
- **Formato estándar**: Para preguntas que no requieren visualizaciones específicas
- **Explicación integrada**: Muestra explicación tras responder
- **Casos de uso**: Preguntas conceptuales, definiciones, reglas gramaticales

#### Estructura de Datos Requerida

```javascript
const questionData = {
  question_text: 'Identifica todos los errores ortográficos en el texto presentado. ¿Cuántos errores ortográficos encuentras?',
  content_data: {
    chart_type: 'error_detection',
    original_text: 'Texto con errores (sin tildes donde corresponde)',
    correct_text: 'Texto corregido con todas las tildes',
    error_count: 3,
    errors_found: [
      {
        incorrect: 'palabra_mal',
        correct: 'palabra_bien',
        position: 8,
        error_type: 'acentuación',
        explanation: 'Falta tilde: palabra_bien'
      }
    ]
  },
  question_subtype: 'error_detection'
}
```

#### Procesamiento Automático

El componente `ErrorDetectionQuestion.js` genera automáticamente:

1. **Visualización del texto**: En caja destacada azul
2. **Explicación dinámica**: Basada en `errors_found`
3. **Formato consistente**: 
   ```
   📝 Análisis de errores:
   • palabra_mal → palabra_bien (explicación)
   ```

#### Integración en PsychometricTestLayout

```javascript
case 'error_detection':
  return (
    <ErrorDetectionQuestion
      question={question}
      onAnswer={handleAnswer}
      selectedAnswer={selectedAnswer}
      showResult={showResult}
      isAnswering={isAnswering}
      attemptCount={attemptCount}
    />
  );
```

#### Ventajas del Sistema

✅ **Sin duplicación**: El texto aparece solo una vez en el componente visual  
✅ **Explicaciones dinámicas**: Se generan automáticamente para cualquier pregunta  
✅ **Formato educativo**: Cada error se explica didácticamente  
✅ **Escalable**: Funciona con 1 error o 10 errores  
✅ **Consistente**: Mismo formato visual que otros tipos de pregunta  

#### Scripts de Ejemplo

Para crear nuevas preguntas de capacidad ortográfica:

```javascript
// scripts/add-nueva-pregunta-ortografia.js
const questionData = {
  section_id: sectionId, // deteccion_errores bajo capacidad-ortografica
  question_text: 'Identifica todos los errores ortográficos en el texto presentado. ¿Cuántos errores ortográficos encuentras?',
  content_data: {
    chart_type: 'error_detection',
    original_text: 'Texto con errores ortograficos sin tildes',
    correct_text: 'Texto con errores ortográficos sin tildes',
    error_count: 2,
    errors_found: [
      {
        incorrect: 'ortograficos',
        correct: 'ortográficos',
        explanation: 'Falta tilde: ortográficos'
      },
      // ... más errores
    ]
  },
  question_subtype: 'error_detection',
  // ... opciones A/B/C/D y respuesta correcta
}
```

#### Mejores Prácticas

1. **Textos realistas**: Usar frases que podrían aparecer en exámenes
2. **Errores comunes**: Focalizarse en tildes y acentuación
3. **Explicaciones claras**: "Falta tilde: palabra_correcta"
4. **Respuesta coherente**: El `error_count` debe coincidir con los errores reales
5. **Testing visual**: Usar `/debug/question/[id]` para verificar renderizado

#### Tipos de Errores Soportados

- **Acentuación**: Palabras sin tilde donde debería llevar
- **Diacríticos**: Confusión entre sí/si, dé/de, etc.
- **Ortografía general**: Palabras mal escritas
- **Posición numérica**: Para algoritmos de detección automática

### Integración con PsychometricTestLayout

#### Tipos de Pregunta Soportados

1. **error_detection** → ErrorDetectionQuestion.js (componente especializado)
   - Detección de errores ortográficos
   - Análisis de texto con explicaciones dinámicas
   
2. **text_question** → Renderizado inline en PsychometricTestLayout.js
   - Preguntas de opción múltiple estándar
   - Orden alfabético, comparación de frases
   - Sin visualizaciones especiales

#### Archivo de Debug

El archivo `/app/debug/question/[id]/page.js` debe incluir ambos tipos:

```javascript
case 'error_detection':
  return <ErrorDetectionQuestion {...questionProps} />

case 'text_question':
  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Implementación estándar de pregunta */}
    </div>
  )
```

Este sistema proporciona una base sólida para evaluar la capacidad ortográfica en oposiciones, con explicaciones educativas que ayudan al aprendizaje.

## 🔧 Sistema de Debug y Testing

### 🔗 URLs PRINCIPALES DE DEBUG

#### 🎯 Debug Batch - Navegación Entre Preguntas (PRINCIPAL)
```
http://localhost:3000/debug/batch
```
**Página principal para revisar múltiples preguntas de forma secuencial con navegación completa**

#### 🔍 Debug Individual - Pregunta Específica
```
http://localhost:3000/debug/question/[id]
```
**Para revisar una pregunta individual por su ID**

### Debug Batch - Navegación Entre Preguntas

El sistema incluye una funcionalidad completa para revisar múltiples preguntas de forma secuencial mediante **Debug Batch**.

#### Funcionalidades Disponibles

**🎮 Navegación Completa:**
- ✅ Botones "Anterior" y "Siguiente" para navegación secuencial
- ✅ Navegación rápida por números (1, 2, 3, etc.) en la parte superior  
- ✅ Contador de posición: "Pregunta X de Y"
- ✅ Enlaces individuales a cada pregunta desde el lote

**🔍 Funciones de Debug:**
- ✅ Reset de pregunta para volver a intentar
- ✅ Contador de intentos en tiempo real
- ✅ Información técnica completa (ID, componente, fecha)
- ✅ Link directo a pregunta individual (`/debug/question/[id]`)

#### Configuración del Lote

El archivo `/app/debug/batch/page.js` se puede configurar para diferentes categorías:

```javascript
// Ejemplo: Lote de Series Numéricas
const currentBatch = {
  name: "Lote Series Numéricas - Preguntas 1-3",
  startNumber: 1,
  questionIds: [
    'fb259e88-f01c-4105-885c-1e1da63d5b84', // Serie: 11, 11, 9, 9, 7, 7, ?
    '1bf0664e-3b99-4d82-94cf-79dfee0f6bf9', // Series con interrogantes
    'cd274a48-9d61-4d02-9585-6b66d9af5772'  // Serie: 1-3-5-7-9-11-?
  ]
}
```

#### Componentes Soportados

El sistema de debug batch soporta todos los tipos de pregunta psicotécnica:

- `bar_chart` → BarChartQuestion
- `pie_chart` → PieChartQuestion  
- `line_chart` → LineChartQuestion
- `data_tables` → DataTableQuestion
- `mixed_chart` → MixedChartQuestion
- `error_detection` → ErrorDetectionQuestion
- `word_analysis` → WordAnalysisQuestion
- `sequence_numeric` → SequenceNumericQuestion
- `text_question` → Renderizado inline

#### Casos de Uso

**📊 Para Desarrolladores:**
- Probar componentes nuevos rápidamente
- Verificar renderizado de explicaciones
- Navegar entre preguntas sin cambiar URLs

**📝 Para Content Creators:**
- Revisar lotes completos de preguntas
- Validar consistencia visual
- Probar flujo de usuario completo

**🎯 Para QA:**
- Testing sistemático de categorías
- Verificar funcionalidad de componentes
- Documentar bugs por lotes

#### Ejemplo de Navegación

1. **Acceder**: http://localhost:3000/debug/batch
2. **Navegar**: Usar botones "Anterior/Siguiente" o números
3. **Resetear**: Botón "🔄 Reiniciar Pregunta" si ya respondiste
4. **Abrir individual**: Click en "Abrir en nueva pestaña"

Este sistema facilita enormemente el proceso de desarrollo, testing y validación de contenido psicotécnico. 🚀

### 🧩 Desarrollo de Nuevos Componentes de Pregunta

#### Principio Fundamental
**Cada tipo de pregunta (`question_subtype`) necesita su propio componente React especializado.**

#### Proceso de Creación de Nuevos Tipos

**1. Crear el Componente:**
```javascript
// /components/MiNuevoTipoPregunta.js
'use client'
import { useState, useEffect } from 'react'

export default function MiNuevoTipoPregunta({ 
  question, onAnswer, selectedAnswer, showResult, isAnswering, attemptCount = 0 
}) {
  // Lógica específica del tipo de pregunta
  // ...
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* UI específica para este tipo */}
    </div>
  )
}
```

**2. Registrar en PsychometricTestLayout.js:**
```javascript
// Importar el componente
import MiNuevoTipoPregunta from './MiNuevoTipoPregunta'

// Añadir case en renderQuestion()
switch (currentQ.question_subtype) {
  case 'mi_nuevo_tipo':
    return (
      <MiNuevoTipoPregunta
        question={currentQ}
        onAnswer={handleAnswer}
        selectedAnswer={selectedAnswer}
        showResult={showResult}
        isAnswering={isAnswering}
        attemptCount={getAttemptCount(currentQ.id)}
      />
    )
  // ... otros casos
}
```

**3. Añadir al Debug Individual:**
```javascript
// /app/debug/question/[id]/page.js
import MiNuevoTipoPregunta from '../../../../components/MiNuevoTipoPregunta'

// Añadir case en renderQuestion()
case 'mi_nuevo_tipo':
  return <MiNuevoTipoPregunta {...questionProps} />
```

**4. Añadir al Debug Batch:**
```javascript
// /app/debug/batch/page.js  
import MiNuevoTipoPregunta from '../../../components/MiNuevoTipoPregunta'

// Añadir case en renderQuestion()
case 'mi_nuevo_tipo':
  return <MiNuevoTipoPregunta {...questionProps} />
```

**5. Actualizar Ejecutor de Tests:**
```javascript
// /app/psicotecnicos/test/ejecutar/PsychometricTestExecutor.js
const categoryToSubtypes = {
  'mi-categoria': ['mi_nuevo_tipo'],
  // ... otras categorías
}
```

#### Ejemplo Completo: SequenceNumericQuestion

**Componente creado:**
- `/components/SequenceNumericQuestion.js`
- Maneja `question_subtype: 'sequence_numeric'`
- UI especializada para series numéricas
- Procesamiento de explicaciones con `whitespace-pre-line`

**Integración realizada:**
- ✅ PsychometricTestLayout.js (case 'sequence_numeric')
- ✅ Debug individual (case 'sequence_numeric') 
- ✅ Debug batch (case 'sequence_numeric')
- ✅ Ejecutor de tests (categoryToSubtypes mapping)

#### Estructura de Props Estándar

Todos los componentes de pregunta reciben las mismas props:

```javascript
{
  question,           // Objeto completo de la pregunta
  onAnswer,          // Función callback para responder
  selectedAnswer,    // Índice de respuesta seleccionada (0,1,2,3)
  showResult,        // Boolean si mostrar resultado
  isAnswering,       // Boolean si está procesando respuesta
  attemptCount       // Número de intentos realizados
}
```

#### Checklist para Nuevos Tipos

- [ ] 📝 Crear componente en `/components/`
- [ ] 🔗 Importar y registrar en PsychometricTestLayout.js
- [ ] 🐛 Añadir soporte en debug individual 
- [ ] 🔄 Añadir soporte en debug batch
- [ ] ⚙️ Configurar mapping en ejecutor de tests
- [ ] 🧪 Crear preguntas de ejemplo
- [ ] 📖 Documentar en README-psicotecnico.md

Este sistema modular permite añadir fácilmente nuevos tipos de preguntas manteniendo consistencia en toda la aplicación. 🎯