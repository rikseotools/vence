const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const limit = parseInt(process.argv[2]) || 20;

  const { data: questions, error } = await supabase
    .from("questions")
    .select(`
      id, question_text, correct_option, option_a, option_b, option_c, option_d, explanation,
      articles!questions_primary_article_id_fkey(
        id, article_number, title, content,
        laws!articles_law_id_fkey(short_name, name)
      )
    `)
    .eq("is_active", true)
    .eq("topic_review_status", "wrong_article")
    .order('id')
    .limit(limit);

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  if (!questions || questions.length === 0) {
    console.log("No hay preguntas wrong_article");
    return;
  }

  console.log(`=== ${questions.length} PREGUNTAS wrong_article ===\n`);

  questions.forEach((data, idx) => {
    const opts = ["A", "B", "C", "D"];
    const resp = [data.option_a, data.option_b, data.option_c, data.option_d][data.correct_option];

    console.log(`\n[${idx + 1}] ID: ${data.id}`);
    console.log(`Q: ${data.question_text.substring(0, 100)}...`);
    console.log(`CORRECTA: ${opts[data.correct_option]} - ${resp.substring(0, 80)}...`);
    console.log(`ARTÍCULO: ${data.articles?.laws?.short_name || '?'} Art. ${data.articles?.article_number || '?'}`);
  });

  console.log(`\n\nTotal: ${questions.length} preguntas`);
})();
