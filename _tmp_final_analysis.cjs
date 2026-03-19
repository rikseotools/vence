require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get law name
  const { data: law } = await supabase.from("laws").select("short_name, name").eq("id", "6ad91a6c-41ec-431f-9c80-5f5566834941").single();
  console.log("Ley:", law?.short_name, "-", law?.name);

  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("\n=== LAS 8 PREGUNTAS ===\n");
  for (let i = 0; i < disputes.length; i++) {
    const d = disputes[i];
    const { data: q } = await supabase.from("questions")
      .select("question_text, correct_option, option_a, option_b, option_c, option_d, primary_article_id, tags")
      .eq("id", d.question_id).single();

    const { data: a } = await supabase.from("articles").select("article_number").eq("id", q.primary_article_id).single();
    const artNum = a ? a.article_number : "?";
    
    // Tema según artículo CE
    let tema = "?";
    const n = parseInt(artNum);
    if (n >= 56 && n <= 65) tema = "T2-Corona";
    else if (n >= 159 && n <= 165) tema = "T2-TC";
    else if (n >= 166 && n <= 169) tema = "T2-Reforma";
    else if (n >= 117 && n <= 127) tema = "T4-Poder Judicial";
    else if (n >= 66 && n <= 80) tema = "T3-Cortes";
    else if (n >= 97 && n <= 107) tema = "T5-Gobierno";

    const hasT2 = (q.tags || []).some(t => t === "T2" || t.includes("Tema 2"));
    const verdict = tema.startsWith("T2") ? "✅ Bien en T2" : "❌ NO es T2, es " + tema;

    console.log("#" + (i+1) + " CE art." + artNum + " | " + verdict);
    console.log("  Q: " + q.question_text.substring(0, 110));
    console.log("  Tags: " + JSON.stringify(q.tags));
    console.log();
  }
})();
