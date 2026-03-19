require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ids = [
  "df6d9b9b-6644-4897-bc47-29906e3a1094",
  "c53bc7d1-465b-445f-9936-84e655cd4d6c",
  "f06168bc-9b5d-4782-ae4e-dc36beae8df1",
  "8c7c2a4f-1adb-4e1b-a660-260559dfcdbe"
];

(async () => {
  for (const id of ids) {
    const { data: q } = await supabase
      .from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, primary_article_id")
      .eq("id", id)
      .single();

    console.log("\n" + "=".repeat(50));
    console.log("Pregunta:", q.question_text);
    console.log("A)", q.option_a);
    console.log("B)", q.option_b);
    console.log("C)", q.option_c);
    console.log("D)", q.option_d);
    console.log("Correcta:", ["A","B","C","D"][q.correct_option]);

    if (q.primary_article_id) {
      const { data: a } = await supabase
        .from("articles")
        .select("article_number, content, law_id")
        .eq("id", q.primary_article_id)
        .single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
        console.log("Ley:", l?.short_name, "art.", a.article_number);
        console.log("Contenido completo:", a.content);
      }
    }
  }
})();
