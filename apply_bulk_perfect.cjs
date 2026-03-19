// Mark all error questions in a topic as tech_perfect (for topics where all errors are false positives)
// Usage: node apply_bulk_perfect.cjs <error_questions_file> <topic_id> <topic_name>
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ERROR_FILE = process.argv[2];
const TOPIC_ID = process.argv[3];
const TOPIC_NAME = process.argv[4] || "Unknown";

if (!ERROR_FILE || !TOPIC_ID) {
  console.error("Usage: node apply_bulk_perfect.cjs <error_questions_file> <topic_id> [topic_name]");
  process.exit(1);
}

const errorStatuses = [
  "bad_explanation", "bad_answer", "bad_answer_and_explanation",
  "wrong_article", "wrong_article_bad_explanation",
  "wrong_article_bad_answer", "wrong_article_bad_answer_and_explanation",
  "all_wrong",
  "tech_bad_explanation", "tech_bad_answer", "tech_bad_answer_and_explanation"
];

async function main() {
  const questions = JSON.parse(fs.readFileSync(ERROR_FILE, "utf8"));
  const ids = questions.map(q => q.id);
  console.log("Questions to mark as perfect:", ids.length);

  // Determine if tech_ or normal based on first question's status
  const isTech = questions[0].topic_review_status.startsWith("tech_");
  const perfectStatus = isTech ? "tech_perfect" : "perfect";

  let success = 0;
  let errors = 0;

  for (const q of questions) {
    const status = q.topic_review_status.startsWith("tech_") ? "tech_perfect" : "perfect";
    const { error } = await supabase
      .from("questions")
      .update({
        topic_review_status: status,
        verified_at: new Date().toISOString(),
        verification_status: "ok"
      })
      .eq("id", q.id);

    if (error) { console.error("  ERROR:", q.id, error.message); errors++; }
    else { success++; }
  }

  console.log("Results: " + success + " success, " + errors + " errors");

  // Verify
  const { data: scopeData } = await supabase
    .from("topic_scope")
    .select("law_id, article_numbers")
    .eq("topic_id", TOPIC_ID);

  let allArticleIds = [];
  for (const scope of scopeData || []) {
    if (scope.article_numbers && scope.article_numbers.length > 0) {
      const { data: arts } = await supabase
        .from("articles")
        .select("id")
        .eq("law_id", scope.law_id)
        .in("article_number", scope.article_numbers);
      if (arts) allArticleIds.push(...arts.map(a => a.id));
    }
  }

  const { count: remaining } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("primary_article_id", allArticleIds)
    .in("topic_review_status", errorStatuses);

  const { count: totalActive } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("primary_article_id", allArticleIds);

  console.log("\n" + TOPIC_NAME + " verification:");
  console.log("  Active questions: " + totalActive);
  console.log("  Remaining errors: " + remaining);
}

main().catch(console.error);
