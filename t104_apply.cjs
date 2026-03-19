require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const corrections = JSON.parse(fs.readFileSync("t104_corrections.json", "utf8"));
  console.log("Total corrections to apply:", corrections.length);

  let success = 0;
  let errors = 0;

  for (const c of corrections) {
    const updateData = {
      explanation: c.new_explanation,
      topic_review_status: "perfect",
      verified_at: new Date().toISOString(),
      verification_status: "ok"
    };

    // If fix_article and new_article_id provided, update primary_article_id
    if (c.verdict === "fix_article" && c.new_article_id) {
      updateData.primary_article_id = c.new_article_id;
      console.log(`  [fix_article] ${c.id} -> new article: ${c.new_article_id}`);
    }

    const { error } = await supabase
      .from("questions")
      .update(updateData)
      .eq("id", c.id);

    if (error) {
      console.error(`  ERROR updating ${c.id}:`, error.message);
      errors++;
    } else {
      success++;
    }
  }

  console.log(`\nResults: ${success} success, ${errors} errors`);

  // Verify: count remaining errors for T104
  const topicId = "f1964780-36f5-4e1e-8d88-db573ea6170b";
  const { data: scopeData } = await supabase
    .from("topic_scope")
    .select("law_id, article_numbers")
    .eq("topic_id", topicId);

  let allArticleIds = [];
  for (const scope of scopeData) {
    if (scope.article_numbers && scope.article_numbers.length > 0) {
      const { data: arts } = await supabase
        .from("articles")
        .select("id")
        .eq("law_id", scope.law_id)
        .in("article_number", scope.article_numbers);
      if (arts) allArticleIds.push(...arts.map(a => a.id));
    }
  }

  const errorStatuses = [
    "bad_explanation", "bad_answer", "bad_answer_and_explanation",
    "wrong_article", "wrong_article_bad_explanation",
    "wrong_article_bad_answer", "wrong_article_bad_answer_and_explanation"
  ];

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

  const { count: perfectCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("primary_article_id", allArticleIds)
    .eq("topic_review_status", "perfect");

  console.log(`\nT104 verification:`);
  console.log(`  Active questions: ${totalActive}`);
  console.log(`  Perfect: ${perfectCount}`);
  console.log(`  Remaining errors: ${remaining}`);
}

main().catch(console.error);
