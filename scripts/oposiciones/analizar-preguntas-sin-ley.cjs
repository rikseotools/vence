/**
 * Script para analizar preguntas sin ley identificada usando embeddings
 *
 * Busca en la base de datos de artículos cuáles son los más relevantes
 * para cada pregunta y determina si están cubiertas por el topic_scope.
 *
 * Uso: node scripts/oposiciones/analizar-preguntas-sin-ley.cjs tramitacion_procesal
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let openai = null;

async function getOpenAIKey() {
  const { data } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .single();

  if (!data?.api_key_encrypted) {
    throw new Error('No hay API key de OpenAI configurada');
  }

  return Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8');
}

async function initOpenAI() {
  const apiKey = await getOpenAIKey();
  openai = new OpenAI({ apiKey });
  console.log('✓ API key de OpenAI obtenida\n');
}

const positionType = process.argv[2] || "tramitacion_procesal";

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.substring(0, 8000)
  });
  return response.data[0].embedding;
}

async function main() {
  console.log(`=== ANÁLISIS CON EMBEDDINGS: ${positionType} ===\n`);

  // Inicializar OpenAI
  await initOpenAI();

  // 1. Cargar informe de cobertura
  const examenesDir = path.join(__dirname, "../../data/examenes/tramitacion-procesal");
  const informePath = path.join(examenesDir, "informe-cobertura.json");

  if (!fs.existsSync(informePath)) {
    console.log("❌ No existe el informe de cobertura. Ejecuta primero validar-cobertura-real.cjs");
    return;
  }

  const informe = JSON.parse(fs.readFileSync(informePath));
  const preguntasSinLey = informe.detalles.filter(d => d.estado === "SIN_LEY");

  console.log(`📚 Preguntas sin ley identificada: ${preguntasSinLey.length}\n`);

  if (preguntasSinLey.length === 0) {
    console.log("✅ No hay preguntas sin ley para analizar");
    return;
  }

  // 2. Cargar preguntas completas
  const archivos = fs.readdirSync(examenesDir).filter(f => f.endsWith(".json") && !f.includes("fuentes") && !f.includes("informe"));

  let todasPreguntas = [];
  for (const archivo of archivos) {
    const data = JSON.parse(fs.readFileSync(path.join(examenesDir, archivo)));
    if (data.preguntas) {
      todasPreguntas = todasPreguntas.concat(data.preguntas);
    }
  }

  // 3. Cargar topic_scope para saber qué artículos están cubiertos
  const { data: topics } = await supabase
    .from("topics")
    .select("id, topic_number, title")
    .eq("position_type", positionType);

  const topicIds = topics.map(t => t.id);

  const { data: scopes } = await supabase
    .from("topic_scope")
    .select("topic_id, law_id, article_numbers")
    .in("topic_id", topicIds);

  // Crear set de artículos cubiertos (law_id + article_number)
  const articulosCubiertos = new Set();
  const leyesCubiertas = new Set();

  for (const scope of scopes || []) {
    leyesCubiertas.add(scope.law_id);
    if (scope.article_numbers) {
      for (const art of scope.article_numbers) {
        articulosCubiertos.add(`${scope.law_id}:${art}`);
      }
    }
  }

  // Cargar nombres de leyes
  const { data: laws } = await supabase
    .from("laws")
    .select("id, short_name, name");

  const lawById = {};
  for (const law of laws) {
    lawById[law.id] = law;
  }

  console.log(`📋 Leyes en scope: ${leyesCubiertas.size}`);
  console.log(`📋 Artículos específicos en scope: ${articulosCubiertos.size}\n`);

  // 4. Analizar cada pregunta sin ley
  const resultados = [];

  console.log("🔍 Analizando preguntas con embeddings...\n");

  for (let i = 0; i < preguntasSinLey.length; i++) {
    const detalle = preguntasSinLey[i];
    const preguntaCompleta = todasPreguntas.find(p => p.numero === detalle.numero);

    if (!preguntaCompleta) {
      console.log(`⚠️  P${detalle.numero}: No encontrada en archivos`);
      continue;
    }

    const textoCompleto = `${preguntaCompleta.texto} ${Object.values(preguntaCompleta.opciones).join(" ")}`;

    process.stdout.write(`[${i + 1}/${preguntasSinLey.length}] P${detalle.numero}: `);

    try {
      // Obtener embedding de la pregunta
      const embedding = await getEmbedding(textoCompleto);

      // Buscar artículos similares usando match_articles
      const { data: matches, error } = await supabase.rpc("match_articles", {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5
      });

      if (error) {
        console.log(`❌ Error: ${error.message}`);
        continue;
      }

      if (!matches || matches.length === 0) {
        console.log("❓ Sin coincidencias");
        resultados.push({
          numero: detalle.numero,
          texto: detalle.texto,
          estado: "SIN_COINCIDENCIAS",
          matches: []
        });
        continue;
      }

      // Verificar si los artículos encontrados están en scope
      const matchesConInfo = [];
      let cubierta = false;

      for (const match of matches) {
        const law = lawById[match.law_id];
        const enScope = leyesCubiertas.has(match.law_id);

        matchesConInfo.push({
          law_id: match.law_id,
          law_name: law?.short_name || "Desconocida",
          article_number: match.article_number,
          similarity: match.similarity,
          en_scope: enScope
        });

        if (enScope) {
          cubierta = true;
        }
      }

      const topMatch = matchesConInfo[0];
      const estado = cubierta ? "CUBIERTA_POR_EMBEDDING" : "NO_CUBIERTA";
      const icon = cubierta ? "✅" : "❌";

      console.log(`${icon} ${topMatch.law_name} Art.${topMatch.article_number} (${(topMatch.similarity * 100).toFixed(1)}%)`);

      resultados.push({
        numero: detalle.numero,
        texto: detalle.texto,
        estado,
        matches: matchesConInfo
      });

      // Pequeña pausa para no saturar la API
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  // 5. Mostrar resumen
  console.log("\n" + "=".repeat(60));
  console.log("RESUMEN DEL ANÁLISIS CON EMBEDDINGS");
  console.log("=".repeat(60));

  const cubiertasPorEmbedding = resultados.filter(r => r.estado === "CUBIERTA_POR_EMBEDDING").length;
  const noCubiertas = resultados.filter(r => r.estado === "NO_CUBIERTA").length;
  const sinCoincidencias = resultados.filter(r => r.estado === "SIN_COINCIDENCIAS").length;

  console.log(`Total analizadas: ${resultados.length}`);
  console.log(`✅ Cubiertas por scope: ${cubiertasPorEmbedding}`);
  console.log(`❌ No cubiertas: ${noCubiertas}`);
  console.log(`❓ Sin coincidencias: ${sinCoincidencias}`);

  // Mostrar las NO cubiertas
  if (noCubiertas > 0) {
    console.log("\n⚠️  PREGUNTAS NO CUBIERTAS:");
    for (const r of resultados.filter(r => r.estado === "NO_CUBIERTA")) {
      const topMatch = r.matches[0];
      console.log(`  P${r.numero}: ${r.texto}...`);
      console.log(`    → Mejor match: ${topMatch.law_name} Art.${topMatch.article_number} (${(topMatch.similarity * 100).toFixed(1)}%)`);
    }
  }

  // Estadísticas por ley encontrada
  console.log("\n📊 LEYES DETECTADAS POR EMBEDDING:");
  const porLey = {};
  for (const r of resultados.filter(r => r.matches.length > 0)) {
    const topLaw = r.matches[0].law_name;
    if (!porLey[topLaw]) {
      porLey[topLaw] = { cubiertas: 0, noCubiertas: 0 };
    }
    if (r.matches[0].en_scope) {
      porLey[topLaw].cubiertas++;
    } else {
      porLey[topLaw].noCubiertas++;
    }
  }

  for (const [ley, stats] of Object.entries(porLey).sort((a, b) => (b[1].cubiertas + b[1].noCubiertas) - (a[1].cubiertas + a[1].noCubiertas))) {
    const total = stats.cubiertas + stats.noCubiertas;
    const icon = stats.noCubiertas === 0 ? "✅" : "⚠️";
    console.log(`  ${icon} ${ley.padEnd(20)}: ${stats.cubiertas} en scope, ${stats.noCubiertas} fuera`);
  }

  // Guardar resultados
  const resultadosPath = path.join(examenesDir, "analisis-embeddings.json");
  fs.writeFileSync(resultadosPath, JSON.stringify({
    fecha: new Date().toISOString(),
    position_type: positionType,
    total_analizadas: resultados.length,
    cubiertas_por_embedding: cubiertasPorEmbedding,
    no_cubiertas: noCubiertas,
    sin_coincidencias: sinCoincidencias,
    por_ley: porLey,
    resultados
  }, null, 2));

  console.log(`\n📄 Resultados guardados en: ${resultadosPath}`);

  // Cobertura final combinada
  const totalPreguntas = informe.total_preguntas;
  const cubiertasRegex = informe.cubiertas;
  const totalCubiertas = cubiertasRegex + cubiertasPorEmbedding;
  const coberturaCombinada = (totalCubiertas / totalPreguntas) * 100;

  console.log("\n" + "=".repeat(60));
  console.log("COBERTURA FINAL COMBINADA");
  console.log("=".repeat(60));
  console.log(`Por regex: ${cubiertasRegex}/${totalPreguntas}`);
  console.log(`Por embedding: ${cubiertasPorEmbedding}/${preguntasSinLey.length}`);
  console.log(`❌ Sin cobertura: ${noCubiertas + sinCoincidencias}`);
  console.log(`\n📊 COBERTURA TOTAL: ${totalCubiertas}/${totalPreguntas} (${coberturaCombinada.toFixed(1)}%)`);
}

main().catch(console.error);
