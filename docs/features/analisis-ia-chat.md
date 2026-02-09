# Sistema de Análisis del IA Chat

> Sistema profesional de trazabilidad completa para el AI Chat de Vence.
> Permite debugging avanzado, análisis de rendimiento y optimización continua.

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Datos Capturados](#datos-capturados)
4. [Acceso y Permisos](#acceso-y-permisos)
5. [Interfaz de Administración](#interfaz-de-administración)
6. [Base de Datos](#base-de-datos)
7. [Análisis con Claude Code](#análisis-con-claude-code)
8. [Señales de Calidad](#señales-de-calidad)
9. [Casos de Uso](#casos-de-uso)
10. [API Reference](#api-reference)
11. [Estructura de Archivos](#estructura-de-archivos)
12. [Mantenimiento](#mantenimiento)
13. [Troubleshooting](#troubleshooting)

---

## Resumen Ejecutivo

El sistema de observabilidad proporciona **visibilidad completa** sobre cada interacción del AI Chat:

| Capacidad | Descripción |
|-----------|-------------|
| **Trazabilidad** | Cada paso del procesamiento queda registrado |
| **Debugging** | Identificar exactamente dónde y por qué falló una respuesta |
| **Análisis** | Patrones de uso, errores comunes, optimización de prompts |
| **Correlación** | Vincular traces con usuarios específicos para soporte |
| **Métricas** | Tiempos, tokens, tasas de error, feedback |

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE OBSERVABILIDAD                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Usuario envía mensaje                                                      │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                        │
│  │ ChatOrchestrator │ ──→ Crea AITracer con logId                          │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         SPANS REGISTRADOS                           │   │
│  │                                                                     │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │   │
│  │  │ ROUTING  │ → │  DOMAIN  │ → │ DB_QUERY │ → │ LLM_CALL │        │   │
│  │  │          │   │          │   │          │   │          │        │   │
│  │  │ • Evalúa │   │ • Procesa│   │ • Query  │   │ • Prompt │        │   │
│  │  │   todos  │   │   lógica │   │ • Results│   │ • Tokens │        │   │
│  │  │ • Elige  │   │ • Pattern│   │ • Time   │   │ • Response│       │   │
│  │  │   mejor  │   │   match  │   │          │   │          │        │   │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘        │   │
│  │                                                                     │   │
│  │  ┌──────────┐   ┌──────────┐                                       │   │
│  │  │POST_PROC │ → │  ERROR   │ (si ocurre)                           │   │
│  │  │          │   │          │                                       │   │
│  │  │ • Discrep│   │ • Stack  │                                       │   │
│  │  │ • Verify │   │ • Context│                                       │   │
│  │  └──────────┘   └──────────┘                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ tracer.flush()  │ ──→ Guarda en ai_chat_traces                          │
│  └─────────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tipos de Spans

| Tipo | Descripción | Datos Clave |
|------|-------------|-------------|
| `routing` | Decisión de qué dominio usar | dominios evaluados, seleccionado, confianza |
| `domain` | Procesamiento del dominio | patrón detectado, leyes identificadas |
| `db_query` | Consulta a base de datos | tabla, filtros, resultados, tiempo |
| `llm_call` | Llamada a OpenAI/Claude | modelo, prompt, tokens, respuesta |
| `post_process` | Post-procesamiento | verificación discrepancias, fuentes |
| `error` | Error capturado | mensaje, stack trace, contexto |

---

## Datos Capturados

### Información Completa del Contexto

El sistema captura **todos los datos necesarios** para debugging y análisis profesional:

#### Datos del Usuario
```typescript
{
  userId: string,              // ID único del usuario
  userEmail: string,           // Email para identificación en soporte
  isPremium: boolean,          // Tipo de cuenta
  oposicion: string,           // Oposición seleccionada
}
```

#### Datos de la Interacción
```typescript
{
  message: string,             // Pregunta completa del usuario
  fullResponse: string,        // Respuesta generada
  responseTimeMs: number,      // Tiempo total de respuesta
  feedback: string | null,     // positive / negative / null
  feedbackComment: string,     // Comentario del usuario
}
```

#### Datos del Contexto de Pregunta
```typescript
{
  questionId: string,          // Si pregunta sobre una question específica
  questionText: string,        // Texto de la pregunta
  correctAnswer: string,       // Respuesta correcta
  lawName: string,             // Ley relacionada
}
```

#### Datos de Procesamiento
```typescript
{
  selectedDomain: string,      // Dominio que procesó
  confidence: number,          // Confianza en la decisión
  patternsDetected: string[],  // Patrones identificados
  lawsDetected: string[],      // Leyes mencionadas
  articlesFound: number,       // Artículos encontrados
}
```

#### Datos de LLM
```typescript
{
  model: string,               // gpt-4-turbo, gpt-4o, etc.
  systemPrompt: string,        // Prompt de sistema usado
  userPrompt: string,          // Prompt construido
  temperature: number,         // Temperatura usada
  maxTokens: number,           // Límite de tokens
  tokensIn: number,            // Tokens de entrada
  tokensOut: number,           // Tokens de salida
  finishReason: string,        // stop, length, etc.
}
```

#### Datos de Discrepancia
```typescript
{
  hadDiscrepancy: boolean,     // Si hubo discrepancia AI vs BD
  aiSuggestedAnswer: string,   // Lo que sugirió la IA
  dbAnswer: string,            // Lo que dice la BD
  reanalysisTriggered: boolean,// Si se re-analizó
}
```

---

## Acceso y Permisos

### URL de Acceso

```
/admin/ai-traces
```

### Emails Autorizados

Configurados en:
- `app/admin/ai-traces/page.tsx`
- `app/api/admin/ai-traces/route.ts`
- `app/api/admin/ai-traces/[logId]/route.ts`

```typescript
const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
  // Añadir más según necesidad
]

function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}
```

### Autenticación

Las APIs requieren Bearer token de Supabase Auth:

```typescript
headers: {
  'Authorization': `Bearer ${session.access_token}`
}
```

---

## Interfaz de Administración

### Vista Principal: Lista de Logs

![Lista de Logs]

| Elemento | Descripción |
|----------|-------------|
| **Mensaje** | Texto de la pregunta del usuario |
| **Fecha** | Timestamp de la interacción |
| **Dominio** | Badge con el dominio que procesó |
| **Traces** | Número de spans registrados |
| **Tiempo** | Duración total en ms |
| **Feedback** | Emoji de feedback si existe |
| **Error** | Badge rojo si hubo error |
| **Discrepancia** | Badge amarillo si hubo discrepancia |

### Filtros Disponibles

| Filtro | Opciones | Uso |
|--------|----------|-----|
| **Errores** | Todos / Con errores / Sin errores | Encontrar fallos |
| **Feedback** | Todos / Positivo / Negativo / Con feedback | Analizar satisfacción |

### Panel de Detalle

Al hacer click en un log se abre un modal con:

#### 1. Estadísticas Resumidas
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  1250ms     │  2          │  850        │  search     │
│  Tiempo     │  LLM Calls  │  Tokens     │  Dominio    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

#### 2. Mensaje y Respuesta
- Pregunta original del usuario
- Respuesta generada (preview)

#### 3. Info de Discrepancia (si existe)
- Qué sugirió la IA
- Qué dice la BD
- Análisis de la diferencia

#### 4. Árbol de Traces Expandible
```
▼ routing (2ms)
  ├── Input: { message: "¿Qué dice el artículo 131?", ... }
  └── Output: { selectedDomain: "search", confidence: 0.95 }

▼ domain: SearchDomain (45ms)
  ├── Pattern: "article_query"
  └── Laws detected: ["Ley 39/2015"]

▼ db_query: search_articles (12ms)
  ├── Query: articles WHERE law='Ley 39/2015' AND number=131
  └── Results: 1 article found

▼ llm_call: gpt-4-turbo (890ms)
  ├── System prompt: "Eres un asistente experto..."
  ├── User prompt: "El usuario pregunta sobre..."
  ├── Tokens: 450 in, 280 out
  └── Response: "El artículo 131 establece..."
```

---

## Base de Datos

### Tabla: `ai_chat_traces`

```sql
CREATE TABLE ai_chat_traces (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_id UUID REFERENCES ai_chat_logs(id) ON DELETE CASCADE,

  -- Tipo de trace
  trace_type TEXT NOT NULL,  -- routing, domain, llm_call, db_query, post_process, error

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,  -- Calculado automáticamente por trigger

  -- Contenido (JSONB flexible)
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  -- Resultado
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  error_stack TEXT,

  -- Jerarquía
  sequence_number INTEGER NOT NULL,
  parent_trace_id UUID REFERENCES ai_chat_traces(id),

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Índices

```sql
-- Búsqueda por log (el más usado)
CREATE INDEX idx_ai_chat_traces_log_id ON ai_chat_traces(log_id);

-- Filtrar por tipo
CREATE INDEX idx_ai_chat_traces_type ON ai_chat_traces(trace_type);

-- Ordenar por fecha
CREATE INDEX idx_ai_chat_traces_created ON ai_chat_traces(created_at DESC);

-- Buscar errores
CREATE INDEX idx_ai_chat_traces_errors ON ai_chat_traces(success) WHERE success = false;

-- Búsqueda en metadata (GIN para JSONB)
CREATE INDEX idx_ai_chat_traces_metadata ON ai_chat_traces USING GIN (metadata);
```

### Vista: `ai_chat_traces_summary`

```sql
CREATE VIEW ai_chat_traces_summary AS
SELECT
  l.id AS log_id,
  l.message,
  l.created_at,
  l.feedback,
  l.had_error,
  l.had_discrepancy,
  COUNT(t.id) AS trace_count,
  SUM(t.duration_ms) AS total_duration_ms,
  ARRAY_AGG(DISTINCT t.trace_type) AS trace_types,
  COUNT(*) FILTER (WHERE t.success = false) AS error_count,
  MAX(t.metadata->>'model') AS model_used,
  SUM((t.metadata->>'tokens_in')::int) AS total_tokens_in,
  SUM((t.metadata->>'tokens_out')::int) AS total_tokens_out
FROM ai_chat_logs l
LEFT JOIN ai_chat_traces t ON t.log_id = l.id
GROUP BY l.id
ORDER BY l.created_at DESC;
```

### Trigger de Duración

```sql
CREATE FUNCTION calculate_trace_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_ms := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) * 1000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_trace_duration
  BEFORE INSERT OR UPDATE ON ai_chat_traces
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trace_duration();
```

---

## Análisis con Claude Code

### Filosofía

El sistema está diseñado para análisis **bajo demanda** con Claude Code, no automatizado:

| Automatizado | Claude Code (Recomendado) |
|--------------|---------------------------|
| Puede hacer cambios incorrectos | Revisión humana antes de aplicar |
| Cuesta tokens constantemente | Solo cuando se necesita |
| No entiende contexto de negocio | Acceso completo al código y datos |
| Cambios ciegos | Propuestas específicas y justificadas |

### Comandos de Análisis

#### Analizar Feedback Negativo
```
Analiza los traces con feedback negativo de los últimos 7 días.
Identifica:
1. Patrones comunes de error
2. Dominios con más problemas
3. Tipos de preguntas que fallan
4. Sugerencias de mejora para los prompts
```

#### Analizar Discrepancias
```
Busca los logs con hadDiscrepancy=true del último mes.
Para cada uno:
1. ¿Qué sugirió la IA vs qué decía la BD?
2. ¿Cuál era correcto?
3. ¿Por qué ocurrió la discrepancia?
4. ¿Cómo podemos prevenirlo?
```

#### Optimizar Prompts
```
Analiza los traces de llm_call del SearchDomain.
Compara:
- Prompts con feedback positivo vs negativo
- Tiempos de respuesta
- Tokens consumidos
Sugiere optimizaciones al prompt actual.
```

#### Analizar Rendimiento
```
Genera un reporte de rendimiento del AI Chat:
- Tiempo promedio de respuesta
- Distribución por dominio
- Tokens promedio por request
- Tasa de errores
- Evolución en el último mes
```

#### Debugging de Usuario Específico
```
El usuario X reportó que el chat no le funciona bien.
Busca sus últimas 20 interacciones y analiza:
1. ¿Qué está preguntando?
2. ¿Qué dominio procesa sus preguntas?
3. ¿Hay errores o discrepancias?
4. ¿Por qué puede estar insatisfecho?
```

### Proceso de Optimización

```
┌─────────────────────────────────────────────────────────────────┐
│                    CICLO DE MEJORA CONTINUA                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. RECOLECTAR                                                │
│      └── Traces se acumulan automáticamente                    │
│                     │                                           │
│                     ▼                                           │
│   2. ANALIZAR (con Claude Code)                                │
│      └── "Analiza feedback negativo de la semana"              │
│                     │                                           │
│                     ▼                                           │
│   3. IDENTIFICAR                                               │
│      └── Claude identifica patrones y problemas                │
│                     │                                           │
│                     ▼                                           │
│   4. PROPONER                                                  │
│      └── Claude sugiere cambios específicos                    │
│                     │                                           │
│                     ▼                                           │
│   5. REVISAR                                                   │
│      └── Admin revisa y aprueba cambios                        │
│                     │                                           │
│                     ▼                                           │
│   6. IMPLEMENTAR                                               │
│      └── Claude aplica los cambios al código                   │
│                     │                                           │
│                     ▼                                           │
│   7. MONITOREAR                                                │
│      └── Verificar mejora en siguientes traces                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Señales de Calidad

### Feedback Explícito

Solo ~5% de usuarios dan feedback. Cuando lo dan:

| Señal | Valor | Significado |
|-------|-------|-------------|
| `feedback = 'positive'` | +2 | Respuesta útil |
| `feedback = 'negative'` | -2 | Respuesta mala |
| `feedbackComment` | texto | Razón específica |

### Señales Proxy (Sin Feedback)

Para el 95% sin feedback explícito, usamos señales indirectas:

#### Señales Negativas
| Señal | Cómo Detectar | Peso |
|-------|---------------|------|
| **Reformulación** | Misma pregunta con otras palabras en <60s | -1.5 |
| **Confusión** | "no entendí", "qué?", "a qué te refieres" | -1.0 |
| **Discrepancia** | `hadDiscrepancy = true` | -1.0 |
| **Error** | `hadError = true` | -2.0 |
| **Abandono rápido** | Sesión termina en <5s después de respuesta | -0.5 |

#### Señales Positivas
| Señal | Cómo Detectar | Peso |
|-------|---------------|------|
| **Profundización** | Pregunta de follow-up sobre el mismo tema | +1.0 |
| **Sesión larga** | Continúa >2min después de respuesta | +0.5 |
| **Click en fuentes** | Abrió artículo citado | +1.0 |
| **Uso de información** | Mencionó la respuesta en siguiente pregunta | +1.5 |

### Cálculo de Score de Calidad

```typescript
function calculateQualityScore(trace: Trace): number {
  let score = 0

  // Feedback explícito (máxima prioridad)
  if (trace.feedback === 'positive') score += 2
  if (trace.feedback === 'negative') score -= 2

  // Señales proxy
  if (trace.hadDiscrepancy) score -= 1
  if (trace.hadError) score -= 2
  if (trace.wasReformulated) score -= 1.5
  if (trace.hadConfusionFollowUp) score -= 1
  if (trace.hadDeeperQuestion) score += 1
  if (trace.clickedSources) score += 1

  return score
}
```

---

## Casos de Uso

### 1. Debugging de Error Reportado

**Escenario:** Usuario reporta "el chat no me entiende cuando pregunto sobre plazos"

**Proceso:**
```
1. Buscar traces del usuario por email
2. Filtrar por mensajes que contengan "plazo"
3. Ver qué dominio procesó (¿routing correcto?)
4. Ver qué patrón detectó
5. Ver qué artículos encontró
6. Ver qué prompt se usó
7. Identificar el problema específico
```

### 2. Optimización de Dominio

**Escenario:** SearchDomain tiene 30% de feedback negativo

**Proceso:**
```
1. Obtener todos los traces de SearchDomain con feedback negativo
2. Agrupar por tipo de pregunta/patrón
3. Identificar los patrones problemáticos
4. Comparar prompts exitosos vs fallidos
5. Proponer mejoras al prompt
6. Implementar y monitorear
```

### 3. Análisis de Costos

**Escenario:** Reducir costos de tokens sin perder calidad

**Proceso:**
```
1. Obtener distribución de tokens por dominio
2. Identificar respuestas con muchos tokens pero feedback neutro/negativo
3. Analizar si los prompts son innecesariamente largos
4. Proponer prompts más concisos
5. A/B test con métricas de calidad
```

### 4. Detección de Nuevos Patrones

**Escenario:** Usuarios preguntan cosas que no manejamos bien

**Proceso:**
```
1. Buscar traces donde selectedDomain = 'fallback'
2. Agrupar mensajes por similitud
3. Identificar patrones recurrentes
4. Decidir si crear nuevo dominio o mejorar existente
5. Implementar mejora
```

---

## API Reference

### GET /api/admin/ai-traces

Lista de logs con resumen de traces.

**Query Parameters:**
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `limit` | number | 50 | Máximo 200 |
| `offset` | number | 0 | Para paginación |
| `hasErrors` | boolean | - | Filtrar por errores |
| `hasFeedback` | string | - | `positive`, `negative`, `any` |
| `fromDate` | string | - | ISO date |
| `toDate` | string | - | ISO date |
| `orderBy` | string | `created_at` | `created_at`, `duration_ms`, `trace_count` |
| `orderDir` | string | `desc` | `asc`, `desc` |

**Response:**
```typescript
{
  traces: TraceSummary[],
  total: number,
  limit: number,
  offset: number,
  hasMore: boolean
}
```

### GET /api/admin/ai-traces/[logId]

Detalle completo de un log con sus traces.

**Response:**
```typescript
{
  log: {
    id: string,
    userId: string,
    message: string,
    fullResponse: string,
    responseTimeMs: number,
    feedback: string | null,
    hadError: boolean,
    hadDiscrepancy: boolean,
    // ... más campos
  },
  traces: Trace[],
  tree: TraceTreeNode[],  // Estructura jerárquica
  stats: {
    totalDurationMs: number,
    llmCallCount: number,
    dbQueryCount: number,
    errorCount: number,
    totalTokensIn: number,
    totalTokensOut: number,
    dominiosEvaluados: number,
    dominioSeleccionado: string
  }
}
```

---

## Estructura de Archivos

```
lib/
├── chat/
│   ├── core/
│   │   ├── AITracer.ts              # Clase principal de tracing
│   │   │   ├── AITracer             # Gestiona spans de un trace
│   │   │   ├── TraceSpanBuilder     # Builder fluent para spans
│   │   │   ├── sanitizeForStorage() # Limita tamaño de datos
│   │   │   └── generateId()         # IDs únicos para spans
│   │   │
│   │   ├── ChatOrchestrator.ts      # Instrumentado con tracer
│   │   │   └── process()            # Crea tracer, traza routing
│   │   │
│   │   └── types.ts                 # Interfaces
│   │       ├── AITracerInterface
│   │       └── TraceSpanBuilderInterface
│   │
│   ├── domains/
│   │   ├── search/SearchDomain.ts
│   │   │   └── handle()             # Traza db_query y llm_call
│   │   │
│   │   ├── stats/StatsDomain.ts
│   │   │   └── handle()             # Traza db_query
│   │   │
│   │   ├── verification/VerificationDomain.ts
│   │   │   └── handle()             # Traza verification
│   │   │
│   │   └── knowledge-base/KnowledgeBaseDomain.ts
│   │       └── handle()             # Traza llm_call
│   │
│   └── analytics/
│       └── TraceAnalyzer.ts         # Análisis automático
│           ├── generateInsightReport()
│           ├── generateWeeklyReport()
│           └── generatePromptSuggestions()
│
├── api/
│   └── ai-traces/
│       ├── schemas.ts               # Zod schemas
│       │   ├── traceTypeSchema
│       │   ├── createTraceSchema
│       │   ├── getTracesRequestSchema
│       │   └── traceAnalyticsSchema
│       │
│       └── queries.ts               # Drizzle queries
│           ├── saveTraces()
│           ├── getTracesByLogId()
│           ├── getTracesList()
│           ├── getLogWithTraces()
│           ├── buildTraceTree()
│           ├── getTraceAnalytics()
│           └── deleteOldTraces()

app/
├── admin/
│   └── ai-traces/
│       └── page.tsx                 # UI de admin
│           ├── TraceTreeView        # Componente árbol expandible
│           ├── LogDetailPanel       # Modal de detalle
│           └── AdminAITracesPage    # Página principal
│
└── api/
    └── admin/
        └── ai-traces/
            ├── route.ts             # GET lista
            └── [logId]/
                └── route.ts         # GET detalle

database/
└── migrations/
    └── add_ai_chat_traces.sql       # Migración completa
        ├── CREATE TABLE
        ├── CREATE INDEX (7 índices)
        ├── RLS Policies
        ├── Trigger duración
        └── Vista resumen

db/
└── schema.ts                        # Tabla aiChatTraces en Drizzle
```

---

## Mantenimiento

### Limpieza de Traces Antiguos

```typescript
import { deleteOldTraces } from '@/lib/api/ai-traces/queries'

// Eliminar traces de más de 90 días
const deleted = await deleteOldTraces(90)
console.log(`Eliminados ${deleted} traces antiguos`)
```

**Recomendación:** Configurar cron mensual para limpieza automática.

### Backup de Datos

Los traces contienen información valiosa. Considerar:

```sql
-- Exportar traces del último mes para análisis offline
COPY (
  SELECT * FROM ai_chat_traces
  WHERE created_at > NOW() - INTERVAL '30 days'
) TO '/backup/traces_month.csv' WITH CSV HEADER;
```

### Monitoreo de Espacio

```sql
-- Ver tamaño de la tabla
SELECT
  pg_size_pretty(pg_total_relation_size('ai_chat_traces')) as total_size,
  pg_size_pretty(pg_relation_size('ai_chat_traces')) as table_size,
  pg_size_pretty(pg_indexes_size('ai_chat_traces')) as indexes_size;
```

### Regenerar Vista

Si la vista tiene problemas:

```sql
DROP VIEW IF EXISTS ai_chat_traces_summary;
-- Ejecutar CREATE VIEW del migration
```

---

## Troubleshooting

### "Acceso Denegado"

**Causa:** Email no está en lista de admins.

**Solución:** Añadir email a:
1. `app/admin/ai-traces/page.tsx` (línea ~343)
2. `app/api/admin/ai-traces/route.ts` (ADMIN_EMAILS)
3. `app/api/admin/ai-traces/[logId]/route.ts` (ADMIN_EMAILS)

### "No hay traces que mostrar"

**Causa:** Los traces solo se generan para nuevas interacciones.

**Verificar:**
1. ¿Hay logs en `ai_chat_logs`? (debería haber)
2. ¿Hay traces en `ai_chat_traces`? (puede estar vacío si es nuevo)
3. Hacer una pregunta al chat y refrescar

### Error 500 en API

**Diagnóstico:**
```bash
# Ver logs del servidor
tail -f /path/to/next.log | grep ai-traces
```

**Causas comunes:**
- Parámetros de filtro inválidos (Zod error)
- Conexión a BD fallida
- Token expirado

### Traces sin duración

**Causa:** El span no se cerró con `.end()`

**Verificar:** En el dominio correspondiente, asegurar:
```typescript
const span = tracer?.spanDB('operation', {...})
// ... operación ...
span?.end()  // ← Importante!
```

### Memoria alta en página de admin

**Causa:** Demasiados traces cargados.

**Solución:** Usar paginación, reducir `limit`.

---

## Métricas Clave (KPIs)

| Métrica | Objetivo | Cómo Medir |
|---------|----------|------------|
| **Tiempo de respuesta** | <2s p95 | `AVG(duration_ms)` de traces |
| **Tasa de errores** | <1% | `COUNT(hadError=true) / total` |
| **Feedback positivo** | >80% | `positive / (positive + negative)` |
| **Discrepancias** | <5% | `COUNT(hadDiscrepancy=true) / total` |
| **Tokens por request** | <1000 | `AVG(tokensIn + tokensOut)` |
| **Routing accuracy** | >95% | Análisis manual de casos |

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-02-09 | Implementación inicial del sistema |
| 2026-02-09 | Creación de documentación |

---

## Contacto

Para dudas sobre el sistema de observabilidad:
- Revisar este documento
- Consultar código fuente en los archivos listados
- Usar Claude Code para análisis y debugging
