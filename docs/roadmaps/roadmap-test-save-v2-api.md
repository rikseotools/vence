# Roadmap: Migrar guardado de tests a V2 API Layer (Drizzle + Zod + TS)

## Problema

El guardado de tests usa Supabase SDK en el cliente con RLS. Si el token JWT expira, los inserts fallan **silenciosamente** — el usuario completa tests que nunca se guardan en BD. No hay logs, no hay errores, no hay feedback.

### Incidente real (29/03/2026)

Victor Molina (premium) completó 100+ tests en 3 días sin que ninguno se guardara. Su token expiró el 26/03 y nunca se refrescó. La app siguió funcionando (lecturas con anon key) pero los inserts en `tests` fallaban por RLS (`auth.uid() = null`).

### Fix inmediato aplicado

- `saveDetailedAnswerWithRetry`: si V2 devuelve `session_expired`, no hacer fallback a V1 — devolver para que el UI muestre el modal
- `createDetailedTestSession`: verificar `getSession()` antes de insertar
- `TestLayout`: mostrar `SessionExpiredModal` cuando la creacion de sesion falla por auth

## Arquitectura actual vs propuesta

```
ACTUAL (cliente → Supabase SDK → RLS):
  Browser → supabase.from('tests').insert() → RLS check → ❌ silencio si token muerto
  Browser → supabase.from('test_questions').insert() → RLS check → ❌ silencio

PROPUESTO (cliente → API V2 → Drizzle):
  Browser → POST /api/v2/tests/create    → Bearer token → getUser() → Drizzle insert → ✅ o 401
  Browser → POST /api/v2/tests/answer    → Bearer token → getUser() → Drizzle insert → ✅ o 401
  Browser → POST /api/v2/tests/complete  → Bearer token → getUser() → Drizzle update → ✅ o 401
```

## Fases

### Fase 1: Endpoint /api/v2/tests/create (crear sesion de test)

**Objetivo:** Reemplazar `createDetailedTestSession` (utils/testSession.ts) que usa Supabase SDK directo.

**Crear:**
- `lib/api/tests/schemas.ts` — Zod schemas para create/answer/complete
- `lib/api/tests/queries.ts` — Drizzle queries para insert/update en `tests` y `test_questions`
- `app/api/v2/tests/create/route.ts` — POST endpoint

**Schema Zod:**
```typescript
const CreateTestRequestSchema = z.object({
  tema: z.number(),
  testNumber: z.number().default(1),
  testType: z.enum(['practice', 'exam']),
  questions: z.array(z.object({
    id: z.string().uuid(),
    difficulty: z.string().optional(),
    articleId: z.string().uuid().optional(),
  })),
  config: z.object({
    timeLimit: z.number().optional(),
  }).optional(),
})
```

**Patron:**
```typescript
async function _POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response // 401

  const body = await request.json()
  const parsed = CreateTestRequestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: '...' }, { status: 400 })

  const test = await createTest(auth.user.id, parsed.data) // Drizzle
  return Response.json({ success: true, testId: test.id })
}
export const POST = withErrorLogging('/api/v2/tests/create', _POST)
```

**Migrar en cliente:**
- `utils/testSession.ts`: `createDetailedTestSession` → fetch `/api/v2/tests/create`
- Si 401 → devolver `{ action: 'session_expired' }`

**Riesgo:** Bajo. El endpoint es aditivo. El cliente puede seguir usando Supabase SDK como fallback.

### Fase 2: Endpoint /api/v2/tests/answer (guardar respuesta individual)

**Objetivo:** Reemplazar `saveDetailedAnswerV2` (utils/testAnswers.ts).

**Crear:**
- `app/api/v2/tests/answer/route.ts` — POST endpoint

**Schema Zod:**
```typescript
const SaveAnswerRequestSchema = z.object({
  testId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedAnswer: z.number().min(0).max(3),
  isCorrect: z.boolean(),
  timeSpent: z.number().min(0),
  questionIndex: z.number().min(0),
})
```

**Ventajas sobre V2 actual:**
- V2 actual (`saveDetailedAnswerV2`) hace `refreshSession()` en el cliente y luego fetch a `/api/answer` con el token. El nuevo endpoint validaria directamente con Bearer token.
- Zod valida todo antes de tocar BD.
- Drizzle inserta con service role — no depende de RLS.

**Riesgo:** Medio. Es el endpoint mas llamado (1 por pregunta). Hay que verificar latencia.

### Fase 3: Endpoint /api/v2/tests/complete (finalizar test)

**Objetivo:** Reemplazar la logica de `finalizeTestSession` (utils/testSession.ts).

**Crear:**
- `app/api/v2/tests/complete/route.ts` — POST endpoint

**Schema:**
```typescript
const CompleteTestRequestSchema = z.object({
  testId: z.string().uuid(),
  score: z.number().min(0),
  totalTimeSeconds: z.number().min(0),
  detailedAnalytics: z.record(z.unknown()).optional(),
})
```

**Este endpoint ademas:**
- Actualiza `user_progress` (tema accuracy)
- Actualiza `user_streaks` (racha diaria)
- Actualiza `daily_question_usage` (conteo diario)
- Actualiza `user_question_history` (historial por pregunta)

Todo en una transaccion Drizzle.

**Riesgo:** Medio. La logica de finalizacion esta dispersa en 4 archivos. Consolidar en un endpoint la simplifica.

### Fase 4: Eliminar Supabase SDK del flujo de guardado

**Objetivo:** Eliminar `supabase.from('tests').insert()` y `supabase.from('test_questions').insert()` del cliente.

- Eliminar `saveDetailedAnswer` (V1 legacy) de `testAnswers.ts`
- Eliminar `createDetailedTestSession` legacy de `testSession.ts`
- Simplificar `saveDetailedAnswerWithRetry` para solo usar V2 (sin fallback a V1)

**Riesgo:** Bajo si fases 1-3 estan completadas y verificadas.

## Archivos afectados

| Archivo | Lineas | Cambio |
|---------|--------|--------|
| `utils/testSession.ts` | ~600 | `createDetailedTestSession` → fetch API |
| `utils/testAnswers.ts` | ~700 | `saveDetailedAnswer` → eliminar, V2 → fetch API |
| `components/TestLayout.tsx` | ~1400 | Usar nuevos endpoints |
| `components/ExamLayout.tsx` | ~900 | Usar nuevos endpoints |
| `lib/api/tests/schemas.ts` | nuevo | Zod schemas |
| `lib/api/tests/queries.ts` | nuevo | Drizzle queries |
| `app/api/v2/tests/create/route.ts` | nuevo | Endpoint |
| `app/api/v2/tests/answer/route.ts` | nuevo | Endpoint |
| `app/api/v2/tests/complete/route.ts` | nuevo | Endpoint |

## Orden recomendado

```
Fase 1 (create) → Fase 3 (complete) → Fase 2 (answer) → Fase 4 (cleanup)
```

Fase 2 es la mas critica en rendimiento (se llama por cada pregunta), asi que mejor dejarla para cuando Fase 1 y 3 estan validadas.

## Criterio de exito

- 0 tests perdidos silenciosamente (todo error queda en `validation_error_logs`)
- Token expirado → 401 → `SessionExpiredModal` → usuario re-loguea → tests se guardan
- Tipos end-to-end: Zod request → Drizzle insert → Zod response
- Latencia: < 200ms por respuesta guardada (actualmente ~100ms con SDK directo)
- Tests: al menos 30 tests unitarios cubriendo create/answer/complete + errores

## Metricas de monitorizacion

Despues de la migracion, crear query en admin dashboard:
```sql
SELECT
  DATE(created_at) as dia,
  COUNT(*) as total_saves,
  COUNT(*) FILTER (WHERE status_code = 200) as ok,
  COUNT(*) FILTER (WHERE status_code = 401) as expired,
  COUNT(*) FILTER (WHERE status_code >= 500) as errors
FROM validation_error_logs
WHERE endpoint LIKE '/api/v2/tests/%'
GROUP BY dia ORDER BY dia DESC;
```
