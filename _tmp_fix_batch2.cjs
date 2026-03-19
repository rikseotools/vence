require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ids = [
  "2ae1344f-e268-423e-86ce-f9fd53d3d91a",
  "c4b70047-b88c-48f1-9006-252ad66ea4ed",
  "0e3cab05-8d50-4327-8f55-7c8325c658d1"
];

(async () => {
  for (const id of ids) {
    const { data: q } = await supabase
      .from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, primary_article_id")
      .eq("id", id)
      .single();

    let artContent = "";
    if (q.primary_article_id) {
      const { data: a } = await supabase
        .from("articles")
        .select("article_number, content, law_id")
        .eq("id", q.primary_article_id)
        .single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
        artContent = a.content || "";
        console.log("\n" + "=".repeat(50));
        console.log(l?.short_name, "art.", a.article_number);
        console.log("Contenido:", artContent.substring(0, 800));
      }
    }
    const letters = ["A", "B", "C", "D"];
    console.log("Pregunta:", q.question_text);
    console.log("A)", q.option_a);
    console.log("B)", q.option_b);
    console.log("C)", q.option_c);
    console.log("D)", q.option_d);
    console.log("Correcta:", letters[q.correct_option]);
  }
})();
