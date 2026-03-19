require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // 1. Get Tema 2 topic
  const { data: t2 } = await supabase.from("topics")
    .select("id, topic_number, title, description")
    .eq("topic_number", 2)
    .eq("position_type", "auxiliar_administrativo")
    .single();

  console.log("=== TEMA 2 ===");
  console.log("ID:", t2.id);
  console.log("Título:", t2.title);
  console.log("Descripción:", t2.description);

  // 2. Get topic_scope for Tema 2
  const { data: scopes } = await supabase.from("topic_scope")
    .select("id, law_id, article_numbers, title_numbers, chapter_numbers, include_full_title, include_full_chapter, weight")
    .eq("topic_id", t2.id);

  console.log("\n=== TOPIC SCOPE TEMA 2 ===");
  for (const s of scopes) {
    const { data: law } = await supabase.from("laws").select("short_name, name").eq("id", s.law_id).single();
    console.log("\nLey:", law?.short_name, "-", law?.name);
    console.log("  article_numbers:", JSON.stringify(s.article_numbers));
    console.log("  title_numbers:", JSON.stringify(s.title_numbers));
    console.log("  chapter_numbers:", JSON.stringify(s.chapter_numbers));
    console.log("  include_full_title:", s.include_full_title);
    console.log("  include_full_chapter:", s.include_full_chapter);
    console.log("  weight:", s.weight);
    
    // Check if art.117 is in this scope
    if (s.article_numbers && s.article_numbers.includes("117")) {
      console.log("  ⚠️ ¡CONTIENE ART. 117!");
    }
  }

  // 3. Also check Tema 4 scope
  const { data: t4 } = await supabase.from("topics")
    .select("id, topic_number, title, description")
    .eq("topic_number", 4)
    .eq("position_type", "auxiliar_administrativo")
    .single();

  console.log("\n\n=== TEMA 4 ===");
  console.log("ID:", t4.id);
  console.log("Título:", t4.title);
  console.log("Descripción:", t4.description);

  const { data: t4scopes } = await supabase.from("topic_scope")
    .select("id, law_id, article_numbers")
    .eq("topic_id", t4.id);

  console.log("\n=== TOPIC SCOPE TEMA 4 ===");
  for (const s of t4scopes) {
    const { data: law } = await supabase.from("laws").select("short_name, name").eq("id", s.law_id).single();
    console.log("\nLey:", law?.short_name, "-", law?.name);
    console.log("  article_numbers:", JSON.stringify(s.article_numbers));
    
    if (s.article_numbers && s.article_numbers.includes("117")) {
      console.log("  ✅ Contiene art. 117");
    }
  }
})();
