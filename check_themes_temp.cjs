const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Obtener los topic_ids para temas 1 y 2
  const { data: topics } = await supabase
    .from("topics")
    .select("id, topic_number")
    .eq("position_type", "auxiliar_administrativo")
    .in("topic_number", [1, 2]);

  const topicIds = topics?.map(t => t.id) || [];
  console.log("Topic IDs:", topicIds);

  // Obtener topic_scope
  const { data: scopes } = await supabase
    .from("topic_scope")
    .select("topic_id, law_id, article_numbers")
    .in("topic_id", topicIds);

  // Recopilar todos los artículos y leyes
  const lawArticles = {};
  scopes?.forEach(s => {
    if (!lawArticles[s.law_id]) lawArticles[s.law_id] = new Set();
    s.article_numbers?.forEach(an => lawArticles[s.law_id].add(an));
  });

  console.log("\nLeyes y artículos únicos:");
  for (const [lawId, articles] of Object.entries(lawArticles)) {
    const { data: law } = await supabase
      .from("laws")
      .select("short_name")
      .eq("id", lawId)
      .single();
    console.log(`  ${law?.short_name}: ${articles.size} artículos`);
  }

  // Obtener una muestra de preguntas de estos artículos
  console.log("\n--- Muestra de 10 preguntas ---");

  // Obtener IDs de artículos de CE para tema 1
  const ceScope = scopes?.find(s => {
    const topic = topics?.find(t => t.id === s.topic_id);
    return topic?.topic_number === 1;
  });

  if (ceScope) {
    const { data: articleIds } = await supabase
      .from("articles")
      .select("id, article_number")
      .eq("law_id", ceScope.law_id)
      .in("article_number", ceScope.article_numbers.slice(0, 20));

    const artIds = articleIds?.map(a => a.id) || [];

    const { data: questions } = await supabase
      .from("questions")
      .select(`
        id,
        question_text,
        primary_article_id,
        articles!inner(article_number, law_id, laws!inner(short_name))
      `)
      .eq("is_active", true)
      .in("primary_article_id", artIds)
      .limit(10);

    questions?.forEach((q, i) => {
      console.log(`\n${i+1}. ${q.articles?.laws?.short_name} Art. ${q.articles?.article_number}`);
      console.log(`   ${q.question_text?.substring(0, 80)}...`);
    });
  }
}

main().catch(console.error);
