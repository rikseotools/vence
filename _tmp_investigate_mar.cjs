require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = "9d2587b1-c799-476d-9797-b7a498a487b1";

(async () => {
  // 1. Find test sessions around the time of disputes (15:10-15:20 UTC on 2026-02-23)
  const { data: sessions } = await supabase
    .from("test_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", "2026-02-23T14:00:00")
    .lte("created_at", "2026-02-23T16:00:00")
    .order("created_at", { ascending: true });

  console.log("=== SESIONES DE TEST DE MAR (23 feb, 14:00-16:00 UTC) ===");
  console.log("Total:", sessions?.length || 0);
  if (sessions) {
    for (const s of sessions) {
      console.log("\nSession ID:", s.id);
      console.log("Creada:", s.created_at);
      console.log("Tipo:", s.test_type);
      console.log("Columnas:", Object.keys(s).filter(k => s[k] !== null).join(", "));
      // Print all non-null values
      for (const [k, v] of Object.entries(s)) {
        if (v !== null && k !== "id" && k !== "created_at" && k !== "user_id") {
          console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v) : v);
        }
      }
    }
  }

  // 2. Check detailed_answers for those question IDs around that time
  const disputeQIds = [
    "53183b91-fce7-4841-805c-00a04a0ae281",
    "2f6c270e-2c1b-4a88-a69b-d460dd0fcfb9",
    "f0a7096b-4499-4490-aa6f-439946fac965",
    "d3fa4ee5-767d-4ac5-a3f0-b7c9f55ec7c6",
    "8c841c10-1456-402d-b6b8-6b5df9bc3056",
    "032bb6a1-9c1e-4802-bd82-321445608e43",
    "55c8cfc6-147a-4545-becf-bd753da72921",
    "87afd8a9-8511-44f9-8d8d-af9c45376aca"
  ];

  const { data: answers } = await supabase
    .from("detailed_answers")
    .select("id, question_id, session_id, created_at")
    .eq("user_id", userId)
    .in("question_id", disputeQIds)
    .order("created_at", { ascending: true });

  console.log("\n\n=== RESPUESTAS DE MAR A LAS 8 PREGUNTAS DISPUTADAS ===");
  console.log("Total:", answers?.length || 0);
  if (answers) {
    const sessionIds = [...new Set(answers.map(a => a.session_id))];
    console.log("Sessions involucradas:", sessionIds);
    answers.forEach(a => console.log("  ", a.created_at?.substring(11,19), "| q:", a.question_id.substring(0,8), "| session:", a.session_id));
  }

  // 3. If we found session IDs, get session details
  if (answers && answers.length > 0) {
    const sessionIds = [...new Set(answers.map(a => a.session_id).filter(Boolean))];
    for (const sid of sessionIds) {
      const { data: sess } = await supabase.from("test_sessions").select("*").eq("id", sid).single();
      if (sess) {
        console.log("\n=== SESIÓN:", sid, "===");
        for (const [k, v] of Object.entries(sess)) {
          if (v !== null && k !== "user_id") {
            console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v) : v);
          }
        }
      }
    }
  }
})();
