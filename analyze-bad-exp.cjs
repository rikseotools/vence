const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: questions, error } = await supabase
    .from("questions")
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, primary_article_id,
      articles!inner(id, article_number, title, content, laws(short_name, name))
    `)
    .eq("topic_review_status", "bad_explanation")
    .eq("is_active", true);

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  console.log("📋 ANÁLISIS DE 9 PREGUNTAS CON BAD_EXPLANATION:\n");

  for (const q of questions) {
    console.log("═".repeat(80));
    console.log("ID:", q.id);
    console.log("Ley:", q.articles.laws?.short_name, "art.", q.articles.article_number);
    console.log("\nPREGUNTA:", q.question_text);
    console.log("\nOPCIONES:");
    console.log("  A:", q.option_a);
    console.log("  B:", q.option_b);
    console.log("  C:", q.option_c);
    console.log("  D:", q.option_d);
    console.log("\nCORRECTA:", ["A", "B", "C", "D"][q.correct_option]);
    console.log("\nEXPLICACIÓN ACTUAL:", q.explanation);
    console.log("\nCONTENIDO DEL ARTÍCULO:");
    console.log(q.articles.content?.substring(0, 1500) || "(sin contenido)");
    console.log("\n");
  }
}

main();
