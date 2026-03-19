require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TOPIC_ID = process.argv[2];
const OUTPUT_FILE = process.argv[3] || "error_questions.json";
const LETTERS = ["A", "B", "C", "D"];

if (!TOPIC_ID) {
  console.error("Usage: node extract_errors.cjs <topic_id> [output_file]");
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
  const { data: scopeData, error: scopeErr } = await supabase
    .from("topic_scope")
    .select("law_id, article_numbers")
    .eq("topic_id", TOPIC_ID);

  if (scopeErr) { console.error("Scope error:", scopeErr); return; }
  if (!scopeData || scopeData.length === 0) { console.log("No scope entries found"); return; }

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

  if (allArticleIds.length === 0) { console.log("No articles found"); return; }

  // Fetch in batches of 100 article IDs to avoid URL length limits
  let allErrorQs = [];
  for (let i = 0; i < allArticleIds.length; i += 100) {
    const batch = allArticleIds.slice(i, i + 100);
    const { data: errorQs, error: qErr } = await supabase
      .from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, topic_review_status, primary_article_id")
      .eq("is_active", true)
      .in("primary_article_id", batch)
      .in("topic_review_status", errorStatuses);

    if (qErr) { console.error("Query error:", qErr); continue; }
    if (errorQs) allErrorQs.push(...errorQs);
  }

  console.log("Error questions found:", allErrorQs.length);
  if (allErrorQs.length === 0) { console.log("No errors to fix"); return; }

  // Status breakdown
  const statusCounts = {};
  allErrorQs.forEach(q => { statusCounts[q.topic_review_status] = (statusCounts[q.topic_review_status] || 0) + 1; });
  console.log("Status breakdown:", JSON.stringify(statusCounts));

  // Fetch article details
  const uniqueArticleIds = [...new Set(allErrorQs.map(q => q.primary_article_id))];
  let allArticles = [];
  for (let i = 0; i < uniqueArticleIds.length; i += 100) {
    const batch = uniqueArticleIds.slice(i, i + 100);
    const { data: arts } = await supabase
      .from("articles")
      .select("id, article_number, title, content, law_id")
      .in("id", batch);
    if (arts) allArticles.push(...arts);
  }

  const lawIds = [...new Set(allArticles.map(a => a.law_id))];
  const { data: laws } = await supabase
    .from("laws")
    .select("id, short_name")
    .in("id", lawIds);

  const lawMap = {};
  (laws || []).forEach(l => { lawMap[l.id] = l.short_name; });

  const articleMap = {};
  allArticles.forEach(a => {
    articleMap[a.id] = {
      article_number: a.article_number,
      title: a.title,
      content: a.content,
      law_short_name: lawMap[a.law_id] || "Unknown"
    };
  });

  const output = allErrorQs.map((q, i) => {
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

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log("Saved to " + OUTPUT_FILE + " (" + output.length + " questions)");
}

main().catch(console.error);
