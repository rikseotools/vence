require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get all 8 pending disputes with details
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id, user_id, dispute_type, description, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (!disputes || disputes.length === 0) { console.log("No hay disputas pendientes"); return; }

  // First dispute
  const d = disputes[0];
  console.log("=== DISPUTA #1 ===");
  console.log("ID:", d.id);
  console.log("Question ID:", d.question_id);
  console.log("User ID:", d.user_id);
  console.log("Tipo:", d.dispute_type);
  console.log("Descripción:", d.description);
  console.log("Fecha:", d.created_at);

  // Get user info
  const { data: user } = await supabase.from("user_profiles").select("display_name, email").eq("id", d.user_id).single();
  console.log("\n=== USUARIO ===");
  console.log("Nombre:", user?.display_name);
  console.log("Email:", user?.email);

  // Get question details
  const { data: q } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, topic_id, subtopic_id, primary_article_id, is_active, is_official_exam, exam_source")
    .eq("id", d.question_id)
    .single();

  if (!q) { console.log("Pregunta no encontrada"); return; }
  console.log("\n=== PREGUNTA ===");
  console.log("Texto:", q.question_text);
  console.log("A:", q.option_a);
  console.log("B:", q.option_b);
  console.log("C:", q.option_c);
  console.log("D:", q.option_d);
  console.log("Correcta:", q.correct_option, "("+["A","B","C","D"][q.correct_option]+")");
  console.log("Topic ID:", q.topic_id);
  console.log("Subtopic ID:", q.subtopic_id);
  console.log("Article ID:", q.primary_article_id);
  console.log("Oficial:", q.is_official_exam, q.exam_source || "");
  console.log("Activa:", q.is_active);

  // Get topic info
  if (q.topic_id) {
    const { data: topic } = await supabase.from("topics").select("id, name, description").eq("id", q.topic_id).single();
    console.log("\n=== TEMA ASIGNADO ===");
    console.log("ID:", topic?.id);
    console.log("Nombre:", topic?.name);
    console.log("Descripción:", topic?.description);
  }

  // Get subtopic info
  if (q.subtopic_id) {
    const { data: sub } = await supabase.from("subtopics").select("id, name, topic_id").eq("id", q.subtopic_id).single();
    console.log("\n=== SUBTEMA ===");
    console.log("ID:", sub?.id);
    console.log("Nombre:", sub?.name);
    console.log("Topic del subtema:", sub?.topic_id);
  }

  // Get article info
  if (q.primary_article_id) {
    const { data: art } = await supabase.from("articles").select("id, article_number, title, law_id").eq("id", q.primary_article_id).single();
    if (art) {
      const { data: law } = await supabase.from("laws").select("id, name, short_name").eq("id", art.law_id).single();
      console.log("\n=== ARTÍCULO VINCULADO ===");
      console.log("Art:", art.article_number, "-", art.title);
      console.log("Ley:", law?.short_name, "-", law?.name);
    }
  }

  // Check if all 8 are from same user
  const userIds = [...new Set(disputes.map(d => d.user_id))];
  const questionIds = disputes.map(d => d.question_id);
  console.log("\n=== RESUMEN 8 DISPUTAS ===");
  console.log("Usuarios distintos:", userIds.length);
  console.log("Question IDs:", questionIds);

  // Get topics of all 8 questions
  const { data: allQs } = await supabase.from("questions").select("id, topic_id, question_text").in("id", questionIds);
  if (allQs) {
    const topicIds = [...new Set(allQs.map(q => q.topic_id).filter(Boolean))];
    const { data: topics } = await supabase.from("topics").select("id, name").in("id", topicIds);
    const topicMap = {};
    topics?.forEach(t => topicMap[t.id] = t.name);
    console.log("\nPreguntas y sus temas:");
    allQs.forEach(q => console.log("  -", q.id.substring(0,8), "| Tema:", topicMap[q.topic_id] || q.topic_id || "sin tema", "|", q.question_text.substring(0, 80)));
  }
})();
