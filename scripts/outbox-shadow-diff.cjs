#!/usr/bin/env node
// Script de validación paridad shadow vs real (Sprint 1 outbox Paso 4).
// Ejecutar tras 24h de soak con SHADOW_HANDLERS_ENABLED=true.
//
// Compara las 8 shadow tables con sus equivalentes reales, contando
// divergencias en cualquier columna agregada. Output: tabla con
// divergent_q, divergent_c, only_in_shadow, only_in_real por tabla.
//
// SLO esperado: 0 divergencias en todas las tablas. Si hay > 0, NO
// hacer cutover: investigar handler y arreglar bug.
//
// Uso:
//   cd /home/manuel/Documentos/github/vence
//   node scripts/outbox-shadow-diff.cjs [--hours 24]

require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const HOURS = (() => {
  const i = process.argv.indexOf('--hours');
  return i > 0 ? Number(process.argv[i + 1]) : 24;
})();

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

// Definición de tablas: PK columns + columnas comparables + columna de tiempo.
//
// METODOLOGÍA: comparamos solo filas POST-activación shadow. Como las tablas
// reales llevan meses acumulando counters y shadow lleva minutos, los TOTALES
// nunca coincidirán. Lo que SÍ debe coincidir bit-a-bit:
//
//  - Para "first_attempts" (insert-once, never update): cada fila creada post-
//    activación en shadow debe tener idénticos campos en real (1:1 paridad).
//  - Para "counter tables" (UPSERT con increment): cada fila TOCADA por handlers
//    en shadow debe existir en real y tener counter_real >= counter_shadow
//    (real puede ser mayor por triggers viejos sumando además, pero NO debe
//    haber filas en shadow con valores > real ni inexistentes en real).
//
// time_col indica la columna a usar para filtrar ventana temporal.
const TABLES = [
  {
    name: 'user_article_stats',
    pk: ['user_id', 'article_id', 'article_number', 'law_name', 'tema_number'],
    compare: ['total_questions', 'correct_answers'],
    time_col: 'updated_at',
    kind: 'counter',
  },
  {
    name: 'user_daily_stats',
    pk: ['user_id', 'day'],
    compare: ['total_questions', 'correct_answers', 'total_time_seconds'],
    time_col: 'updated_at',
    kind: 'counter',
  },
  {
    name: 'user_hourly_stats',
    pk: ['user_id', 'hour'],
    compare: ['total_questions', 'correct_answers'],
    time_col: 'updated_at',
    kind: 'counter',
  },
  {
    name: 'user_difficulty_stats',
    pk: ['user_id', 'difficulty'],
    compare: ['total_questions', 'correct_answers', 'total_time_seconds'],
    time_col: 'updated_at',
    kind: 'counter',
  },
  {
    name: 'user_stats_summary',
    pk: ['user_id'],
    compare: ['total_questions', 'correct_answers', 'blank_answers', 'questions_this_week', 'total_time_seconds'],
    time_col: 'updated_at',
    kind: 'counter',
  },
  {
    name: 'user_question_history_v2',
    pk: ['user_id', 'question_id'],
    compare: ['total_attempts', 'correct_attempts', 'success_rate'],
    time_col: 'updated_at',
    kind: 'counter',
  },
  {
    name: 'law_question_first_attempts',
    pk: ['user_id', 'question_id'],
    compare: ['is_correct', 'time_taken_seconds'],
    time_col: 'created_at',
    kind: 'first_attempt',
  },
  {
    name: 'question_first_attempts',
    pk: ['user_id', 'question_id'],
    compare: ['is_correct', 'time_spent_seconds'],
    time_col: 'created_at',
    kind: 'first_attempt',
  },
];

(async () => {
  console.log(`Query diff shadow vs real (últimas ${HOURS}h, solo filas tocadas por shadow):\n`);
  console.log('Tabla'.padEnd(35) + 'shadow_rows  divergent  missing_in_real  shadow_gt_real');

  let totalBlockers = 0;
  for (const t of TABLES) {
    const using = t.pk.join(', ');
    const compareDiff = t.compare.map(c => `s.${c} IS DISTINCT FROM r.${c}`).join(' OR ');
    // Para counter tables: shadow > real es bug grave (handler suma más de lo que toca).
    // Para first_attempt: cualquier divergencia en valor es bug grave.
    const shadowGtReal = t.kind === 'counter'
      ? t.compare.filter(c => c !== 'success_rate').map(c => `COALESCE(s.${c}, 0) > COALESCE(r.${c}, 0)`).join(' OR ')
      : '1=0'; // first_attempt: no aplica
    const timeFilter = `s.${t.time_col} > NOW() - INTERVAL '${HOURS} hours'`;

    try {
      // Solo claves presentes en shadow (las que activación + handlers tocaron).
      // Importante: usamos IS NOT DISTINCT FROM (en vez de =) para que NULL = NULL.
      // El UNIQUE INDEX de las tablas usa NULLS NOT DISTINCT (NULL = NULL), pero
      // LEFT JOIN USING (...) trata NULL como UNKNOWN → filas con NULLs serían
      // falsos positivos de "missing_in_real". Usamos ON con IS NOT DISTINCT FROM.
      const joinCondition = t.pk
        .map((col) => `s.${col} IS NOT DISTINCT FROM r.${col}`)
        .join(' AND ');
      const result = await sql.unsafe(`
        SELECT
          COUNT(*) AS shadow_rows,
          COUNT(*) FILTER (WHERE (${compareDiff})) AS divergent,
          COUNT(*) FILTER (WHERE r.user_id IS NULL) AS missing_in_real,
          COUNT(*) FILTER (WHERE (${shadowGtReal})) AS shadow_gt_real
        FROM public.${t.name}_shadow s
        LEFT JOIN public.${t.name} r ON ${joinCondition}
        WHERE s.${t.time_col} > NOW() - INTERVAL '${HOURS} hours'
      `);

      const row = result[0];
      const sr = Number(row.shadow_rows);
      const dv = Number(row.divergent);
      const mr = Number(row.missing_in_real);
      const sgr = Number(row.shadow_gt_real);
      // BLOCKER: missing_in_real (handler crea fila inexistente) o shadow_gt_real (handler suma más).
      // Para first_attempt: divergent es ESPERABLE (real tiene historicos pre-shadow con
      // ON CONFLICT DO NOTHING que preserva valores antiguos, shadow registra el "primer
      // intento" desde activación). Solo missing_in_real sería bug real.
      const blockers = mr + sgr;
      totalBlockers += blockers;
      const flag = blockers === 0 ? '✅' : '🔴';
      console.log(
        `${flag} ${t.name.padEnd(33)}${String(sr).padStart(11)}${String(dv).padStart(11)}${String(mr).padStart(17)}${String(sgr).padStart(16)}`,
      );
    } catch (e) {
      console.log(`❌ ${t.name.padEnd(33)} ERROR: ${e.message.slice(0, 80)}`);
      totalBlockers += 1;
    }
  }

  console.log();
  console.log('Leyenda:');
  console.log('  shadow_rows     = filas en shadow tocadas en la ventana');
  console.log('  divergent       = valores distintos shadow vs real (esperable en counter durante soak)');
  console.log('  missing_in_real = filas en shadow que no existen en real (BLOCKER: handler crea filas falsas)');
  console.log('  shadow_gt_real  = counters shadow > real (BLOCKER: handler suma de más)');
  console.log();
  if (totalBlockers === 0) {
    console.log('🟢 SIN BLOCKERS: shadow nunca crea filas falsas ni suma de más.');
    console.log('   "divergent" en counter tables es esperable (real lleva meses, shadow minutos).');
    console.log('   Para cutover: backfill shadow desde real ANTES del DROP TRIGGER + RENAME.');
    console.log('   Ver docs/runbooks/outbox-cutover.md');
  } else {
    console.log(`🔴 ${totalBlockers} blockers detectados. NO HACER CUTOVER.`);
    console.log('   Investigar handler causa, fix, repetir soak.');
  }

  await sql.end();
})();
