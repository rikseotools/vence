// READ-ONLY. Calibración Cubo A (answer_ok=false activas) + dry-run detector §19.
// No muta nada. Conforme manual revisar-preguntas-con-agente.md v2.1.
const fs = require('fs');
const path = '/home/manuel/Documentos/github/vence/';
require(path + 'node_modules/dotenv').config({ path: path + '.env.local' });
const postgres = require(path + 'node_modules/postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 4 });

(async () => {
  const out = {};

  // 0. ¿Existen columnas review_method_version / options_ok?
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_verification_results'
      AND column_name IN ('review_method_version','options_ok')`;
  const hasRMV = cols.some(c => c.column_name === 'review_method_version');
  const hasOpts = cols.some(c => c.column_name === 'options_ok');
  out.schema = { review_method_version: hasRMV, options_ok: hasOpts };

  // 1. Totales del catálogo activo
  const [tot] = await sql`SELECT count(*)::int n FROM questions WHERE is_active = true`;
  out.active_total = tot.n;
  const [nv] = await sql`SELECT count(*)::int n FROM questions WHERE is_active = true AND verified_at IS NULL`;
  out.active_verified_at_null = nv.n;

  // 2. Activas con answer_ok=false NO descartada, split por fuerza del modelo
  //    (a nivel pregunta: una pregunta cuenta como "fuerte" si tiene al menos
  //     una fila answer_ok=false de sonnet/opus)
  const [strong] = await sql`
    SELECT count(DISTINCT q.id)::int n
    FROM questions q
    JOIN ai_verification_results av ON av.question_id = q.id
    WHERE q.is_active = true
      AND av.answer_ok = false AND COALESCE(av.discarded,false) = false
      AND (av.ai_model ILIKE '%sonnet%' OR av.ai_model ILIKE '%opus%')`;
  out.answer_false_strong = strong.n;

  const [haikuAny] = await sql`
    SELECT count(DISTINCT q.id)::int n
    FROM questions q
    JOIN ai_verification_results av ON av.question_id = q.id
    WHERE q.is_active = true
      AND av.answer_ok = false AND COALESCE(av.discarded,false) = false
      AND av.ai_model ILIKE '%haiku%'`;

  const [anyFalse] = await sql`
    SELECT count(DISTINCT q.id)::int n
    FROM questions q
    JOIN ai_verification_results av ON av.question_id = q.id
    WHERE q.is_active = true
      AND av.answer_ok = false AND COALESCE(av.discarded,false) = false`;
  out.answer_false_any = anyFalse.n;
  out.answer_false_haiku_any = haikuAny.n;

  // 3. Del grupo fuerte: cuántas son examen oficial (no se toca la clave, §8.4)
  const [off] = await sql`
    SELECT count(DISTINCT q.id)::int n
    FROM questions q
    JOIN ai_verification_results av ON av.question_id = q.id
    WHERE q.is_active = true AND q.is_official_exam = true
      AND av.answer_ok = false AND COALESCE(av.discarded,false) = false
      AND (av.ai_model ILIKE '%sonnet%' OR av.ai_model ILIKE '%opus%')`;
  out.answer_false_strong_official = off.n;

  // 4. Split por review_method_version (si existe la columna) — flags de método ciego viejo §16.2
  if (hasRMV) {
    const rmv = await sql`
      SELECT COALESCE(av.review_method_version,'(null)') v, count(DISTINCT q.id)::int n
      FROM questions q
      JOIN ai_verification_results av ON av.question_id = q.id
      WHERE q.is_active = true
        AND av.answer_ok = false AND COALESCE(av.discarded,false) = false
        AND (av.ai_model ILIKE '%sonnet%' OR av.ai_model ILIKE '%opus%')
      GROUP BY 1 ORDER BY 2 DESC`;
    out.answer_false_strong_by_method = rmv;
  }

  // 5. Por modelo exacto (visibilidad)
  out.answer_false_by_model = await sql`
    SELECT av.ai_model, count(DISTINCT q.id)::int n
    FROM questions q
    JOIN ai_verification_results av ON av.question_id = q.id
    WHERE q.is_active = true
      AND av.answer_ok = false AND COALESCE(av.discarded,false) = false
    GROUP BY 1 ORDER BY 2 DESC`;

  // 6. MUESTRA 50 (grupo fuerte) con artículo COMPLETO sin truncar
  const rmvSel = hasRMV ? sql`av.review_method_version` : sql`NULL::text AS review_method_version`;
  const optSel = hasOpts ? sql`av.options_ok` : sql`NULL::boolean AS options_ok`;
  const sample = await sql`
    SELECT DISTINCT ON (q.id)
      q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
      q.correct_option, q.explanation, q.is_official_exam, q.lifecycle_state,
      q.primary_article_id,
      a.article_number, a.title AS article_title, a.content AS article_content,
      l.short_name AS law_short_name, l.is_virtual,
      av.ai_model, av.confidence, av.explanation AS av_note,
      av.correct_option_should_be, av.correct_article_suggestion,
      av.verified_at, ${rmvSel}, ${optSel}
    FROM questions q
    JOIN ai_verification_results av ON av.question_id = q.id
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.is_active = true
      AND av.answer_ok = false AND COALESCE(av.discarded,false) = false
      AND (av.ai_model ILIKE '%sonnet%' OR av.ai_model ILIKE '%opus%')
    ORDER BY q.id, av.verified_at DESC
    LIMIT 50`;
  out.sample_size = sample.length;
  fs.writeFileSync('/tmp/calib_sample.json', JSON.stringify(sample, null, 2));

  // 7. DRY-RUN detector mecánico §19 (solo conteo + ejemplos). Alta precisión.
  // dup_options: dos opciones no nulas idénticas (trim)
  const [dup] = await sql`
    SELECT count(*)::int n FROM questions q WHERE q.is_active = true AND (
      btrim(q.option_a)=btrim(q.option_b) OR btrim(q.option_a)=btrim(q.option_c) OR
      btrim(q.option_a)=btrim(COALESCE(q.option_d,'\x01')) OR btrim(q.option_b)=btrim(q.option_c) OR
      btrim(q.option_b)=btrim(COALESCE(q.option_d,'\x01')) OR btrim(q.option_c)=btrim(COALESCE(q.option_d,'\x01')))`;
  out.detector_dup_options = dup.n;

  // leaked_meta: metadato filtrado al final de una opción/explicación
  const [meta] = await sql`
    SELECT count(*)::int n FROM questions q WHERE q.is_active = true AND (
      q.option_a ~ '[(]art[íi]culo\s+\d' OR q.option_b ~ '[(]art[íi]culo\s+\d' OR
      q.option_c ~ '[(]art[íi]culo\s+\d' OR q.option_d ~ '[(]art[íi]culo\s+\d' OR
      q.question_text ILIKE '%pregunta anulada%' OR q.explanation ILIKE '%pregunta anulada%')`;
  out.detector_leaked_meta = meta.n;

  // ocr: corchete intra-palabra (basura OCR), alta precisión §19
  const [ocr] = await sql`
    SELECT count(*)::int n FROM questions q WHERE q.is_active = true AND (
      q.question_text ~ '\w[\]\[]\w' OR q.option_a ~ '\w[\]\[]\w' OR
      q.option_b ~ '\w[\]\[]\w' OR q.option_c ~ '\w[\]\[]\w' OR q.option_d ~ '\w[\]\[]\w')`;
  out.detector_ocr = ocr.n;

  // Ejemplos del detector (5 de cada uno) para verificar precisión a ojo
  out.detector_examples = {};
  out.detector_examples.dup = await sql`
    SELECT q.id, q.option_a, q.option_b, q.option_c, q.option_d FROM questions q
    WHERE q.is_active = true AND (
      btrim(q.option_a)=btrim(q.option_b) OR btrim(q.option_a)=btrim(q.option_c) OR
      btrim(q.option_b)=btrim(q.option_c)) LIMIT 5`;
  out.detector_examples.meta = await sql`
    SELECT q.id, q.option_a, q.option_b, q.option_c, q.option_d FROM questions q
    WHERE q.is_active = true AND (
      q.option_a ~ '[(]art[íi]culo\s+\d' OR q.option_b ~ '[(]art[íi]culo\s+\d' OR
      q.option_c ~ '[(]art[íi]culo\s+\d' OR q.option_d ~ '[(]art[íi]culo\s+\d') LIMIT 5`;

  console.log(JSON.stringify(out, null, 2));
  await sql.end();
})().catch(async e => { console.error('ERROR', e.message); try { await sql.end(); } catch(_){} process.exit(1); });
