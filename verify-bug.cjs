const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const monicaId = "dc5ac505-4535-47df-b086-e454656646ce";

  console.log("🔍 VERIFICANDO BUG: correctAnswer vs userAnswer");
  console.log("═".repeat(70));

  // Obtener el test de hoy de Monica
  const { data: todayTest } = await supabase
    .from("tests")
    .select("*")
    .eq("user_id", monicaId)
    .gte("created_at", "2026-01-10T00:00:00")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!todayTest) {
    console.log("❌ No se encontró test de hoy para Monica");
    return;
  }

  console.log("\n📋 TEST ENCONTRADO:");
  console.log("   ID:", todayTest.id);
  console.log("   Tipo:", todayTest.test_type);
  console.log("   Creado:", todayTest.created_at);

  // Ver las preguntas del test con ambos campos
  const { data: questions } = await supabase
    .from("test_questions")
    .select("question_order, user_answer, correct_answer, is_correct")
    .eq("test_id", todayTest.id)
    .order("question_order", { ascending: true });

  console.log("\n📝 ANÁLISIS DE RESPUESTAS:");
  console.log("   Total preguntas:", questions?.length || 0);

  let withCorrectAnswer = 0;
  let withUserAnswer = 0;
  let withBoth = 0;

  for (const q of questions || []) {
    const hasCorrect = q.correct_answer && q.correct_answer !== "";
    const hasUser = q.user_answer && q.user_answer !== "";

    if (hasCorrect) withCorrectAnswer++;
    if (hasUser) withUserAnswer++;
    if (hasCorrect && hasUser) withBoth++;
  }

  console.log("   Con correctAnswer:", withCorrectAnswer);
  console.log("   Con userAnswer:", withUserAnswer);
  console.log("   Con ambos:", withBoth);

  // Mostrar detalle de las primeras 5 preguntas
  console.log("\n📊 DETALLE (primeras 5):");
  for (const q of (questions || []).slice(0, 5)) {
    console.log(`   ${q.question_order}. correctAnswer='${q.correct_answer || "(vacío)"}' | userAnswer='${q.user_answer || "(vacío)"}'`);
  }

  // Diagnóstico
  console.log("\n🩺 DIAGNÓSTICO:");
  if (withCorrectAnswer > 0 && withUserAnswer === 0) {
    console.log("   ✅ CONFIRMADO: /api/exam/init funciona (correctAnswer guardado)");
    console.log("   ❌ CONFIRMADO: /api/exam/answer falla (userAnswer vacío)");
    console.log("\n   💡 CAUSA: El schema Zod requiere correctAnswer, pero no se envía");
    console.log("   💡 SOLUCIÓN: Hacer correctAnswer opcional en saveAnswerRequestSchema");
  } else if (withBoth === questions?.length) {
    console.log("   ✅ Todo funciona correctamente");
  } else {
    console.log("   ⚠️ Estado mixto - investigar más");
  }

  console.log("\n" + "═".repeat(70));
}

main();
