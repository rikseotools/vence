require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchQuestion(searchText, label) {
  console.log("\n" + "=".repeat(70));
  console.log("PREGUNTA:", label);
  console.log("=".repeat(70));

  const { data } = await supabase
    .from("questions")
    .select("id, question_text, is_active, is_official_exam, exam_source, correct_option")
    .ilike("question_text", `%${searchText}%`);

  console.log("Total encontradas:", data?.length || 0);
  console.log("Activas:", data?.filter(q => q.is_active).length || 0);

  data?.forEach((q, i) => {
    console.log("\n--- Copia", i + 1, "---");
    console.log("ID:", q.id);
    console.log("is_active:", q.is_active ? "✅ SÍ" : "❌ NO");
    console.log("is_official_exam:", q.is_official_exam ? "✅ SÍ" : "❌ NO");
    console.log("exam_source:", q.exam_source || "NULL");
    console.log("correct_option:", q.correct_option, "(A=0, B=1, C=2, D=3)");
    console.log("Texto:", q.question_text?.substring(0, 120) + "...");
  });

  // Alerta si hay más de 1 activa
  const activas = data?.filter(q => q.is_active) || [];
  if (activas.length > 1) {
    console.log("\n⚠️⚠️⚠️ PROBLEMA: HAY", activas.length, "COPIAS ACTIVAS ⚠️⚠️⚠️");
  }

  return data;
}

(async () => {
  // Pregunta 1: personas físicas fallecidas
  await searchQuestion(
    "lo que respecta a los datos sobre las personas físicas fallecidas",
    "Personas físicas fallecidas"
  );

  // Pregunta 2: fases del procedimiento de gestión
  await searchQuestion(
    "fases del procedimiento de gestión del Presupuesto de gastos",
    "Fases procedimiento gestión Presupuesto"
  );

  // También buscar variante "de la gestión"
  await searchQuestion(
    "fases del procedimiento de la gestión del Presupuesto",
    "Fases procedimiento DE LA gestión (variante)"
  );

  // Pregunta 3: funcionarios interinos
  await searchQuestion(
    "funcionarios interinos los que, por razones expresamente justificadas de necesidad",
    "Funcionarios interinos"
  );
})();
