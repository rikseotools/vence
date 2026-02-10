require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";
  const fixDate = "2026-01-23T06:06:06";

  console.log("=== ACTIVIDAD DE BEA ANTES Y DESPUÉS DEL FIX ===\n");
  console.log("Fix aplicado: 23 enero 2026 a las 06:06\n");

  // Sesiones ANTES del fix (23 enero antes de las 06:06)
  console.log("--- ANTES DEL FIX ---\n");
  const { data: beforeSessions } = await supabase
    .from("user_sessions")
    .select("session_start, session_end, total_duration_minutes, tests_completed, questions_answered")
    .eq("user_id", bea)
    .lt("session_start", fixDate)
    .order("session_start", { ascending: false })
    .limit(5);

  if (beforeSessions) {
    beforeSessions.forEach(s => {
      const status = s.tests_completed > 0 ? "✅ completado" : "❌ incompleto";
      console.log(`${s.session_start.split("T")[0]} ${s.session_start.split("T")[1].split(".")[0]} | ${s.questions_answered} preguntas | ${status}`);
    });
  }

  // Sesiones DESPUÉS del fix
  console.log("\n--- DESPUÉS DEL FIX ---\n");
  const { data: afterSessions } = await supabase
    .from("user_sessions")
    .select("session_start, session_end, total_duration_minutes, tests_completed, questions_answered")
    .eq("user_id", bea)
    .gte("session_start", fixDate)
    .order("session_start", { ascending: true });

  if (afterSessions) {
    let completados = 0;
    let incompletos = 0;

    afterSessions.forEach(s => {
      const status = s.tests_completed > 0 ? "✅ completado" : "❌ incompleto";
      if (s.tests_completed > 0) completados++;
      else incompletos++;
      console.log(`${s.session_start.split("T")[0]} ${s.session_start.split("T")[1].split(".")[0]} | ${s.questions_answered} preguntas | ${status}`);
    });

    console.log(`\nRESUMEN POST-FIX: ${completados} completados, ${incompletos} incompletos`);
  }

  // Contar redirects a /auth/callback ANTES del fix
  console.log("\n\n--- REDIRECTS A /auth/callback ---\n");

  const { data: beforeAuth } = await supabase
    .from("user_interactions")
    .select("created_at")
    .eq("user_id", bea)
    .eq("event_type", "page_view")
    .ilike("page_url", "%/auth/callback%")
    .lt("created_at", fixDate);

  const { data: afterAuth } = await supabase
    .from("user_interactions")
    .select("created_at")
    .eq("user_id", bea)
    .eq("event_type", "page_view")
    .ilike("page_url", "%/auth/callback%")
    .gte("created_at", fixDate);

  console.log("Redirects ANTES del fix:", beforeAuth?.length || 0);
  console.log("Redirects DESPUÉS del fix:", afterAuth?.length || 0);

  // Días de actividad antes y después
  const { data: beforeDays } = await supabase
    .from("user_sessions")
    .select("session_start")
    .eq("user_id", bea)
    .lt("session_start", fixDate);

  const { data: afterDays } = await supabase
    .from("user_sessions")
    .select("session_start")
    .eq("user_id", bea)
    .gte("session_start", fixDate);

  console.log("\nDías activos ANTES del fix:", beforeDays?.length || 0, "sesiones");
  console.log("Días activos DESPUÉS del fix:", afterDays?.length || 0, "sesiones");

  // Calcular ratio de completados
  if (afterAuth && afterSessions) {
    const ratio = afterAuth.length / (afterSessions.length || 1);
    console.log(`\nRatio redirects/sesiones POST-FIX: ${ratio.toFixed(2)}`);
  }

})();
