require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = "9d2587b1-c799-476d-9797-b7a498a487b1";

(async () => {
  // Broader search - any recent sessions
  const { data: sessions } = await supabase
    .from("test_sessions")
    .select("id, test_type, created_at, total_questions, config")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("=== ÚLTIMAS 5 SESIONES DE MAR ===");
  if (sessions) {
    sessions.forEach(s => {
      console.log("\nID:", s.id);
      console.log("Creada:", s.created_at);
      console.log("Tipo:", s.test_type);
      console.log("Total preguntas:", s.total_questions);
      console.log("Config:", JSON.stringify(s.config));
    });
  }

  // Check detailed_answers - any recent ones
  const { data: recentAnswers } = await supabase
    .from("detailed_answers")
    .select("id, question_id, session_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\n=== ÚLTIMAS 10 RESPUESTAS DE MAR ===");
  if (recentAnswers) {
    recentAnswers.forEach(a => {
      console.log(a.created_at, "| q:", a.question_id.substring(0,8), "| session:", a.session_id);
    });
  }

  // Check tracking interactions around dispute time
  const { data: tracking } = await supabase
    .from("tracking_interactions")
    .select("id, interaction_type, question_id, metadata, created_at")
    .eq("user_id", userId)
    .gte("created_at", "2026-02-23T14:30:00")
    .lte("created_at", "2026-02-23T16:00:00")
    .order("created_at", { ascending: true })
    .limit(30);

  console.log("\n=== TRACKING DE MAR (23 feb, 14:30-16:00 UTC) ===");
  console.log("Total:", tracking?.length || 0);
  if (tracking) {
    tracking.forEach(t => {
      console.log(t.created_at.substring(11,19), "|", t.interaction_type, "| q:", t.question_id?.substring(0,8) || "n/a", "| meta:", JSON.stringify(t.metadata)?.substring(0, 150));
    });
  }

  // Also check if there's a question_scopes or question_tags table
  const { data: tags } = await supabase.from("question_tags").select("*").limit(1);
  console.log("\nquestion_tags existe:", tags !== null ? "sí (" + tags?.length + ")" : "no");

  // Check the questions table for any topic-related field we might have missed
  const { data: q1 } = await supabase.from("questions").select("tags").eq("id", "53183b91-fce7-4841-805c-00a04a0ae281").single();
  console.log("\nTags pregunta #1:", JSON.stringify(q1?.tags));
  
  // Check what topics exist for T2
  const { data: topics } = await supabase.from("topics").select("id, name, slug").ilike("name", "%tribunal%").limit(5);
  console.log("\nTopics con 'tribunal':", JSON.stringify(topics));
  
  const { data: topics2 } = await supabase.from("topics").select("id, name, slug").ilike("slug", "%t2%").limit(5);
  console.log("Topics con slug t2:", JSON.stringify(topics2));
  
  // Check what T2 tag means - look at other questions with T2
  const { data: t2qs } = await supabase.from("topics").select("id, name, slug, oposicion_id").order("name").limit(30);
  console.log("\n=== TODOS LOS TOPICS ===");
  if (t2qs) t2qs.forEach(t => console.log("  ", t.slug || t.id.substring(0,8), "|", t.name, "| opos:", t.oposicion_id));
})();
