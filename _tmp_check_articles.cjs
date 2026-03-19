require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("=== VERIFICACIÓN ARTÍCULO ↔ PREGUNTA ===\n");
  
  for (let i = 0; i < disputes.length; i++) {
    const d = disputes[i];
    const { data: q } = await supabase.from("questions")
      .select("question_text, option_a, option_b, option_c, option_d, correct_option, primary_article_id, tags, explanation")
      .eq("id", d.question_id).single();

    let artInfo = "SIN ARTÍCULO";
    let artTitle = "";
    let lawName = "";
    if (q.primary_article_id) {
      const { data: a } = await supabase.from("articles").select("article_number, display_number, title, law_id, full_text").eq("id", q.primary_article_id).single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
        artInfo = (l?.short_name || "?") + " art." + (a.display_number || a.article_number);
        artTitle = a.title || "";
        lawName = l?.short_name || "";
        
        // Check if the article text actually answers the question
        const artText = (a.full_text || "").substring(0, 200);
        
        console.log(`#${i+1} | ${artInfo}`);
        console.log(`  Pregunta: ${q.question_text.substring(0, 120)}`);
        console.log(`  Correcta: ${["A","B","C","D"][q.correct_option]} - ${[q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]}`);
        console.log(`  Art. título: ${artTitle}`);
        console.log(`  Tags: ${JSON.stringify(q.tags)}`);
        
        // Check: does the question TEXT mention a specific article?
        const artMention = q.question_text.match(/art[íi]culo\s+(\d+)/i);
        if (artMention) {
          const mentionedNum = artMention[1];
          const linkedNum = a.article_number;
          const match = mentionedNum === linkedNum;
          console.log(`  Menciona art. ${mentionedNum} | Vinculada art. ${linkedNum} | ${match ? "✅ COINCIDE" : "❌ NO COINCIDE"}`);
        } else {
          console.log(`  No menciona artículo específico en el texto | Vinculada art. ${a.article_number}`);
        }
      }
    } else {
      console.log(`#${i+1} | SIN ARTÍCULO VINCULADO`);
      console.log(`  Pregunta: ${q.question_text.substring(0, 120)}`);
    }
    console.log();
  }
})();
