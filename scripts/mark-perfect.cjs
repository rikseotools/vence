// Uso: node scripts/mark-perfect.cjs <id> <status> "<nota>"
// status: perfect, tech_perfect, wrong_article
// Ejemplo: node scripts/mark-perfect.cjs abc123 perfect "Art 15 RGPD confirmado"

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const [,, idArg, statusArg, noteArg, newArtIdArg] = process.argv;

(async () => {
  if (!idArg || !statusArg) {
    console.log("Uso: node scripts/mark-perfect.cjs <id> <status> \"<nota>\" [newArticleId]");
    console.log("status: perfect, tech_perfect, wrong_article");
    return;
  }

  // Buscar pregunta por ID completo o parcial
  let q;
  // Primero intentar con ID completo
  const { data: exact } = await supabase
    .from("questions")
    .select("id")
    .eq("id", idArg)
    .single();

  if (exact) {
    q = exact;
  } else {
    // Intentar con like
    const { data: partial } = await supabase
      .from("questions")
      .select("id")
      .like("id", idArg + "%")
      .limit(1);
    q = partial?.[0];
  }

  if (!q) {
    console.log("No encontrada pregunta con ID:", idArg);
    return;
  }

  const updateData = {
    topic_review_status: statusArg,
    verified_at: new Date().toISOString(),
    verification_status: statusArg === "wrong_article" ? "problem" : "ok"
  };

  // Si se proporciona nuevo article ID, actualizar también
  if (newArtIdArg) {
    updateData.primary_article_id = newArtIdArg;
  }

  await supabase.from("questions").update(updateData).eq("id", q.id);

  const verifyData = {
    article_ok: statusArg === "tech_perfect" ? null : (statusArg === "perfect"),
    answer_ok: statusArg !== "wrong_article",
    explanation_ok: statusArg !== "wrong_article",
    confidence: "alta",
    explanation: "Opus 4.5: " + (noteArg || statusArg),
    ai_model: "claude-opus-4-5-real",
    verified_at: new Date().toISOString()
  };

  if (newArtIdArg) {
    verifyData.article_id = newArtIdArg;
  }

  await supabase.from("ai_verification_results").update(verifyData).eq("question_id", q.id);

  console.log("✅", q.id.substring(0, 8), "->", statusArg);

  const { count } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("topic_review_status", "wrong_article");

  console.log("Quedan", count, "preguntas wrong_article");
})();
