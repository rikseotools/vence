// RE-VERIFICACIÓN de la tanda 4 (paso 7 del método v2.1).
//
// No se re-lee lo que el agente escribió en su fichero: se lee la pregunta VIVA en BD con la
// explicación YA APLICADA. Es la diferencia que hace útil este paso — comprueba lo que el opositor
// está viendo, no lo que se pretendía escribir.
//
// Cubre las 149 (no una muestra): re-verificar es más barato que escribir, y las tandas previas
// dieron entre 2,5% y 6,9% de defecto, todos ellos afirmaciones FALSAS dentro de razones bien
// formadas — invisibles a cualquier gate de forma.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') });
const postgres = require(path.join(ROOT, 'node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 });
const BASE = __dirname;
const POR_LOTE = parseInt(process.argv[2] || '25', 10);

(async () => {
  const ids = fs.readdirSync(path.join(BASE, 'estructuradas')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  const rows = await sql`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option,
           q.explanation, q.is_official_exam, a.id aid, a.article_number, a.title atitle, a.content acontent,
           l.short_name ley, (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) exp
      FROM questions q LEFT JOIN articles a ON a.id=q.primary_article_id LEFT JOIN laws l ON l.id=a.law_id
     WHERE q.id = ANY(string_to_array(${ids.join(',')}, ',')::uuid[])
     ORDER BY exp DESC`;

  const OUT = path.join(BASE, 'reverificacion');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'lotes'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'articulos'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'salida'), { recursive: true });
  const vistos = new Set();
  for (const r of rows) {
    if (!r.aid || vistos.has(r.aid)) continue;
    vistos.add(r.aid);
    fs.writeFileSync(path.join(OUT, 'articulos', `${r.aid}.txt`),
      `LEY: ${r.ley}\nARTÍCULO: ${r.article_number} — ${r.atitle || ''}\n${'='.repeat(70)}\n${r.acontent}`);
  }
  let n = 0;
  for (let i = 0; i < rows.length; i += POR_LOTE) {
    n++;
    const chunk = rows.slice(i, i + POR_LOTE).map(r => ({
      question_id: r.id, servidas: r.exp, es_examen_oficial: r.is_official_exam === true,
      ley: r.ley, articulo: r.article_number,
      articulo_fichero: `data/pilotos/t291-tanda4-30jul/reverificacion/articulos/${r.aid}.txt`,
      enunciado: r.question_text,
      opciones: { A: r.option_a, B: r.option_b, C: r.option_c, D: r.option_d },
      clave_marcada: ['A','B','C','D'][r.correct_option],
      explicacion_aplicada: r.explanation,
    }));
    fs.writeFileSync(path.join(OUT, 'lotes', `rev-${String(n).padStart(2,'0')}.json`), JSON.stringify(chunk, null, 2));
  }
  console.log(`✅ ${rows.length} preguntas · ${n} lotes de ${POR_LOTE} · ${vistos.size} artículos · ${rows.reduce((s,r)=>s+r.exp,0)} exposiciones`);
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1) });
