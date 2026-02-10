require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  // Buscar todas las tablas que contengan "event" en el nombre
  const tables = [
    "notification_events",
    "email_events",
    "user_events",
    "auth_events",
    "session_events",
    "tracking_events",
    "analytics_events"
  ];

  console.log("=== BUSCANDO TABLAS DE EVENTOS ===\n");

  for (const t of tables) {
    const { data, error } = await supabase
      .from(t)
      .select("*")
      .eq("user_id", bea)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      console.log(`✅ Tabla ${t} existe - ${data.length} registros para Bea`);
      if (data.length > 0) {
        console.log("Columnas:", Object.keys(data[0]));
        data.forEach(e => {
          console.log(`  - ${e.created_at}: ${e.event_type || e.type || e.action || JSON.stringify(e).substring(0, 100)}`);
        });
      }
      console.log("");
    }
  }

  // Buscar en user_interactions eventos de auth
  console.log("=== USER_INTERACTIONS (auth-related) ===\n");
  const { data: authInteractions } = await supabase
    .from("user_interactions")
    .select("*")
    .eq("user_id", bea)
    .or("page_path.ilike.%auth%,page_path.ilike.%callback%,page_path.ilike.%login%,interaction_type.ilike.%auth%,interaction_type.ilike.%session%")
    .order("created_at", { ascending: false })
    .limit(20);

  if (authInteractions && authInteractions.length > 0) {
    console.log(`Encontrados ${authInteractions.length} eventos auth-related:`);
    authInteractions.forEach(i => {
      console.log(`  ${i.created_at} | ${i.interaction_type} | ${i.page_path}`);
    });
  }

  // Buscar test_sessions de Bea
  console.log("\n=== TEST_SESSIONS DE BEA ===\n");
  const { data: sessions } = await supabase
    .from("test_sessions")
    .select("id, created_at, completed_at, status, total_questions, correct_answers, session_type")
    .eq("user_id", bea)
    .order("created_at", { ascending: false })
    .limit(10);

  if (sessions) {
    console.log(`${sessions.length} sesiones de test:`);
    sessions.forEach(s => {
      const completed = s.completed_at ? "✅ completada" : "❌ incompleta";
      console.log(`  ${s.created_at} | ${s.session_type || "normal"} | ${s.correct_answers}/${s.total_questions} | ${completed}`);
    });
  }

  // Buscar detailed_answers recientes de Bea
  console.log("\n=== DETAILED_ANSWERS RECIENTES ===\n");
  const { data: answers } = await supabase
    .from("detailed_answers")
    .select("id, created_at, session_id, is_correct")
    .eq("user_id", bea)
    .order("created_at", { ascending: false })
    .limit(20);

  if (answers) {
    console.log(`${answers.length} respuestas recientes:`);
    // Agrupar por fecha
    const byDate = {};
    answers.forEach(a => {
      const date = a.created_at.split("T")[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(a);
    });
    Object.keys(byDate).forEach(date => {
      console.log(`  ${date}: ${byDate[date].length} respuestas`);
    });
  }

  // Ver mensaje de feedback de Bea
  console.log("\n=== FEEDBACK DE BEA ===\n");
  const { data: feedbacks } = await supabase
    .from("user_feedback")
    .select("id, message, status, created_at")
    .eq("user_id", bea);

  if (feedbacks) {
    feedbacks.forEach(f => {
      console.log(`Fecha: ${f.created_at}`);
      console.log(`Status: ${f.status}`);
      console.log(`Mensaje: ${f.message}`);
      console.log("---");
    });
  }
})();
