require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const topics = [
  { id: "bf188c31-b7d8-46a9-a66f-c86809ec1478", name: "T106" },
  { id: "877ae801-3340-4834-9be5-6a2481e32787", name: "T107" },
  { id: "8e6a56b9-c1b4-4d3f-a6f5-2d699339ab4e", name: "T108" },
  { id: "d10712ca-f699-45dc-aaf6-2cacb2ee2d1d", name: "T109" },
  { id: "d65be1ce-6a5e-42d1-9b1c-70f8b3784847", name: "T110" },
  { id: "385bb1d1-347e-4f25-9d95-c784dcac014c", name: "T111" },
  { id: "79035b41-1528-462f-b623-1335d3189f06", name: "T112" },
];

const errorStatuses = [
  "bad_explanation", "bad_answer", "bad_answer_and_explanation",
  "wrong_article", "wrong_article_bad_explanation",
  "wrong_article_bad_answer", "wrong_article_bad_answer_and_explanation"
];

async function main() {
  for (const t of topics) {
    const { data: scopeData } = await supabase
      .from("topic_scope")
      .select("law_id, article_numbers")
      .eq("topic_id", t.id);

    if (scopeData === null || scopeData.length === 0) {
      console.log(t.name + ": no scope entries");
      continue;
    }

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

    if (allArticleIds.length === 0) {
      console.log(t.name + ": no articles in scope");
      continue;
    }

    const { count: totalActive } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .in("primary_article_id", allArticleIds);

    const { count: errorCount } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .in("primary_article_id", allArticleIds)
      .in("topic_review_status", errorStatuses);

    console.log(t.name + ": " + totalActive + " active, " + errorCount + " errors");
  }
}

main().catch(console.error);
