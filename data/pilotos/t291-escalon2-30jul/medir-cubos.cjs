// Mide los cubos candidatos para la revisión con agentes (T-291) contra RDS VIVO.
// No usa supabase-js (apunta al Supabase congelado). Ver CLAUDE.md § BD.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') });
const postgres = require(path.join(ROOT, 'node_modules/postgres'));

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 });

(async () => {
  console.log('→ construyendo tabla temporal de exposición (test_questions)…');
  const t0 = Date.now();
  await sql.unsafe(`CREATE TEMP TABLE exp AS
    SELECT question_id, count(*)::int AS servidas
    FROM public.test_questions GROUP BY 1`);
  await sql.unsafe(`CREATE INDEX ON exp (question_id)`);
  const [{ n: expRows }] = await sql.unsafe(`SELECT count(*)::int n FROM exp`);
  console.log(`   ${expRows} preguntas con al menos 1 exposición (${((Date.now()-t0)/1000).toFixed(0)}s)`);

  console.log('\n→ base: preguntas activas con exposición y flags');
  await sql.unsafe(`CREATE TEMP TABLE base AS
    SELECT q.id,
           coalesce(e.servidas, 0) AS servidas,
           (q.explanation_data IS NOT NULL) AS estructurada,
           q.shuffle_safety,
           NOT EXISTS (SELECT 1 FROM public.ai_verification_results v WHERE v.question_id = q.id) AS nunca_verificada
      FROM public.questions q
      LEFT JOIN exp e ON e.question_id = q.id
     WHERE q.is_active`);
  await sql.unsafe(`CREATE INDEX ON base (nunca_verificada, estructurada, servidas DESC)`);

  const resumen = await sql.unsafe(`
    SELECT nunca_verificada, estructurada,
           count(*)::int AS preguntas,
           sum(servidas)::bigint AS exposiciones,
           count(*) FILTER (WHERE servidas = 0)::int AS sin_ver_nadie
      FROM base GROUP BY 1,2 ORDER BY 1 DESC, 2`);
  console.table(resumen);

  console.log('\n→ CUBO RECOMENDADO: activas · nunca verificadas · SIN estructura — concentración por exposición');
  const conc = await sql.unsafe(`
    WITH c AS (
      SELECT servidas, row_number() OVER (ORDER BY servidas DESC) rn
        FROM base WHERE nunca_verificada AND NOT estructurada
    ), tot AS (SELECT sum(servidas)::numeric s, count(*)::int n FROM c)
    SELECT k AS top_n,
           (SELECT count(*) FROM c WHERE rn <= k)::int AS preguntas,
           (SELECT sum(servidas) FROM c WHERE rn <= k)::bigint AS exposiciones,
           round(100.0 * (SELECT sum(servidas) FROM c WHERE rn <= k) / (SELECT s FROM tot), 1) AS pct_exposicion,
           (SELECT min(servidas) FROM c WHERE rn <= k)::int AS corte_apariciones
      FROM (VALUES (200),(500),(1000),(2000),(3000),(5000)) v(k)`);
  console.table(conc);

  console.log('\n→ del top-1000 de ese cubo: estado de shuffle_safety y lifecycle');
  const top = await sql.unsafe(`
    WITH c AS (
      SELECT b.id, b.servidas, b.shuffle_safety
        FROM base b WHERE b.nunca_verificada AND NOT b.estructurada
       ORDER BY b.servidas DESC LIMIT 1000)
    SELECT c.shuffle_safety, count(*)::int preguntas, sum(c.servidas)::bigint exposiciones
      FROM c GROUP BY 1 ORDER BY 2 DESC`);
  console.table(top);

  console.log('\n→ contexto: reparto del top-1000 por oposición (position_type del topic_scope del artículo)');
  const porOpo = await sql.unsafe(`
    WITH c AS (
      SELECT b.id, b.servidas FROM base b
       WHERE b.nunca_verificada AND NOT b.estructurada
       ORDER BY b.servidas DESC LIMIT 1000)
    SELECT coalesce(l.short_name,'(sin ley)') AS ley, count(*)::int preguntas, sum(c.servidas)::bigint exposiciones
      FROM c
      JOIN public.questions q ON q.id = c.id
      LEFT JOIN public.articles a ON a.id = q.primary_article_id
      LEFT JOIN public.laws l ON l.id = a.law_id
     GROUP BY 1 ORDER BY 3 DESC LIMIT 15`);
  console.table(porOpo);

  console.log('\n→ comparativa: cubo "muy vistas SIN estructura pero YA verificadas" (candidato alternativo)');
  const alt = await sql.unsafe(`
    WITH c AS (
      SELECT servidas, row_number() OVER (ORDER BY servidas DESC) rn
        FROM base WHERE NOT nunca_verificada AND NOT estructurada)
    SELECT (SELECT count(*) FROM c)::int AS preguntas_cubo,
           (SELECT sum(servidas) FROM c)::bigint AS exposiciones_cubo,
           (SELECT sum(servidas) FROM c WHERE rn <= 1000)::bigint AS exp_top1000,
           (SELECT min(servidas) FROM c WHERE rn <= 1000)::int AS corte_top1000`);
  console.table(alt);

  await sql.end();
})().catch(async (e) => { console.error('❌', e.message); process.exit(1); });
