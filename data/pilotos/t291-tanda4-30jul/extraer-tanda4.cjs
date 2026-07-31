// TANDA 4 — cubo de T-291 por exposición, con dos cambios respecto a la tanda 2:
//  · Office 2016 YA NO se excluye: sus 15 artículos se enriquecieron el 30/07 (T-302), así que ya
//    hay contra qué verificar y de qué citar.
//  · Siguen fuera los contenedores clínicos TCAE, que siguen sin enriquecer.
// Se excluye lo que una pasada anterior declaró defectuoso (si no, vuelve a la cola por seguir
// cumpliendo `explanation_data IS NULL`) y lo que ya tiene estructura.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') });
const postgres = require(path.join(ROOT, 'node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 });
const N = parseInt(process.argv[2] || '150', 10);
const POR_LOTE = parseInt(process.argv[3] || '25', 10);
const OUT = path.join(__dirname, 'tanda4');
const BLOQUEADOS = ['Funciones del TCAE', 'Farmacologia TCAE', 'Comunicacion sanitaria', 'Constantes vitales'];

(async () => {
  await sql.unsafe(`CREATE TEMP TABLE exp AS SELECT question_id, count(*)::int servidas FROM test_questions GROUP BY 1`);
  await sql.unsafe(`CREATE INDEX ON exp (question_id)`);
  const rows = await sql`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
           q.correct_option, q.explanation, q.is_official_exam, q.primary_article_id,
           a.article_number, a.title AS article_title, a.content AS article_content,
           l.short_name AS law_short_name, l.is_virtual, coalesce(e.servidas,0) AS servidas
      FROM questions q
      LEFT JOIN exp e ON e.question_id = q.id
      LEFT JOIN articles a ON a.id = q.primary_article_id
      LEFT JOIN laws l ON l.id = a.law_id
     WHERE q.is_active AND q.explanation_data IS NULL
       AND EXISTS (SELECT 1 FROM ai_verification_results v WHERE v.question_id=q.id AND coalesce(v.discarded,false)=false)
       AND coalesce(e.servidas,0) > 0
       AND coalesce(l.short_name,'') <> ALL(${BLOQUEADOS})
       AND a.content IS NOT NULL AND length(a.content) > 1500
       AND NOT EXISTS (SELECT 1 FROM ai_verification_results v WHERE v.question_id=q.id
             AND coalesce(v.discarded,false)=false AND (v.answer_ok IS FALSE OR v.options_ok IS FALSE OR v.article_ok IS FALSE))
     ORDER BY coalesce(e.servidas,0) DESC, q.id LIMIT ${N}`;

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'articulos'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'lotes'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'salida'), { recursive: true });
  const vistos = new Set();
  for (const r of rows) {
    if (vistos.has(r.primary_article_id)) continue;
    vistos.add(r.primary_article_id);
    fs.writeFileSync(path.join(OUT, 'articulos', `${r.primary_article_id}.txt`),
      `LEY: ${r.law_short_name}\nARTÍCULO: ${r.article_number} — ${r.article_title || ''}\n${'='.repeat(70)}\n${r.article_content}`);
  }
  const porArt = new Map();
  for (const r of rows) { const k = r.primary_article_id; if (!porArt.has(k)) porArt.set(k, []); porArt.get(k).push(r); }
  const ordenados = [...porArt.values()].sort((a,b)=>Math.max(...b.map(x=>x.servidas))-Math.max(...a.map(x=>x.servidas))).flat();
  let n = 0;
  for (let i = 0; i < ordenados.length; i += POR_LOTE) {
    n++;
    const chunk = ordenados.slice(i, i + POR_LOTE).map((r) => ({
      question_id: r.id, servidas: r.servidas, es_examen_oficial: r.is_official_exam === true,
      enunciado: r.question_text,
      opciones: { 0: r.option_a, 1: r.option_b, 2: r.option_c, 3: r.option_d, 4: r.option_e },
      clave_actual_indice: r.correct_option, clave_actual_letra: ['A','B','C','D','E'][r.correct_option],
      explicacion_actual: r.explanation, ley: r.law_short_name, ley_es_virtual: r.is_virtual === true,
      articulo: r.article_number, articulo_titulo: r.article_title,
      articulo_fichero: `scratchpad/t291/tanda4/articulos/${r.primary_article_id}.txt`,
    }));
    fs.writeFileSync(path.join(OUT, 'lotes', `lote-${String(n).padStart(2,'0')}.json`), JSON.stringify(chunk, null, 2));
  }
  console.log(`✅ ${rows.length} preguntas · ${n} lotes de ${POR_LOTE} · ${vistos.size} artículos`);
  console.log(`   exposición: ${rows.reduce((s,r)=>s+r.servidas,0)} · corte ${rows[rows.length-1].servidas} (máx ${rows[0].servidas})`);
  const porLey = {};
  for (const r of rows) { porLey[r.law_short_name] = (porLey[r.law_short_name]||0)+1 }
  console.log('   ' + Object.entries(porLey).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`${k}:${v}`).join(' · '));
  await sql.end();
})().catch((e)=>{console.error('❌',e.message);process.exit(1)});
