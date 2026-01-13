const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const perfects = [
    { id: "30f45398", note: "Art 106 Ley 39/2015 confirma: previo dictamen favorable del Consejo de Estado. Respuesta A correcta." },
    { id: "23d1a34c", note: "Art 120.3 CE confirma: Las sentencias se pronunciarán en audiencia pública. Respuesta B correcta." }
  ];

  for (const p of perfects) {
    const { data: q } = await supabase
      .from("questions")
      .select("id")
      .eq("is_active", true)
      .like("id", p.id + "%")
      .single();

    if (!q) { console.log("No encontrado:", p.id); continue; }

    await supabase.from("questions").update({
      topic_review_status: "perfect",
      verified_at: new Date().toISOString(),
      verification_status: "ok"
    }).eq("id", q.id);

    await supabase.from("ai_verification_results").update({
      article_ok: true,
      answer_ok: true,
      explanation_ok: true,
      confidence: "alta",
      explanation: "Opus 4.5: " + p.note,
      ai_model: "claude-opus-4-5-real",
      verified_at: new Date().toISOString()
    }).eq("question_id", q.id);

    console.log("✅", q.id.substring(0, 8), "→ perfect");
  }

  const { count } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("topic_review_status", "wrong_article");

  console.log("\nQuedan", count, "preguntas wrong_article");

  const { data: nextBatch } = await supabase
    .from("questions")
    .select("id, question_text, correct_option, option_a, option_b, option_c, option_d, articles!questions_primary_article_id_fkey(article_number, title, content, laws!articles_law_id_fkey(short_name, name))")
    .eq("is_active", true)
    .eq("topic_review_status", "wrong_article")
    .limit(20);

  console.log("\n=== Analizar siguiente lote ===\n");

  const opts = ["A", "B", "C", "D"];
  for (const q of nextBatch) {
    const lawRef = q.articles?.laws?.short_name || q.articles?.laws?.name;
    const artNum = q.articles?.article_number;

    console.log(q.id.substring(0,8));
    console.log("Q:", q.question_text.substring(0, 120));
    console.log("Vinculado:", lawRef, "Art", artNum);
    console.log("Resp:", opts[q.correct_option], "-", [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]?.substring(0, 60));
    console.log("");
  }
})();
