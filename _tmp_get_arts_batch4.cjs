require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ids = [
  "573e906a-5245-435b-a174-01dd24d46948",
  "521d5066-18c3-488c-904a-a07d9c96f22b",
  "0160382a-aa23-4b40-a206-d71a3ae41fa6",
  "cbf3687c-9e06-40e4-ac15-cc333682c458",
  "654ee02b-e404-4191-a5d6-0fe36f26632e",
  "67c32f1a-ed57-473d-85b1-74b7748ac553",
  "540ec37a-8a29-4f07-b565-245067d5fa95"
];

(async () => {
  for (const id of ids) {
    const { data: q } = await supabase
      .from("questions")
      .select("id, question_text, primary_article_id")
      .eq("id", id)
      .single();

    if (q.primary_article_id) {
      const { data: a } = await supabase
        .from("articles")
        .select("article_number, content, law_id")
        .eq("id", q.primary_article_id)
        .single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
        console.log("\n" + "=".repeat(40));
        console.log("ID:", q.id);
        console.log(l?.short_name, "art.", a.article_number);
        console.log("Contenido:", (a.content || "").substring(0, 800));
      }
    } else {
      console.log("\n" + "=".repeat(40));
      console.log("ID:", q.id, "- SIN ARTICULO VINCULADO");
    }
  }
})();
