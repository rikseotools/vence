# Roadmap: Migración UQH v1 → v2 (eliminar `user_question_history` duplicada)

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

> ⚠️ Cambios en working tree, SIN commit/deploy aún. Fase 4 (DROP v1) solo DESPUÉS de desplegar y confirmar en prod que se lee v2.

## Fase 4 — eliminar v1 (solo cuando 0 referencias a v1)
- [ ] Eliminar/migrar funciones SQL que referencian v1: `update_user_question_history` (función del trigger antiguo, latente), `update_user_question_history_correct_delta`, `migrate_existing_data`.
- [ ] Borrar los triggers v1 desactivados de `test_questions`.
- [ ] Parar y quitar el bridge (`SyncUqhV1BridgeModule` + cron + service + entrada en `app.module.ts`).
- [ ] `DROP TABLE user_question_history`.
- Nota: el plan original decía "DROP v1 + RENAME v2→v1", pero renombrar obligaría a repointar TODO el código ya migrado que lee v2. Alternativa más limpia: migrar todos los lectores a v2 y solo `DROP` v1 (sin rename), dejando `user_question_history_v2` como nombre definitivo.

## Notas
- `psychometric_user_question_history` es tabla **distinta** (psicotécnicas), ajena a esta migración.
- No hay urgencia: el bridge cubre la frescura de v1. La Fase 3 se puede hacer lector a lector con calma.
