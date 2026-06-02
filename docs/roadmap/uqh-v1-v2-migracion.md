# Roadmap: Migración UQH v1 → v2 (eliminar `user_question_history` duplicada)

> ✅ **MIGRACIÓN COMPLETA 2026-06-02.** v1 (`user_question_history`, 816.552 filas) eliminada de la BD (triggers + funciones + tabla). v2 (`user_question_history_v2`) es ya la única tabla de historial, alimentada por outbox→handler Fargate. Export Drizzle `userQuestionHistory` + tipos derivados eliminados del código. Ver §Fase 4.

> Estado a 2026-06-01. Origen: el cutover outbox (commit `df76c84c`, 30/05 08:28 UTC) desactivó los triggers que escribían `user_question_history` (v1). El handler Fargate (vía outbox) escribe solo `user_question_history_v2`. v1 quedó congelada → se añadió un **bridge temporal** que la mantiene al día mientras se migran los lectores.

## Arquitectura actual

- **Escritura:** `test_questions` INSERT → trigger `tg_test_questions_emit_outbox` (enabled) → outbox → handler Fargate `UserQuestionHistoryV2Handler` → **v2**.
- **v1 ← v2:** `backend/src/sync-uqh-v1-bridge` (cron, registrado en `app.module.ts`) sincroniza v1 desde v2 (self-healing desde `MAX(v1.last_attempt_at)`). Lag ~5 min.
- **Triggers v1 y v2 en `test_questions`:** TODOS desactivados (`trigger_update_user_question_history_*`). Solo el outbox alimenta v2.
- **Esquema:** v1 y v2 **idénticos** (13 columnas iguales: id, user_id, question_id, total_attempts, correct_attempts, success_rate, personal_difficulty, first_attempt_at, last_attempt_at, trend, trend_calculated_at, created_at, updated_at). → Migrar un lector = repointar el objeto Drizzle `userQuestionHistory` → `userQuestionHistoryV2`.

## Estado: HECHO ✅
- v2 creada y alimentada por outbox→Fargate.
- Triggers v1 desactivados.
- Bridge desplegado (v1 al día).
- **Lectores ya en v2:** `lib/api/random-test`, `lib/chat/domains/stats`, `components/QuestionEvolution.tsx`, `lib/api/difficulty-insights/queriesV2.ts`, `app/api/cron/check-stats-drift`, `app/api/v2/official-exams/*` (dejaron de escribir v1).

## Fase 3 — migrar lectores que AÚN leen v1 (CÓDIGO HECHO 01/06, pendiente DEPLOY)
Cada uno: repointar a `userQuestionHistoryV2`. Paridad verificada (usuario más pesado 15.581 filas: weak v1=691=v2, 0 discrepancias). Esquema idéntico → swap directo. typecheck OK, 0 refs v1 en app.
- [x] `lib/api/topic-progress/queries.ts` → v2 (8 refs).
- [x] `lib/api/chat/queries.ts` → v2.
- [x] `lib/api/filtered-questions/queries.ts` → v2 (nunca-vistas + solo-falladas).
- [x] `lib/api/admin-delete-user/queries.ts` → AÑADIDO borrado de `user_question_history_v2` (antes solo borraba v1 = bug: dejaba huérfano el historial v2 al borrar un usuario). Mantiene borrado v1 mientras v1 exista.

> ✅ Commiteado en `16ef0b4c` y pusheado a `origin/main` (01/06). Entra en el próximo deploy. **Fase 4 (DROP v1) solo DESPUÉS de desplegar y confirmar en prod que se lee v2.**

## Fase 4 — eliminar v1 (RUNBOOK — NO ejecutar hasta cumplir las precondiciones)

### Precondiciones (TODAS obligatorias antes de tocar nada)
1. El commit `16ef0b4c` está **desplegado** en prod (frontend ECS).
2. `git grep -nE "userQuestionHistory[^V]|from\('user_question_history'\)" lib/ app/ components/` → **0 resultados** (ningún lector de app en v1). *(verificado el 01/06; re-verificar tras deploy por si entró código nuevo).*
3. Tras el deploy, navegar/probar en prod: configurador (nunca-vistas/falladas), progreso por tema, chat IA stats, y borrado de usuario → sin errores. Confirmar que esos endpoints leen v2.

### Paso 1 — Código ✅ HECHO (commit `ad1aedb4`, pusheado 02/06; PENDIENTE DEPLOY)
- [x] Bridge eliminado: borrados `backend/src/sync-uqh-v1-bridge/` (cron+service+module) + import y entrada en `backend/src/app.module.ts`. typecheck backend exit 0.
- [x] `lib/api/admin-delete-user/queries.ts`: quitada la entrada de borrado de v1 (queda solo v2).
- [ ] `db/schema.ts`: el export `userQuestionHistory` (v1, línea ~1348) se DEJÓ (inocuo; nadie lo importa salvo un comentario). Quitarlo opcionalmente junto al DROP.
- [ ] **DEPLOY de `ad1aedb4`** → el bridge deja de correr (v1 se congela, inocuo). Confirmar en logs Fargate que el cron del bridge ya no aparece.

### Paso 2 — SQL ✅ EJECUTADO 2026-06-02
v1 antes del DROP: 816.552 filas (congeladas, 0 lectores). Tras el DROP: `to_regclass('public.user_question_history')` = null; v2 intacta y fresca (816.878 filas, lag 8s — el outbox handler sigue escribiéndola). Export `userQuestionHistory` + tipo `UserQuestionHistory` eliminados de `db/schema.ts` y `types/database.types.ts`; comentario obsoleto en `official-exams/complete` actualizado. typecheck exit 0.

SQL ejecutado:
```sql
-- a) triggers v1 desactivados en test_questions
DROP TRIGGER IF EXISTS trigger_update_user_question_history_correct ON test_questions;
DROP TRIGGER IF EXISTS trigger_update_user_question_history_insert  ON test_questions;
-- b) funciones que referencian v1 (verificar dependencias antes: \df+ / pg_depend)
DROP FUNCTION IF EXISTS update_user_question_history() CASCADE;
DROP FUNCTION IF EXISTS update_user_question_history_correct_delta() CASCADE;
-- migrate_existing_data: one-off, verificar que no la llama nada y DROP si procede.
-- c) la tabla v1 (último paso; backup recomendado)
DROP TABLE IF EXISTS user_question_history;
```
- Verificar después: `SELECT to_regclass('public.user_question_history')` → null; v2 sigue intacta y alimentándose por el outbox handler.

### Decisión rename
- El plan original decía "DROP v1 + RENAME v2→v1". Renombrar obligaría a repointar TODO el código ya migrado que lee v2 → más churn y riesgo. **Recomendado: NO renombrar** — dejar `user_question_history_v2` como nombre definitivo. Si se quiere el nombre `user_question_history`, hacerlo en un paso posterior y coordinado (rename + repoint masivo en un solo PR).

### Rollback
- Si algo falla tras el DROP: restaurar `user_question_history` desde backup + re-añadir el bridge. Por eso el orden es código primero (deja de depender de v1) y DROP al final.

## Notas
- `psychometric_user_question_history` es tabla **distinta** (psicotécnicas), ajena a esta migración.
- No hay urgencia: el bridge cubre la frescura de v1. La Fase 3 se puede hacer lector a lector con calma.
