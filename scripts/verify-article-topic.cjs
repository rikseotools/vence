const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Tomar preguntas que tienen T1 en tags
  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, question_text, primary_article_id, tags")
    .contains("tags", ["T1"])
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("=== VERIFICACIÓN: ARTÍCULO → TOPIC_SCOPE ===\n");
  console.log("Preguntas encontradas:", questions.length);

  for (const q of questions) {
    console.log("\n---");
    console.log("Pregunta:", q.question_text.substring(0, 60) + "...");
    console.log("Tag actual:", q.tags);

    if (!q.primary_article_id) {
      console.log("⚠️ Sin primary_article_id");
      continue;
    }

    const { data: art } = await supabase
      .from("articles")
      .select("article_number, law_id, laws(short_name, name)")
      .eq("id", q.primary_article_id)
      .single();

    if (!art) {
      console.log("⚠️ Artículo no encontrado");
      continue;
    }

    const lawName = art.laws?.short_name || art.laws?.name || "Ley desconocida";
    console.log("Artículo vinculado:", lawName, "art.", art.article_number);

    // Buscar en topic_scope
    const { data: scope } = await supabase
      .from("topic_scope")
      .select("topics(topic_number, title, position_type)")
      .eq("law_id", art.law_id)
      .contains("article_numbers", [String(art.article_number)]);

    if (scope && scope.length > 0) {
      console.log("Según topic_scope pertenece a:");
      scope.forEach(s => {
        console.log("  → Topic " + s.topics.topic_number + " [" + s.topics.position_type + "]: " + s.topics.title);
      });
    } else {
      console.log("⚠️ Este artículo NO está en ningún topic_scope");
    }
  }
})();
