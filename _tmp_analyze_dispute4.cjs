require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // First, get the question with minimal columns to see what exists
  const qId = "53183b91-fce7-4841-805c-00a04a0ae281";
  
  const { data: q, error } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, scope, is_official_exam, exam_source, is_active")
    .eq("id", qId);

  console.log("Error:", error?.message);
  console.log("Data:", q?.length);
  
  if (q && q[0]) {
    const question = q[0];
    console.log("\n=== PREGUNTA ===");
    console.log("Texto:", question.question_text);
    console.log("A:", question.option_a);
    console.log("B:", question.option_b);
    console.log("C:", question.option_c);
    console.log("D:", question.option_d);
    console.log("Correcta:", question.correct_option, "("+["A","B","C","D"][question.correct_option]+")");
    console.log("Scope:", JSON.stringify(question.scope));
    console.log("Article:", question.primary_article_id);
    console.log("Oficial:", question.is_official_exam);
    console.log("Activa:", question.is_active);
    
    if (question.primary_article_id) {
      const { data: art } = await supabase.from("articles").select("article_number, title, law_id").eq("id", question.primary_article_id).single();
      if (art) {
        const { data: law } = await supabase.from("laws").select("short_name").eq("id", art.law_id).single();
        console.log("Art:", art.article_number, "-", art.title, "| Ley:", law?.short_name);
      }
    }
  }

  // Now get ALL 8 disputes and their questions
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("\n=== BUSCANDO LAS 8 PREGUNTAS ===");
  for (const d of disputes) {
    const { data: qs, error: qe } = await supabase
      .from("questions")
      .select("id, question_text, scope, primary_article_id")
      .eq("id", d.question_id);
    
    if (qe) {
      console.log(d.id.substring(0,8), "| ERROR:", qe.message);
    } else if (qs && qs.length > 0) {
      const qq = qs[0];
      console.log(d.id.substring(0,8), "| scope:", JSON.stringify(qq.scope), "| q:", qq.question_text.substring(0, 80));
    } else {
      console.log(d.id.substring(0,8), "| NO ENCONTRADA - id:", d.question_id);
    }
  }
})();
