const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const visitorId = "dc5ac505-4535-47df-b086-e454656646ce";

  console.log("═".repeat(70));
  console.log("📊 HISTORIAL COMPLETO DE TESTS DE MONICA");
  console.log("═".repeat(70));

  // 1. TODAS las sesiones de test
  const { data: sessions } = await supabase
    .from("test_sessions")
    .select("*")
    .eq("user_id", visitorId)
    .order("created_at", { ascending: false })
    .limit(20);

  console.log("\n🎯 ÚLTIMAS SESIONES DE TEST:", sessions?.length || 0);

  for (const s of sessions || []) {
    const fecha = new Date(s.created_at).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log("\n   [" + fecha + "]");
    console.log("   Tipo:", s.test_type, "| Preguntas:", s.total_questions);
    console.log("   Respondidas:", s.questions_answered, "| Correctas:", s.correct_answers);
    console.log("   Completado:", s.is_completed ? "SÍ" : "NO", "| Terminado:", s.ended_at ? "SÍ" : "NO");
  }

  // 2. TODAS las respuestas
  const { data: answers } = await supabase
    .from("detailed_answers")
    .select("created_at, is_correct")
    .eq("user_id", visitorId)
    .order("created_at", { ascending: false })
    .limit(50);

  console.log("\n\n📝 ÚLTIMAS RESPUESTAS:", answers?.length || 0);

  // Agrupar por día
  const byDay = {};
  for (const a of answers || []) {
    const day = a.created_at.split("T")[0];
    if (!byDay[day]) byDay[day] = { total: 0, correct: 0 };
    byDay[day].total++;
    if (a.is_correct) byDay[day].correct++;
  }

  for (const [day, stats] of Object.entries(byDay)) {
    console.log("   " + day + ": " + stats.total + " respuestas (" + stats.correct + " correctas)");
  }

  // 3. Conteo diario histórico
  const { data: dailyCounts } = await supabase
    .from("daily_question_counts")
    .select("*")
    .eq("user_id", visitorId)
    .order("date", { ascending: false })
    .limit(10);

  console.log("\n\n📈 CONTEO DIARIO (últimos días):");
  for (const d of dailyCounts || []) {
    console.log("   " + d.date + ": " + d.question_count + " preguntas");
  }

  // 4. Ver suscripción
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", visitorId);

  console.log("\n\n💳 SUSCRIPCIONES:", subs?.length || 0);
  for (const sub of subs || []) {
    console.log("   Estado:", sub.status);
    console.log("   Plan:", sub.plan_type);
    console.log("   Creada:", sub.created_at);
  }

  // 5. Ver perfil completo
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", visitorId)
    .single();

  console.log("\n\n👤 PERFIL COMPLETO:");
  console.log("   is_premium:", profile?.is_premium);
  console.log("   Creado:", profile?.created_at);
  console.log("   Racha:", profile?.current_streak);
  console.log("   Total respondidas:", profile?.total_questions_answered);

  console.log("\n" + "═".repeat(70));
}

main();
