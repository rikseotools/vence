# Roadmap: Lifecycle robusto de preguntas (state machine + audit completo)

**Estado:** Diseño aprobado, pendiente de implementación
**Fecha:** 2026-05-03 (reemplaza versión anterior del mismo día)
**Prioridad:** Alta — bug confirmado en producción

## 1. Problema (datos reales 2026-05-03)

Auditoría sobre `questions` (102.230 filas):

**State drift severo.** `topic_review_status` es `text` libre y existen **31 valores distintos** vs 13 documentados. Hay siete formas de decir "está bien" (`verified` 20.061, `tech_perfect` 20.477, `perfect` 4.445, `reviewed` 2.022, `verificado` 141, `verified_ok` 23, `approved` 5, `ai_verified` 2) y estados huérfanos no documentados (`flagged`, `bad_article`, `bad_options`, `defective`, `ambiguous`, `out_of_scope`, `rejected`, `outdated`, `tech_pending_adaptation`, `unverifiable`, `wrong_answer`, `explanation_error`).

**`is_active` y `topic_review_status` desincronizados** — el sistema "auto-desactivar al detectar error" falla:

| Caso | Filas | Significado |
|------|-------|-------------|
| ACTIVE + `bad_explanation` | 7 | Explicación rota servida a estudiantes |
| ACTIVE + `wrong_article_bad_answer` | 3 | Respuesta incorrecta servida a estudiantes |
| ACTIVE + `tech_bad_explanation` | 18 | Explicación rota (informática) servida |
| DEACTIVATED + `perfect` | 1.193 | Marcadas perfectas pero ocultas (probable: desactivadas por imagen/duplicado y verificación posterior las "ascendió") |
| DEACTIVATED sin `deactivation_reason` | 1.134 | Off sin saber por qué |
| ACTIVE + `verified_at IS NULL` | **42.575** | 41% del catálogo expuesto a estudiantes sin pasar QA |

**Cajón desactivado mezcla 4 categorías distintas:**
- ~23.736 pendientes nunca revisadas (razón: "Pendiente de revisión post-importación")
- ~2.100 irrecuperables (duplicadas, derogadas, imagen no disponible)
- ~400 recuperables con fix IA sugerido (`bad_*`)
- ~70 estructurales reparables (opciones vacías, art placeholder)
- 1.134 huérfanas sin razón

**`deactivation_reason` es texto libre con typos** ("Respuesta y explicación incorrectas\n  (informática)" con `\n` y espacios extra — 23 filas — vs sin — 29 filas). Sin taxonomía machine-readable.

## 2. Modelo mental objetivo

Una pregunta es **visible a estudiantes ⇔ está perfecta y verificada**. El resto está en uno de estos cuatro lugares:
1. Esperando revisión (recién importada, nunca tocada).
2. Esperando reparación tras detectarse un problema recuperable.
3. Esperando decisión humana (problema que la IA no puede resolver sola).
4. Jubilada explícitamente (irrecuperable o duplicada de otra mejor).

No hay "cajón desastre". Cada pregunta tiene un estado tipado, una razón machine-readable, y una biografía completa de transiciones.

## 3. Diseño

### 3.1 State machine: 8 estados

| Estado | `is_active` derivado | Significado | Transiciones de salida legales |
|--------|----------------------|-------------|-------------------------------|
| `draft` | false | Recién importada, sin verificar | needs_review, needs_human, approved, tech_approved, quarantine, retired_* |
| `needs_review` | false | IA detectó problema recuperable + sugiere fix | approved, tech_approved, needs_human, retired_* |
| `needs_human` | false | Requiere decisión humana (artículo fuera de scope, ambiguous, IA sin respuesta clara) | approved, tech_approved, needs_review, retired_* |
| `quarantine` | false | Estructural roto (opciones vacías, correct_option fuera de rango) | draft, retired_irreparable |
| **`approved`** | **true** | Verificada `perfect` para ley normal | needs_review, needs_human, retired_* |
| **`tech_approved`** | **true** | Verificada `tech_perfect` para ley virtual/técnica | needs_review, needs_human, retired_* |
| `retired_duplicate` | false | Duplicada de otra mejor — **terminal** | (ninguna) |
| `retired_irreparable` | false | Imagen perdida, derogada, anulada — **terminal** | (ninguna) |

`retired_*` son **terminales**: la función SQL de transición rechaza cualquier salida. Si una "retired" resulta ser recuperable, hay que crear una pregunta nueva (con FK a la jubilada como referencia).

### 3.2 Schema

**Sobre `questions`** — UNA columna nueva (no cinco):

```sql
ALTER TABLE questions ADD COLUMN lifecycle_state text NOT NULL DEFAULT 'draft'
  CHECK (lifecycle_state IN (
    'draft','needs_review','needs_human','quarantine',
    'approved','tech_approved','retired_duplicate','retired_irreparable'
  ));

CREATE INDEX idx_questions_lifecycle_state ON questions (lifecycle_state);
CREATE INDEX idx_questions_lifecycle_visible
  ON questions (lifecycle_state) WHERE lifecycle_state IN ('approved','tech_approved');
```

`is_active` se mantiene durante toda la migración como `bool` normal. En **fase E** se vuelve `GENERATED`:

```sql
-- Fase E (la peligrosa, requiere auditoría completa de escritores antes)
ALTER TABLE questions DROP COLUMN is_active;
ALTER TABLE questions ADD COLUMN is_active bool
  GENERATED ALWAYS AS (lifecycle_state IN ('approved','tech_approved')) STORED;
```

**Tabla nueva `question_lifecycle_history`** (append-only, fuente única de verdad para audit):

```sql
CREATE TABLE question_lifecycle_history (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id          uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  from_state           text,                                -- NULL solo en la primera fila (creación)
  to_state             text NOT NULL CHECK (to_state IN (
                          'draft','needs_review','needs_human','quarantine',
                          'approved','tech_approved','retired_duplicate','retired_irreparable')),
  reason_code          text NOT NULL,                       -- machine-readable, taxonomía cerrada (ver §3.4)
  changed_at           timestamptz NOT NULL DEFAULT now(),
  changed_by           uuid,                                -- NULL = sistema (cron, IA, backfill)
  ai_verification_id   uuid REFERENCES ai_verification_results(id),
  notes                text                                 -- libre, solo display
);

CREATE INDEX idx_qlh_question_id ON question_lifecycle_history (question_id, changed_at DESC);
CREATE INDEX idx_qlh_changed_at ON question_lifecycle_history (changed_at DESC);
CREATE INDEX idx_qlh_to_state ON question_lifecycle_history (to_state);
```

**Columnas legacy** (`topic_review_status`, `verification_status`, `deactivation_reason`): se mantienen sin tocar durante A-E. Se eliminan o renombran a `*_legacy` en fase F.

### 3.3 Triple bloqueo anti-bypass

Sin estos tres mecanismos, el audit history tiene agujeros y el state machine es solo "convención". **Los tres son obligatorios:**

```sql
-- 1) REVOKE escritura directa sobre lifecycle_state
REVOKE UPDATE (lifecycle_state) ON questions FROM authenticated, service_role;
GRANT UPDATE (lifecycle_state) ON questions TO postgres;  -- solo superuser

-- 2) Función SECURITY DEFINER única vía de transición legítima
CREATE OR REPLACE FUNCTION transition_question_state(
  p_question_id        uuid,
  p_expected_state     text,                  -- check optimista anti-race
  p_new_state          text,
  p_reason_code        text,                  -- obligatorio
  p_changed_by         uuid DEFAULT NULL,
  p_ai_verification_id uuid DEFAULT NULL,
  p_notes              text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current text;
BEGIN
  -- Marker para que el trigger fallback sepa que esta transición es legítima
  -- (transaction-local: 3er argumento `true` lo limita a la transacción actual)
  PERFORM set_config('app.lifecycle_via_function', 'true', true);

  -- Lock + read current state
  SELECT lifecycle_state INTO v_current
  FROM questions WHERE id = p_question_id FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Question % not found', p_question_id;
  END IF;

  -- Optimistic check
  IF v_current <> p_expected_state THEN
    RAISE EXCEPTION 'State mismatch: expected %, got %', p_expected_state, v_current;
  END IF;

  -- No-op detection (mismo estado): rechazar para no contaminar history
  IF v_current = p_new_state THEN
    RAISE EXCEPTION 'Same-state transition rejected: % -> %', v_current, p_new_state;
  END IF;

  -- Validate transition is legal (terminal states reject all out-transitions)
  IF v_current IN ('retired_duplicate','retired_irreparable') THEN
    RAISE EXCEPTION 'Cannot transition from terminal state %', v_current;
  END IF;

  -- (further transition rules from §3.1 enforced here)

  -- Update + history insert in same transaction
  UPDATE questions SET lifecycle_state = p_new_state WHERE id = p_question_id;

  INSERT INTO question_lifecycle_history
    (question_id, from_state, to_state, reason_code, changed_by, ai_verification_id, notes)
  VALUES
    (p_question_id, v_current, p_new_state, p_reason_code, p_changed_by, p_ai_verification_id, p_notes);
END;
$$;

-- 3) Trigger AFTER UPDATE como red de seguridad (por si superuser bypassa la función)
-- Detecta bypass leyendo session variable `app.lifecycle_via_function`:
--   - Si la transición vino vía función → la variable es 'true' → no hace nada
--   - Si la transición vino de UPDATE directo → la variable no está → log bypass
CREATE OR REPLACE FUNCTION log_lifecycle_change_fallback() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.lifecycle_state IS DISTINCT FROM NEW.lifecycle_state THEN
    IF current_setting('app.lifecycle_via_function', true) <> 'true' THEN
      INSERT INTO question_lifecycle_history
        (question_id, from_state, to_state, reason_code, notes)
      VALUES (NEW.id, OLD.lifecycle_state, NEW.lifecycle_state, 'bypass_detected',
              'WARNING: lifecycle_state changed without transition_question_state() — investigate');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_questions_lifecycle_audit_fallback
AFTER UPDATE OF lifecycle_state ON questions
FOR EACH ROW EXECUTE FUNCTION log_lifecycle_change_fallback();

-- 4) Trigger AFTER INSERT para capturar la creación inicial
CREATE OR REPLACE FUNCTION log_lifecycle_initial() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO question_lifecycle_history
    (question_id, from_state, to_state, reason_code, notes)
  VALUES (NEW.id, NULL, NEW.lifecycle_state, 'created', 'Initial state on insert');
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_questions_lifecycle_audit_insert
AFTER INSERT ON questions
FOR EACH ROW EXECUTE FUNCTION log_lifecycle_initial();
```

Garantía resultante: **toda fila de `questions` tiene al menos 1 entrada en history (creación), y todo cambio de estado está auditado.** Si alguien con permisos de superuser bypassa la función, el trigger fallback deja rastro con `reason_code='bypass_detected'` para detección.

### 3.4 Taxonomía de `reason_code`

Vive en `lib/constants/lifecycleReasons.ts`. Cerrada, extensible solo añadiendo strings (sin migración):

| Código | Cuándo se emite | Estado destino típico |
|--------|-----------------|----------------------|
| `created` | Trigger AFTER INSERT | (estado inicial) |
| `imported_unreviewed` | Importación scrapping/oficial | draft |
| `ai_verified_perfect` | IA: articleOk+answerOk+explanationOk | approved |
| `ai_verified_tech_perfect` | IA: answerOk+explanationOk en ley virtual | tech_approved |
| `ai_detected_bad_explanation` | IA: explanationOk=false (recuperable) | needs_review |
| `ai_detected_bad_answer` | IA: answerOk=false (recuperable) | needs_review |
| `ai_detected_wrong_article` | IA: articleOk=false (necesita humano) | needs_human |
| `ai_detected_all_wrong` | IA: 3 booleans=false | needs_human |
| `structural_invalid` | Validación: opciones vacías, correct_option fuera de rango | quarantine |
| `admin_marked_perfect` | Admin click "Perfect" en panel | approved |
| `admin_marked_problem` | Admin click "Tiene problema" | needs_human |
| `admin_image_unavailable` | Admin: imagen no disponible | retired_irreparable |
| `admin_duplicate_of` | Admin marca duplicada (ver `notes` para FK) | retired_duplicate |
| `admin_law_derogated` | Ley derogada | retired_irreparable |
| `admin_exam_annulled` | Pregunta anulada en examen oficial | retired_irreparable |
| `auto_fix_applied` | Pipeline batch-fix aplicó `explanation_fix` | approved/tech_approved |
| `cron_legacy_grandfather_expired` | Cron 90d: legacy approved sin verificar → degradar | draft |
| `backfill_2026_05` | Migración inicial | (cualquiera) |
| `bypass_detected` | Trigger fallback detectó UPDATE directo | (cualquiera) |

## 4. Plan de migración (6 fases, cada una reversible <5 min)

| Fase | Cambio | Riesgo | Reversión |
|------|--------|--------|-----------|
| **A. Schema aditivo** | ADD COLUMN `lifecycle_state` text **nullable** (sin default — debe quedar NULL hasta backfill), CHECK que acepta 8 valores OR NULL, CREATE TABLE history, CREATE FUNCTION transition. **Sin triggers, sin REVOKE todavía** (irían en C). NO toca `is_active` | nulo | DROP additions |
| **B. Backfill + tighten** | UPDATE 102k filas mapeando 31 valores → 8 estados (reglas §5). Seed inicial de history (~102k filas, `reason_code='backfill_2026_05'`). Al final: ALTER lifecycle_state SET NOT NULL, SET DEFAULT 'draft', tighten CHECK para rechazar NULL. `is_active` no cambia | bajo (en transacción) | UPDATE inverso |
| **C. Endpoint + enforcement** | `lib/constants/lifecycleReasons.ts`. `/api/admin/questions/lifecycle/transition` (wrapper de función SQL). CREATE TRIGGER AFTER INSERT (auto-log creación). CREATE TRIGGER AFTER UPDATE OF lifecycle_state (fallback bypass detection vía session variable). REVOKE UPDATE(lifecycle_state) FROM authenticated, anon. Triggers solo aquí — ya no se dispararán en backfill (que ocurrió en B) | nulo | borrar archivo + DROP triggers + GRANT atrás |
| **D. Migrar escritores** | `verify/route.js` y `updateQuestionStatus()` reescritos para llamar a `transition_question_state()`. Constants en `lib/constants/lifecycleReasons.ts`. Manuales actualizados | medio (4-12 sitios) | revert commit |
| **E. Generated `is_active`** | Auditoría exhaustiva de escritores → DROP+ADD `is_active GENERATED`. Garantía de invariante. **Bloqueo: cualquier escritor a `is_active` no migrado romperá producción** | **alto** | restaurar columna bool desde history |
| **F. Limpieza** | DROP/rename `topic_review_status`→`_legacy`, `verification_status`→`_legacy`, `deactivation_reason`→`_legacy`. Actualizar `db/schema.ts`. Manuales finales + CLAUDE.md | bajo | renombrar atrás |

**Pre-condición de fase E (no-negociable):**
1. `grep -rn "is_active\s*[:=]\s*\(true\|false\)" --include='*.{ts,tsx,js,jsx,cjs,mjs}'` debe dar resultado vacío en código de runtime.
2. Dry-run en BD de staging con la suite Jest completa pasando.
3. Smoke test manual de las rutas críticas: import script, verify endpoint, admin update-status, fetcher de tests.

## 5. Reglas de backfill (31 valores → 8 estados)

```
SI is_active=true Y topic_review_status IN
   ('perfect','verified','verificado','verified_ok','reviewed','approved','ai_verified')
   → approved

SI is_active=true Y topic_review_status='tech_perfect'
   → tech_approved

SI is_active=true Y topic_review_status IN ('pending', NULL)
   → ver §6 decisión #1 (legacy_grandfather)

SI is_active=true Y topic_review_status IN ('bad_*', 'tech_bad_*', 'wrong_*', 'all_wrong')
   → needs_review (LOG: estaba activa indebidamente, son los 28 casos detectados)

SI is_active=false Y topic_review_status IN ('perfect','tech_perfect','verified','verificado','verified_ok','reviewed','approved','ai_verified')
   → ver §6 decisión #2 (perfectas-pero-desactivadas)

SI is_active=false Y deactivation_reason ~* 'duplicad|duplicate'
   → retired_duplicate

SI is_active=false Y deactivation_reason ~* 'imagen|figura|derogad|anulad|obsoleta|outdated'
   → retired_irreparable

SI is_active=false Y deactivation_reason ~* 'pendiente.*revisi.n.*post-importaci.n'
   → draft

SI is_active=false Y topic_review_status IN ('bad_explanation','bad_answer','bad_answer_and_explanation','tech_bad_*','wrong_answer','explanation_error')
   → needs_review

SI is_active=false Y topic_review_status IN ('wrong_article','wrong_article_bad_*','all_wrong','bad_article','out_of_scope','ambiguous','unverifiable','flagged','needs_review','defective')
   → needs_human

SI is_active=false Y topic_review_status IN ('invalid_structure','bad_options')
   → quarantine

SI is_active=false Y topic_review_status IN ('rejected','tech_pending_adaptation')
   → retired_irreparable

SI is_active=false Y deactivation_reason IS NULL Y topic_review_status IS NULL
   → ver §6 decisión #3 (huérfanas 1.134)
```

Cada fila del backfill inserta una entrada en history con `reason_code='backfill_2026_05'`, `from_state=NULL`, `to_state=<resultado>`, `notes='legacy: trs=<old>, da=<old_da>, was_active=<bool>'`.

## 6. Decisiones críticas (estado de aprobación)

### Decisión #1 — Las 42.575 activas-nunca-verificadas ✅ DECIDIDO: opción (b)

**Backfill como `approved` + cron 90d degrada a `draft` las que sigan sin verificar.**

Implementación del cron:
```sql
UPDATE questions
SET lifecycle_state = 'draft'  -- vía función transition_question_state, no UPDATE directo
WHERE lifecycle_state = 'approved'
  AND verified_at IS NULL
  AND created_at < NOW() - interval '90 days';
-- reason_code: 'cron_legacy_grandfather_expired'
```

Trade-off aceptado: durante 90 días estas preguntas siguen visibles sin haber pasado QA. Plazo deliberado para verificar en lote. La cron arranca tras fase B.

### Decisión #2 — Las 1.193 desactivadas-pero-`perfect`/`tech_perfect` ✅ DECIDIDO

**Principio:** una pregunta desactivada NO se reactiva automáticamente desde un script de backfill. Si está off, hay una razón (aunque no la conozcamos del todo). Pasar de `is_active=false` a `is_active=true` (vía `approved`) requiere intervención humana explícita.

| Sub-caso (`deactivation_reason`) | Mapeo | Razón |
|-----|-------|-------|
| Menciona imagen, duplicado, derogado, anulado, obsoleta | `retired_*` correspondiente | Razón conocida y permanente — se quedan jubiladas |
| NULL, vacío o no encaja con causas de retirada | `needs_human` | Estaban off por razón desconocida. Antes de volver a mostrarlas, un humano debe entender por qué se desactivaron. `needs_human` es el estado correcto: "ya verificada por IA pero estado actual ambiguo" |

No se usa `draft` porque estas filas ya tienen `verified_at` ≠ NULL. `draft` es para "recién importada, jamás tocada". `needs_human` cuadra con "ya revisada pero requiere decisión humana ahora".

### Decisión #3 — Las 1.134 huérfanas (deact + sin reason + sin status) ✅ DECIDIDO: opción (b)

**Backfill como `draft`.** Quedan deactivated (no auto-reactivan), vuelven al cajón de pendientes, normal flow las recupera si son válidas. Solo una verificación IA con resultado perfect las moverá a `approved` (vía función de transición, no backfill).

### Decisión #4 — `psychometric_questions` (tabla aparte) ✅ DECIDIDO: opción (b)

**Fuera de scope para esta migración.** `psychometric_questions` no tiene `topic_review_status` ni los 31 valores de drift, ni los bugs de desync activa-con-error. Su modelo actual (`is_active` + `is_verified` + `deactivation_reason`) es más simple y no presenta los bugs que motivan este roadmap. Migración futura como deuda explícita en memoria del proyecto.

## 7. Archivos a crear/modificar

| Archivo | Cambio | Fase |
|---------|--------|------|
| `supabase/migrations/2026XXXX_lifecycle_phase_a_schema.sql` | Crear | A |
| `supabase/migrations/2026XXXX_lifecycle_phase_b_backfill.sql` | Crear | B |
| `supabase/migrations/2026XXXX_lifecycle_phase_e_generated_active.sql` | Crear | E |
| `supabase/migrations/2026XXXX_lifecycle_phase_f_drop_legacy.sql` | Crear | F |
| `lib/constants/lifecycleReasons.ts` | Crear (taxonomía + helpers) | C |
| `app/api/admin/questions/lifecycle/transition/route.ts` | Crear (wrapper de función SQL) | C |
| `app/api/topic-review/verify/route.js` | Migrar bloque `is_active`/`topic_review_status` → llamar a transition | D |
| `lib/api/topic-review/queries.ts` (`updateQuestionStatus`) | Migrar idem | D |
| `db/schema.ts` | Regenerar tras fase A y E | A, E |
| `components/Admin/TopicReviewTab.tsx` | Adaptar badges + filtros a 8 estados | D |
| `app/admin/revision-temas/[topicId]/page.js` | Idem | D |
| Scripts de import (12 archivos) | Eliminar `is_active: true/false` (queda `lifecycle_state` por default) | D |
| `__tests__/**` (~30 archivos) | Actualizar mocks | D |

## 8. Manuales a actualizar (con cada fase)

| Manual | Cambio | Fase |
|--------|--------|------|
| `docs/maintenance/revisar-temas-con-agente.md` | §3 (mapeo 12 estados → 8 lifecycle), §11 (lifecycle, no auto-deactivation) | D |
| `docs/maintenance/preguntas-con-problemas.md` | Reescribir queries SQL con `lifecycle_state` | D |
| `docs/maintenance/importar-preguntas-scrapeadas.md` | "insertar con `lifecycle_state='draft'`" | D |
| `CLAUDE.md` | Sección breve sobre lifecycle | F |
| `docs/database/tablas.md` | Schema actualizado | F |

## 9. Test plan

- **Unit**: función SQL `transition_question_state` rechaza transiciones ilegales, terminales, races.
- **Integration**: cada endpoint que escribe pasa por la función. Imposible bypass.
- **Smoke pre-fase-E**: simular en staging que un escritor obsoleto a `is_active` rompe (`ERROR: cannot insert into column`). Si pasa, audit incompleta.
- **Backfill verification**: `SELECT lifecycle_state, COUNT(*) FROM questions GROUP BY 1` debe sumar 102.230 sin NULLs y sin valores fuera del enum.
- **Audit completeness**: `SELECT q.id FROM questions q LEFT JOIN question_lifecycle_history h ON h.question_id=q.id WHERE h.id IS NULL` debe dar vacío tras backfill.

## 10. Principios

- **Una fuente de verdad por dato**: estado actual en `questions.lifecycle_state`, biografía en `question_lifecycle_history`. Sin denormalización.
- **Invariantes en BD, no en app**: CHECK constraint, función SECURITY DEFINER, generated column, triggers. La app no puede violarlas.
- **Aditivo siempre que sea posible**: solo fase E es destructiva, y va precedida de auditoría obligatoria.
- **Reversible <5 min por fase**: cada fase tiene plan de rollback documentado.
- **Visibilidad derivada del estado**: nunca seteable directamente. Imposible que `is_active` y `lifecycle_state` se desincronicen tras fase E.
