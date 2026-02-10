require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: tests } = await supabase
    .from("tests")
    .select("id, title, score, total_questions, completed_at")
    .eq("is_completed", true)
    .order("completed_at", { ascending: false })
    .limit(100);

  let scoreIsCount = 0;
  let scoreIsPct = 0;
  let neither = 0;

  console.log("=== ANÁLISIS: ¿Qué representa el campo score? ===\n");

  for (const test of tests) {
    const { data: answers } = await supabase
      .from("test_questions")
      .select("is_correct")
      .eq("test_id", test.id);

    if (!answers || answers.length === 0) continue;

    const correct = answers.filter(a => a.is_correct).length;
    const total = answers.length;
    const realPct = Math.round(correct/total*100);
    const score = parseInt(test.score) || 0;

    if (score === correct && score !== realPct) {
      scoreIsCount++;
    } else if (score === realPct && score !== correct) {
      scoreIsPct++;
    } else if (score === correct && score === realPct) {
      // Coinciden (ej: 50 correctas de 100 = 50%)
      scoreIsCount++; // Asumimos que es count porque coincide
    } else {
      neither++;
      if (neither <= 5) {
        console.log("❓ Caso raro:", test.title);
        console.log("   Score:", score, "| Correctas:", correct, "| Total:", total, "| Pct:", realPct);
      }
    }
  }

  console.log("\n=== RESULTADO ===");
  console.log("Tests donde score = CONTEO de correctas:", scoreIsCount);
  console.log("Tests donde score = PORCENTAJE:", scoreIsPct);
  console.log("Tests donde no coincide ninguno:", neither);

  if (scoreIsCount > scoreIsPct) {
    console.log("\n✅ CONCLUSIÓN: El campo 'score' almacena el NÚMERO de correctas, no el porcentaje.");
    console.log("   El código de mis-estadisticas calcula: porcentaje = score / total_questions * 100");
  } else {
    console.log("\n✅ CONCLUSIÓN: El campo 'score' almacena el PORCENTAJE.");
  }
}
check();
