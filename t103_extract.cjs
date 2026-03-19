require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TOPIC_ID = "f1964780-36f5-4e1e-8d88-db573ea6170b";
const LETTERS = ["A", "B", "C", "D"];

async function main() {
  // Step 1: Get topic_scope entries (law_id + article_numbers)
  const { data: scopeData, error: scopeErr } = await supabase
    .from("topic_scope")
    .select("law_id, article_numbers")
    .eq("topic_id", TOPIC_ID);

  if (scopeErr) {
    console.error("Scope error:", scopeErr);
    return;
  }

  if (scopeData.length === 0) {
    console.log("No scope entries found for topic", TOPIC_ID);
    // Try finding correct topic ID
    const { data: topics } = await supabase
      .from("topics")
      .select("id, name")
      .ilike("name", "%documento%");
    console.log("Topics matching 'documento':", JSON.stringify(topics, null, 2));
    return;
  }

  console.log("Scope entries:", scopeData.length);

  // Step 2: For each scope entry, get matching article IDs
  let allArticleIds = [];
  for (const scope of scopeData) {
    if (scope.article_numbers && scope.article_numbers.length > 0) {
      const { data: arts } = await supabase
        .from("articles")
        .select("id")
        .eq("law_id", scope.law_id)
        .in("article_number", scope.article_numbers);
      if (arts) {
        allArticleIds.push(...arts.map(a => a.id));
      }
    }
  }

  console.log("Total articles in scope:", allArticleIds.length);

  if (allArticleIds.length === 0) {
    console.log("No articles found!");
    return;
  }

  // Step 3: Count total active questions
  const { count: totalActive } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("primary_article_id", allArticleIds);

  console.log("Total active questions:", totalActive);

  // Step 4: Get error questions
  const errorStatuses = [
    "bad_explanation", "bad_answer", "bad_answer_and_explanation",
    "wrong_article", "wrong_article_bad_explanation",
    "wrong_article_bad_answer", "wrong_article_bad_answer_and_explanation"
  ];

  const { data: errorQs, count: errorCount } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, topic_review_status, primary_article_id", { count: "exact" })
    .eq("is_active", true)
    .in("primary_article_id", allArticleIds)
    .in("topic_review_status", errorStatuses);

  console.log("Error questions:", errorCount);

  if (errorCount === 0) {
    console.log("No error questions to fix!");
    return;
  }

  // Status breakdown
  const statusCounts = {};
  errorQs.forEach(q => {
    statusCounts[q.topic_review_status] = (statusCounts[q.topic_review_status] || 0) + 1;
  });
  console.log("Status breakdown:", JSON.stringify(statusCounts, null, 2));

  // Step 5: Get article content for each question
  const uniqueArticleIds = [...new Set(errorQs.map(q => q.primary_article_id))];
  const { data: articles } = await supabase
    .from("articles")
    .select("id, article_number, title, content, law_id")
    .in("id", uniqueArticleIds);

  // Get law info
  const lawIds = [...new Set(articles.map(a => a.law_id))];
  const { data: laws } = await supabase
    .from("laws")
    .select("id, short_name")
    .in("id", lawIds);

  const lawMap = {};
  laws.forEach(l => { lawMap[l.id] = l.short_name; });

  const articleMap = {};
  articles.forEach(a => {
    articleMap[a.id] = {
      article_number: a.article_number,
      title: a.title,
      content: a.content,
      law_short_name: lawMap[a.law_id] || "Unknown"
    };
  });

  // Step 6: Build output
  const output = errorQs.map((q, i) => {
    const art = articleMap[q.primary_article_id] || {};
    return {
      index: i + 1,
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      correct_letter: LETTERS[q.correct_option],
      explanation: q.explanation,
      topic_review_status: q.topic_review_status,
      primary_article_id: q.primary_article_id,
      article_number: art.article_number,
      article_title: art.title,
      article_content: art.content,
      law_short_name: art.law_short_name
    };
  });

  fs.writeFileSync("t104_error_questions.json", JSON.stringify(output, null, 2));
  console.log("Saved to t104_error_questions.json (" + output.length + " questions)");
}

main().catch(console.error);
