const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Buscar preguntas con problemas (no perfect/tech_perfect)
  const { data: problemas, error } = await supabase
    .from("questions")
    .select("id, question_text, topic_review_status, verification_status, primary_article_id, articles(article_number, laws(short_name))")
    .eq("is_active", true)
    .not("topic_review_status", "is", null)
    .not("topic_review_status", "in", "(perfect,tech_perfect)")
    .order("topic_review_status");

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  console.log("📊 PREGUNTAS CON PROBLEMAS (no perfect/tech_perfect):");
  console.log("Total:", problemas.length);

  if (problemas.length === 0) {
    console.log("\n✅ ¡No hay preguntas con problemas! Todo está perfecto.");
  } else {
    // Agrupar por status
    const byStatus = {};
    problemas.forEach(p => {
      if (!byStatus[p.topic_review_status]) byStatus[p.topic_review_status] = [];
      byStatus[p.topic_review_status].push(p);
    });

    console.log("\nDesglose por estado:");
    Object.keys(byStatus).forEach(status => {
      console.log("  " + status + ": " + byStatus[status].length);
    });

    console.log("\nDetalle:");
    problemas.slice(0, 15).forEach(p => {
      const art = p.articles ? p.articles.laws?.short_name + " art. " + p.articles.article_number : "Sin artículo";
      console.log("- [" + p.topic_review_status + "] " + art);
      console.log("  ID: " + p.id);
      console.log("  " + (p.question_text?.substring(0, 80) || "") + "...");
      console.log("");
    });

    if (problemas.length > 15) {
      console.log("... y " + (problemas.length - 15) + " más");
    }
  }

  // Resumen general
  const { data: stats } = await supabase
    .from("questions")
    .select("topic_review_status")
    .eq("is_active", true)
    .not("topic_review_status", "is", null);

  const summary = {};
  stats?.forEach(s => {
    summary[s.topic_review_status] = (summary[s.topic_review_status] || 0) + 1;
  });

  console.log("\n📈 RESUMEN TOTAL DE VERIFICACIONES:");
  Object.keys(summary).sort().forEach(k => {
    const icon = (k === "perfect" || k === "tech_perfect") ? "✅" : "⚠️";
    console.log("  " + icon + " " + k + ": " + summary[k]);
  });
}

main();
