require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ids = [
  "c7448c86-98c3-4b38-ab01-f12b311935c5",
  "5e2d7489-0f5f-41bd-9763-26c819dec1df",
  "92587d1c-971e-4f43-9737-f00c4dfea00d",
  "e1885d75-103d-4a6d-ad4c-72d140835cf1",
  "193dc6e6-f391-464c-b1f0-38a5b9a1d192"
];

(async () => {
  for (const id of ids) {
    const { data: q } = await supabase
      .from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id")
      .eq("id", id)
      .single();

    const letters = ["A", "B", "C", "D"];
    console.log("\n" + "=".repeat(60));
    console.log("ID:", q.id);
    console.log("Pregunta:", q.question_text);
    console.log("A)", q.option_a);
    console.log("B)", q.option_b);
    console.log("C)", q.option_c);
    console.log("D)", q.option_d);
    console.log("Correcta:", letters[q.correct_option]);

    if (q.primary_article_id) {
      const { data: article } = await supabase
        .from("articles")
        .select("article_number, content, law_id")
        .eq("id", q.primary_article_id)
        .single();
      if (article) {
        const { data: law } = await supabase.from("laws").select("short_name").eq("id", article.law_id).single();
        console.log("Articulo:", law?.short_name, "art.", article.article_number);
        console.log("Contenido art:", (article.content || "").substring(0, 600));
      }
    }
  }
})();
