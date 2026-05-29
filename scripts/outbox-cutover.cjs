#!/usr/bin/env node
// Script de cutover atómico Sprint 1 outbox.
//
// Ejecuta el cutover final tras soak 24h+ con SHADOW_HANDLERS_ENABLED=true:
//   1. Pre-flight check (worker vivo, queue al día, paridad sin blockers)
//   2. BEGIN transacción atómica
//   3. DISABLE 20 triggers analíticos en test_questions
//   4. BACKFILL shadow ← real (suma counters históricos pre-soak a counters del soak)
//   5. RENAME real → real_pre_outbox, shadow → real (swap atómico)
//   6. COMMIT
//   7. Validación post-cutover
//
// El cutover dura <2s (RENAME es metadata-only). Las funciones SQL siguen
// leyendo de los nombres viejos (sin cambios).
//
// ⚠️  COORDINACIÓN CON HANDLERS REQUERIDA: tras el RENAME, los handlers
// shadow escribirían a `user_article_stats_shadow` que YA NO EXISTE.
// Por tanto el cutover debe coordinarse con:
//
//   1. Antes: parar handlers (SHADOW_HANDLERS_ENABLED=false, deploy task def v15)
//   2. Ejecutar este script (DISABLE + BACKFILL + RENAME)
//   3. Deploy backend con handlers actualizados (quitar sufijo _shadow del INSERT)
//   4. Activar handlers de nuevo (task def v16, SHADOW_HANDLERS_ENABLED=true otra vez,
//      ahora escribiendo a tabla con nombre canónico)
//
// Durante los pasos 1-3 hay ventana de pérdida temporal de stats (~5 min de
// deploy). Las funciones SQL críticas siguen leyendo y los users ven datos
// estables del backfill. Los nuevos events se acumulan en outbox y serán
// procesados al activar paso 4.
//
// ⚠️  ESTE SCRIPT MODIFICA PROD. Por defecto modo DRY-RUN — solo imprime el
// SQL que ejecutaría. Para ejecución real, pasar --execute explícitamente.
//
// Uso:
//   # 1. Validar (dry-run, default)
//   node scripts/outbox-cutover.cjs
//
//   # 2. Ejecutar cutover real (PROD)
//   node scripts/outbox-cutover.cjs --execute
//
//   # 3. Revertir tras cutover
//   node scripts/outbox-cutover.cjs --rollback --execute

require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const DRY_RUN = !process.argv.includes('--execute');
const ROLLBACK = process.argv.includes('--rollback');

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

// 20 triggers analíticos que se DISABLE en el cutover.
// NO incluye los que NO se sustituyen (calculate_retention_score,
// trigger_update_user_streak, update_timestamp_trigger).
const TRIGGERS_TO_DISABLE = [
  'law_question_difficulty_update_trigger',
  'track_first_attempt_trigger',
  'trigger_update_user_question_history_correct',
  'trigger_update_user_question_history_insert',
  'trigger_update_user_question_history_v2_insert',
  'trigger_update_user_question_history_v2_update',
  'update_user_article_stats_delete',
  'update_user_article_stats_insert',
  'update_user_article_stats_update',
  'update_user_daily_stats_delete',
  'update_user_daily_stats_insert',
  'update_user_daily_stats_update',
  'update_user_difficulty_stats_delete',
  'update_user_difficulty_stats_insert',
  'update_user_difficulty_stats_update',
  'update_user_hourly_stats_delete',
  'update_user_hourly_stats_insert',
  'update_user_hourly_stats_update',
  'update_user_stats_summary_on_delete_trigger',
  'update_user_stats_summary_on_update_trigger',
  'update_user_stats_summary_trigger',
  'update_user_stats_total_time_delete_trigger',
  'update_user_stats_total_time_insert_trigger',
  'update_user_stats_total_time_update_trigger',
];

// Tablas a backfill+rename: counter (suma counters) + first_attempt (preserva existente).
const TABLES = [
  { name: 'user_article_stats', pk: ['user_id', 'article_id', 'article_number', 'law_name', 'tema_number'], sum_cols: ['total_questions', 'correct_answers'], kind: 'counter' },
  { name: 'user_daily_stats', pk: ['user_id', 'day'], sum_cols: ['total_questions', 'correct_answers', 'total_time_seconds'], kind: 'counter' },
  { name: 'user_hourly_stats', pk: ['user_id', 'hour'], sum_cols: ['total_questions', 'correct_answers'], kind: 'counter' },
  { name: 'user_difficulty_stats', pk: ['user_id', 'difficulty'], sum_cols: ['total_questions', 'correct_answers', 'total_time_seconds'], kind: 'counter' },
  { name: 'user_stats_summary', pk: ['user_id'], sum_cols: ['total_questions', 'correct_answers', 'blank_answers', 'questions_this_week', 'total_time_seconds'], kind: 'counter' },
  { name: 'user_question_history_v2', pk: ['user_id', 'question_id'], sum_cols: ['total_attempts', 'correct_attempts'], kind: 'counter' },
  { name: 'law_question_first_attempts', pk: ['user_id', 'question_id'], kind: 'first_attempt' },
  { name: 'question_first_attempts', pk: ['user_id', 'question_id'], kind: 'first_attempt' },
];

async function preflightCheck() {
  console.log('═══ PASO 1: Pre-flight check ═══\n');

  // 1. Worker outbox vivo (último proc < 60s)
  const [w] = await sql`
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(processed_at)))::int AS proc_ago_s,
           COUNT(*) FILTER (WHERE processed_at IS NULL) AS pending
    FROM public.test_questions_outbox
  `;
  console.log(`  Worker outbox: último proc=${w.proc_ago_s}s ago | pending=${w.pending}`);
  if (w.proc_ago_s > 60) throw new Error(`❌ Worker outbox parado (${w.proc_ago_s}s ago). Force-restart ECS antes de cutover.`);
  if (Number(w.pending) > 100) throw new Error(`❌ Outbox queue acumulada (${w.pending}). Esperar drain antes de cutover.`);

  // 2. Las 8 tablas _shadow existen
  const shadowTables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%_shadow' ORDER BY tablename`;
  console.log(`  Shadow tables: ${shadowTables.length}/8 existen`);
  if (shadowTables.length < 8) throw new Error(`❌ Faltan shadow tables: ${shadowTables.map(t => t.tablename).join(', ')}`);

  // 3. SHADOW_HANDLERS_ENABLED debe estar ACTIVO (verificar via ECS o emisión reciente)
  const [shadowWrites] = await sql`SELECT COUNT(*) AS n FROM public.user_article_stats_shadow WHERE updated_at > NOW() - INTERVAL '5 min'`;
  console.log(`  Shadow writes últimos 5min: ${shadowWrites.n}`);
  if (Number(shadowWrites.n) === 0) throw new Error(`❌ Handlers shadow no escriben. SHADOW_HANDLERS_ENABLED=false?`);

  console.log('  ✅ Pre-flight OK\n');
}

async function cutover() {
  console.log('═══ PASO 2-6: Cutover atómico ═══\n');

  const stmts = [];

  // 2. DISABLE 20 triggers
  for (const t of TRIGGERS_TO_DISABLE) {
    stmts.push(`ALTER TABLE public.test_questions DISABLE TRIGGER ${t}`);
  }

  // 3. Backfill shadow ← real (sumar counters / preservar first_attempt)
  for (const t of TABLES) {
    const pkCols = t.pk.join(', ');
    if (t.kind === 'counter') {
      const sumExprs = t.sum_cols.map(c =>
        `${c} = GREATEST(0, COALESCE(public.${t.name}_shadow.${c}, 0) + COALESCE(EXCLUDED.${c}, 0))`
      ).join(',\n      ');
      stmts.push(`-- Backfill ${t.name}: shadow_total = shadow_post_soak + real_pre_soak
INSERT INTO public.${t.name}_shadow
SELECT * FROM public.${t.name} r
ON CONFLICT (${pkCols}) DO UPDATE SET
      ${sumExprs},
      updated_at = NOW()`);
    } else {
      // first_attempt: preservar el existente en shadow (que es el más reciente),
      // pero traer los filas que solo existen en real.
      stmts.push(`-- Backfill ${t.name}: only insert filas que solo existen en real
INSERT INTO public.${t.name}_shadow
SELECT r.* FROM public.${t.name} r
LEFT JOIN public.${t.name}_shadow s USING (${pkCols})
WHERE s.${t.pk[0]} IS NULL
ON CONFLICT (${pkCols}) DO NOTHING`);
    }
  }

  // 4. RENAME atómico
  for (const t of TABLES) {
    stmts.push(`ALTER TABLE public.${t.name} RENAME TO ${t.name}_pre_outbox`);
    stmts.push(`ALTER TABLE public.${t.name}_shadow RENAME TO ${t.name}`);
  }

  console.log(`📋 ${stmts.length} statements a ejecutar dentro de una sola transacción:\n`);
  stmts.forEach((s, i) => console.log(`  ${String(i+1).padStart(2)}. ${s.slice(0, 100)}${s.length > 100 ? '...' : ''}`));

  if (DRY_RUN) {
    console.log('\n🟡 DRY RUN — nada ejecutado. Pasa --execute para aplicar.');
    return;
  }

  console.log('\n⚠️  EJECUTANDO CUTOVER REAL...');
  await sql.begin(async (tx) => {
    for (const s of stmts) {
      await tx.unsafe(s);
    }
  });
  console.log('✅ Cutover COMPLETO');
}

async function rollback() {
  console.log('═══ ROLLBACK ═══\n');

  const stmts = [];

  // 1. RENAME inverso
  for (const t of TABLES) {
    stmts.push(`ALTER TABLE public.${t.name} RENAME TO ${t.name}_shadow`);
    stmts.push(`ALTER TABLE public.${t.name}_pre_outbox RENAME TO ${t.name}`);
  }

  // 2. ENABLE 20 triggers
  for (const t of TRIGGERS_TO_DISABLE) {
    stmts.push(`ALTER TABLE public.test_questions ENABLE TRIGGER ${t}`);
  }

  console.log(`📋 ${stmts.length} statements rollback:\n`);
  stmts.forEach((s, i) => console.log(`  ${String(i+1).padStart(2)}. ${s.slice(0, 100)}`));

  if (DRY_RUN) {
    console.log('\n🟡 DRY RUN — nada ejecutado. Pasa --execute para aplicar.');
    return;
  }

  console.log('\n⚠️  EJECUTANDO ROLLBACK REAL...');
  await sql.begin(async (tx) => {
    for (const s of stmts) {
      await tx.unsafe(s);
    }
  });
  console.log('✅ Rollback COMPLETO');
}

async function postValidation() {
  console.log('\n═══ Validación post-cutover ═══\n');

  // Las tablas con nombre real ahora son las shadow (renombradas).
  // Verificar que las funciones SQL siguen funcionando.
  for (const t of TABLES) {
    const [c] = await sql.unsafe(`SELECT COUNT(*) AS n FROM public.${t.name}`);
    console.log(`  ${t.name}: ${c.n} filas (debería ser similar a las del shadow + las traídas del backfill)`);
  }
}

(async () => {
  try {
    if (ROLLBACK) {
      await rollback();
    } else {
      await preflightCheck();
      // Re-ejecutar diff para confirmar 0 blockers
      console.log('═══ Validación diff antes del cutover ═══');
      console.log('(ejecutar manualmente: node scripts/outbox-shadow-diff.cjs --hours 24)\n');
      await cutover();
      if (!DRY_RUN) await postValidation();
    }
  } catch (e) {
    console.error('\n❌ ERROR:', e.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
