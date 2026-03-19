require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("=== ANÁLISIS DE TAGS DE LAS 8 PREGUNTAS ===\n");
  for (let i = 0; i < disputes.length; i++) {
    const d = disputes[i];
    const { data: q } = await supabase.from("questions").select("question_text, tags, primary_article_id").eq("id", d.question_id).single();
    
    let artInfo = "";
    if (q.primary_article_id) {
      const { data: a } = await supabase.from("articles").select("article_number, law_id").eq("id", q.primary_article_id).single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
        artInfo = l?.short_name + " art." + a.article_number;
      }
    }

    const tags = q.tags || [];
    const isT2 = tags.includes("T2") || tags.includes("Tema 2");
    const isTC = q.question_text.toLowerCase().includes("tribunal constitucional") || 
                 q.question_text.toLowerCase().includes("constitucional");
    const isPJ = artInfo.includes("art.117") || q.question_text.toLowerCase().includes("potestad jurisdiccional") ||
                 q.question_text.toLowerCase().includes("organización y funcionamiento");
    
    const correctTema = isPJ ? "T4 (Poder Judicial)" : "T2 (Tribunal Constitucional)";
    const verdict = isPJ ? "❌ MAL ETIQUETADA" : "✅ CORRECTA";
    
    console.log(`#${i+1} ${verdict}`);
    console.log(`  Pregunta: ${q.question_text.substring(0, 100)}`);
    console.log(`  Tags: ${JSON.stringify(tags)}`);
    console.log(`  Artículo: ${artInfo}`);
    console.log(`  Tema real: ${correctTema}`);
    console.log();
  }

  // Check: what tags do Tema 4 questions have?
  console.log("=== MUESTRA DE PREGUNTAS DE TEMA 4 (Poder Judicial) ===");
  const { data: t4qs } = await supabase.from("questions").select("tags, question_text")
    .or("tags.cs.{T4},tags.cs.{\"Tema 4\"}")
    .limit(5);
  if (t4qs && t4qs.length > 0) {
    t4qs.forEach(q => console.log("  Tags:", JSON.stringify(q.tags), "|", q.question_text.substring(0, 60)));
  } else {
    // Try a different approach
    const { data: t4qs2 } = await supabase.from("questions").select("tags, question_text").contains("tags", ["T4"]).limit(5);
    console.log("Con contains T4:", t4qs2?.length);
    if (t4qs2) t4qs2.forEach(q => console.log("  Tags:", JSON.stringify(q.tags), "|", q.question_text.substring(0, 60)));
  }
})();
