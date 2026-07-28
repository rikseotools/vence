#!/usr/bin/env node
/**
 * extraer-lote.cjs — saca del cubo «Explicación apelotonada» de /admin/calidad las preguntas
 * ORDENADAS POR EXPOSICIÓN REAL (veces servidas en los últimos 90 días), con su artículo
 * vinculado COMPLETO, y las reparte en ficheros de lote listos para los agentes.
 *
 * El cubo es el mismo predicado que pinta el panel (app/api/admin/question-quality/route.ts):
 * activa + explicación de más de 400 caracteres SIN un solo salto de línea. Es decir, el muro
 * de texto que el opositor se encuentra tras responder.
 *
 * Por qué por exposición y no por id: 256 preguntas (3,2% del cubo) concentran el 77% de las
 * impresiones. Arreglar por orden de aparición reparte el esfuerzo donde nadie lo ve.
 *
 * Uso:
 *   node scripts/apelotonadas/extraer-lote.cjs --min-impresiones 10 --tam 16 --out <dir>
 *   node scripts/apelotonadas/extraer-lote.cjs --ids a,b,c --out <dir>
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const getUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
};

const arg = (n, def) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : def;
};

async function main() {
  const postgres = require(path.join(RAIZ, 'node_modules', 'postgres'));
  const sql = postgres(getUrl(), { ssl: { rejectUnauthorized: false }, max: 2 });
  const minImp = parseInt(arg('min-impresiones', '10'), 10);
  const tam = parseInt(arg('tam', '16'), 10);
  const out = arg('out', '/tmp/apelotonadas');
  const idsRaw = arg('ids', null);
  const ids = idsRaw ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean) : null;

  const filas = await sql`
    WITH cubo AS (
      SELECT id, question_text, option_a, option_b, option_c, option_d, option_e,
             correct_option, explanation, primary_article_id, shuffle_safety
        FROM questions
       WHERE is_active = true
         AND explanation IS NOT NULL
         AND length(explanation) > 400
         AND explanation NOT LIKE '%' || chr(10) || '%'
         AND explanation_data IS NULL
    ), expos AS (
      SELECT tq.question_id, count(*)::int AS veces
        FROM test_questions tq JOIN cubo c ON c.id = tq.question_id
       WHERE tq.created_at > now() - interval '90 days'
       GROUP BY 1
    )
    SELECT c.*, coalesce(e.veces, 0) AS impresiones,
           a.article_number, a.title AS article_title, a.content AS article_content,
           l.short_name AS ley, l.name AS ley_nombre, l.is_virtual, l.id AS law_id, a.id AS article_id
      FROM cubo c
      LEFT JOIN expos e ON e.question_id = c.id
      LEFT JOIN articles a ON a.id = c.primary_article_id
      LEFT JOIN laws l ON l.id = a.law_id
     WHERE ${ids ? sql`c.id = ANY(${ids}::uuid[])` : sql`coalesce(e.veces, 0) >= ${minImp}`}
     ORDER BY coalesce(e.veces, 0) DESC, c.id`;

  fs.mkdirSync(out, { recursive: true });
  const lotes = [];
  for (let i = 0; i < filas.length; i += tam) lotes.push(filas.slice(i, i + tam));
  lotes.forEach((lote, n) => {
    const f = path.join(out, `lote_${String(n + 1).padStart(2, '0')}.json`);
    fs.writeFileSync(f, JSON.stringify(lote, null, 1));
    const imp = lote.reduce((s, q) => s + q.impresiones, 0);
    console.log(`${f}  ${lote.length} preguntas · ${imp} impresiones`);
  });
  console.log(`\nTotal: ${filas.length} preguntas en ${lotes.length} lotes.`);
  await sql.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
