require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  const { data: tests, error } = await supabase
    .from("tests")
    .select("id, user_id, title, score, total_questions, completed_at")
    .eq("is_completed", true)
    .not("score", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1000);

  if (error) { console.error("Error:", error); return; }

  const affectedUsers = new Map();
  let totalBuggy = 0;
  let totalAnalyzed = 0;

  for (const test of tests) {
    const { data: answers } = await supabase
      .from("test_questions")
      .select("is_correct, user_answer")
      .eq("test_id", test.id);

    if (!answers || answers.length === 0) continue;
    totalAnalyzed++;

    const total = answers.length;
    const correct = answers.filter(a => a.is_correct).length;
    const correctPercentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    const currentScore = parseInt(test.score) || 0;

    const isBuggy = currentScore === correct && currentScore !== correctPercentage && total > 1;

    if (isBuggy) {
      totalBuggy++;
      const count = affectedUsers.get(test.user_id) || 0;
      affectedUsers.set(test.user_id, count + 1);
    }
  }

  console.log("=== INVESTIGACIÓN DEL BUG DE SCORES ===\n");
  console.log("Tests analizados:", totalAnalyzed);
  console.log("Tests con bug:", totalBuggy, "(" + Math.round(totalBuggy/totalAnalyzed*100) + "%)");
  console.log("Usuarios afectados:", affectedUsers.size, "\n");

  const userIds = Array.from(affectedUsers.keys());
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, nickname")
    .in("id", userIds);

  const profileMap = new Map();
  if (profiles) profiles.forEach(p => profileMap.set(p.id, p));

  console.log("Top usuarios afectados:");
  const sorted = Array.from(affectedUsers.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  sorted.forEach(([userId, count]) => {
    const profile = profileMap.get(userId);
    const name = profile ? (profile.nickname || profile.full_name || profile.email) : "Desconocido";
    console.log("  " + name + ": " + count + " tests afectados");
  });
}

investigate().catch(console.error);
