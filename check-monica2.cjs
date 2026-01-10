const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const monicaId = "dc5ac505-4535-47df-b086-e454656646ce";
  const hoy = "2026-01-10";
  const ayer = "2026-01-09";

  console.log("═".repeat(70));
  console.log("📊 ACTIVIDAD DE MONICA - 9 y 10 ENERO 2026");
  console.log("═".repeat(70));

  // 1. Sesiones de test
  const { data: sessions, error: sessError } = await supabase
    .from("user_test_sessions")
    .select("*")
    .eq("user_id", monicaId)
    .gte("created_at", ayer + "T00:00:00")
    .order("created_at", { ascending: true });

  console.log("\n🎯 SESIONES DE TEST (9-10 enero):", sessions?.length || 0);
  if (sessError) console.log("   Error:", sessError.message);

  for (const s of sessions || []) {
    const fecha = new Date(s.created_at).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
    console.log("\n   [" + fecha + "] ID: " + s.id);
    console.log("   Tipo:", s.test_type || s.tipo);
    console.log("   Total preguntas:", s.total_questions);
    console.log("   Respondidas:", s.answered_count || s.questions_answered);
    console.log("   Correctas:", s.correct_count || s.correct_answers);
    console.log("   Completado:", s.completed_at ? "SÍ" : "NO");
  }

  // 2. Historial de preguntas
  const { data: history, error: histError } = await supabase
    .from("user_question_history")
    .select("*")
    .eq("user_id", monicaId)
    .gte("answered_at", ayer + "T00:00:00")
    .order("answered_at", { ascending: true });

  console.log("\n\n📝 PREGUNTAS RESPONDIDAS (9-10 enero):", history?.length || 0);
  if (histError) console.log("   Error:", histError.message);

  // Agrupar por día
  const byDay = {};
  for (const h of history || []) {
    const day = h.answered_at?.split("T")[0] || "unknown";
    if (!byDay[day]) byDay[day] = { total: 0, correct: 0 };
    byDay[day].total++;
    if (h.is_correct) byDay[day].correct++;
  }

  for (const [day, stats] of Object.entries(byDay).sort()) {
    console.log("   " + day + ": " + stats.total + " preguntas (" + stats.correct + " correctas)");
  }

  // 3. Detalle de hoy
  const historyHoy = (history || []).filter(h => h.answered_at?.startsWith(hoy));
  console.log("\n\n📋 DETALLE HOY (" + hoy + "):", historyHoy.length + " preguntas");

  for (const h of historyHoy.slice(0, 10)) {
    const hora = new Date(h.answered_at).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit", minute: "2-digit"
    });
    const resultado = h.is_correct ? "✅" : "❌";
    console.log("   [" + hora + "] " + resultado + " pregunta:" + (h.question_id?.substring(0, 8) || "?"));
  }

  if (historyHoy.length > 10) {
    console.log("   ... y " + (historyHoy.length - 10) + " más");
  }

  // 4. Daily question count
  const { data: dailyCount } = await supabase
    .from("daily_question_counts")
    .select("*")
    .eq("user_id", monicaId)
    .gte("date", ayer);

  console.log("\n\n📈 CONTEO DIARIO:");
  for (const d of dailyCount || []) {
    console.log("   " + d.date + ": " + d.question_count + " preguntas");
  }

  // 5. Toda la actividad histórica
  const { data: allHistory } = await supabase
    .from("user_question_history")
    .select("answered_at")
    .eq("user_id", monicaId)
    .order("answered_at", { ascending: false })
    .limit(100);

  console.log("\n\n📊 HISTORIAL COMPLETO:");
  const allByDay = {};
  for (const h of allHistory || []) {
    const day = h.answered_at?.split("T")[0] || "unknown";
    allByDay[day] = (allByDay[day] || 0) + 1;
  }

  for (const [day, count] of Object.entries(allByDay).sort().reverse()) {
    console.log("   " + day + ": " + count + " preguntas");
  }

  console.log("\n" + "═".repeat(70));
}

main();
