// Generic script to apply corrections from agent reviews
// Usage: node apply_corrections.cjs <corrections_json_file> <topic_id> <topic_name>
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CORRECTIONS_FILE = process.argv[2];
const TOPIC_ID = process.argv[3];
const TOPIC_NAME = process.argv[4] || "Unknown";

if (!CORRECTIONS_FILE || !TOPIC_ID) {
  console.error("Usage: node apply_corrections.cjs <corrections_file> <topic_id> [topic_name]");
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
  const corrections = JSON.parse(fs.readFileSync(CORRECTIONS_FILE, "utf8"));
  console.log("Total corrections to process:", corrections.length);

  const verdictCounts = {};
  corrections.forEach(c => { verdictCounts[c.verdict] = (verdictCounts[c.verdict] || 0) + 1; });
  console.log("Verdicts:", JSON.stringify(verdictCounts));

  let success = 0;
  let errors = 0;
  let deactivated = 0;

  for (const c of corrections) {
    if (c.verdict === "deactivate") {
      // Deactivate question
      const { error } = await supabase
        .from("questions")
        .update({
          is_active: false,
          topic_review_status: "pending",
          verification_status: null,
          verified_at: null
        })
        .eq("id", c.id);

      if (error) { console.error("  ERROR deactivating " + c.id + ":", error.message); errors++; }
      else { deactivated++; success++; console.log("  DEACTIVATED: " + c.id); }

      // Also delete verification result
      await supabase.from("ai_verification_results").delete().eq("question_id", c.id);
      continue;
    }

    // Build update data
    const updateData = {
      topic_review_status: "tech_perfect",
      verified_at: new Date().toISOString(),
      verification_status: "ok"
    };

    // Check if this question had non-tech status (e.g., all_wrong, bad_explanation)
    // In that case, use "perfect" instead of "tech_perfect"
    if (c.original_status && !c.original_status.startsWith("tech_")) {
      updateData.topic_review_status = "perfect";
    }

    if (c.new_explanation) {
      updateData.explanation = c.new_explanation;
    }

    if (c.correct_option !== null && c.correct_option !== undefined) {
      updateData.correct_option = c.correct_option;
      console.log("  FIX_ANSWER: " + c.id + " -> option " + c.correct_option);
    }

    const { error } = await supabase
      .from("questions")
      .update(updateData)
      .eq("id", c.id);

    if (error) { console.error("  ERROR updating " + c.id + ":", error.message); errors++; }
    else { success++; }
  }

  console.log("\nResults: " + success + " success, " + errors + " errors, " + deactivated + " deactivated");

  // Verify remaining errors
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

  if (allArticleIds.length === 0) {
    console.log("No articles found for verification");
    return;
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
