require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = "9d2587b1-c799-476d-9797-b7a498a487b1";

(async () => {
  // Check topics table content
  const { data: topics } = await supabase.from("topics").select("*").limit(20);
  console.log("=== TOPICS TABLE ===");
  if (topics) topics.forEach(t => console.log(JSON.stringify(t)));

  // What T2 maps to - look for topic mapping
  // Check oposicion_temas or similar
  const { data: ot, error: otErr } = await supabase.from("oposicion_temas").select("*").limit(5);
  console.log("\noposicion_temas:", otErr ? otErr.message : JSON.stringify(ot));

  // Check question_scopes
  const { data: qs, error: qsErr } = await supabase.from("question_scopes").select("*").limit(5);
  console.log("\nquestion_scopes:", qsErr ? qsErr.message : JSON.stringify(qs));

  // Mar's detailed answers - try with different approach
  const { data: answers, error: aErr } = await supabase
    .from("detailed_answers")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log("\ndetailed_answers Mar:", aErr ? aErr.message : (answers?.length + " rows"));
  if (answers) answers.forEach(a => console.log("  ", a.created_at));

  // Check test_sessions - maybe user_id column is different
  const { data: sess, error: sErr } = await supabase
    .from("test_sessions")
    .select("id, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(3);
  console.log("\ntest_sessions (últimas 3):", sErr ? sErr.message : JSON.stringify(sess));

  // Check the dispute table more - maybe it stores the topic/test context
  const { data: d1 } = await supabase.from("question_disputes").select("*").eq("id", "dbc540e3-37b3-436f-b5dc-ad38fdc5de64").single();
  console.log("\n=== DISPUTA COMPLETA (todos los campos) ===");
  console.log(Object.keys(d1).join(", "));
  for (const [k, v] of Object.entries(d1)) {
    if (v !== null) console.log(`  ${k}:`, v);
  }

  // Check what "T2" means in the context of Auxiliar Administrativo
  // The questions are about Tribunal Constitucional and Poder Judicial
  // T2 likely = Tema 2 of the oposición
  // Let me check what topics exist for auxiliar_administrativo_estado
  const { data: oposTopics } = await supabase
    .from("oposicion_topics")
    .select("*")
    .limit(20);
  console.log("\noposicion_topics content:", JSON.stringify(oposTopics));

  // Check the tag "VI. El Tribunal Constitucional" - is that a different tema?
  const { data: viSample } = await supabase.from("questions").select("id, tags, question_text").contains("tags", ["VI. El Tribunal Constitucional"]).limit(3);
  console.log("\n=== PREGUNTAS CON TAG 'VI. El Tribunal Constitucional' ===");
  if (viSample) viSample.forEach(q => console.log("  Tags:", JSON.stringify(q.tags), "|", q.question_text.substring(0, 80)));

  // What tag does "Poder Judicial" fall under?
  const { data: pjSample } = await supabase.from("questions").select("id, tags, question_text").contains("tags", ["cgpj"]).limit(3);
  console.log("\n=== PREGUNTAS CON TAG 'cgpj' ===");
  if (pjSample) pjSample.forEach(q => console.log("  Tags:", JSON.stringify(q.tags), "|", q.question_text.substring(0, 80)));
})();
