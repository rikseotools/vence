const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const monicaId = "dc5ac505-4535-47df-b086-e454656646ce";

  console.log("🔍 DETALLE DEL TEST DE MONICA HOY...");
  console.log("═".repeat(70));

  // 1. Ver el test de hoy con todos sus detalles
  const { data: todayTest } = await supabase
    .from("tests")
    .select("*")
    .eq("user_id", monicaId)
    .gte("created_at", "2026-01-10T00:00:00")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.log("\n🎯 TEST DE HOY:");
  console.log(JSON.stringify(todayTest, null, 2));

  // 2. Ver las respuestas de ese test
  if (todayTest) {
    const { data: answers } = await supabase
      .from("test_questions")
      .select("*, questions(question_text, correct_option)")
      .eq("test_id", todayTest.id)
      .order("question_order", { ascending: true });

    console.log("\n\n📝 RESPUESTAS (" + (answers?.length || 0) + "):");

    let correct = 0;
    let incorrect = 0;

    for (const a of answers || []) {
      const isCorrect = a.is_correct ? "✅" : "❌";
      if (a.is_correct) correct++;
      else incorrect++;

      console.log("   " + a.question_order + ". " + isCorrect + " (respondió: " + a.user_answer + ", correcta: " + a.questions?.correct_option + ")");
    }

    console.log("\n   📊 Resultado: " + correct + "/" + (correct + incorrect) + " (" + Math.round((correct / (correct + incorrect)) * 100) + "%)");
  }

  // 3. Ver el test del 9 enero que también reportó
  const { data: yesterdayTest } = await supabase
    .from("tests")
    .select("*")
    .eq("user_id", monicaId)
    .gte("created_at", "2026-01-09T00:00:00")
    .lt("created_at", "2026-01-10T00:00:00")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.log("\n\n🎯 TEST DE AYER (9 ENERO):");
  console.log("   ID:", yesterdayTest?.id);
  console.log("   Tipo:", yesterdayTest?.test_type);
  console.log("   Total:", yesterdayTest?.total_questions);
  console.log("   Completado:", yesterdayTest?.is_completed);
  console.log("   Creado:", yesterdayTest?.created_at);
  console.log("   Completado at:", yesterdayTest?.completed_at);

  // 4. Ver si hay algo en test_results o similar
  const { data: testResults, error: resultsError } = await supabase
    .from("test_results")
    .select("*")
    .eq("user_id", monicaId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (resultsError) {
    console.log("\n\n📊 test_results: " + resultsError.message);
  } else {
    console.log("\n\n📊 TEST_RESULTS:", testResults?.length || 0);
    for (const r of testResults || []) {
      console.log("   " + r.created_at?.split("T")[0] + ": score " + r.score + "/" + r.total_questions);
    }
  }

  // 5. Ver si hay problemas con is_completed vs completed_at
  const { data: allTests } = await supabase
    .from("tests")
    .select("id, is_completed, completed_at, created_at, test_type")
    .eq("user_id", monicaId)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\n\n🔍 ESTADO COMPLETADO VS COMPLETED_AT:");
  for (const t of allTests || []) {
    const fecha = t.created_at?.split("T")[0];
    const completedAt = t.completed_at ? "✅ " + t.completed_at.split("T")[1]?.substring(0, 5) : "❌ null";
    const isCompleted = t.is_completed ? "true" : "false";
    console.log("   [" + fecha + "] is_completed:" + isCompleted + " | completed_at:" + completedAt + " | tipo:" + t.test_type);
  }

  console.log("\n" + "═".repeat(70));
}

main();
