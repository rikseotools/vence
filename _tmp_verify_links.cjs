require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Resolve the 3 distinct article IDs
  const artIds = [
    "84e89339-fac1-4c08-a399-56acf689320d",
    "8e5d9ef1-7c80-4e48-a43a-447b69d0bf07",
    "a7e977c1-2f4e-48c8-acff-18797725966d"
  ];

  console.log("=== ARTÍCULOS VINCULADOS ===\n");
  for (const aid of artIds) {
    const { data: a } = await supabase.from("articles").select("id, article_number, display_number, title, law_id").eq("id", aid).single();
    if (a) {
      const { data: l } = await supabase.from("laws").select("short_name, name").eq("id", a.law_id).single();
      console.log(aid.substring(0,8), "=", (l?.short_name || "?") + " art." + (a.display_number || a.article_number), "-", a.title || "sin título");
    }
  }

  // Now the full picture
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("\n=== LAS 8 PREGUNTAS CON SU ARTÍCULO ===\n");
  for (let i = 0; i < disputes.length; i++) {
    const d = disputes[i];
    const { data: q } = await supabase.from("questions")
      .select("question_text, correct_option, option_a, option_b, option_c, option_d, primary_article_id, tags")
      .eq("id", d.question_id).single();

    const { data: a } = await supabase.from("articles").select("article_number, display_number, law_id").eq("id", q.primary_article_id).single();
    const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
    
    const artLabel = l.short_name + " art." + (a.display_number || a.article_number);
    
    // Check: does the question match the linked article?
    const qText = q.question_text.toLowerCase();
    const artNum = a.article_number;
    const mentionsArt = qText.includes("artículo " + artNum) || qText.includes("art. " + artNum) || qText.includes("art." + artNum);
    
    // Determine correct tema based on article
    let correctTema = "?";
    if (artNum === "159" || artNum === "160" || artNum === "161" || artNum === "162" || artNum === "163" || artNum === "164" || artNum === "165") {
      correctTema = "T2 (Tribunal Constitucional)";
    } else if (artNum === "117" || artNum === "118" || artNum === "119" || artNum === "120" || artNum === "121" || artNum === "122" || artNum === "123" || artNum === "124" || artNum === "125" || artNum === "126" || artNum === "127") {
      correctTema = "T4 (Poder Judicial)";
    } else if (artNum === "166" || artNum === "167" || artNum === "168" || artNum === "169") {
      correctTema = "T2 (Reforma Constitución)";
    }

    const hasT2Tag = (q.tags || []).some(t => t === "T2" || t === "Tema 2");
    
    console.log("#" + (i+1) + " | " + artLabel + " | Tema correcto: " + correctTema);
    console.log("  Q: " + q.question_text.substring(0, 110));
    console.log("  R: " + ["A","B","C","D"][q.correct_option] + ") " + [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]);
    console.log("  Tags: " + JSON.stringify(q.tags) + " | Tiene T2: " + hasT2Tag);
    console.log("  Art vinculado correcto: " + (mentionsArt ? "✅ sí menciona art." + artNum : "⚠️ no menciona artículo explícito"));
    console.log();
  }
})();
