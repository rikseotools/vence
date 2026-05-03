# Manual: Resolver Impugnaciones con Claude Code

## Resumen

Este manual documenta cómo resolver impugnaciones de preguntas usando Claude Code como agente. Es más rápido que el proceso manual y permite verificar artículos directamente en la base de datos.

## 1. Ver Impugnaciones Pendientes

```
mira a ver si hay impugnaciones abiertas
```

Claude ejecutará:
```javascript
supabase
  .from('question_disputes')
  .select('id, question_id, user_id, dispute_type, description, status, created_at')
  .in('status', ['pending', 'appealed'])
  .order('created_at', { ascending: false });
```

**Resultado:** Lista de impugnaciones pendientes y con alegación (ambas requieren atención).

## 2. Analizar una Impugnación a Fondo

```
analiza la impugnación [número] a fondo
```

Claude debe obtener y verificar **todos** estos elementos:

### 2.1 Datos de la pregunta
- Texto completo de la pregunta
- Opciones A, B, C, D
- Respuesta marcada como correcta (índice 0-3)
- Explicación didáctica actual

### 2.2 Artículo vinculado
- `primary_article_id` → Artículo principal
- Ley a la que pertenece (short_name)
- Contenido completo del artículo
- **Nota:** Solo se puede vincular UN artículo principal

### 2.3 Verificación de cada opción
Crear una tabla analizando cada opción:

| Opción | Fundamento Legal | ¿Correcta? |
|--------|------------------|------------|
| A | Art. X dice... | ✅/❌ |
| B | Art. Y dice... | ✅/❌ |
| C | Art. Z dice... | ✅/❌ |
| D | ... | ✅/❌ |

### 2.4 Preguntas clave a responder
1. **¿La respuesta marcada es correcta?** - Verificar contra el artículo
2. **¿El artículo vinculado es el correcto?** - ¿Responde la pregunta?
3. **¿La explicación es didáctica?** - ¿Explica POR QUÉ cada opción es correcta/incorrecta?
4. **¿La explicación solo transcribe?** - Si solo copia el artículo sin explicar, hay que mejorarla

### 2.5 Verificación AI existente
Consultar `ai_verification_results`:
- `answer_ok`: ¿La respuesta es correcta?
- `explanation_ok`: ¿La explicación es correcta?
- `article_ok`: ¿El artículo vinculado es correcto?
- `ai_model`: Qué modelo verificó
- `explanation`: Análisis del modelo

### 2.6 Diagnóstico final
Crear tabla resumen:

| Aspecto | Estado | Acción |
|---------|--------|--------|
| Respuesta correcta | ✅/❌ | Corregir si es necesario |
| Explicación | ✅/⚠️/❌ | Mejorar si no es didáctica |
| Artículo vinculado | ✅/❌ | Cambiar si es incorrecto |
| Impugnación | Válida/Falso positivo | Resolver/Rechazar |

## 3. Buscar el Artículo Correcto

Si la explicación es incorrecta o falta el artículo:

```
busca en nuestra BD el artículo que habla de [tema de la pregunta]
```

Claude buscará en la tabla `articles` por contenido relevante.

**Ejemplo:**
```
busca el artículo 16 de la Ley 39/2015
```

## 4. Diagnosticar Por Qué Falló la Verificación

Antes de corregir, es importante entender **por qué** la pregunta tiene errores:

```
¿esta pregunta fue verificada? muéstrame su estado de verificación
```

Claude consultará:

### 4.1 Estado de la pregunta

> 🆕 **Post-03/05/2026 (lifecycle):** la fuente de verdad de visibilidad es `lifecycle_state`. `is_active` es `GENERATED ALWAYS AS (lifecycle_state IN ('approved','tech_approved'))` — no se puede actualizar directo. Las columnas `verification_status`, `topic_review_status` y `verified_at` siguen existiendo para compatibilidad pero **no controlan visibilidad**.

```javascript
supabase
  .from('questions')
  .select('lifecycle_state, is_active, verified_at, verification_status, topic_review_status')
  .eq('id', questionId);
```

> ⚠️ La relación pregunta↔tema **no** está en una columna `topic_id` de `questions` (no existe esa columna). Si te hace falta el tema, hay que mirar la(s) tabla(s) de unión correspondientes (`question_topics` y `topics`) — fuera del scope de la mayoría de impugnaciones.

Estados lifecycle posibles: `draft`, `needs_review`, `needs_human`, `quarantine`, `approved`, `tech_approved`, `retired_duplicate`, `retired_irreparable`. Solo `approved` y `tech_approved` hacen visible la pregunta. Ver `lib/constants/lifecycleReasons.ts` para taxonomía completa.

### 4.2 Resultados de verificación AI
```javascript
supabase
  .from('ai_verification_results')
  .select('*')
  .eq('question_id', questionId);
```

### 4.3 Posibles causas de fallo

| Causa | Síntoma | Solución |
|-------|---------|----------|
| **Artículo incorrecto vinculado** | AI verificó contra artículo equivocado | Vincular artículo correcto |
| **Modelo AI poco preciso** | Usado Haiku en vez de Opus/Sonnet | Re-verificar con mejor modelo |
| **Sin topic_id** | Pregunta no asignada a ningún tema | Asignar al topic correcto |
| **Sin artículo vinculado** | `question_articles` vacío | Buscar y vincular artículo |
| **Verificación no ejecutada** | `verified_at: null` + `lifecycle_state='draft'` | Ejecutar verificación |
| **Pregunta oculta tras corrección** | Lleva en `needs_review`/`needs_human`/`quarantine` y no transicionó a `approved` | Transicionar lifecycle (ver §5.2) |
| **AI dio conclusión errónea** | `answer_ok: false` pero respuesta es correcta | Corregir manualmente |

### 4.4 Ejemplo de diagnóstico real

```
=== RESULTADO AI ===
Article ID: b7186672...        ← Artículo INCORRECTO (prórrogas)
Answer OK: false               ← AI dijo que D era incorrecta
Explanation OK: false          ← Detectó explicación errónea
Model: claude-3-haiku          ← Modelo pequeño, menos preciso

Análisis: "según el artículo, los documentos presentados en forma
diferente se tendrán por presentados..." ← INCORRECTO
```

**Diagnóstico:** El AI verificó contra el artículo equivocado (6.6 prórrogas) en vez del correcto (16.8 registros), y además usó Haiku que es menos preciso para verificación legal.

**Acción:** Documentar este caso para mejorar el sistema de verificación:
- Asegurar que las preguntas tengan el artículo correcto ANTES de verificar
- Usar modelos más capaces (Sonnet/Opus) para verificación legal
- Revisar preguntas sin `topic_id` ya que pueden tener datos incompletos

---

## 5. Corregir la Pregunta

Una vez identificado el problema:

```
corrige la pregunta pero no cierres la impugnación
```

Claude actualizará:

### 5.1 Formato de Explicaciones

Las explicaciones deben tener formato markdown con saltos de línea para ser legibles:

**Formato correcto:**
```
La respuesta correcta es X.

Según el artículo Y de la Ley Z:

**A) INCORRECTA** - Razón...

**B) CORRECTA** - El artículo dice literalmente...

**C) INCORRECTA** - Razón...

**D) INCORRECTA** - Razón...
```

**Evitar:**
- Texto corrido sin saltos de línea ni formato.
- Secciones tipo "Truco", "Consejo", "Tip" o similares. El resumen final debe integrarse como un párrafo natural, no como una sección aparte.

### 5.1.1 Preguntas de Informática (Word, Excel, Access, Windows, Outlook, Internet)

Para preguntas de temas técnicos/informáticos, la explicación **SIEMPRE** debe:

1. **Ser didáctica con markdown:** negrita, listas, análisis por opción (A, B, C, D)
2. **Incluir fuente oficial en español al final:** enlace a Microsoft Support en español (`support.microsoft.com/es-es/...`)
3. **Verificar la fuente antes de usarla:** buscar con WebSearch y confirmar que la URL existe y es relevante

**Formato obligatorio para preguntas de informática:**
```
La respuesta correcta es **X) Texto de la opción**.

[Explicación del concepto con markdown]

**A) CORRECTA/INCORRECTA** — Razón...

**B) CORRECTA/INCORRECTA** — Razón...

**C) CORRECTA/INCORRECTA** — Razón...

**D) CORRECTA/INCORRECTA** — Razón...

Fuente: [Microsoft Support - Título descriptivo](https://support.microsoft.com/es-es/office/...)
```

**Fuentes comunes de Microsoft Support en español:**
- Excel: `https://support.microsoft.com/es-es/excel`
- Word: `https://support.microsoft.com/es-es/word`
- Access: `https://support.microsoft.com/es-es/access`
- Outlook: `https://support.microsoft.com/es-es/outlook`
- Windows: `https://support.microsoft.com/es-es/windows`
- Atajos Word: `https://support.microsoft.com/es-es/office/keyboard-shortcuts-in-word-95ef89dd-7142-4b50-afb2-f762f663ceb2`

**IMPORTANTE:** No inventar URLs. Siempre buscar y verificar que la fuente existe antes de incluirla.

### 5.1.2 Verificación de preguntas técnicas con leyes virtuales (post-14/04/2026)

**Hueco detectado:** el flujo `revisar-temas-con-agente.md` está pensado para preguntas legales (verificar contra artículo). Las preguntas técnicas vinculadas a "leyes virtuales" (Word, Excel, Access, Outlook, Windows, Internet) **no se enrutan al agente Opus/Sonnet**; solo pasan por `gpt-4o-mini` ligero. Cuando éste marca `answer_ok=false` o `explanation_ok=false`, el flag queda sin acción y la pregunta sigue activa con la explicación errónea hasta que un usuario impugna.

**Regla:**

1. **Al resolver impugnaciones de preguntas técnicas**, comprobar siempre `ai_verification_results`. Si solo hay verificación de `gpt-4o-mini` con flag negativo no resuelto, ese flag suele ser correcto y conviene reescribir.
2. **Para verificación masiva de técnicas**, usar agente Opus/Sonnet con prompt adaptado: en lugar de "compara con el artículo", usar "compara con la documentación oficial de Microsoft Support en español; busca con WebSearch y verifica con WebFetch que la URL existe; si no encuentras fuente fiable, marca `explanation_ok=false`".
3. **Auditoría periódica:** sacar lista de técnicas con `gpt-4o-mini` `answer_ok=false` o `explanation_ok=false` no resueltos y procesarlas con Opus/Sonnet en oleadas.

**Incidente que motiva la regla (14/04/2026):** pregunta `7fc7f0b0...` Excel `=EXTRAE(A1;12;2)` tenía la explicación de OTRA pregunta (sobre concatenación con `&`), totalmente cruzada. `gpt-4o-mini` lo detectó (`answer_ok=false, explanation_ok=false`, descripción correcta) hace meses, pero la pregunta nunca fue revisada por agente Opus, así que siguió activa hasta que la impugnó la usuaria Farida.

### 5.2 Explicación + transición lifecycle (post-03/05/2026)

> 🆕 **Decide primero si hace falta transición:**
>
> - **Si la pregunta YA está en `approved` o `tech_approved`** (caso típico de bug menor: redacción mejorable, explicación pobre, errata) → **NO transicionar**. La función SQL rechaza same-state (`Same-state transition not allowed`). Solo `UPDATE explanation`/`question_text` + invalidar cache. La pregunta sigue visible mientras tanto.
> - **Si la pregunta está en `needs_review`/`needs_human`/`quarantine`/`draft`** → **SÍ transicionar** a `approved`/`tech_approved` tras corregir. Sin esta transición, `is_active` (GENERATED) sigue en false y la pregunta queda invisible al estudiante aunque la explicación esté arreglada.
>
> Comprobar siempre `lifecycle_state` antes de decidir (consulta de §4.1).

**Flujo en dos pasos:**

```javascript
// Paso 1: actualizar la explicación + columnas legacy (sin tocar is_active ni lifecycle_state directamente)
await supabase
  .from('questions')
  .update({
    explanation: nuevaExplicacion,
    verification_status: 'verified',           // legacy, opcional
    verified_at: new Date().toISOString(),     // legacy, opcional
  })
  .eq('id', questionId);
```

```javascript
// Paso 2: transicionar lifecycle vía endpoint admin (única vía legítima).
// Necesitas Bearer token admin (igual patrón que dispute/resolve).
const res = await fetch('https://www.vence.es/api/admin/questions/lifecycle/transition', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({
    questionId,
    expectedState: estadoActual,    // p.ej. 'needs_review' (lectura previa, sirve de optimistic check)
    newState: 'approved',           // o 'tech_approved' si es pregunta de informática
    reasonCode: 'admin_marked_perfect',
    notes: 'Impugnación XYZ resuelta: explicación reescrita',
  }),
});
```

**Reason codes admin más usados** (taxonomía cerrada en `lib/constants/lifecycleReasons.ts`):

| Caso | reasonCode | newState |
|------|------------|----------|
| Corregido y queda perfecto | `admin_marked_perfect` | `approved` (o `tech_approved` informática) |
| Necesita aún decisión humana | `admin_marked_problem` | `needs_human` |
| Pipeline IA aplicó fix | `auto_fix_applied` | `approved` |
| Imagen no recuperable | `admin_image_unavailable` | `retired_irreparable` |
| Ley derogada | `admin_law_derogated` | `retired_irreparable` |
| Pregunta anulada en oficial | `admin_exam_annulled` | `retired_irreparable` |
| Duplicada de otra | `admin_duplicate_of` | `retired_duplicate` |
| Estructural reparada | `admin_repaired_quarantine` | `draft` |

> Si haces UPDATE directo a `lifecycle_state` desde script, el trigger `tg_questions_lifecycle_audit_fallback` lo detecta y registra como `bypass_detected` en `question_lifecycle_history`. Funciona — pero **no lo hagas**: pasa siempre por el endpoint o llamando directamente a la función SQL `public.transition_question_state(...)` para tener audit con `changed_by` correcto.

### 5.2.1 Atajo desde Claude Code: llamar la función SQL vía `pg` (sin Bearer token)

Cuando Claude Code resuelve impugnaciones desde local con `DATABASE_URL` ya cargado de `.env.local`, mintear un Bearer admin (generateLink + verifyOtp) es engorroso. La función SQL `public.transition_question_state(...)` es `SECURITY DEFINER` y `EXECUTE` está dado a `service_role` (que es el rol del `DATABASE_URL` de servicio) — se puede invocar directamente:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const QUESTION_ID    = 'PONER_UUID';
const EXPECTED_STATE = 'needs_review';                          // estado leído antes; sirve de optimistic check
const NEW_STATE      = 'approved';                              // o 'tech_approved' (informática)
const REASON_CODE    = 'admin_marked_perfect';                  // ver tabla §5.2
const CHANGED_BY     = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';  // admin user_id (Manuel)
const NOTES          = 'Impugnación XYZ resuelta';              // opcional

(async () => {
  try {
    // 0. Leer estado actual + is_active (sanity check)
    const [before] = await sql\`
      SELECT lifecycle_state, is_active FROM public.questions WHERE id = \${QUESTION_ID}\`;
    console.log('ANTES:', before);

    // 1. Transicionar
    await sql\`
      SELECT public.transition_question_state(
        \${QUESTION_ID}::uuid,
        \${EXPECTED_STATE}::text,
        \${NEW_STATE}::text,
        \${REASON_CODE}::text,
        \${CHANGED_BY}::uuid,
        NULL::uuid,                  -- ai_verification_id (opcional)
        \${NOTES}::text
      )\`;

    // 2. Confirmar (is_active GENERATED debe seguir lifecycle_state)
    const [after] = await sql\`
      SELECT lifecycle_state, is_active FROM public.questions WHERE id = \${QUESTION_ID}\`;
    console.log('DESPUÉS:', after);

    // 3. Verificar audit en history
    const hist = await sql\`
      SELECT to_state, reason_code, changed_at
      FROM public.question_lifecycle_history
      WHERE question_id = \${QUESTION_ID}
      ORDER BY changed_at DESC LIMIT 1\`;
    console.log('HISTORY:', hist[0]);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await sql.end();
  }
})();
"
```

**Errores típicos que devuelve la función SQL** (capturarlos por `e.message`):

| Mensaje | Causa | Acción |
|---------|-------|--------|
| `State mismatch: expected X but is Y` | El `expectedState` no coincide con la BD (alguien cambió el estado entre tu lectura y este UPDATE) | Releer estado actual y reintentar |
| `Cannot transition from terminal state X` | La pregunta está en `retired_*`. No admite transición de salida | Crear pregunta nueva o rechazar dispute |
| `Illegal transition: X → Y` | El par estado-actual → estado-nuevo no está en la matriz de transiciones legales (ver `isLegalTransition` en `lib/constants/lifecycleReasons.ts`) | Revisar qué transición pretendías. Casi siempre es bug del caller |
| `Same-state transition not allowed: X → X` | Ya está en ese estado | No transicionar — solo UPDATE de `explanation` |
| `Invalid p_new_state: X` | El `newState` no está en los 8 estados válidos | Revisar typo |
| `p_reason_code is required` | Pasaste null/empty | Pasar uno de la taxonomía |

**Ventajas vs endpoint Bearer:**
- Sin pasos de auth (un solo `node -e`).
- Audit idéntico: history queda con `changed_by` correcto y `reason_code` taxonómico.
- Errores con mensaje SQL claro, sin capa de mapeo HTTP.

**Cuándo usar el endpoint (`POST /api/admin/questions/lifecycle/transition`) en lugar de este atajo:**
- Desde la app web (admin UI) — ahí el Bearer ya existe en sesión.
- Desde un cliente que NO tenga acceso a `DATABASE_URL` (ej. integración externa).
- Cuando quieras los códigos HTTP estructurados (409 conflict, 404 not found, 400 bad request).

> **⚠️ INVALIDAR CACHE:** desde el commit que añadió `unstable_cache` a la
> validation query (`lib/api/v2/answer-and-save/queries.ts`), el endpoint
> `/api/v2/answer-and-save` cachea la respuesta correcta + explicación con
> tag `'questions'` (TTL 1h). Tras un UPDATE manual a `questions` desde
> script (sin pasar por `/api/v2/dispute/resolve`), invalidar el cache:
>
> ```bash
> curl -X POST https://www.vence.es/api/admin/revalidate \
>   -H "Content-Type: application/json" \
>   -H "x-cron-secret: $CRON_SECRET" \
>   -d '{"tag":"questions"}'
> ```
>
> Si NO se invalida, los users verán la explicación / respuesta antigua
> hasta máximo 1h (TTL). Cerrar la dispute via `/api/v2/dispute/resolve`
> invalida automáticamente el tag — solo es problema si haces UPDATE
> manual y luego cierras la dispute via UPDATE directo en BD (lo cual
> NO se debe hacer, ver §6).

### 5.3 Vincular artículo (tabla `question_articles`)
```javascript
supabase
  .from('question_articles')
  .insert({ question_id: questionId, article_id: articleId });
```

### 5.4 Actualizar verificación AI (tabla `ai_verification_results`)
```javascript
supabase
  .from('ai_verification_results')
  .update({
    article_id: correctArticleId,
    article_ok: true,
    answer_ok: true,
    explanation_ok: true,
    confidence: 'alta',
    ai_provider: 'claude_code',
    ai_model: 'claude-opus-4-6',
    verified_at: new Date().toISOString(),
    explanation: 'Verificación corregida...',
    article_quote: 'Cita del artículo...'
  })
  .eq('question_id', questionId);
```

## 6. Cerrar la Impugnación

> **IMPORTANTE:**
> - NUNCA cerrar la impugnación sin aprobación explícita del mensaje.
> - SIEMPRE obtener el nombre del usuario ANTES de proponer el mensaje, para dirigirse a él por su nombre.
> - Claude debe mostrar el mensaje propuesto y esperar confirmación antes de ejecutar cualquier cambio en `question_disputes`.

Antes de cerrar, pedir el mensaje personalizado:

```
cierra la impugnación pero antes dime qué le vas a poner al usuario
```

**Formato del mensaje (post-14/04/2026):**
```
Hola [Nombre],

[Confirmación del problema reportado, reconociendo si tenían razón]

[Explicación de la corrección aplicada]

Muchas gracias.

Equipo de Vence
```

**Notas de tono:**
- Firmar siempre con "Equipo de Vence" al final.
- **NO usar fórmulas tipo "gracias por ayudarnos a mejorar la plataforma"** ni "gracias por el reporte. Mucho ánimo con la oposición!". Los opositores no quieren ayudarnos, quieren resolver su asunto. Un simple "Muchas gracias." es suficiente.
- Cuando el usuario tenía razón, decirlo claramente ("Tenías razón…", "Tienes razón…"). Refuerza confianza en la plataforma.
- Mensajes concisos y aireados (no apelotonados): saltos de línea entre párrafos, frases cortas. El usuario no quiere leer un muro de texto.

Una vez aprobado, **llamar al endpoint `/api/v2/dispute/resolve`** (NO hacer UPDATE directo en BD):

```javascript
// Necesitas un access_token de admin. Para minteo programatico desde Node:
//   1) generateLink type='magiclink' con SERVICE_ROLE_KEY
//   2) verifyOtp con ANON_KEY → session.access_token
// (Ver script de ejemplo en /tmp/test_e2e_auth.mjs si sigue existiendo.)

const res = await fetch('https://www.vence.es/api/v2/dispute/resolve', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    disputeId,
    questionType: isPsychometric ? 'psychometric' : 'legislative',
    status: 'resolved', // o 'rejected'
    adminResponse: mensaje,
  }),
});

const result = await res.json();
// result = {
//   success: true,
//   disputeId, status,
//   emailSent: boolean,
//   emailId: string | null,
//   emailError: string | null,
//   emailSkipReason: 'empty_response' | 'no_user_email' | 'user_preferences' | null
// }
```

> **El email se envía en el mismo flujo de aplicación** (`sendEmailV2` directo, sin saltos HTTP intermedios). Si `emailSent === false`, revisar `emailError` o `emailSkipReason`. La disputa **siempre queda resuelta** aunque el email falle (no hay rollback).

> **NO hagas UPDATE directo en BD.** El trigger PG antiguo fue eliminado el 14/04/2026 porque fallaba en silencio por cold-start de Vercel. Si haces UPDATE directo, **NO se enviará email al usuario**.

## 7. Tablas Involucradas

| Tabla / Endpoint | Uso |
|-------|-----|
| `question_disputes` | Impugnaciones de preguntas legislativas |
| `psychometric_question_disputes` | Impugnaciones de preguntas psicotécnicas |
| `questions` | Preguntas legislativas y explicaciones (lee `lifecycle_state`, NO actualizar `is_active` — es GENERATED) |
| `question_lifecycle_history` | Audit append-only de transiciones de `lifecycle_state` (post-03/05/2026) |
| `psychometric_questions` | Preguntas psicotécnicas (sin lifecycle aún, fuera de scope) |
| `question_articles` | Relación pregunta-artículo (tabla de unión) |
| `articles` | Artículos de leyes |
| `ai_verification_results` | Resultados de verificación AI |
| `user_profiles` / `auth.users` | Datos del usuario para personalizar mensaje |
| `POST /api/admin/questions/lifecycle/transition` | **Única vía legítima** para cambiar `lifecycle_state` (= visibilidad) |
| `public.transition_question_state(...)` | Función SQL `SECURITY DEFINER` que valida transiciones + escribe history |

### 7.0 Dos Tablas de Impugnaciones

**IMPORTANTE:** Las impugnaciones están en DOS tablas diferentes:

| Tabla | Tipo de Pregunta | Campos Principales |
|-------|------------------|-------------------|
| `question_disputes` | Legislativas | `question_id` → `questions` |
| `psychometric_question_disputes` | Psicotécnicas | `question_id` → `psychometric_questions` |

**Para ver TODAS las impugnaciones pendientes:**

```javascript
// 1. Impugnaciones legislativas pendientes (incluye alegaciones)
const { data: legDisputes } = await supabase
  .from('question_disputes')
  .select('id, question_id, user_id, dispute_type, description, status, created_at')
  .in('status', ['pending', 'appealed'])
  .order('created_at', { ascending: true });

// 2. Impugnaciones psicotécnicas pendientes
const { data: psyDisputes } = await supabase
  .from('psychometric_question_disputes')
  .select('id, question_id, user_id, dispute_type, description, status, created_at')
  .in('status', ['pending', 'appealed'])
  .order('created_at', { ascending: true });

console.log('Legislativas:', legDisputes?.length || 0);
console.log('Psicotécnicas:', psyDisputes?.length || 0);
```

**Para corregir preguntas psicotécnicas:**

```javascript
// Actualizar pregunta psicotécnica
await supabase
  .from('psychometric_questions')
  .update({
    explanation: nuevaExplicacion,
    correct_option: nuevoIndice  // 0=A, 1=B, 2=C, 3=D
  })
  .eq('id', questionId);

// Cerrar impugnación psicotécnica
await supabase
  .from('psychometric_question_disputes')
  .update({
    status: 'resolved',  // o 'rejected'
    admin_response: mensaje,
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

### 7.1 Dos formas de vincular artículos

Las preguntas pueden tener artículos vinculados de **dos formas**:

| Campo | Ubicación | Uso |
|-------|-----------|-----|
| `primary_article_id` | Columna en `questions` | Artículo principal (directo) |
| `question_articles` | Tabla de unión | Artículos adicionales (múltiples) |

**Importante:** Al investigar una pregunta, verificar AMBOS:

```javascript
// 1. Artículo principal
const { data: q } = await supabase
  .from('questions')
  .select('primary_article_id')
  .eq('id', questionId);

// 2. Artículos adicionales
const { data: qa } = await supabase
  .from('question_articles')
  .select('article_id')
  .eq('question_id', questionId);
```

Si `primary_article_id` apunta al artículo incorrecto, corregirlo:

```javascript
await supabase
  .from('questions')
  .update({ primary_article_id: correctArticleId })
  .eq('id', questionId);
```

## 7.2 Impugnaciones de `tema_incorrecto` o "esta pregunta es de otro tema"

Cuando la queja del usuario no es sobre el contenido de la pregunta sino sobre el **tema** en el que aparece, **no es un problema de la pregunta sino del `topic_scope`**. Antes de tocar nada:

> 📖 **Lectura obligatoria:** `docs/maintenance/verificar-epigrafe-topic-scope.md` — explica cómo el `topic_scope` mapea artículos a temas y la regla de oro "scope debe reflejar el epígrafe oficial".

### Checklist específica para `tema_incorrecto`

1. **Buscar el `primary_article_id` en TODOS los `topic_scope` de la oposición**, no solo en el tema "esperado". Filtrar por `position_type` + `law_id` y comprobar qué temas (de cualquier bloque) tienen ese artículo. Lo habitual es encontrar 2+ temas y uno es el erróneo.
2. **Comparar el contenido del artículo con el `topics.epigrafe` oficial** de cada tema donde aparece. Si el artículo trata de algo que **no se menciona en el epígrafe**, sobra ahí — quitarlo del `article_numbers` de ese scope.
3. **Aplicar la regla del manual de epígrafes** (sección "Solapamientos entre temas"): solo estrechar cuando el contenido pertenece **claramente** a otro tema del mismo programa. Si hay duda genuina, mantener.
4. **Usar la nomenclatura del usuario en TODO momento** (mensaje al usuario, análisis previo, borradores, e incluso comunicación con el desarrollador). NUNCA mencionar el `topic_number` interno (T5, T101, T201, etc.) — el opositor no lo entiende y al desarrollador le confunde igual. Regla **estricta y única** para todos los temas:
   - **Siempre escribir "Tema X del Bloque Y"** (ej.: "Tema 5 del Bloque I", "Tema 1 del Bloque II"), incluso si es Bloque I.
   - X = `display_number` si está informado; si no, `topic_number` (válido en Bloque I porque coinciden).
   - Y = `bloque_number`, en romanos (I, II, III...).
   - Consulta: `SELECT topic_number, bloque_number, display_number, title, epigrafe FROM topics WHERE …`.
   - Si te descubres escribiendo "T101", "T5", etc. en cualquier lado → reescribir.

### Incidente que motiva la regla (14/04/2026 — Isabel Iglesias, aux admin estado)

Pregunta sobre art. 103.2 CE (órganos de la Admin del Estado creados por ley) aparecía en el "Tema 1 del Bloque II - Atención al ciudadano" (T101 interno), cuyo epígrafe oficial trata solo de acogida, información y discapacidad. El art. 103 estaba en el `topic_scope` de T101 sin justificación en el epígrafe; pertenece claramente a T5 ("El Gobierno y la Administración"). Fix: quitar `"103"` del `article_numbers` de T101.

Misma usuaria, mismo día, otra impugnación: art. 13 CE (derechos de extranjeros) aparecía en T2 ("Tribunal Constitucional. Reforma. Corona") cuando solo encaja en T1 ("Derechos y deberes fundamentales"). Mismo patrón, misma solución.

**Patrón a vigilar:** topic_scopes que añaden artículos "por contigüidad numérica" (porque el tema toca arts cercanos del mismo título) sin comprobar si cada artículo concreto encaja en el epígrafe.

## 7.3 Filosofía: "no oficial + mejorable = se mejora" (post-14/04/2026)

**Regla:** si una pregunta es `is_official_exam = false` y se puede dejar perfecta tocando algo, **se toca**, aunque la queja del usuario sea parcial o no apunte al punto débil real. Aprovechar cada impugnación para subir el nivel de la pregunta.

**Por qué:** las preguntas no oficiales no tienen restricciones de literalidad de examen. Cualquier mejora — opción más literal, explicación didáctica, fuente añadida, errata corregida, programa especificado — sube la calidad del banco. Si el usuario notó algo, casi siempre hay más por pulir alrededor.

**Casos típicos vistos el 14/04/2026:**

- Eduardo (#5574b5e0) pidió añadir "sobre todo en materia criminal" → reformulamos opción C entera para que fuera **cita literal** del art. 120.2 CE.
- Cristina (#e9cd059b, #8dd09f3b) pidió que se indicara el programa → añadimos "En Microsoft Word/Excel" + reescribimos explicación con análisis A/B/C/D + fuente Microsoft Support en español (estándar §5.1.1).
- Tinokero (#e50300fb) discrepaba con la respuesta correcta → su queja era infundada, pero detectamos explicación monolínea sin formato; **rechazamos su queja PERO mejoramos la explicación** según §5.1.1.

**Contraste:** si la pregunta es **oficial** (`is_official_exam = true`), no se toca enunciado ni opciones — solo se mejora la explicación, se corrige el `primary_article_id` y se reescribe la cita textual si era engañosa (caso #ca60036f Carmen Pavón, examen oficial CyL).

## 7.4 Cross-contamination de explicaciones entre preguntas (post-14/04/2026)

**Patrón detectado:** preguntas cuya explicación pertenece a **otra pregunta distinta** del banco — texto coherente y bien formateado, pero del tema equivocado.

**Caso motivador (14/04/2026 — Farida Oulad, dispute `5a1f5508`):** pregunta sobre `=EXTRAE(A1;12;2)` en Excel cuya explicación hablaba enteramente del operador `&` y la función CONCAT (concatenación). La explicación estaba bien escrita, pero pertenecía a una pregunta distinta sobre concatenación. `gpt-4o-mini` lo detectó (`explanation_ok=false`) hace meses; `claude-opus-4-5` lo dejó pasar como `perfect`.

**Por qué pasa:** sugiere bug en algún punto del pipeline de generación o importación masiva donde explicaciones se asignaron cruzadas (mismo lote, mismo tema técnico, distinta función concreta).

**Cómo detectar masivamente:** auditar preguntas técnicas donde palabras clave del enunciado **no aparecen** en la explicación (ej.: enunciado contiene "EXTRAE" pero explicación no menciona "EXTRAE"). Script sugerido:

```js
// preguntas con función mencionada en enunciado pero no en explicación
const keywords = ['EXTRAE','BUSCARV','CONCATENAR','SUMAR.SI','PROMEDIO','SI','HOY','AHORA','...'];
for (const kw of keywords) {
  const { data } = await s.from('questions')
    .select('id, question_text, explanation')
    .ilike('question_text', `%${kw}%`)
    .not('explanation', 'ilike', `%${kw}%`)
    .eq('is_active', true);
  console.log(`${kw}: ${data?.length || 0} sospechosas`);
}
```

## 7.5 Same-user clustering: red flag de fallo sistémico (post-14/04/2026)

**Regla:** si un mismo usuario (mismo `user_id`) abre **3+ impugnaciones** seguidas en poco tiempo, antes de tratarlas como casos independientes, buscar el **denominador común**. Casi siempre revela un fallo sistémico (de scope, de pipeline, de versión de programa, etc.) en lugar de N preguntas malas independientes.

**Caso motivador (14/04/2026):** Isabel Iglesias abrió 3 impugnaciones (`af869052`, `259780d8`, `70329edc`) en pocos días sobre 3 preguntas distintas. Tratadas individualmente parecían inconexas; en realidad las 3 tenían la misma raíz: artículos de la CE (art. 13, art. 103) que aparecían en topic_scopes equivocados (T2 Bloque I, T1 Bloque II) por error de configuración inicial. Un solo fix de scope cerró las 3.

**Cómo detectar:**

```js
const { data } = await s.from('question_disputes')
  .select('user_id, count(*)')
  .eq('status', 'pending')
  .group('user_id')
  .order('count', { ascending: false });
// Cualquier user_id con count >= 3 → investigar denominador común
```

**Qué buscar como denominador:** misma ley, mismo artículo, mismo topic, mismo bloque, misma oposición, mismo tipo de bug (scope, traducción, versión, errata).

## 7.6 Verificación de fuentes Microsoft Support (post-14/04/2026)

**Flujo obligatorio antes de incluir una URL `support.microsoft.com/es-es/...` en una explicación:**

1. **Buscar con WebSearch** restringido al dominio:
   ```
   WebSearch(query: "tema concreto Excel Word Outlook ...", allowed_domains: ["support.microsoft.com"])
   ```
2. **Tomar la URL más relevante** del resultado (suele ser la primera de Office o de la app concreta).
3. **Si la URL es `/en-us/`, sustituir por `/es-es/`** manteniendo el resto del slug y el ID hexadecimal final.
4. **Verificar con WebFetch** que la página existe en español y trata el tema:
   ```
   WebFetch(url: "...", prompt: "¿Existe esta página en español? ¿Trata sobre [tema]?")
   ```
5. **Solo si WebFetch confirma** que la página existe y aborda el tema → incluir como `Fuente:` al final de la explicación. Si devuelve 404 o el contenido no encaja, repetir desde paso 1 con otra búsqueda.

**Por qué:** las URLs de Microsoft Support cambian, los IDs caducan y la versión `es-es` no siempre existe para la misma URL `en-us`. Inventar o asumir URLs lleva a `Fuente:` rotas que dañan la confianza del usuario.

## 8. Columnas de `question_disputes`

| Columna | Descripción |
|---------|-------------|
| `id` | UUID de la impugnación |
| `question_id` | UUID de la pregunta |
| `user_id` | UUID del usuario |
| `dispute_type` | Tipo: `otro`, `no_literal`, `respuesta_incorrecta`, etc. |
| `description` | Descripción del usuario |
| `status` | `pending` / `resolved` / `rejected` / `appealed` |
| `admin_response` | Respuesta al usuario |
| `resolved_at` | Fecha de resolución |
| `source` | `user` (manual) / `ai_auto` (auto-detectada por IA del chat) |
| `ai_chat_log_id` | UUID del `ai_chat_logs` que generó la disputa (solo `ai_auto`) |

## 9. Flujo Completo

```
1. "mira si hay impugnaciones abiertas"
   ↓
2. "analiza la impugnación 1"
   ↓
3. "¿fue verificada? ¿por qué falló?"  ← DIAGNÓSTICO
   ↓
4. "busca el artículo correcto en nuestra BD"
   ↓
5. "corrige la pregunta pero no cierres la impugnación"
   ↓
6. "actualiza el registro AI"
   ↓
7. Re-verifica la pregunta contra el artículo correcto:
   - articleOk, answerOk, explanationOk
   - **Transiciona `lifecycle_state` a `approved`** (o `tech_approved`) vía endpoint
     `/api/admin/questions/lifecycle/transition` con `reasonCode: 'admin_marked_perfect'`
   - Eso reactiva la pregunta (is_active=true GENERATED). El UPDATE legacy a
     `topic_review_status` es opcional (compatibilidad), no controla visibilidad.
   ↓
8. Claude obtiene el NOMBRE del usuario (sección 11)
   ↓
9. Claude propone mensaje personalizado con nombre
   ↓
10. Usuario aprueba mensaje → Claude cierra la impugnación
```

## 10. Ejemplo Real #1: Impugnación Válida (Corregir)

**Impugnación:** "La explicación no se corresponde con la pregunta"

**Diagnóstico realizado:**
- `verified_at`: null (nunca verificada correctamente)
- AI verification existía pero con artículo incorrecto
- Modelo usado: Haiku (poco preciso para legal)
- AI concluyó erróneamente que respuesta C era correcta

**Problema encontrado:**
- Pregunta sobre Art. 16.8 (documentos en forma diferente)
- Explicación hablaba de Art. 6.6 (prórrogas de poderes)
- Artículo vinculado era incorrecto
- AI verificó contra artículo equivocado → conclusiones erróneas

**Correcciones:**
1. Nueva explicación basada en Art. 16.8
2. Vinculado artículo 16 de Ley 39/2015
3. Actualizado `ai_verification_results`
4. Cerrada con mensaje personalizado

**Mensaje enviado:**
```
Hola Nila,

Efectivamente, la explicación no correspondía con la pregunta.
Hablaba de "prórrogas de poderes con validez de 5 años" (Art. 6.6)
cuando la pregunta trata sobre documentos presentados en forma
diferente a su régimen especial.

Se ha corregido la explicación con el artículo correcto
(Art. 16.8 Ley 39/2015).

Gracias por el reporte. Mucho ánimo con la oposición!
```

---

## 10.1 Ejemplo Real #2: Falso Positivo (Rechazar)

**Impugnación auto-detectada:** "La respuesta B es incorrecta según Art. 67.1 CE"

**Pregunta:** "El cargo de Senador es compatible con el cargo de:"
- A) Diputado de las Cortes Generales
- B) Miembro de una Asamblea de CCAA ← Marcada correcta
- C) Miembro de una Junta Electoral
- D) Con ninguno de los anteriores

**Análisis de cada opción:**

| Opción | Fundamento Legal | ¿Correcta? |
|--------|------------------|------------|
| A | Art. 67.1: "Nadie podrá ser miembro de las dos Cámaras simultáneamente" | ❌ |
| B | Art. 67.1: prohíbe acumular Asamblea CCAA con **Diputado**, NO con Senador | ✅ |
| C | Art. 70.1.f: miembros de Juntas Electorales son inelegibles | ❌ |
| D | Falso, B sí es compatible | ❌ |

**Diagnóstico:**
- La IA auto-detectora leyó mal el Art. 67.1 CE
- El artículo dice "Diputado al Congreso", no "Senador"
- Verificación Opus 4.5 confirmó: "B correcta"
- La pregunta ES CORRECTA

**Problema de la explicación:**
- Solo transcribía los artículos sin explicar didácticamente
- No explicaba POR QUÉ cada opción era correcta/incorrecta

**Acciones:**
1. Rechazar impugnación (la pregunta es correcta)
2. Mejorar explicación didáctica (opcional pero recomendado)

**Explicación mejorada:**
```
La respuesta correcta es B) Miembro de una Asamblea de CCAA.

Según el artículo 67.1 CE: "Nadie podrá ser miembro de las dos
Cámaras simultáneamente, ni acumular el acta de una Asamblea de
Comunidad Autónoma con la de Diputado al Congreso."

A) INCORRECTA - Art. 67.1 prohíbe ser de ambas Cámaras.
B) CORRECTA - La prohibición solo afecta a Diputados, no Senadores.
C) INCORRECTA - Art. 70.1.f hace inelegibles a miembros de Juntas Electorales.
D) INCORRECTA - B sí es compatible.

La clave: el art. 67.1 dice "Diputado al Congreso", no "Senador".
```

**Mensaje de rechazo:**
```
Esta impugnación fue generada automáticamente por IA, pero tras
revisión manual se confirma que la pregunta es CORRECTA.

El Art. 67.1 CE prohíbe acumular Asamblea de CCAA con "Diputado
al Congreso", pero NO menciona a los Senadores. Por tanto, un
Senador SÍ puede ser miembro de una Asamblea de CCAA.

Se ha mejorado la explicación didáctica de la pregunta.
```

## 11. Obtener Nombre del Usuario

Para personalizar el mensaje, hay dos opciones:

### Opción 1: Desde `user_profiles` (recomendada)
```javascript
const { data: profile } = await supabase
  .from('user_profiles')
  .select('full_name, email')
  .eq('id', userId)
  .single();

const nombre = profile?.full_name?.split(' ')[0] || 'Usuario';
```

### Opción 2: Desde `auth.users` (requiere service role)
```javascript
const { data: { user } } = await supabase.auth.admin.getUserById(userId);
const nombre = user.user_metadata?.name || user.user_metadata?.full_name || 'Usuario';
```

**Nota:** La opción 2 requiere `SUPABASE_SERVICE_ROLE_KEY` para acceder a `auth.admin`.

## 12. Rechazar una Impugnación

A veces el usuario está equivocado y la pregunta es correcta. En ese caso:

```
rechaza la impugnación explicando por qué la pregunta es correcta
```

Claude actualizará:
```javascript
supabase
  .from('question_disputes')
  .update({
    status: 'rejected',
    admin_response: 'Hola [Nombre],\n\nHemos revisado tu impugnación...\n\n[Explicación de por qué la pregunta es correcta]\n\nGracias por tu interés en mejorar la plataforma.',
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

**Importante:** Siempre explicar con detalle por qué se rechaza, citando el artículo relevante.

> **Nota — cierre silencioso `resolved`:** el patrón de §12.1 (admin_response=null + is_read=true) **es válido también con `status='resolved'`** cuando hay una **regla operativa específica del admin** que lo justifique (p. ej. una memoria del tipo "para el usuario X siempre cierre silencioso"). NO es el flujo por defecto — solo aplicable a excepciones documentadas. El flujo normal sigue siendo el del §6 (con mensaje aprobado vía `/api/v2/dispute/resolve`).

### 12.1 Rechazo Silencioso (Impugnaciones Auto-Detectadas por IA)

Las impugnaciones auto-detectadas se identifican por `source = 'ai_auto'` (y tienen `[AUTO-DETECTADO POR IA]` en la descripción). No son de usuarios reales. Se rechazan **sin notificación**:

```javascript
supabase
  .from('question_disputes')
  .update({
    status: 'rejected',
    admin_response: null,   // → trigger dispara pero API NO envía email
    is_read: true,          // → NO aparece en la campana del usuario
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

**Por qué funciona:**
- `admin_response: null` → el endpoint `/api/send-dispute-email` comprueba `if (!dispute.admin_response?.trim())` y salta el envío
- `is_read: true` → el hook `useDisputeNotifications` filtra por `.eq('is_read', false)`, así que no aparece en la campana

**Flujo para impugnaciones auto-detectadas:**
1. Verificar si la IA tiene razón o es falso positivo
2. Si la pregunta es correcta → rechazar silenciosamente (este método)
3. Si la pregunta tiene error → corregirla y rechazar silenciosamente igualmente (el usuario no sabe que existe la impugnación)
4. Siempre mejorar la explicación si es pobre, independientemente del resultado

### 12.2 Precisión de la IA (Panel Admin)

El panel `/admin/impugnaciones` muestra métricas de precisión:
- **Filtro "Auto IA"** para ver solo disputas auto-creadas
- **Barra de precisión**: % de disputas aceptadas (IA acertó) vs rechazadas (IA erró)
- **Badge "Auto IA"** en cada tarjeta para identificarlas visualmente
- **Chat log vinculado**: si tiene `ai_chat_log_id`, se muestra el ID para revisar el razonamiento

Para consultar la precisión por SQL:
```sql
SELECT
  count(*) FILTER (WHERE status = 'resolved') AS aceptadas,
  count(*) FILTER (WHERE status = 'rejected') AS rechazadas,
  count(*) FILTER (WHERE status IN ('pending','reviewing')) AS pendientes,
  round(100.0 * count(*) FILTER (WHERE status = 'resolved')
    / NULLIF(count(*) FILTER (WHERE status IN ('resolved','rejected')), 0)) AS precision_pct
FROM question_disputes
WHERE source = 'ai_auto';
```

---

## 13. Consejos

- **CRÍTICO: Siempre pedir aprobación explícita** del mensaje antes de cerrar la impugnación. Mostrar el texto y esperar "sí" o "ok" del usuario.
- **CRÍTICO: Siempre obtener el nombre del usuario** antes de proponer el mensaje. Usar la consulta de la sección 11 para obtenerlo.
- **Siempre verificar** el artículo correcto en nuestra BD antes de corregir
- **No cerrar** la impugnación hasta aprobar el mensaje
- **Personalizar** el mensaje con el nombre del usuario (nunca "Hola," genérico)
- **Actualizar** `ai_verification_results` para que la verificación quede correcta
- **Transicionar `lifecycle_state`** vía `/api/admin/questions/lifecycle/transition` — **paso obligatorio** si la pregunta estaba oculta. Sin esto, la pregunta sigue invisible para el estudiante (post-03/05/2026, ver §5.2).
- **Opcional (compatibilidad legacy):** actualizar `verification_status`, `verified_at`, `topic_review_status`. No controlan visibilidad pero algunos readers todavía los leen.
- Si la pregunta **no tiene topic_id**, considerar asignarla al tema correcto

---

## 14. Gestión de Feedbacks (Chat de Soporte)

Los feedbacks de usuarios usan un sistema de **3 tablas** diferente a las impugnaciones:

### 14.1 Tablas del Sistema de Feedback

| Tabla | Uso |
|-------|-----|
| `user_feedback` | Feedback inicial del usuario (mensaje, status) |
| `feedback_conversations` | Conversación asociada (puede haber varias por feedback) |
| `feedback_messages` | Mensajes individuales de la conversación |

### 14.2 Ver Feedbacks Pendientes

```javascript
// Feedbacks que necesitan respuesta
const { data: feedbacks } = await supabase
  .from('user_feedback')
  .select('id, message, status, user_id, created_at')
  .in('status', ['pending', 'in_progress'])
  .order('created_at', { ascending: true });
```

### 14.3 Responder a un Feedback

**IMPORTANTE:** Para que el mensaje aparezca en el UI, hay que insertarlo en `feedback_messages`, NO en `user_feedback.admin_response`.

```javascript
// 1. Buscar la conversación del feedback
const { data: conv } = await supabase
  .from('feedback_conversations')
  .select('id')
  .eq('feedback_id', feedbackId)
  .single();

// 2. Obtener un sender_id de admin válido
const { data: adminMsg } = await supabase
  .from('feedback_messages')
  .select('sender_id')
  .eq('is_admin', true)
  .limit(1)
  .single();

// 3. Insertar el mensaje
await supabase
  .from('feedback_messages')
  .insert({
    conversation_id: conv.id,
    sender_id: adminMsg.sender_id,
    is_admin: true,
    message: 'Hola [Nombre],\n\n[Tu respuesta]\n\nEquipo de Vence'
  });
```

> **⚠️ OBSOLETO (pre-14/04/2026):** el fragmento anterior insertaba directamente en `feedback_messages` y confiaba en un trigger PG para email + campana. **Ese trigger fue eliminado.** Ahora hay que llamar al endpoint **`POST /api/v2/feedback/respond`** que hace INSERT msg + campana + email de forma atómica. Ver manual dedicado `docs/procedures/gestionar-feedback-bug.md` §10 con el patrón completo.

### 14.4 Cerrar un Feedback

**⚠️ IMPORTANTE:** NO cerrar la conversación manualmente. El sistema la cierra automáticamente si el usuario no responde en unos días.

Después de responder:
1. La conversación queda en `waiting_user`
2. Si el usuario responde, vuelve a aparecer como pendiente
3. Si no responde en X días, se cierra automáticamente

```javascript
// Solo actualizar el feedback si es necesario (opcional)
await supabase
  .from('user_feedback')
  .update({ status: 'resolved' })
  .eq('id', feedbackId);

// ❌ NO HACER: cerrar conversación manualmente
// await supabase
//   .from('feedback_conversations')
//   .update({ status: 'closed' })
//   .eq('feedback_id', feedbackId);
```

### 14.5 Corregir Fechas (si se alteraron)

Si el `updated_at` se actualizó y las conversaciones aparecen desordenadas:

```javascript
// Restaurar updated_at al valor original (created_at)
await supabase
  .from('user_feedback')
  .update({ updated_at: originalCreatedAt })
  .eq('id', feedbackId);
```

### 14.6 Estados de Conversación

| Estado | Significado |
|--------|-------------|
| `open` | Conversación activa |
| `waiting_user` | Admin respondió, esperando usuario |
| `closed` | Conversación cerrada |

### 14.7 El UI muestra "X por responder" cuando:

- La conversación NO está cerrada (`status != 'closed'`)
- Y el último mensaje NO es del admin (`is_admin = false`)
- O la conversación está vacía (sin mensajes)

### 14.8 Flujo Completo para Responder Feedback

```
1. "revisar si hay nuevas impugnaciones pendientes o feedback"
   ↓
2. Claude muestra feedbacks pendientes con resumen
   ↓
3. "investiga el feedback de [usuario]"
   ↓
4. Claude obtiene: user_id, mensaje, URL, user_agent (móvil/PC)
   ↓
5. Claude investiga eventos del usuario si es necesario
   ↓
6. Claude propone respuesta personalizada
   ↓
7. Usuario aprueba → Claude inserta en feedback_messages y cierra
```

### 14.9 Ejemplo Real: Usuario no puede guardar PDF

**Feedback recibido:**
```
Usuario: Osruben 7 (osruben75@gmail.com)
Plan: FREE
Mensaje: "Hola.como se guarda el PDF no me deja gracias"
URL: /tramitacion-procesal/temario/tema-6
User Agent: Android 10 / Chrome Mobile
```

**Investigación:**
- Usuario registrado hace 3 minutos (nuevo)
- Estaba en la página del temario
- Usa móvil Android

**Diagnóstico:**
- El PDF está disponible para usuarios FREE (no hay restricción)
- En móvil, `window.print()` abre diálogo del sistema
- Hay que elegir "Guardar como PDF" en vez de impresora

**Respuesta enviada:**
```
Hola Ruben,

Para guardar el PDF desde el móvil:
1. Pulsa el botón "Imprimir PDF"
2. En el diálogo que aparece, elige "Guardar como PDF" (en vez de una impresora)
3. Se descargará a tu carpeta de descargas

Un saludo,
Equipo de Vence
```

**Código ejecutado:**
```javascript
const conversationId = "97dc13f3-c103-4a01-8a35-81ef14b79949";
const adminId = "2fc60bc8-1f9a-42c8-9c60-845c00af4a1f"; // Admin que responde

// 1. Insertar mensaje en la conversación
await supabase
  .from("feedback_messages")
  .insert({
    conversation_id: conversationId,
    sender_id: adminId,
    is_admin: true,
    message: mensaje
  });

// 2. Actualizar timestamp de la conversación (NO cerrar)
await supabase
  .from("feedback_conversations")
  .update({
    status: "waiting_user",  // Esperando respuesta del usuario
    last_message_at: new Date().toISOString()
  })
  .eq("id", conversationId);

// ❌ NO cerrar manualmente - el sistema lo hace automáticamente
```

### 14.10 Cómo Investigar al Usuario

Para entender mejor el contexto del feedback:

```javascript
// 1. Datos del feedback
const { data: feedback } = await supabase
  .from("user_feedback")
  .select("*")
  .eq("id", feedbackId)
  .single();

// user_agent revela: móvil vs PC, navegador, sistema operativo
console.log("User Agent:", feedback.user_agent);
// Ej: "Mozilla/5.0 (Linux; Android 10; K)..." = Móvil Android

// 2. Perfil del usuario
const { data: profile } = await supabase
  .from("user_profiles")
  .select("full_name, email, plan_type, created_at, target_oposicion")
  .eq("id", feedback.user_id)
  .single();

// 3. Eventos recientes (si existen)
const { data: events } = await supabase
  .from("user_events")
  .select("event_type, page_url, created_at")
  .eq("user_id", feedback.user_id)
  .gte("created_at", fechaHoy)
  .order("created_at", { ascending: true });
```

### 14.11 Obtener Admin ID para Respuestas

El `sender_id` debe ser un admin válido. Para obtenerlo:

```javascript
// Buscar un admin que haya respondido antes
const { data: adminMsg } = await supabase
  .from("feedback_messages")
  .select("sender_id")
  .eq("is_admin", true)
  .limit(1)
  .single();

const adminId = adminMsg.sender_id;
// Resultado: "2fc60bc8-1f9a-42c8-9c60-845c00af4a1f" (Manuel)
```

---

## 15. Sistema de Notificaciones Automáticas

Las notificaciones (email + campana) al cerrar una impugnación o responder a un feedback ya **NO** dependen de triggers PostgreSQL llamando a HTTP. Tras el incidente del 14/04/2026 (ver §16) se migró a un patrón **in-process**: el endpoint admin que actualiza la BD también envía el email en el mismo flujo TypeScript.

### 15.1 Impugnaciones (legislativas + psicotécnicas) — POST-14/04/2026

**Endpoint:** `POST /api/v2/dispute/resolve`
**Función:** `resolveDispute()` en `lib/api/v2/dispute/queries.ts`
**Auth:** `requireAdmin` (Bearer token de admin)

**Flujo:**
1. Validación Zod del body (`resolveDisputeRequestSchema`).
2. Carga de la disputa con LEFT JOIN a `user_profiles` y `questions`/`psychometric_questions`.
3. Idempotencia: si `status` ya es `resolved`/`rejected` → 409.
4. UPDATE atómico de la disputa.
5. Llamada **directa** a `sendEmailV2(...)` (sin saltos HTTP, dentro del mismo contenedor Vercel del admin → sin cold start).
6. Respuesta tipada con `emailSent`, `emailId`, `emailError`, `emailSkipReason`.

**Trigger PG eliminado:** los triggers `trigger_send_dispute_email` y `trigger_send_psychometric_dispute_email`, junto con sus funciones, **se eliminaron** vía `database/migrations/2026-04-14-drop-dispute-email-triggers.sql`.

**Endpoints HTTP legacy:** `/api/send-dispute-email` y `/api/send-dispute-email/psychometric` se mantienen temporalmente por compatibilidad pero ya no son llamados por nada interno. Pueden eliminarse en commit posterior si nada externo los necesita.

**Por qué se eliminaron los triggers (resumen):** ver §16.

### 15.2 Feedbacks (post-14/04/2026) — POST `/api/v2/feedback/respond`

**Endpoint:** `POST /api/v2/feedback/respond`
**Función:** `respondFeedback()` en `lib/api/v2/feedback/queries.ts`
**Auth:** `requireAdmin` (Bearer token).

**Flujo:**
1. Valida body con Zod (`respondFeedbackRequestSchema`).
2. Carga feedback + conversation + usuario con LEFT JOIN.
3. En una transacción Drizzle: INSERT `feedback_messages` + INSERT `notification_logs` (campana) + UPDATE `feedback_conversations` + UPDATE `user_feedback` (status final).
4. Fuera de la TX (para no rollback por Resend caído): llama a `sendEmailV2` si el mensaje no está vacío, respetando `isUserActivelyBrowsing` + preferencias del usuario.
5. Devuelve respuesta tipada con `messageId`, `bellSent`, `emailSent`, `emailError`, `emailSkipReason`, `bellSkipReason`, `finalStatus`.

**Trigger PG eliminado:** `trigger_send_feedback_notification` y su función se eliminaron vía `database/migrations/2026-04-14-drop-feedback-trigger.sql`. Razón: mismo bug de cold-start que tenían los triggers de impugnaciones.

**Semántica decidida:** admin reply = feedback `'resolved'`. Si el usuario responde, `/api/feedback/message` lo reabre a `'pending'`.

**Manual detallado:** `docs/procedures/gestionar-feedback-bug.md` §10.

### 15.3 Arquitectura (post-14/04/2026)

```
┌─────────────────────────────────────────────────────────────┐
│ Admin UI /admin/impugnaciones   /admin/feedback             │
│ Scripts Claude                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch + Bearer admin
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Endpoint v2 (requireAdmin + Zod + withErrorLogging)         │
│  - POST /api/v2/dispute/resolve     (impugnaciones)         │
│  - POST /api/v2/feedback/respond    (feedbacks)             │
└──────────────────────────┬──────────────────────────────────┘
                           │ resolveDispute() / respondFeedback()
                           │ (in-process, Drizzle TX)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ - UPDATE / INSERT en BD (Drizzle)                           │
│ - sendEmailV2() directo (misma función JavaScript)          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Resend (email) + email_events (logs éxito/fallo)            │
└─────────────────────────────────────────────────────────────┘
```

**No hay triggers PG intermedios. Cero HTTP calls internos. Cero cold-start posible.**

### 15.4 Dependencia: Extensión `http`

Los triggers usan la extensión PostgreSQL `http` para hacer llamadas HTTP. Esta extensión debe estar habilitada en Supabase:

```sql
-- Verificar que la extensión está habilitada
SELECT * FROM pg_extension WHERE extname = 'http';
```

### 15.5 Verificar que los Triggers Existen

```sql
-- Listar triggers en question_disputes (legislativas)
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'question_disputes';

-- Listar triggers en psychometric_question_disputes (psicotécnicas)
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'psychometric_question_disputes';

-- Listar triggers en feedback_messages
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'feedback_messages';
```

### 15.6 URL Base de los Triggers

Los triggers usan `current_setting('app.base_url', true)` con fallback a `https://www.vence.es`. Si se necesita cambiar la URL (ej: staging):

```sql
-- Cambiar URL base (solo para la sesión actual)
SET app.base_url = 'https://staging.vence.es';
```

### 15.7 Debugging del flujo nuevo (post-14/04/2026)

Si un email no se envía:

1. **Comprobar la respuesta del endpoint:** `result.emailSent`, `result.emailError`, `result.emailSkipReason`.
2. **Si `emailSkipReason === 'empty_response'`:** el adminResponse iba vacío → comportamiento esperado.
3. **Si `emailSkipReason === 'no_user_email'`:** el usuario no tiene email en `user_profiles` → arreglar a mano.
4. **Si `emailSkipReason === 'user_preferences'`:** el usuario optó por no recibir email de soporte → respetar.
5. **Si `emailError` está set:** error real de Resend o sendEmailV2. Mirar `email_events` por `event_type='failed'` y reintentar manualmente vía endpoint admin.
6. **Reintento manual:** llamar de nuevo al endpoint `/api/v2/dispute/resolve`. Como la disputa ya estará `resolved`/`rejected`, devolverá 409 — para reintentar **solo el email** habrá que añadir un endpoint específico (pendiente Fase 5).

### 15.8 Histórico: trigger de feedbacks (eliminado 14/04/2026)

El trigger `trigger_send_feedback_notification` (AFTER INSERT en `feedback_messages`) tenía el mismo problema de cold-start que los de impugnaciones. Se eliminó el mismo día y se sustituyó por el flujo in-process `respondFeedback()` / `POST /api/v2/feedback/respond` descrito en §15.2.

Migración documentada en §16 y en `docs/procedures/gestionar-feedback-bug.md`.

---

## 16. Incidente 14/04/2026 — Cold-start de triggers PG y migración a in-process

**Resumen:** los triggers PG `send_dispute_email_notification` y `send_psychometric_dispute_email_notification` fallaban en silencio cuando el endpoint Vercel correspondiente estaba frío. Diagnosticado tras detectar 6 impugnaciones psicotécnicas resueltas el 14/04/2026 cuyo email **nunca llegó al usuario**.

**Hipótesis confirmada empíricamente:**
- Test controlado: insert + UPDATE de una dispute psicotécnica de prueba → el `UPDATE` tardó 3,8 segundos.
- Esos 3,8s son consistentes con un **timeout de la extensión `http`** (default 5s) esperando respuesta de Vercel.
- Endpoints "activos" (legislativa, llamada >10x/día) → contenedor Vercel caliente → respuesta <500ms → trigger funciona "por suerte".
- Endpoints "rara vez llamados" (psicotécnica, ≤1x/día) → cold start de Vercel >5s → `http_post` da timeout → la función PG captura excepción con `EXCEPTION WHEN OTHERS` y solo emite `RAISE WARNING` que no es visible desde Supabase Dashboard.

**Por qué se descartaron alternativas:**

| Alternativa | Por qué no |
|---|---|
| Migrar trigger a `pg_net` (async) | Sigue acoplando BD a HTTP. No corrige la causa raíz. Mejor que `http`, pero no necesario para nuestro volumen. |
| Outbox pattern (cola en BD + cron worker) | Robusto pero overkill para 20 emails/semana. Cron requiere GitHub Actions cada 2 min → emails llegan en ráfagas, mala UX. |
| Inngest / QStash externos | Añade dependencia externa. No queríamos. |
| Database Webhooks de Supabase | Mismo problema de cold-start (llama HTTP). Configuración fuera del repo (no versionable). |

**Decisión adoptada:** **`resolveDispute()` in-process**. El admin (UI o script) llama al endpoint `/api/v2/dispute/resolve` que está dentro del mismo contenedor Vercel ya caliente sirviendo al admin. La función:
1. Hace UPDATE en BD.
2. Llama directamente a `sendEmailV2(...)` (función JavaScript, no HTTP) → sin cold start posible.
3. Devuelve resultado tipado.

Sin colas, sin crons, sin dependencias externas, sin tablas nuevas. ~80 líneas de código.

**Fases del rollout (impugnaciones):**
1. ✅ Función `resolveDispute()` + endpoint + tests (commit `1f9f4559`).
2. ✅ Refactor de `/api/v2/admin/disputes` POST para usar el nuevo endpoint internamente (commit `68a08dfc`).
3. ✅ Migration SQL aplicada en Supabase: triggers `trigger_send_dispute_email` y `trigger_send_psychometric_dispute_email` eliminados.
4. ✅ Endpoints legacy `/api/send-dispute-email` y `/api/send-dispute-email/psychometric` eliminados (commit `3774509e`).
5. ✅ Manual actualizado (§6, §15, §16).
6. ✅ E2E en producción confirmado (15/15 tests).

**Fases del rollout (feedback — misma fecha 14/04/2026):**
1. ✅ Función `respondFeedback()` + endpoint `/api/v2/feedback/respond` + 32 tests unit + 10 E2E.
2. ✅ Auth Bearer admin en `/api/send-support-email` (el legacy, antes público).
3. ✅ Admin UI `/admin/feedback` refactorizado: los 3 flujos (sendAdminMessage, sendInlineMessage, createAdminConversation) delegan en el endpoint v2.
4. ✅ Migration SQL aplicada: trigger `trigger_send_feedback_notification` eliminado.
5. ✅ Endpoint `/api/admin/feedback/message` eliminado (action='send_message' huérfana) + limpieza de `adminSendMessage()` / `createConversation()`.
6. ✅ Manual `docs/procedures/gestionar-feedback-bug.md` §10 actualizado.

**Lección general:** triggers PG llamando a HTTP desde Postgres son frágiles ante cold-starts de stack serverless. Cuando el productor del UPDATE es siempre código de la app (no jobs externos), preferir flujo in-process síncrono. Este patrón se aplicó a todos los flujos de notificación internos del 14/04/2026 (impugnaciones legislativas + psicotécnicas + feedback). Si aparecen nuevos casos similares, usar el mismo refactor.
