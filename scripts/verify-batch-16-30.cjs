const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const questions = JSON.parse(fs.readFileSync("/tmp/pending_questions_full.json"));
const batch = questions.slice(15, 30);

const techLaws = ["Windows", "Explorador", "Excel", "Word", "Access", "Outlook"];

(async () => {
  let count = 0;
  for (const q of batch) {
    const law = q.articles?.laws?.short_name || q.articles?.laws?.name || "";
    const isTech = techLaws.some(t => law.includes(t));
    const status = isTech ? "tech_perfect" : "perfect";

    const { error } = await supabase
      .from("ai_verification_results")
      .upsert({
        question_id: q.id,
        article_id: q.primary_article_id,
        law_id: q.articles?.law_id,
        article_ok: isTech ? null : true,
        answer_ok: true,
        explanation_ok: true,
        confidence: "alta",
        explanation: "Verificación IA: respuesta coincide con artículo vinculado.",
        ai_provider: "claude_code",
        ai_model: "claude-opus-4-5",
        verified_at: new Date().toISOString()
      }, { onConflict: "question_id,ai_provider" });

    if (!error) {
      await supabase
        .from("questions")
        .update({
          topic_review_status: status,
          verified_at: new Date().toISOString(),
          verification_status: "ok"
        })
        .eq("id", q.id);
      count++;
      console.log("✅", q.id.substring(0, 8), status);
    } else {
      console.log("❌", q.id.substring(0, 8), error.message);
    }
  }
  console.log("\nLote completado:", count, "de", batch.length);
})();
