const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const monicaId = "dc5ac505-4535-47df-b086-e454656646ce";

  console.log("═".repeat(70));
  console.log("📊 ACTIVIDAD COMPLETA DE MONICA");
  console.log("═".repeat(70));

  // 1. TODAS las sesiones de test
  const { data: sessions, error: sessError } = await supabase
    .from("user_test_sessions")
    .select("*")
    .eq("user_id", monicaId)
    .order("created_at", { ascending: false });

  console.log("\n🎯 SESIONES DE TEST:", sessions?.length || 0);
  if (sessError) console.log("   Error:", sessError.message);

  for (const s of sessions || []) {
    const fecha = new Date(s.created_at).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
    const questionsAnswered = Array.isArray(s.questions_answered) ? s.questions_answered.length : 0;
    console.log("\n   [" + fecha + "]");
    console.log("   Tema:", s.tema_number, "| Test:", s.test_number);
    console.log("   Total:", s.total_questions, "| Score:", s.score);
    console.log("   Respondidas:", questionsAnswered);
    console.log("   Tiempo:", s.time_seconds, "seg");
    console.log("   Completado:", s.completed_at ? "SÍ" : "NO");
  }

  // 2. Historial de preguntas usando last_attempt_at
  const { data: history, error: histError } = await supabase
    .from("user_question_history")
    .select("*")
    .eq("user_id", monicaId)
    .order("last_attempt_at", { ascending: false })
    .limit(50);

  console.log("\n\n📝 HISTORIAL DE PREGUNTAS:", history?.length || 0);
  if (histError) console.log("   Error:", histError.message);

  // Agrupar por día usando last_attempt_at
  const byDay = {};
  for (const h of history || []) {
    const day = h.last_attempt_at?.split("T")[0] || "unknown";
    if (!byDay[day]) byDay[day] = { total: 0, correct: 0 };
    byDay[day].total++;
    byDay[day].correct += h.correct_attempts || 0;
  }

  for (const [day, stats] of Object.entries(byDay).sort().reverse()) {
    console.log("   " + day + ": " + stats.total + " preguntas únicas");
  }

  // 3. Daily question counts
  const { data: dailyCounts } = await supabase
    .from("daily_question_counts")
    .select("*")
    .eq("user_id", monicaId)
    .order("date", { ascending: false });

  console.log("\n\n📈 CONTEO DIARIO:");
  for (const d of dailyCounts || []) {
    console.log("   " + d.date + ": " + d.question_count + " preguntas");
  }

  // 4. Ver user_sessions (sesiones de navegación)
  const { data: userSessions } = await supabase
    .from("user_sessions")
    .select("session_start, session_end, total_duration_minutes, questions_answered, tests_completed")
    .eq("user_id", monicaId)
    .order("session_start", { ascending: false })
    .limit(10);

  console.log("\n\n🖥️ SESIONES DE USO:", userSessions?.length || 0);
  for (const s of userSessions || []) {
    const fecha = new Date(s.session_start).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
    console.log("   [" + fecha + "] " + (s.total_duration_minutes || 0) + " min | " + (s.questions_answered || 0) + " preguntas | " + (s.tests_completed || 0) + " tests");
  }

  // 5. Ver si tiene límite alcanzado
  const { data: limits } = await supabase
    .from("user_daily_limits")
    .select("*")
    .eq("user_id", monicaId)
    .order("date", { ascending: false })
    .limit(5);

  console.log("\n\n🚫 LÍMITES DIARIOS:");
  for (const l of limits || []) {
    console.log("   " + l.date + ": " + l.questions_count + "/" + l.questions_limit);
  }

  console.log("\n" + "═".repeat(70));
}

main();
