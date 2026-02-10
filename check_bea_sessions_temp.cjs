require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  // Sesiones de usuario
  console.log("=== USER_SESSIONS DE BEA ===\n");
  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", bea)
    .order("session_start", { ascending: false })
    .limit(10);

  if (sessions && sessions.length > 0) {
    console.log(`${sessions.length} sesiones:\n`);
    sessions.forEach((s, i) => {
      console.log(`--- Sesión ${i + 1} ---`);
      console.log("Start:", s.session_start);
      console.log("End:", s.session_end);
      console.log("Duración (min):", s.total_duration_minutes);
      console.log("Device:", s.device_model, s.operating_system);
      console.log("Browser:", s.browser_name, s.browser_version);
      console.log("Tests intentados:", s.tests_attempted);
      console.log("Tests completados:", s.tests_completed);
      console.log("Preguntas respondidas:", s.questions_answered);
      console.log("Entry:", s.entry_page);
      console.log("Exit:", s.exit_page);
      console.log("Bounce:", s.bounce_indicator);
      console.log("");
    });
  } else {
    console.log("No hay sesiones registradas");
  }

  // Buscar eventos de auth o error en user_interactions
  console.log("\n=== EVENTOS DE AUTH/ERROR ===\n");
  const { data: authEvents } = await supabase
    .from("user_interactions")
    .select("*")
    .eq("user_id", bea)
    .or("event_type.ilike.%auth%,event_type.ilike.%error%,event_type.ilike.%logout%,event_type.ilike.%login%,page_url.ilike.%auth%,page_url.ilike.%callback%")
    .order("created_at", { ascending: false })
    .limit(20);

  if (authEvents && authEvents.length > 0) {
    console.log(`${authEvents.length} eventos auth-related:`);
    authEvents.forEach(e => {
      console.log(`  ${e.created_at.split("T")[1].split(".")[0]} | ${e.event_type} | ${e.page_url}`);
    });
  } else {
    console.log("No hay eventos de auth/error");
  }

  // Ver todas las page_views de hoy
  console.log("\n=== PAGE VIEWS HOY (27 enero) ===\n");
  const { data: todayViews } = await supabase
    .from("user_interactions")
    .select("created_at, event_type, page_url, label, value")
    .eq("user_id", bea)
    .eq("event_type", "page_view")
    .gte("created_at", "2026-01-27T00:00:00")
    .order("created_at", { ascending: true });

  if (todayViews && todayViews.length > 0) {
    console.log(`${todayViews.length} page views:`);
    todayViews.forEach(v => {
      const time = v.created_at.split("T")[1].split(".")[0];
      console.log(`  ${time} | ${v.page_url || v.label}`);
    });
  }

  // Ver flujo completo de interacciones en una ventana de tiempo
  console.log("\n=== FLUJO DETALLADO 13:44-13:50 ===\n");
  const { data: flowEvents } = await supabase
    .from("user_interactions")
    .select("created_at, event_type, page_url, action, label, element_text, value")
    .eq("user_id", bea)
    .gte("created_at", "2026-01-27T13:44:00")
    .lte("created_at", "2026-01-27T13:50:00")
    .order("created_at", { ascending: true });

  if (flowEvents) {
    console.log(`${flowEvents.length} eventos en ese periodo:\n`);
    flowEvents.forEach(e => {
      const time = e.created_at.split("T")[1].split(".")[0];
      let desc = e.event_type;
      if (e.action && e.action !== e.event_type) desc += ` (${e.action})`;
      if (e.element_text) desc += ` - "${e.element_text.substring(0, 30)}"`;
      else if (e.label) desc += ` - ${e.label}`;

      // Añadir info relevante del value
      if (e.value) {
        if (e.value.fromQuestion !== undefined) {
          desc += ` [Q${e.value.fromQuestion} → Q${e.value.toQuestion}]`;
        }
        if (e.value.questionIndex !== undefined && e.event_type === "test_answer_selected") {
          desc += ` [Q${e.value.questionIndex}]`;
        }
      }

      console.log(`${time} | ${desc}`);
    });
  }

})();
