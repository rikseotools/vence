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
 * ## Sirve para MÁS de un cubo (`--cubo`)
 *
 * El pipeline entero (extraer con el artículo → reescribir estructurada → registrar traza →
 * re-verificar sobre BD viva) no tiene nada de específico de las explicaciones apelotonadas: lo
 * único que cambia es QUÉ preguntas entran. Por eso el predicado es un parámetro:
 *
 *   · `apelotonada`    (default) — explicación >400 caracteres sin un solo salto de línea.
 *   · `nota-auditoria` — la «explicación» es la NOTA que un pase de IA escribió SOBRE la
 *     pregunta (`lib/health/auditNoteExplanation.cjs`, el mismo criterio que el barrido). Es un
 *     defecto PEOR: ahí no hay explicación ninguna, hay una crítica. Cola: T-249.
 *
 * ## `--ids` significa esos ids, y punto (arreglado 28/07/2026)
 *
 * Antes `--ids` se aplicaba DENTRO del cubo, así que pedir 35 ids devolvía 8 y los otros 27
 * desaparecían **sin decir nada** — justo cuando se usa para reprocesar una lista que salió de
 * otra consulta, que es para lo que existe. Ahora `--ids` parte de todas las activas con
 * explicación y AVISA si algún id pedido no aparece.
 *
 * Uso:
 *   node scripts/apelotonadas/extraer-lote.cjs --min-impresiones 10 --tam 16 --out <dir>
 *   node scripts/apelotonadas/extraer-lote.cjs --cubo nota-auditoria --min-impresiones 1 --out <dir>
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

  const cubo = arg('cubo', 'apelotonada');
  const { AUDIT_NOTE_PATS, AUDIT_NOTE_META_RE_SRC } = require(
    path.join(RAIZ, 'lib', 'health', 'auditNoteExplanation.cjs'));

  // El predicado de cada cubo. Con `--ids` no se aplica ninguno: los ids MANDAN (ver cabecera).
  const PREDICADOS = {
    apelotonada: sql`length(explanation) > 400
         AND explanation NOT LIKE '%' || chr(10) || '%'
         AND explanation_data IS NULL`,
    // Mismo criterio que el barrido de salud: literales por ILIKE OR el patrón del acto.
    // `ILIKE ANY(array)` y no un OR concatenado: esta librería (porsager/postgres) no tiene
    // `sql.join` —eso es Drizzle—, y el array viaja como UN parámetro, que además es más barato.
    'nota-auditoria': sql`(explanation ILIKE ANY(${AUDIT_NOTE_PATS.map((p) => '%' + p + '%')})
         OR explanation ~* ${AUDIT_NOTE_META_RE_SRC})`,
  };
  if (!ids && !PREDICADOS[cubo]) {
    console.error(`❌ --cubo desconocido: "${cubo}". Opciones: ${Object.keys(PREDICADOS).join(', ')}`);
    process.exit(2);
  }

  const filas = await sql`
    WITH cubo AS (
      SELECT id, question_text, option_a, option_b, option_c, option_d, option_e,
             correct_option, explanation, primary_article_id, shuffle_safety
        FROM questions
       WHERE is_active = true
         AND explanation IS NOT NULL
         AND ${ids ? sql`true` : PREDICADOS[cubo]}
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

  // Un id pedido que no sale es SIEMPRE un aviso: o la pregunta se desactivó, o ya no existe.
  // Callárselo fue el fallo que este script tuvo hasta el 28/07 (35 pedidos → 8 devueltos).
  if (ids) {
    const traidos = new Set(filas.map((f) => f.id));
    const perdidos = ids.filter((i) => !traidos.has(i));
    if (perdidos.length)
      console.warn(`⚠️  ${perdidos.length} de ${ids.length} ids NO salieron (inactiva o inexistente): ${perdidos.slice(0, 5).join(', ')}${perdidos.length > 5 ? '…' : ''}`);
  }

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
