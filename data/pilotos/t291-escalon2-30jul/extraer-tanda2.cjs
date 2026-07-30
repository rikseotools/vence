// TANDA 2 — cambio de cubo, y el motivo está medido.
//
// El cubo de "nunca verificadas" se agotó en VALOR con las 500 de la tanda 1: lo que queda atacable
// son 1.385 preguntas que suman 1.854 exposiciones (media 1,3 apariciones). Gastar cuota de agente
// ahí rinde 1,3 exposiciones por pregunta.
//
// El cubo con audiencia real es otro: **activas YA verificadas y SIN explicación estructurada**,
// 47.263 preguntas con 1,59 M de exposiciones. Su top-500 concentra 221.067 exposiciones (13,9%),
// con un corte de 288 apariciones: 119 veces más exposición por pregunta que seguir con el anterior.
//
// Aquí el trabajo es distinto: la clave ya pasó por una verificación, así que el objetivo es
// ESCRIBIR la explicación estructurada desde el artículo (y comprobar la clave de paso, sin tocarla).
// Se priorizan leyes REALES: sus artículos son fuente completa y citable, al contrario que los
// contenedores que T-302 bloquea.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') });
const postgres = require(path.join(ROOT, 'node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 });

const N = parseInt(process.argv[2] || '400', 10);
const POR_LOTE = parseInt(process.argv[3] || '25', 10);
const OUT = path.join(__dirname, 'tanda2');
// Contenedores sin materia suficiente (T-302): no se gasta agente en ellos hasta enriquecerlos.
const BLOQUEADOS = ['Excel 2016', 'Word 2016', 'PowerPoint 2016', 'Funciones del TCAE',
  'Farmacologia TCAE', 'Comunicacion sanitaria', 'Constantes vitales'];

(async () => {
  await sql.unsafe(`CREATE TEMP TABLE exp AS SELECT question_id, count(*)::int servidas FROM test_questions GROUP BY 1`);
  await sql.unsafe(`CREATE INDEX ON exp (question_id)`);

  const rows = await sql`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
           q.correct_option, q.explanation, q.shuffle_safety, q.shuffle_mode, q.lifecycle_state,
           q.is_official_exam, q.primary_article_id,
           a.article_number, a.title AS article_title, a.content AS article_content,
           l.short_name AS law_short_name, l.name AS law_name, l.is_virtual, l.boe_url,
           coalesce(e.servidas, 0) AS servidas,
           (SELECT string_agg(DISTINCT v.ai_provider, ', ') FROM ai_verification_results v
             WHERE v.question_id = q.id AND coalesce(v.discarded,false) = false) AS verificada_por
      FROM questions q
      LEFT JOIN exp e ON e.question_id = q.id
      LEFT JOIN articles a ON a.id = q.primary_article_id
      LEFT JOIN laws l ON l.id = a.law_id
     WHERE q.is_active AND q.explanation_data IS NULL
       AND EXISTS (SELECT 1 FROM ai_verification_results v
                    WHERE v.question_id = q.id AND coalesce(v.discarded,false) = false)
       AND coalesce(e.servidas,0) > 0
       AND coalesce(l.short_name,'') <> ALL(${BLOQUEADOS})
       AND a.content IS NOT NULL AND length(a.content) > 200
       -- Excluir lo que una pasada anterior ya declaró DEFECTUOSO. Sin esto vuelven a la cola: una
       -- pregunta marcada 'defecto_opciones' no recibe explicación, así que se queda sin
       -- 'explanation_data' y el filtro de arriba la vuelve a seleccionar. Pasó de verdad con
       -- '15b81b24' (Excel, la opción correcta no está entre las cuatro): la tanda 2 la diagnosticó,
       -- la tanda 3 le escribió explicación igualmente, y la re-verificación volvió a cazarla.
       AND NOT EXISTS (
         SELECT 1 FROM ai_verification_results v
          WHERE v.question_id = q.id AND coalesce(v.discarded, false) = false
            AND (v.answer_ok IS FALSE OR v.options_ok IS FALSE OR v.article_ok IS FALSE))
     ORDER BY coalesce(e.servidas,0) DESC, q.id
     LIMIT ${N}`;

  const artDir = path.join(OUT, 'articulos');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(artDir, { recursive: true });
  const vistos = new Set();
  for (const r of rows) {
    if (vistos.has(r.primary_article_id)) continue;
    vistos.add(r.primary_article_id);
    const cab = `LEY: ${r.law_short_name} — ${r.law_name || ''}\nARTÍCULO: ${r.article_number} — ${r.article_title || ''}\n`
      + `is_virtual: ${r.is_virtual === true}\nBOE: ${r.boe_url || '(sin url)'}\n${'='.repeat(70)}\n`;
    fs.writeFileSync(path.join(artDir, `${r.primary_article_id}.txt`), cab + r.article_content);
  }

  // agrupar por artículo (un agente ve pocas fuentes) y los grupos por exposición
  const porArt = new Map();
  for (const r of rows) {
    const k = r.primary_article_id;
    if (!porArt.has(k)) porArt.set(k, []);
    porArt.get(k).push(r);
  }
  const ordenados = [...porArt.values()]
    .sort((a, b) => Math.max(...b.map((x) => x.servidas)) - Math.max(...a.map((x) => x.servidas)))
    .flat();

  const loteDir = path.join(OUT, 'lotes');
  fs.mkdirSync(loteDir, { recursive: true });
  let n = 0;
  for (let i = 0; i < ordenados.length; i += POR_LOTE) {
    n++;
    const chunk = ordenados.slice(i, i + POR_LOTE).map((r) => ({
      question_id: r.id,
      servidas: r.servidas,
      es_examen_oficial: r.is_official_exam === true,
      verificada_por: r.verificada_por,
      enunciado: r.question_text,
      opciones: { 0: r.option_a, 1: r.option_b, 2: r.option_c, 3: r.option_d, 4: r.option_e },
      clave_actual_indice: r.correct_option,
      clave_actual_letra: ['A', 'B', 'C', 'D', 'E'][r.correct_option],
      explicacion_actual: r.explanation,
      ley: r.law_short_name, ley_es_virtual: r.is_virtual === true,
      articulo: r.article_number, articulo_titulo: r.article_title,
      articulo_fichero: `scratchpad/t291/tanda2/articulos/${r.primary_article_id}.txt`,
      boe_url: r.boe_url,
      shuffle_mode: r.shuffle_mode, shuffle_safety: r.shuffle_safety,
    }));
    fs.writeFileSync(path.join(loteDir, `lote-${String(n).padStart(2, '0')}.json`), JSON.stringify(chunk, null, 2));
  }

  const porLey = {};
  for (const r of rows) {
    porLey[r.law_short_name] = porLey[r.law_short_name] || { q: 0, e: 0, virtual: r.is_virtual === true };
    porLey[r.law_short_name].q++; porLey[r.law_short_name].e += r.servidas;
  }
  console.log(`✅ ${rows.length} preguntas · ${n} lotes de ${POR_LOTE} · ${vistos.size} artículos`);
  console.log(`   exposición total: ${rows.reduce((s, r) => s + r.servidas, 0)}`);
  console.log(`   corte: ${rows[rows.length - 1].servidas} apariciones (máx ${rows[0].servidas})`);
  console.log('\nreparto por ley:');
  for (const [k, v] of Object.entries(porLey).sort((a, b) => b[1].e - a[1].e).slice(0, 12)) {
    console.log(`   ${String(v.e).padStart(6)} exp · ${String(v.q).padStart(4)}q · ${v.virtual ? '[virtual]' : '[real]   '} ${k}`);
  }
  await sql.end();
})().catch((e) => { console.error('❌', e.message); process.exit(1) });
