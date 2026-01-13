const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data } = await supabase
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
    .limit(1)
    .single();

  if (!data) {
    console.log("No hay mas preguntas wrong_article");
    return;
  }

  const opts = ["A", "B", "C", "D"];
  const resp = [data.option_a, data.option_b, data.option_c, data.option_d][data.correct_option];

  console.log("=== PREGUNTA ===");
  console.log("ID:", data.id);
  console.log("Q:", data.question_text);
  console.log("");
  console.log("A:", data.option_a);
  console.log("B:", data.option_b);
  console.log("C:", data.option_c);
  console.log("D:", data.option_d);
  console.log("");
  console.log("CORRECTA:", opts[data.correct_option], "-", resp);
  console.log("");
  console.log("Explicacion:", data.explanation || "(sin explicacion)");
  console.log("");
  console.log("=== ARTICULO VINCULADO ===");
  console.log("Ley:", data.articles?.laws?.short_name || data.articles?.laws?.name || "(sin ley)");
  console.log("Art:", data.articles?.article_number || "(sin numero)");
  console.log("Titulo:", data.articles?.title || "(sin titulo)");
  console.log("ID art:", data.articles?.id || "(sin id)");
  console.log("Contenido:", data.articles?.content || "(sin contenido)");
})();
