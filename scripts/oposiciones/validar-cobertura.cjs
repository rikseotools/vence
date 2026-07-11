/**
 * Script para validar cobertura de preguntas con topic_scope
 *
 * Verifica que las preguntas de exámenes oficiales se pueden responder
 * con los artículos vinculados en topic_scope.
 *
 * Uso: node scripts/oposiciones/validar-cobertura.cjs <position_type>
 *
 * El script:
 * 1. Carga preguntas de exámenes (JSON)
 * 2. Para cada pregunta, genera embedding y busca artículos similares
 * 3. Verifica si los artículos encontrados están en topic_scope
 * 4. Genera informe de cobertura
 */

const { createClient } = require('../lib/pg-agnostic-client.cjs');
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fs = require("fs");
const path = require("path");

const positionType = process.argv[2];

if (!positionType) {
  console.log("Uso: node scripts/oposiciones/validar-cobertura.cjs <position_type>");
  console.log("Ejemplo: node scripts/oposiciones/validar-cobertura.cjs tramitacion_procesal");
  process.exit(1);
}

// Función para calcular similitud coseno
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  console.log(`=== VALIDACIÓN DE COBERTURA: ${positionType} ===\n`);

  // 1. Cargar topic_scope de esta oposición
  console.log("📚 Cargando topic_scope...");

  const { data: topics } = await supabase
    .from("topics")
    .select("id, topic_number, title")
    .eq("position_type", positionType);

  if (!topics || topics.length === 0) {
    console.log("❌ No hay topics para este position_type");
    console.log("   Primero ejecuta: node scripts/oposiciones/crear-tramitacion-procesal.cjs");
    return;
  }

  const topicIds = topics.map(t => t.id);

  const { data: scopes } = await supabase
    .from("topic_scope")
    .select("topic_id, law_id, article_numbers")
    .in("topic_id", topicIds);

  console.log(`  Topics: ${topics.length}`);
  console.log(`  Scopes: ${scopes?.length || 0}`);

  // Construir mapa de artículos cubiertos
  const articulosCubiertos = new Map(); // law_id:article_number -> topic_id

  for (const scope of scopes || []) {
    for (const artNum of scope.article_numbers) {
      const key = `${scope.law_id}:${artNum}`;
      if (!articulosCubiertos.has(key)) {
        articulosCubiertos.set(key, []);
      }
      articulosCubiertos.get(key).push(scope.topic_id);
    }
  }

  console.log(`  Artículos en scope: ${articulosCubiertos.size}\n`);

  // 2. Cargar artículos con embeddings
  console.log("📚 Cargando artículos con embeddings...");

  const { data: articles, error: artError } = await supabase
    .from("articles")
    .select("id, law_id, article_number, title, content, embedding")
    .not("embedding", "is", null)
    .limit(10000);

  if (artError) {
    console.log("❌ Error cargando artículos:", artError.message);
    return;
  }

  console.log(`  Artículos con embedding: ${articles.length}\n`);

  // 3. Cargar preguntas de ejemplo (simuladas por ahora)
  // En producción, esto vendría de los PDFs parseados
  const preguntasEjemplo = [
    {
      id: 1,
      texto: "Según el artículo 117 de la Constitución Española, la justicia emana:",
      respuesta: "Del pueblo",
      tema_esperado: 6
    },
    {
      id: 2,
      texto: "El Tribunal Supremo tiene su sede en:",
      respuesta: "Madrid",
      tema_esperado: 7
    },
    {
      id: 3,
      texto: "Según la Ley de Enjuiciamiento Civil, el juicio ordinario se reserva para cuantías superiores a:",
      respuesta: "6.000 euros",
      tema_esperado: 16
    },
    {
      id: 4,
      texto: "La inscripción de nacimiento en el Registro Civil debe realizarse en el plazo de:",
      respuesta: "10 días",
      tema_esperado: 30
    },
    {
      id: 5,
      texto: "Según la Ley Orgánica 1/2004, de violencia de género, ¿qué tipo de violencia comprende?",
      respuesta: "Física, psicológica, sexual y económica",
      tema_esperado: 2
    }
  ];

  console.log("🔍 Validando preguntas de ejemplo...\n");

  let cubiertas = 0;
  let noCubiertas = 0;
  const detalles = [];

  for (const pregunta of preguntasEjemplo) {
    // Buscar artículos relevantes por texto (simplificado)
    // En producción usaríamos embeddings
    const textoLower = pregunta.texto.toLowerCase();

    // Buscar coincidencias en contenido de artículos
    let mejorMatch = null;
    let mejorScore = 0;

    for (const art of articles) {
      const contenido = (art.content || "").toLowerCase();
      const titulo = (art.title || "").toLowerCase();

      // Puntuación simple por coincidencia de palabras
      const palabrasPregunta = textoLower.split(/\s+/).filter(p => p.length > 4);
      let score = 0;
      for (const palabra of palabrasPregunta) {
        if (contenido.includes(palabra) || titulo.includes(palabra)) {
          score++;
        }
      }

      if (score > mejorScore) {
        mejorScore = score;
        mejorMatch = art;
      }
    }

    // Verificar si el artículo está en scope
    const cubierta = mejorMatch
      ? articulosCubiertos.has(`${mejorMatch.law_id}:${mejorMatch.article_number}`)
      : false;

    if (cubierta) {
      cubiertas++;
      console.log(`✅ P${pregunta.id}: "${pregunta.texto.substring(0, 50)}..."`);
      console.log(`   → Artículo: ${mejorMatch?.article_number} (score: ${mejorScore})`);
    } else {
      noCubiertas++;
      console.log(`❌ P${pregunta.id}: "${pregunta.texto.substring(0, 50)}..."`);
      if (mejorMatch) {
        console.log(`   → Mejor match: Art ${mejorMatch.article_number} pero NO en scope`);
      } else {
        console.log(`   → No se encontró artículo relacionado`);
      }
    }
    console.log("");

    detalles.push({
      pregunta: pregunta.id,
      cubierta,
      articuloEncontrado: mejorMatch?.article_number,
      score: mejorScore
    });
  }

  // 4. Resumen
  console.log("=".repeat(50));
  console.log("RESUMEN DE COBERTURA");
  console.log("=".repeat(50));
  console.log(`Total preguntas: ${preguntasEjemplo.length}`);
  console.log(`Cubiertas: ${cubiertas} (${((cubiertas / preguntasEjemplo.length) * 100).toFixed(1)}%)`);
  console.log(`No cubiertas: ${noCubiertas}`);
  console.log("");

  if (noCubiertas > 0) {
    console.log("⚠️  Hay preguntas sin cobertura.");
    console.log("   Ejecuta: node scripts/oposiciones/ajustar-topic-scope.cjs para corregir");
  } else {
    console.log("✅ 100% de cobertura alcanzada");
    console.log("   La oposición está lista para activar");
  }

  console.log("\n📝 NOTA: Esta es una validación de ejemplo.");
  console.log("   Para validación real, importa preguntas de exámenes oficiales.");
}

main().catch(console.error);
