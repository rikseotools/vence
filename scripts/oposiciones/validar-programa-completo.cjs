/**
 * Script para validar cobertura del PROGRAMA OFICIAL completo
 *
 * Compara cada epígrafe del temario con los artículos disponibles
 * y verifica que el topic_scope cubra todo el contenido.
 *
 * Uso: node scripts/oposiciones/validar-programa-completo.cjs tramitacion_procesal
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
    .from("ai_api_config")
    .select("api_key_encrypted")
    .eq("provider", "openai")
    .single();

  if (!data?.api_key_encrypted) {
    throw new Error("No hay API key de OpenAI configurada");
  }

  return Buffer.from(data.api_key_encrypted, "base64").toString("utf-8");
}

async function initOpenAI() {
  const apiKey = await getOpenAIKey();
  openai = new OpenAI({ apiKey });
  console.log("✓ API key de OpenAI obtenida\n");
}

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.substring(0, 8000)
  });
  return response.data[0].embedding;
}

const positionType = process.argv[2] || "tramitacion_procesal";

async function main() {
  console.log(`=== VALIDACIÓN DE PROGRAMA COMPLETO: ${positionType} ===\n`);

  await initOpenAI();

  // 1. Cargar temario
  const temarioPath = path.join(__dirname, "../../data/temarios/tramitacion-procesal.json");
  if (!fs.existsSync(temarioPath)) {
    console.log("❌ No existe el archivo de temario");
    return;
  }

  const temario = JSON.parse(fs.readFileSync(temarioPath));
  console.log(`📚 Temas en programa: ${temario.temas.length}\n`);

  // 2. Cargar topic_scope
  const { data: topics } = await supabase
    .from("topics")
    .select("id, topic_number, title")
    .eq("position_type", positionType);

  const topicByNumber = {};
  for (const t of topics) {
    topicByNumber[t.topic_number] = t;
  }

  const topicIds = topics.map(t => t.id);
  const { data: scopes } = await supabase
    .from("topic_scope")
    .select("topic_id, law_id")
    .in("topic_id", topicIds);

  // Crear mapa de leyes por tema
  const leyesPorTema = {};
  for (const scope of scopes || []) {
    const topic = topics.find(t => t.id === scope.topic_id);
    if (topic) {
      if (!leyesPorTema[topic.topic_number]) {
        leyesPorTema[topic.topic_number] = new Set();
      }
      leyesPorTema[topic.topic_number].add(scope.law_id);
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

  // Set de todas las leyes en scope
  const todasLeyesEnScope = new Set();
  for (const scope of scopes || []) {
    todasLeyesEnScope.add(scope.law_id);
  }

  console.log(`📋 Topics en BD: ${topics.length}`);
  console.log(`📋 Scopes totales: ${scopes?.length || 0}`);
  console.log(`📋 Leyes en scope: ${todasLeyesEnScope.size}\n`);

  // 3. Analizar cada tema
  const resultados = [];

  console.log("🔍 Analizando cobertura de cada tema...\n");

  for (const tema of temario.temas) {
    // Saltamos temas de informática (32-37) que no tienen leyes
    if (tema.numero >= 32) {
      console.log(`[${tema.numero}/37] ${tema.titulo}: ⏭️  Tema de informática (sin leyes)`);
      resultados.push({
        numero: tema.numero,
        titulo: tema.titulo,
        tipo: "informatica",
        cobertura: "N/A"
      });
      continue;
    }

    process.stdout.write(`[${tema.numero}/37] ${tema.titulo}: `);

    try {
      // Obtener embedding del epígrafe
      const embedding = await getEmbedding(tema.epigrafe);

      // Buscar artículos similares
      const { data: matches, error } = await supabase.rpc("match_articles", {
        query_embedding: embedding,
        match_threshold: 0.25,
        match_count: 10
      });

      if (error) {
        console.log(`❌ Error: ${error.message}`);
        continue;
      }

      if (!matches || matches.length === 0) {
        console.log("❓ Sin coincidencias");
        resultados.push({
          numero: tema.numero,
          titulo: tema.titulo,
          tipo: "derecho",
          cobertura: "SIN_MATCHES",
          matches: []
        });
        continue;
      }

      // Verificar cobertura
      const leyesTema = leyesPorTema[tema.numero] || new Set();
      const leyesEncontradas = new Set();
      const leyesFaltantes = new Set();
      const matchesInfo = [];

      for (const match of matches) {
        const law = lawById[match.law_id];
        const enScopeTema = leyesTema.has(match.law_id);
        const enScopeGeneral = todasLeyesEnScope.has(match.law_id);

        leyesEncontradas.add(match.law_id);

        if (!enScopeTema && match.similarity > 0.4) {
          leyesFaltantes.add(match.law_id);
        }

        matchesInfo.push({
          law_id: match.law_id,
          law_name: law?.short_name || "?",
          article: match.article_number,
          similarity: match.similarity,
          en_scope_tema: enScopeTema,
          en_scope_general: enScopeGeneral
        });
      }

      // Calcular cobertura
      const matchesEnScope = matchesInfo.filter(m => m.en_scope_tema).length;
      const matchesAltos = matchesInfo.filter(m => m.similarity > 0.4).length;
      const coberturaScore = matchesAltos > 0 ? (matchesEnScope / matchesAltos) * 100 : 100;

      let estado;
      let icon;
      if (coberturaScore >= 80) {
        estado = "BUENA";
        icon = "✅";
      } else if (coberturaScore >= 50) {
        estado = "PARCIAL";
        icon = "⚠️";
      } else {
        estado = "BAJA";
        icon = "❌";
      }

      const topMatch = matchesInfo[0];
      console.log(`${icon} ${coberturaScore.toFixed(0)}% - Top: ${topMatch.law_name} Art.${topMatch.article} (${(topMatch.similarity * 100).toFixed(0)}%)`);

      // Mostrar leyes faltantes si hay
      if (leyesFaltantes.size > 0 && coberturaScore < 80) {
        const faltantesNombres = [...leyesFaltantes].map(id => lawById[id]?.short_name || id).join(", ");
        console.log(`   → Falta añadir: ${faltantesNombres}`);
      }

      resultados.push({
        numero: tema.numero,
        titulo: tema.titulo,
        tipo: "derecho",
        cobertura: estado,
        cobertura_pct: coberturaScore,
        matches: matchesInfo,
        leyes_faltantes: [...leyesFaltantes].map(id => ({
          id,
          name: lawById[id]?.short_name
        }))
      });

      // Pausa para no saturar API
      await new Promise(r => setTimeout(r, 300));

    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  // 4. Resumen
  console.log("\n" + "=".repeat(60));
  console.log("RESUMEN DE COBERTURA DEL PROGRAMA");
  console.log("=".repeat(60));

  const temasDerecho = resultados.filter(r => r.tipo === "derecho");
  const buena = temasDerecho.filter(r => r.cobertura === "BUENA").length;
  const parcial = temasDerecho.filter(r => r.cobertura === "PARCIAL").length;
  const baja = temasDerecho.filter(r => r.cobertura === "BAJA").length;
  const sinMatches = temasDerecho.filter(r => r.cobertura === "SIN_MATCHES").length;

  console.log(`\nTemas de derecho: ${temasDerecho.length}`);
  console.log(`✅ Cobertura buena (≥80%): ${buena}`);
  console.log(`⚠️  Cobertura parcial (50-79%): ${parcial}`);
  console.log(`❌ Cobertura baja (<50%): ${baja}`);
  console.log(`❓ Sin matches: ${sinMatches}`);

  const coberturaMedia = temasDerecho
    .filter(r => r.cobertura_pct !== undefined)
    .reduce((sum, r) => sum + r.cobertura_pct, 0) / temasDerecho.filter(r => r.cobertura_pct !== undefined).length;

  console.log(`\n📊 COBERTURA MEDIA: ${coberturaMedia.toFixed(1)}%`);

  // Mostrar temas con problemas
  const temasProblema = resultados.filter(r => r.cobertura === "PARCIAL" || r.cobertura === "BAJA");
  if (temasProblema.length > 0) {
    console.log("\n⚠️  TEMAS QUE NECESITAN REVISIÓN:");
    for (const t of temasProblema) {
      const faltantes = t.leyes_faltantes?.map(l => l.name).join(", ") || "N/A";
      console.log(`  Tema ${t.numero}: ${t.titulo}`);
      console.log(`    → Cobertura: ${t.cobertura_pct?.toFixed(0)}% | Falta añadir: ${faltantes}`);
    }
  }

  // Recopilar todas las leyes que faltan
  const todasLeyesFaltantes = new Map();
  for (const r of resultados) {
    if (r.leyes_faltantes) {
      for (const ley of r.leyes_faltantes) {
        if (!todasLeyesFaltantes.has(ley.id)) {
          todasLeyesFaltantes.set(ley.id, { name: ley.name, temas: [] });
        }
        todasLeyesFaltantes.get(ley.id).temas.push(r.numero);
      }
    }
  }

  if (todasLeyesFaltantes.size > 0) {
    console.log("\n📋 LEYES A AÑADIR AL SCOPE:");
    for (const [id, info] of todasLeyesFaltantes) {
      console.log(`  - ${info.name}: Temas ${info.temas.join(", ")}`);
    }
  }

  // Guardar informe
  const informePath = path.join(__dirname, "../../data/temarios/informe-cobertura-programa.json");
  fs.writeFileSync(informePath, JSON.stringify({
    fecha: new Date().toISOString(),
    position_type: positionType,
    total_temas: temario.temas.length,
    temas_derecho: temasDerecho.length,
    cobertura_buena: buena,
    cobertura_parcial: parcial,
    cobertura_baja: baja,
    cobertura_media: coberturaMedia,
    leyes_faltantes: Object.fromEntries(todasLeyesFaltantes),
    resultados
  }, null, 2));

  console.log(`\n📄 Informe guardado en: ${informePath}`);
}

main().catch(console.error);
