require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = "9d2587b1-c799-476d-9797-b7a498a487b1";

(async () => {
  // Check topics table existence
  const { data: topicsCheck, error: topErr } = await supabase.from("topics").select("id").limit(1);
  console.log("topics table:", topErr ? "ERROR: " + topErr.message : "exists, rows: " + topicsCheck?.length);

  // Maybe themes table?
  const { data: themesCheck, error: thErr } = await supabase.from("themes").select("id").limit(1);
  console.log("themes table:", thErr ? "ERROR: " + thErr.message : "exists, rows: " + themesCheck?.length);

  // Check oposicion_topics
  const { data: opTopics, error: otErr } = await supabase.from("oposicion_topics").select("*").limit(10);
  console.log("oposicion_topics:", otErr ? "ERROR: " + otErr.message : "exists, rows: " + opTopics?.length);
  if (opTopics) opTopics.forEach(t => console.log("  ", JSON.stringify(t)));

  // What does T2 mean? Check questions with T2 tag
  const { data: t2Sample } = await supabase.from("questions").select("id, question_text, tags, primary_article_id").contains("tags", ["T2"]).limit(5);
  console.log("\n=== SAMPLE PREGUNTAS CON TAG T2 ===");
  if (t2Sample) {
    for (const q of t2Sample) {
      let artInfo = "";
      if (q.primary_article_id) {
        const { data: a } = await supabase.from("articles").select("article_number, law_id").eq("id", q.primary_article_id).single();
        if (a) {
          const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
          artInfo = l?.short_name + " art." + a.article_number;
        }
      }
      console.log("  ", q.question_text.substring(0, 80), "| Tags:", JSON.stringify(q.tags), "| Art:", artInfo);
    }
  }

  // What other tags exist? Check distinct tags
  const { data: tagSample } = await supabase.from("questions").select("tags").not("tags", "is", null).limit(100);
  const allTags = new Set();
  if (tagSample) tagSample.forEach(q => (q.tags || []).forEach(t => allTags.add(t)));
  console.log("\n=== TAGS DISTINTOS (muestra) ===");
  console.log([...allTags].sort().join(", "));

  // Check if user has ANY sessions ever
  const { count: sessionCount } = await supabase.from("test_sessions").select("id", { count: "exact" }).eq("user_id", userId);
  console.log("\n=== TOTAL SESIONES DE MAR ===", sessionCount);

  // Check if user has ANY detailed_answers
  const { count: answerCount } = await supabase.from("detailed_answers").select("id", { count: "exact" }).eq("user_id", userId);
  console.log("=== TOTAL RESPUESTAS DE MAR ===", answerCount);

  // Check user_test_history or similar
  const { data: hist, error: hErr } = await supabase.from("user_test_history").select("*").eq("user_id", userId).limit(3);
  console.log("user_test_history:", hErr ? "ERROR: " + hErr.message : "exists, rows: " + hist?.length);
})();
