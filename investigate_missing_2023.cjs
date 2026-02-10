require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Leer JSON
  const json = JSON.parse(fs.readFileSync("data/examenes-oficiales/auxiliar-administrativo-estado/23-01-20 convocatoria 20 enero 2023 - OEP 2021-2022/20 de enero de 2023.json", "utf-8"));
  const primeraParteJson = json.partes[0].preguntas.slice(0, 30); // Solo legislativas (1-30)

  // Obtener todas las preguntas del examen 2023 primera parte (activas e inactivas)
  const { data: bdAll } = await supabase
    .from("questions")
    .select("id, question_text, is_active, exam_source, correct_option, created_at, updated_at")
    .eq("exam_date", "2023-01-20")
    .eq("is_official_exam", true)
    .like("exam_source", "%Primera parte%")
    .not("exam_source", "ilike", "%Reserva%");

  console.log("=== INVESTIGACIÓN COMPLETA: PREGUNTAS FALTANTES EXAMEN 2023 ===\n");
  console.log("En JSON (Q1-Q30):", primeraParteJson.length);
  console.log("En BD total:", bdAll?.length);
  console.log("En BD activas:", bdAll?.filter(q => q.is_active).length);
  console.log("En BD inactivas:", bdAll?.filter(q => !q.is_active).length);

  // Para cada pregunta del JSON, buscar en BD
  console.log("\n" + "=".repeat(80));
  console.log("ANÁLISIS PREGUNTA POR PREGUNTA");
  console.log("=".repeat(80));

  for (const jsonQ of primeraParteJson) {
    const num = jsonQ.numero;
    const enunciado = jsonQ.enunciado;
    const correctaJson = jsonQ.respuesta_correcta.toUpperCase();
    const correctaIndex = correctaJson.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3

    // Buscar en BD por similitud de texto (primeros 40 chars)
    const searchText = enunciado.substring(0, 40).toLowerCase();

    // Buscar en todas las preguntas del examen 2023
    const found = bdAll?.filter(q =>
      q.question_text?.toLowerCase().includes(searchText)
    );

    // También buscar en TODA la BD
    const { data: foundGlobal } = await supabase
      .from("questions")
      .select("id, is_active, exam_date, exam_source, correct_option, created_at")
      .ilike("question_text", "%" + searchText + "%")
      .limit(5);

    console.log(`\n--- Q${num} ---`);
    console.log("JSON:", enunciado.substring(0, 70) + "...");
    console.log("Correcta JSON:", correctaJson, `(index: ${correctaIndex})`);

    if (found && found.length > 0) {
      console.log("✅ EN EXAMEN 2023:", found.length, "copia(s)");
      found.forEach(f => {
        const status = f.is_active ? "ACTIVA" : "INACTIVA";
        const correctMatch = f.correct_option === correctaIndex ? "✓" : "✗ DIFERENTE!";
        console.log(`   - ID: ${f.id.substring(0,8)} | ${status} | Correct BD: ${f.correct_option} ${correctMatch}`);
        if (!f.is_active) {
          console.log(`     Updated: ${f.updated_at} (posible razón de desactivación)`);
        }
      });
    } else {
      console.log("❌ NO EN EXAMEN 2023");

      if (foundGlobal && foundGlobal.length > 0) {
        console.log("   Pero existe en BD con otro exam_date:");
        foundGlobal.forEach(f => {
          console.log(`   - ID: ${f.id.substring(0,8)} | Date: ${f.exam_date || 'null'} | Active: ${f.is_active} | Source: ${f.exam_source?.substring(0,30) || 'null'}`);
        });
      } else {
        console.log("   ⚠️ NO EXISTE EN TODA LA BD");
      }
    }
  }

  // Resumen final
  console.log("\n" + "=".repeat(80));
  console.log("RESUMEN FINAL");
  console.log("=".repeat(80));

  const inactivas = bdAll?.filter(q => !q.is_active) || [];
  if (inactivas.length > 0) {
    console.log("\nPreguntas INACTIVAS del examen 2023 (investigar por qué):");
    for (const q of inactivas) {
      console.log(`\n- ID: ${q.id}`);
      console.log(`  Texto: ${q.question_text?.substring(0, 60)}...`);
      console.log(`  Updated: ${q.updated_at}`);
      console.log(`  Created: ${q.created_at}`);
    }
  }
})();
