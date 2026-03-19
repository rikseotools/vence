require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const questionIds = [
    "53183b91-fce7-4841-805c-00a04a0ae281",
    "2f6c270e-ffec-4c0d-bae4-d6e74b8e5e14",
    "f0a7096b-4e32-4ddd-a92a-8b65b94e9f0c",
    "d3fa4ee5-4f80-4f56-a36b-3dca647e3e31",
    "8c841c10-3f6c-4f1a-91e0-0b80f4c7cf41",
    "032bb6a1-5f4e-4cf8-b92e-4fa8ea1e3e71",
    "55c8cfc6-aabc-4e2d-b843-3e9f2b8f1c41",
    "87afd8a9-f8e0-4b0c-9d0e-9e4b8f2e1a61"
  ];

  // Get first question directly
  const { data: q1, error: e1 } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, topic_id, subtopic_id, primary_article_id, is_official_exam, exam_source, scope")
    .eq("id", "53183b91-fce7-4841-805c-00a04a0ae281");

  console.log("=== PREGUNTA 1 ===");
  if (e1) console.log("Error:", e1.message);
  if (q1 && q1[0]) {
    const q = q1[0];
    console.log("Texto:", q.question_text);
    console.log("A:", q.option_a);
    console.log("B:", q.option_b);
    console.log("C:", q.option_c);
    console.log("D:", q.option_d);
    console.log("Correcta:", q.correct_option, "("+["A","B","C","D"][q.correct_option]+")");
    console.log("Topic:", q.topic_id);
    console.log("Subtopic:", q.subtopic_id);
    console.log("Article:", q.primary_article_id);
    console.log("Scope:", q.scope);
    console.log("Oficial:", q.is_official_exam, q.exam_source || "");

    // Get topic
    if (q.topic_id) {
      const { data: t } = await supabase.from("topics").select("name, oposicion_id").eq("id", q.topic_id).single();
      console.log("Tema:", t?.name, "| Oposición:", t?.oposicion_id);
    }
    // Get subtopic
    if (q.subtopic_id) {
      const { data: s } = await supabase.from("subtopics").select("name, topic_id").eq("id", q.subtopic_id).single();
      console.log("Subtema:", s?.name, "| Topic padre:", s?.topic_id);
    }
    // Get article + law
    if (q.primary_article_id) {
      const { data: a } = await supabase.from("articles").select("article_number, title, law_id").eq("id", q.primary_article_id).single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name, name").eq("id", a.law_id).single();
        console.log("Artículo:", a.article_number, "-", a.title);
        console.log("Ley:", l?.short_name);
      }
    }
  } else {
    console.log("No data returned, raw:", q1);
  }

  // Get all 8 disputes with question IDs
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id, description, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  // Get all questions in one batch
  const ids = disputes.map(d => d.question_id);
  const { data: allQs } = await supabase.from("questions").select("id, question_text, topic_id, scope").in("id", ids);

  const qMap = {};
  if (allQs) allQs.forEach(q => qMap[q.id] = q);

  // Get all topic names
  const topicIds = [...new Set((allQs || []).map(q => q.topic_id).filter(Boolean))];
  const { data: topics } = await supabase.from("topics").select("id, name").in("id", topicIds.length > 0 ? topicIds : ["none"]);
  const tMap = {};
  if (topics) topics.forEach(t => tMap[t.id] = t.name);

  console.log("\n=== RESUMEN DE LAS 8 DISPUTAS ===");
  for (const d of disputes) {
    const q = qMap[d.question_id];
    if (q) {
      console.log("\n" + d.id.substring(0,8), "|", d.created_at.substring(11,19));
      console.log("  Pregunta:", q.question_text.substring(0, 100));
      console.log("  Tema:", tMap[q.topic_id] || q.topic_id || "sin tema");
      console.log("  Scope:", q.scope);
    } else {
      console.log("\n" + d.id.substring(0,8), "| Pregunta NO encontrada:", d.question_id);
    }
  }
})();
