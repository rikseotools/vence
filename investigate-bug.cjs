const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("🔍 INVESTIGANDO POSIBLE BUG EN GUARDADO DE TESTS...");
  console.log("═".repeat(70));

  // 1. Ver actividad general de los últimos días
  const { data: recentSessions } = await supabase
    .from("user_sessions")
    .select("id, user_id, session_start, questions_answered, tests_completed, entry_page")
    .gte("session_start", "2026-01-08T00:00:00")
    .order("session_start", { ascending: false })
    .limit(100);

  console.log("\n📊 SESIONES ÚLTIMOS 3 DÍAS:");

  const byDay = {};
  for (const s of recentSessions || []) {
    const day = s.session_start?.split("T")[0];
    if (!byDay[day]) byDay[day] = { sessions: 0, withQuestions: 0, totalQuestions: 0, zeroQuestions: 0 };
    byDay[day].sessions++;
    if (s.questions_answered > 0) {
      byDay[day].withQuestions++;
      byDay[day].totalQuestions += s.questions_answered;
    } else {
      byDay[day].zeroQuestions++;
    }
  }

  for (const [day, stats] of Object.entries(byDay).sort().reverse()) {
    console.log("   " + day + ": " + stats.sessions + " sesiones | " + stats.withQuestions + " con preguntas (" + stats.totalQuestions + ") | " + stats.zeroQuestions + " sin preguntas");
  }

  // 2. Ver si hay sesiones que entraron a test pero no tienen respuestas
  const testEntrySessions = (recentSessions || []).filter(s =>
    s.entry_page &&
    (s.entry_page.includes("/test/") || s.entry_page.includes("aleatorio") || s.entry_page.includes("rapido")) &&
    s.questions_answered === 0
  );

  console.log("\n⚠️  SESIONES QUE ENTRARON A TEST PERO 0 PREGUNTAS:", testEntrySessions.length);
  for (const s of testEntrySessions.slice(0, 15)) {
    const fecha = new Date(s.session_start).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
    console.log("   [" + fecha + "] user:" + (s.user_id?.substring(0, 8) || "anon"));
    console.log("        → " + s.entry_page?.substring(0, 70));
  }

  // 3. Verificar user_question_history reciente
  const { data: recentHistory } = await supabase
    .from("user_question_history")
    .select("user_id, last_attempt_at")
    .gte("last_attempt_at", "2026-01-08T00:00:00")
    .order("last_attempt_at", { ascending: false })
    .limit(200);

  const historyByDay = {};
  for (const h of recentHistory || []) {
    const day = h.last_attempt_at?.split("T")[0];
    if (!historyByDay[day]) historyByDay[day] = 0;
    historyByDay[day]++;
  }

  console.log("\n📝 PREGUNTAS EN USER_QUESTION_HISTORY (últimos días):");
  for (const [day, count] of Object.entries(historyByDay).sort().reverse()) {
    console.log("   " + day + ": " + count + " registros");
  }

  // 4. Ver test_questions (donde se guardan las respuestas del test)
  const { data: recentTestQuestions, error: tqError } = await supabase
    .from("test_questions")
    .select("id, created_at")
    .gte("created_at", "2026-01-08T00:00:00")
    .order("created_at", { ascending: false })
    .limit(100);

  if (tqError) {
    console.log("\n❌ Error en test_questions:", tqError.message);
  } else {
    const tqByDay = {};
    for (const tq of recentTestQuestions || []) {
      const day = tq.created_at?.split("T")[0];
      if (!tqByDay[day]) tqByDay[day] = 0;
      tqByDay[day]++;
    }

    console.log("\n📋 REGISTROS EN TEST_QUESTIONS (respuestas guardadas):");
    for (const [day, count] of Object.entries(tqByDay).sort().reverse()) {
      console.log("   " + day + ": " + count + " respuestas");
    }
  }

  // 5. Ver tests table
  const { data: recentTests, error: testsError } = await supabase
    .from("tests")
    .select("id, created_at, is_completed, test_type")
    .gte("created_at", "2026-01-08T00:00:00")
    .order("created_at", { ascending: false })
    .limit(50);

  if (testsError) {
    console.log("\n❌ Error en tests:", testsError.message);
  } else {
    console.log("\n🎯 TESTS CREADOS (últimos días):", recentTests?.length || 0);
    const testsByDay = {};
    for (const t of recentTests || []) {
      const day = t.created_at?.split("T")[0];
      if (!testsByDay[day]) testsByDay[day] = { total: 0, completed: 0 };
      testsByDay[day].total++;
      if (t.is_completed) testsByDay[day].completed++;
    }

    for (const [day, stats] of Object.entries(testsByDay).sort().reverse()) {
      console.log("   " + day + ": " + stats.total + " tests (" + stats.completed + " completados)");
    }
  }

  console.log("\n" + "═".repeat(70));
}

main();
