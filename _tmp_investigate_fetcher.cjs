require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // How are questions mapped to topics? Check question_topic_mapping or similar
  const tables = ["question_topic_mapping", "question_topics", "topic_questions", "question_topic_assignments"];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*").limit(1);
    console.log(`${t}: ${error ? "NO EXISTE" : "EXISTE (" + data?.length + " rows)"}`);
  }

  // Check the RPC function that gets questions
  // The key question: what does "scope" or tag-based filtering look like?
  // Let me check if questions have a "scope" jsonb field
  const { data: q1 } = await supabase.from("questions").select("*").eq("id", "53183b91-fce7-4841-805c-00a04a0ae281").single();
  
  // Check all column names that might indicate topic assignment
  const topicCols = Object.keys(q1).filter(k => 
    k.includes("topic") || k.includes("scope") || k.includes("theme") || k.includes("tema") || k.includes("subject")
  );
  console.log("\nColumnas topic-related en questions:", topicCols);

  // The questions use "tags" array. Let me check how many art.117 questions have T2 tag
  // First get all articles for CE art.117
  const { data: art117 } = await supabase.from("articles").select("id").eq("article_number", "117");
  console.log("\nArticles with number 117:", art117?.length);
  
  if (art117 && art117.length > 0) {
    const art117Ids = art117.map(a => a.id);
    const { data: art117Qs } = await supabase.from("questions").select("id, tags, question_text")
      .in("primary_article_id", art117Ids);
    console.log("Questions linked to art.117:", art117Qs?.length);
    if (art117Qs) {
      art117Qs.forEach(q => console.log("  Tags:", JSON.stringify(q.tags), "|", q.question_text.substring(0, 60)));
    }
  }

  // Check: how does the app fetch questions for a specific tema?
  // The function get_personalized_questions might filter by tags
  // Let me check what the disputed questions #3 and #8 have in common with T2 questions
  
  // Question #3: f0a7096b - tags: ["constitucion","poder_judicial","parte_1"]
  // Question #8: 87afd8a9 - tags: [] (empty/null)
  
  // Maybe they got included because they're tagged with "constitucion" and the app 
  // maps Tema 2 to "constitucion" related questions?
  
  // Or maybe the app uses primary_article_id -> law -> topic mapping?
  // Let me check what law CE art.117 belongs to and what topics that law covers
  const { data: ceArt117 } = await supabase.from("articles").select("id, law_id, article_number")
    .eq("article_number", "117")
    .limit(5);
  
  if (ceArt117) {
    for (const art of ceArt117) {
      const { data: law } = await supabase.from("laws").select("short_name, name, topic_number").eq("id", art.law_id).single();
      console.log("\nArt 117 en:", law?.short_name, "| topic_number:", law?.topic_number);
    }
  }

  // Check if laws have a topic_number field
  const { data: ceLaw } = await supabase.from("laws").select("*").ilike("short_name", "CE%").limit(1);
  if (ceLaw && ceLaw[0]) {
    const topicFields = Object.keys(ceLaw[0]).filter(k => k.includes("topic"));
    console.log("\nCampos topic en laws:", topicFields);
    topicFields.forEach(k => console.log(`  ${k}:`, ceLaw[0][k]));
  }

  // Check question_law_topics or similar mapping
  const { data: lawTopics, error: ltErr } = await supabase.from("law_topics").select("*").limit(5);
  console.log("\nlaw_topics:", ltErr ? "NO EXISTE" : JSON.stringify(lawTopics));

  // Check article_topic_mapping
  const { data: atm, error: atmErr } = await supabase.from("article_topic_mapping").select("*").limit(5);
  console.log("article_topic_mapping:", atmErr ? "NO EXISTE" : JSON.stringify(atm));
})();
