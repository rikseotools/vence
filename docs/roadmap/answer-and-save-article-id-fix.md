# Roadmap — `article_id` NULL en `test_questions` (answer-and-save)

> **Estado**: ✅ Fase A APLICADA (2026-05-27 ~13:37 CEST). 🟡 Fase B PREPARADA, esperando ventana de ejecución.
> **Propietario**: equipo Vence
> **Coste recurrente**: 0€
> **Última actualización**: 2026-05-27 ~15:00 CEST.

---

## 🚀 PUNTO DE RETOMA — leer antes de tocar nada

**Contexto en 30 segundos:**

El path `/api/v2/answer-and-save → insertTestAnswer` guardaba en `test_questions.article_id` lo que el cliente enviase (`req.questionData.article?.id || null`). El server **NO resolvía** el campo aunque ya hacía el JOIN a `articles` en `getQuestionValidationCached`.

Resultado: **143.754 filas test_questions con `article_id = NULL`** (11.37% del total). De esas, ~27% son legislativas con `question_id` resoluble → ~39k filas backfilleables vía `questions.primary_article_id`. Las restantes son psicotécnicas (article_id correctamente null por diseño) o AI-generated sin questionId resoluble.

**Impacto:** todos los endpoints que dependen de `article_id` perdían tracking del 11% de las respuestas (oposiciones-compatibles, theme-stats, weak-articles, `user_article_stats`).

---

## Fases

### Fase A — Stop the bleed (fix server-side) ✅ APLICADA 2026-05-27 13:37 CEST

**Cambio:** commit `b832517a` en `lib/api/v2/answer-and-save/queries.ts`.

- `getQuestionValidationInternal` ahora SELECT añade `articles.id` (JOIN ya existía).
- `QuestionValidation.articleId` propagado a `validateAndSaveAnswer`.
- Si el cliente no envió `article.id` pero el server resolvió uno, se enriquece el `saveRequest` antes de `insertTestAnswer`.
- Cache key bump a `'question-validation-v2'` para invalidar entradas v1 sin articleId.

**Verificación post-deploy:** sample 30/30 respuestas legislativas con question_id guardadas en los 2.5 min post-rollout → **0% article_id NULL** (vs 11.37% pre-fix). Verificación funcional en `taskDef=28 COMPLETED 13:37 CEST`.

**Rollback:** `git revert b832517a` (solo añade resolución defensiva, no quita info — rollback safe).

### Fase B — Backfill histórico 🟡 PREPARADO 2026-05-27

Recupera las ~39k filas históricas resolubles. Beneficia a todos los endpoints que dependen de `article_id` retroactivamente.

#### Pre-conditions verificadas (2026-05-27 ~14:50 CEST)

- ✅ `test_questions.article_id` total con NULL: **144.031** filas (post-Fase A; algunas nuevas con article_id rellenado ya).
- ✅ Sample 2000 random NULL → 537 legislativas con question_id (27%). Extrapolando: ~38.900 filas backfilleables.
- ✅ De 223 question_ids únicos sample: **100% (223/223)** tienen `primary_article_id` resoluble en `questions`.
- ✅ Triggers materialized en `test_questions` son `AFTER UPDATE OF is_correct, time_spent_seconds` — **NO disparan en UPDATE de `article_id`**. Sin cascada de recompute.
- ✅ Tráfico actual a `test_questions`: ~3 inserts/min (medido 2026-05-27 14:50 CEST). Bajísima contención.

#### SQL exacto para ejecutar

```sql
-- Backfill batches de 5.000 filas con commit por batch.
-- Bucle hasta que UPDATE devuelva 0 filas.
-- Cada batch: ~1-3 segundos. Total estimado: ~20-40 batches = 1-2 min.

UPDATE test_questions tq
SET article_id = q.primary_article_id
FROM questions q
WHERE tq.id IN (
  SELECT tq2.id
  FROM test_questions tq2
  INNER JOIN questions q2 ON q2.id = tq2.question_id
  WHERE tq2.article_id IS NULL
    AND q2.primary_article_id IS NOT NULL
  LIMIT 5000
)
AND tq.question_id = q.id
AND tq.article_id IS NULL
AND q.primary_article_id IS NOT NULL;
```

#### Script monitor (copy-paste)

```bash
node <<'EOF'
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'})
const postgresMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres')
const postgres = postgresMod.default || postgresMod

const sessionUrl = process.env.DATABASE_URL.replace(':6543/', ':5432/')
const sql = postgres(sessionUrl, { max: 1, prepare: false, idle_timeout: 10 })

;(async () => {
  let totalUpdated = 0
  let batch = 0
  while (true) {
    batch++
    const t0 = Date.now()
    const result = await sql`
      UPDATE test_questions tq
      SET article_id = q.primary_article_id
      FROM questions q
      WHERE tq.id IN (
        SELECT tq2.id
        FROM test_questions tq2
        INNER JOIN questions q2 ON q2.id = tq2.question_id
        WHERE tq2.article_id IS NULL
          AND q2.primary_article_id IS NOT NULL
        LIMIT 5000
      )
      AND tq.question_id = q.id
      AND tq.article_id IS NULL
      AND q.primary_article_id IS NOT NULL
    `
    const updated = result.count
    totalUpdated += updated
    const ms = Date.now() - t0
    console.log(`batch ${batch}: ${updated} rows in ${ms}ms (total ${totalUpdated})`)
    if (updated === 0) break
    // No sleep — el UPDATE batch toma row locks brevemente y libera. Si el
    // tráfico real generase contención, añadir `await new Promise(r=>setTimeout(r,500))`.
  }
  console.log(`\n✅ Backfill completo: ${totalUpdated} filas actualizadas en ${batch} batches`)

  // Verificación final
  const [{ count: stillNull }] = await sql`
    SELECT COUNT(*)::int AS count FROM test_questions WHERE article_id IS NULL
  `
  console.log(`test_questions con article_id NULL post-backfill: ${stillNull}`)
  console.log('  → residual esperado: psicotécnicas + AI-generated sin question_id resoluble')

  await sql.end()
})()
EOF
```

#### Por qué Fase B es production-safe

- **Triggers no se disparan** (verificado en migración `20260523_materialized_stats_triggers.sql`).
- **Batches de 5k filas** → row locks brevísimos, no bloquean inserts concurrentes en otras filas.
- **WHERE excluye filas que ya tienen article_id** → idempotente, re-ejecutable.
- **Reversible**: el campo `article_id` puede volverse NULL si el fix fuese erróneo (pero el sample muestra 100% resoluble correctamente).
- **NO requiere ventana de mantenimiento** dado el tráfico actual (3 inserts/min). Aún así, recomendado ejecutar fuera de pico (madrugada o sobremesa).

#### Sub-fase B.2: refresh `user_article_stats` (decisión separada)

El backfill de `test_questions.article_id` **NO actualiza** automáticamente las filas históricas en `user_article_stats` que se agruparon con `article_id=NULL`. Esas siguen en uas con article_id=null y no se contabilizan en endpoints que leen via uas (oposiciones-compatibles refactorizado).

Opciones para B.2:
- **B.2.a — No hacer nada:** los endpoints que leen test_questions DIRECTO (theme-stats antiguo si existe) sí se benefician. uas histórico queda con el desfase. Aceptable si la mayoría del valor viene de respuestas futuras.
- **B.2.b — Reconciliación dirigida:** SQL que migre las counts de uas-con-null a uas-con-articleId correcto. Más complejo, requiere agrupar por (user, article_number, law_name, tema_number) y sumar.
- **B.2.c — Re-correr backfill materialized completo:** TRUNCATE + reload completo via `scripts/backfill-materialized-stats.mjs`. Es el bazooka: 4421 users × ~10s = ~12 horas. Solo justificable si B.2.b es muy complejo.

**Recomendación:** ejecutar B.1, medir 24h. Si el residual histórico afecta significativamente las métricas user-facing, abordar B.2.

#### Criterios de éxito Fase B

- `test_questions WHERE article_id IS NULL AND question_id IS NOT NULL AND question_type='legislative'` → **0 filas** post-backfill (o residual <100 filas explicables).
- Endpoints downstream (oposiciones-compatibles, theme-stats) muestran progreso ligeramente superior para users históricos.
- 0 errores en `validation_error_logs` durante la ventana de ejecución.

---

## Antipatterns a evitar al retomar

- ❌ Ejecutar el UPDATE sin LIMIT batching. Un UPDATE de 39k filas en una sola transacción podría tomar locks pesados.
- ❌ Saltar B.1 directo a B.2.c (TRUNCATE + reload). Es 12h de runtime para un beneficio incremental — overkill.
- ❌ Asumir que Fase B "arregla todo retroactivamente". user_article_stats queda con desfase si no se hace B.2.

---

## Métricas baseline (2026-05-27)

Pre-Fase A (medido 13:00 CEST):
- `test_questions.article_id NULL`: **143.754 filas** (11.37% de 1.262.606 total).
- Sample legislativas con question_id: ~27% del NULL pool = ~38.800 backfilleables.

Post-Fase A (medido 13:40 CEST, 2.5 min post-deploy):
- 30/30 respuestas legislativas frescas con question_id → **0% article_id NULL**. Sangrado detenido.

Post-Fase B (pendiente):
- Esperable: `test_questions WHERE article_id IS NULL AND question_id IS NOT NULL` → cae a residual <500 filas (AI-generated sin resolución posible).

---

## Relacionado

- [`materialized-stats-aggregates.md`](materialized-stats-aggregates.md) — patrón hermano (theme-stats); este roadmap arregla la fuente de datos que ese patrón consume.
- [`weak-articles-perf.md`](weak-articles-perf.md) — endpoint que también se benefició retroactivamente de Fase A y se beneficiará de B.
- Commit `b832517a` — Fase A applied.
- Commit `5027a941` — `oposiciones-compatibles` refactor consumidor de uas que motivó descubrir este bug.
