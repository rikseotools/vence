require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get all 8 disputes
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("=== PREGUNTA 1 EN DETALLE ===\n");
  
  const { data: q1 } = await supabase.from("questions").select("*").eq("id", disputes[0].question_id).single();
  
  console.log("Texto:", q1.question_text);
  console.log("A:", q1.option_a);
  console.log("B:", q1.option_b);
  console.log("C:", q1.option_c);
  console.log("D:", q1.option_d);
  console.log("Correcta:", q1.correct_option, "("+["A","B","C","D"][q1.correct_option]+")");
  console.log("Tags:", JSON.stringify(q1.tags));
  console.log("Article:", q1.primary_article_id);
  console.log("Oficial:", q1.is_official_exam, q1.exam_source || "");
  console.log("Explicación:", (q1.explanation || "").substring(0, 200));
  
  // Get article
  if (q1.primary_article_id) {
    const { data: art } = await supabase.from("articles").select("article_number, display_number, title, law_id").eq("id", q1.primary_article_id).single();
    if (art) {
      const { data: law } = await supabase.from("laws").select("short_name, name").eq("id", art.law_id).single();
      console.log("\nArtículo:", art.article_number, art.display_number || "", "-", art.title);
      console.log("Ley:", law?.short_name, "-", law?.name);
    }
  }

  // Now check: where was this question shown? What "tema" context?
  // Check question_tags or related
  const { data: qt } = await supabase.from("question_topics").select("*").eq("question_id", disputes[0].question_id);
  console.log("\nquestion_topics:", qt?.length, qt ? JSON.stringify(qt) : "tabla no existe?");

  // Get all 8 questions summary
  console.log("\n\n=== RESUMEN 8 PREGUNTAS DISPUTADAS ===\n");
  for (let i = 0; i < disputes.length; i++) {
    const d = disputes[i];
    const { data: q } = await supabase.from("questions").select("question_text, tags, primary_article_id").eq("id", d.question_id).single();
    
    let artInfo = "";
    if (q && q.primary_article_id) {
      const { data: a } = await supabase.from("articles").select("article_number, law_id").eq("id", q.primary_article_id).single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
        artInfo = l?.short_name + " art." + a.article_number;
      }
    }
    
    console.log("#" + (i+1), d.created_at.substring(11,19));
    console.log("  Q:", q?.question_text?.substring(0, 100));
    console.log("  Tags:", JSON.stringify(q?.tags));
    console.log("  Art:", artInfo || "sin artículo");
    console.log();
  }
})();
