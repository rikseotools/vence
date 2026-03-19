require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const ids = [
    "53183b91-fce7-4841-805c-00a04a0ae281",
    "2f6c270e-2c1b-4a88-a69b-d460dd0fcfb9",
    "f0a7096b-4499-4490-aa6f-439946fac965",
    "d3fa4ee5-767d-4ac5-a3f0-b7c9f55ec7c6",
    "8c841c10-1456-402d-b6b8-6b5df9bc3056",
    "032bb6a1-9c1e-4802-bd82-321445608e43",
    "55c8cfc6-147a-4545-becf-bd753da72921",
    "87afd8a9-8511-44f9-8d8d-af9c45376aca"
  ];

  // Query each one individually with select *
  for (const id of ids) {
    const { data, error } = await supabase.from("questions").select("id, primary_article_id").eq("id", id).single();
    if (error) {
      console.log(id.substring(0,8), "| ERROR:", error.message, error.code);
    } else if (data) {
      console.log(id.substring(0,8), "| primary_article_id:", data.primary_article_id);
    } else {
      console.log(id.substring(0,8), "| NO DATA");
    }
  }

  // Wait - maybe the question_id in disputes is not exactly matching
  // Let me get the disputes again and check the EXACT question_ids
  console.log("\n=== EXACT question_ids from disputes ===");
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("question_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  
  for (const d of disputes) {
    const qid = d.question_id;
    console.log("Dispute q_id:", qid);
    const { data, error } = await supabase.from("questions").select("id, primary_article_id, question_text").eq("id", qid).single();
    if (error) console.log("  ERROR:", error.message, error.code, error.details);
    else if (data) console.log("  FOUND | art:", data.primary_article_id, "| q:", data.question_text.substring(0,60));
    else console.log("  NULL DATA");
  }
})();
