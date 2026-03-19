require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = "9d2587b1-c799-476d-9797-b7a498a487b1";

(async () => {
  // The disputes were at 15:10-15:20 UTC on 2026-02-23
  // Check all tables that might track sessions/answers

  // 1. Check schema for session-related tables
  const sessionTables = [
    "test_sessions", "user_sessions", "quiz_sessions", 
    "test_results", "user_test_results", "exam_sessions"
  ];
  
  for (const t of sessionTables) {
    const { data, error } = await supabase.from(t).select("id").limit(1);
    if (!error) console.log("TABLE EXISTS:", t);
  }

  // 2. Check detailed_answers - maybe different column name
  const answerTables = [
    "detailed_answers", "user_answers", "answers", "question_answers",
    "test_answers", "user_question_answers"
  ];
  
  for (const t of answerTables) {
    const { data, error } = await supabase.from(t).select("id").limit(1);
    if (!error) console.log("TABLE EXISTS:", t);
  }

  // 3. Check tracking_interactions
  const { data: track, error: tErr } = await supabase
    .from("tracking_interactions")
    .select("id, interaction_type, question_id, metadata, created_at")
    .eq("user_id", userId)
    .gte("created_at", "2026-02-23T14:00:00")
    .lte("created_at", "2026-02-23T16:30:00")
    .order("created_at", { ascending: true })
    .limit(50);

  if (tErr) {
    console.log("tracking_interactions error:", tErr.message);
  } else {
    console.log("\n=== TRACKING INTERACTIONS ===");
    console.log("Total:", track?.length || 0);
    if (track) {
      track.forEach(t => {
        const meta = t.metadata ? JSON.stringify(t.metadata).substring(0, 200) : "";
        console.log(t.created_at.substring(11,19), "|", t.interaction_type, "| q:", (t.question_id || "").substring(0,8), "|", meta);
      });
    }
  }

  // 4. Check ai_chat_logs for this user around that time
  const { data: aiLogs } = await supabase
    .from("ai_chat_logs")
    .select("id, question_id, suggestion_used, created_at")
    .eq("user_id", userId)
    .gte("created_at", "2026-02-23T14:00:00")
    .lte("created_at", "2026-02-23T16:30:00")
    .order("created_at", { ascending: true });

  console.log("\n=== AI CHAT LOGS ===");
  console.log("Total:", aiLogs?.length || 0);
  if (aiLogs) aiLogs.forEach(l => console.log(l.created_at.substring(11,19), "| q:", (l.question_id || "").substring(0,8), "|", l.suggestion_used));

  // 5. Check user_question_history
  const { data: hist, error: hErr } = await supabase
    .from("user_question_history")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", "2026-02-23T14:00:00")
    .lte("created_at", "2026-02-23T16:30:00")
    .order("created_at", { ascending: true })
    .limit(30);

  if (hErr) {
    console.log("\nuser_question_history:", hErr.message);
  } else {
    console.log("\n=== USER QUESTION HISTORY ===");
    console.log("Total:", hist?.length || 0);
    if (hist && hist.length > 0) {
      console.log("Columns:", Object.keys(hist[0]).join(", "));
      hist.forEach(h => {
        const vals = Object.entries(h).filter(([k,v]) => v !== null && k !== "user_id").map(([k,v]) => k + ":" + v).join(" | ");
        console.log("  ", vals.substring(0, 200));
      });
    }
  }
})();
