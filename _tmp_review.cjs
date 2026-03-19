require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ids = [
  "ff3514ea-d847-46c7-bc0a-8ccfe2278469",
  "de858282-bc20-4ab4-8e0f-de6be0212674",
  "137219ca-6e4c-4b48-906c-80bb465e173b",
  "9fc0c93d-93bb-42f3-8184-b84633958322",
  "c5dabcc0-b240-4be1-b6c7-233ecd86c257",
  "2e0b49ee-4b1f-46ff-ab9b-94a25bfd4ab5",
  "06848961-1b22-47fb-bc4b-83653134848d",
  "33cbfdca-c002-4cbd-807a-621d37d33266",
  "2c21ee70-e8a9-46a7-8aae-71c8699e8c75"
];

(async () => {
  for (const id of ids) {
    const { data: q } = await supabase.from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id")
      .eq("id", id).single();
    if (!q) { console.log("NOT FOUND:", id); continue; }

    const letters = ["A","B","C","D"];
    console.log("========================================");
    console.log("ID:", q.id);
    console.log("Pregunta:", q.question_text.substring(0, 120));
    console.log("Correcta:", letters[q.correct_option]);

    if (q.primary_article_id) {
      const { data: a } = await supabase.from("articles").select("article_number, content, law_id").eq("id", q.primary_article_id).single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
        console.log("Art vinculado:", l?.short_name, a.article_number);
      }
    }

    console.log("Explicacion (" + (q.explanation || "").length + " chars):");
    console.log(q.explanation || "(vacia)");
    console.log("");
  }
})();
