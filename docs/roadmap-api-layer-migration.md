# Roadmap: Migración a API Layer (Drizzle + Zod)

> Generado: 2026-01-11
> Objetivo: Migrar llamadas directas a Supabase desde cliente hacia API Layer con Drizzle + Zod

## Estado Actual

- **Arquitectura existente:** `lib/api/` ya tiene el patrón correcto (Drizzle + Zod)
- **Problema:** 171+ archivos hacen llamadas directas a Supabase desde cliente
- **Impacto:** Falta de validación, queries no optimizadas, código duplicado

---

## FASE 1: Fetchers Principales

### 1.1 lib/testFetchers.js → ⚠️ ESTRATEGIA HÍBRIDA (NO migrar completo)

**Estado:** [🔍] Analizado - Requiere enfoque híbrido

**Ubicación actual:** `lib/testFetchers.js` (~2400 líneas, 12 funciones, 45+ queries)

#### 📊 Análisis Realizado (2026-01-11)

**¿Por qué NO migrar completamente a API Layer?**

| Aspecto | Problema |
|---------|----------|
| **Latencia** | Se ejecuta en CLIENTE. Migrar añadiría +50-200ms por request (round-trip adicional) |
| **Cache de sesión** | Usa `Map()` global para evitar preguntas repetidas. En servidor no persistiría entre requests |
| **Funciones RPC** | Usa `supabase.rpc()` que ya están optimizadas en PostgreSQL |
| **Riesgo** | 🔴 ALTO - El archivo es crítico para TODOS los tests de la app |

**Lo que SÍ mejoraría:**
- ✅ Validación de parámetros (actualmente sin validación)
- ✅ Consolidar queries N+1 (líneas 1125-1140 hacen 1 query POR artículo)
- ✅ Eliminar código duplicado (6+ queries SELECT idénticas)

#### ✅ TAREAS RECOMENDADAS (Mejoras In-Situ)

**Prioridad ALTA:**
- [ ] Crear `lib/testFetchers.schemas.ts` con validaciones Zod
- [ ] Aplicar `safeParse` en cada función antes de queries
- [ ] Refactorizar loop N+1 de artículos imprescindibles (líneas 1125-1140)

**Prioridad MEDIA:**
- [ ] Extraer `buildBaseQuestionQuery()` para eliminar duplicación
- [ ] Añadir tipos TypeScript a funciones principales

**NO HACER:**
- ❌ Mover fetchers a endpoints API (añade latencia sin beneficio)
- ❌ Reemplazar funciones RPC por queries Drizzle

#### 📝 Ejemplo de Validación a Añadir

```typescript
// lib/testFetchers.schemas.ts
import { z } from 'zod'

export const fetchQuestionsParamsSchema = z.object({
  n: z.coerce.number().int().min(1).max(100).default(25),
  difficultyMode: z.enum(['easy', 'medium', 'hard', 'extreme', 'random']).default('random'),
  excludeRecent: z.coerce.boolean().default(false),
  recentDays: z.coerce.number().int().min(1).max(365).default(15),
  onlyOfficial: z.coerce.boolean().default(false),
  focusWeak: z.coerce.boolean().default(false),
  focusEssential: z.coerce.boolean().default(false),
})

// Usar en fetchQuestionsByTopicScope:
const parsed = fetchQuestionsParamsSchema.safeParse({
  n: searchParams.get('n'),
  difficultyMode: searchParams.get('difficulty_mode'),
  // ...
})
if (!parsed.success) throw new Error('Parámetros inválidos')
```

**Nota:** Ya usa API Layer parcialmente (`fetchUserQuestionHistory` → `/api/user/question-history`)

---

### 1.2 lib/lawFetchers.js → API Layer

**Estado:** [ ] Pendiente

**Ubicación actual:** `lib/lawFetchers.js`

**Funciones a migrar:**
- [ ] `fetchQuestionsByLaw()` - líneas 119-133
- [ ] `validateLawExists()` - líneas 430-434
- [ ] `getLawStats()` - líneas 460-472 (2 count queries → 1)

**Nueva ubicación:**
```
lib/api/law-questions/
├── queries.ts
├── schemas.ts
└── index.ts
app/api/law-questions/
└── route.ts
```

---

## FASE 2: Hooks con N+1 Queries (ALTA PRIORIDAD)

### 2.1 hooks/useIntelligentNotifications.js

**Estado:** [ ] Pendiente

**Problema:** 4 queries separadas a tabla `tests` (líneas 923, 951, 1242, 1375)

**Solución:**
- [ ] Crear `/api/user/notification-data` que consolide las 4 queries en 1
- [ ] Retornar datos agregados

**Beneficio:** Reducir 4 round-trips a BD → 1

---

### 2.2 hooks/useNewMedalsBadge.js

**Estado:** [ ] Pendiente

**Problema:** 5 queries cada navegación (líneas 71, 116, 233, 244, 250)
- `user_medals`
- `test_questions`
- `user_profiles`
- `public_user_profiles`

**Solución:**
- [ ] Crear `/api/user/medals-summary` con query optimizada
- [ ] JOIN en servidor en lugar de queries separadas

**Beneficio:** 5 queries → 1 query con JOIN

---

### 2.3 hooks/useDisputeNotifications.js

**Estado:** [ ] Pendiente

**Problema:** 4 queries a `question_disputes` (líneas 49, 113, 148, 177)

**Solución:**
- [ ] Consolidar en `/api/user/dispute-notifications`

---

## FASE 3: Componentes Críticos (MEDIA PRIORIDAD)

### 3.1 components/PsychometricTestLayout.js

**Estado:** [ ] Pendiente

**Problema:** INSERT sin transacciones (líneas 84-87, 279-280, 294-295, 348-349)

**Solución:**
- [ ] Crear `/api/psychometric/session` para crear sesión
- [ ] Crear `/api/psychometric/answer` para guardar respuestas
- [ ] Usar transacciones Drizzle para integridad

---

### 3.2 components/TestLayout.js

**Estado:** [ ] Pendiente

**Queries a migrar:**
- [ ] Líneas 599-601: SELECT test_questions
- [ ] Líneas 873-881: SELECT + UPDATE user_profiles
- [ ] Líneas 1047-1048: SELECT test_questions

**Nota:** Ya tiene buen manejo de errores, solo migrar a API

---

### 3.3 components/ChatInterface.js

**Estado:** [ ] Pendiente

**Problema:** 8+ operaciones de DB en un componente

**Queries a migrar:**
- [ ] Líneas 341-343: INSERT feedback_conversations
- [ ] Líneas 357-366: SELECT feedback_messages
- [ ] Líneas 393-394: INSERT feedback_messages
- [ ] Líneas 406-434: SELECT/UPDATE conversaciones

**Solución:**
- [ ] Crear `/api/support/conversation` (CRUD)
- [ ] Crear `/api/support/message` (CRUD)

---

### 3.4 components/OnboardingModal.js

**Estado:** [ ] Pendiente

**Problema:** 4 updates secuenciales a user_profiles

**Solución:**
- [ ] Crear `/api/user/onboarding` que haga todo en una transacción

---

### 3.5 components/RankingModal.js

**Estado:** [ ] Pendiente

**Nota:** NO cachear - usuarios quieren ver ranking actualizado al instante

**Queries a migrar:**
- [ ] Líneas 128-147: SELECT admin_users, public_profiles
- [ ] Líneas 341-380: SELECT streaks

**Beneficio:** Validación + tipado, NO caching

---

## FASE 4: Componentes de Seguridad (MEDIA PRIORIDAD)

### 4.1 components/QuestionDispute.js + QuestionDisputeFixed.js

**Estado:** [ ] Pendiente

**Problema:** INSERT sin validación Zod (líneas 38-56)

**Solución:**
- [ ] Crear `/api/disputes` con validación de:
  - `dispute_type` (enum)
  - `question_id` (UUID válido)
  - `description` (longitud mínima/máxima)

---

### 4.2 components/ArticleModal.js

**Estado:** [ ] Pendiente

**Problema:** INSERT comentarios sin validación (líneas 424-449)

---

### 4.3 components/FeedbackModal.js

**Estado:** [ ] Pendiente

**Problema:** INSERT feedback sin validación de relaciones

---

## FASE 5: APIs JavaScript a Migrar (BAJA PRIORIDAD)

### 5.1 app/api/exam/resume/route.js

**Estado:** [ ] Parcialmente migrado

**Problema:** Líneas 69-79 todavía usan Supabase directo

**Solución:**
- [ ] Completar migración a Drizzle

---

### 5.2 app/api/ai/chat/route.js

**Estado:** [ ] Pendiente

**Problema:** Líneas 24-79 usan Supabase directo

**Solución:**
- [ ] Migrar `getUserDailyMessageCount()` a Drizzle
- [ ] Migrar `logChatInteraction()` a Drizzle

---

### 5.3 app/api/topic-review/route.js

**Estado:** [ ] Pendiente

**Problema:** Líneas 29-63 usan Supabase directo

---

## FASE 6: Limpieza y Componentes Menores (BAJA PRIORIDAD)

- [ ] ShareQuestion.js, ShareStreak.js, SharePrompt.js → `/api/share`
- [ ] AvatarChanger.js → `/api/user/avatar`
- [ ] InteractiveBreadcrumbs.js → revisar si necesita API
- [ ] MotivationalMessage.js → `/api/motivational`

---

## Patrón de Migración (Referencia)

### Estructura de carpetas
```
lib/api/[nombre]/
├── queries.ts      # Queries Drizzle tipadas
├── schemas.ts      # Schemas Zod para request/response
└── index.ts        # Re-exports

app/api/[nombre]/
└── route.ts        # Endpoint Next.js
```

### Ejemplo de schema (schemas.ts)
```typescript
import { z } from 'zod'

export const getQuestionsRequestSchema = z.object({
  tema: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).default(10),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).optional(),
})

export type GetQuestionsRequest = z.infer<typeof getQuestionsRequestSchema>

export function safeParseGetQuestionsRequest(data: unknown) {
  return getQuestionsRequestSchema.safeParse(data)
}
```

### Ejemplo de query (queries.ts)
```typescript
import { getDb } from '@/db/client'
import { questions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function getQuestionsByTema(tema: number, limit: number) {
  const db = getDb()

  return db.select()
    .from(questions)
    .where(eq(questions.temaNumber, tema))
    .limit(limit)
}
```

### Ejemplo de endpoint (route.ts)
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { safeParseGetQuestionsRequest } from '@/lib/api/questions/schemas'
import { getQuestionsByTema } from '@/lib/api/questions/queries'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parseResult = safeParseGetQuestionsRequest(body)

  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: 'Parámetros inválidos' },
      { status: 400 }
    )
  }

  const { tema, limit } = parseResult.data
  const questions = await getQuestionsByTema(tema, limit)

  return NextResponse.json({ success: true, questions })
}
```

---

## Progreso General

| Fase | Descripción | Estado | Prioridad |
|------|-------------|--------|-----------|
| 1.1 | testFetchers.js | [🔍] Analizado - Estrategia híbrida | ⚠️ CAMBIO |
| 1.2 | lawFetchers.js | [ ] Pendiente análisis | ALTA |
| 2 | Hooks N+1 | [ ] 0% | ALTA |
| 3 | Componentes críticos | [ ] 0% | MEDIA |
| 4 | Seguridad (validación) | [ ] 0% | MEDIA |
| 5 | APIs JavaScript | [ ] 0% | BAJA |
| 6 | Limpieza | [ ] 0% | BAJA |

---

## Notas

- **NO cachear RankingModal** - usuarios quieren ver cambios inmediatos
- **Priorizar Fetchers** - mayor impacto porque se usan en todos los tests
- **Tests unitarios** - crear tests para cada API nueva antes de migrar
- **Migración gradual** - mantener compatibilidad mientras se migra

---

## Referencias

- Arquitectura existente: `lib/api/answers/`, `lib/api/exam/`, `lib/api/stats/`
- Schema de BD: `db/schema.ts`
- Tests existentes: `__tests__/api/`
