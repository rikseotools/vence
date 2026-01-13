const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Get all verified question IDs
  let verifiedIds = new Set();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data: batch } = await supabase
      .from("ai_verification_results")
      .select("question_id")
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!batch || batch.length === 0) break;
    batch.forEach(v => verifiedIds.add(v.question_id));
    page++;
    if (batch.length < pageSize) break;
  }

  // Get all active question IDs
  let allQuestions = [];
  page = 0;

  while (true) {
    const { data: batch } = await supabase
      .from("questions")
      .select("id")
      .eq("is_active", true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!batch || batch.length === 0) break;
    allQuestions = allQuestions.concat(batch);
    page++;
    if (batch.length < pageSize) break;
  }

  // Filter unverified
  const pendingIds = allQuestions.filter(q => !verifiedIds.has(q.id)).map(q => q.id);

  console.log("Total activas:", allQuestions.length);
  console.log("Verificadas:", verifiedIds.size);
  console.log("Sin verificar:", pendingIds.length);

  // Get details of unverified questions
  const { data: questions, error } = await supabase
    .from("questions")
    .select(`
      id,
      question_text,
      option_a, option_b, option_c, option_d,
      correct_option,
      explanation,
      primary_article_id,
      articles(
        id,
        article_number,
        content,
        law_id,
        laws(short_name, name)
      )
    `)
    .in("id", pendingIds.slice(0, 400));

  if (error) {
    console.error("Error:", error);
    return;
  }

  const byLaw = {};
  questions.forEach(q => {
    const law = q.articles?.laws?.short_name || q.articles?.laws?.name || "Sin artículo";
    if (!byLaw[law]) byLaw[law] = [];
    byLaw[law].push(q);
  });

  console.log("\n=== PREGUNTAS SIN VERIFICAR POR LEY ===");
  Object.entries(byLaw).sort((a, b) => b[1].length - a[1].length).forEach(([law, qs]) => {
    console.log(law + ": " + qs.length);
  });

  // Save for processing
  fs.writeFileSync("/tmp/pending_questions_full.json", JSON.stringify(questions, null, 2));
  fs.writeFileSync("/tmp/pending_ids.json", JSON.stringify(pendingIds));
  console.log("\nGuardados en /tmp/pending_questions_full.json");
})();
