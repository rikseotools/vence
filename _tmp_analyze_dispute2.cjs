require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get all 8 pending disputes with ALL fields
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const d = disputes[0];
  console.log("=== DISPUTA #1 - TODOS LOS CAMPOS ===");
  console.log(JSON.stringify(d, null, 2));

  // Try user profile with auth.users
  const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", d.user_id).single();
  console.log("\n=== PERFIL USUARIO ===");
  console.log(JSON.stringify(profile, null, 2));

  // Check if question exists (maybe deleted or in another table)
  const { data: q, error: qErr } = await supabase.from("questions").select("id").eq("id", d.question_id);
  console.log("\n=== PREGUNTA EN questions ===");
  console.log("Encontrada:", q?.length, "Error:", qErr?.message);

  // Maybe it's a psychometric question?
  const { data: pq } = await supabase.from("psychometric_questions").select("id, question_text, category").eq("id", d.question_id);
  console.log("En psychometric_questions:", pq?.length);

  // Check all 8 question IDs
  console.log("\n=== TODAS LAS 8 DISPUTAS ===");
  for (const disp of disputes) {
    const { data: qq } = await supabase.from("questions").select("id, question_text, topic_id").eq("id", disp.question_id);
    const found = qq && qq.length > 0;
    console.log(disp.id.substring(0,8), "| q:", disp.question_id.substring(0,8), "| encontrada:", found, found ? "| " + qq[0].question_text.substring(0,60) : "");
  }
})();
