require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get Tema 1 topic
  const { data: t1 } = await supabase.from("topics")
    .select("id").eq("topic_number", 1).eq("position_type", "auxiliar_administrativo").single();

  // Get CE law
  const { data: ceLaw } = await supabase.from("laws").select("id").eq("short_name", "CE").single();

  // Get current scope entry
  const { data: scopeEntry } = await supabase.from("topic_scope")
    .select("id, article_numbers")
    .eq("topic_id", t1.id)
    .eq("law_id", ceLaw.id)
    .single();

  console.log("Scope entry ID:", scopeEntry.id);
  console.log("Artículos antes:", scopeEntry.article_numbers.length);

  // New articles: 1-55 + 116
  const newArticles = [];
  for (let i = 1; i <= 55; i++) newArticles.push(String(i));
  newArticles.push("116");

  console.log("Artículos después:", newArticles.length);
  console.log("Nuevos:", newArticles.join(", "));

  // Update
  const { error } = await supabase.from("topic_scope")
    .update({ article_numbers: newArticles })
    .eq("id", scopeEntry.id);

  if (error) {
    console.error("❌ Error:", error.message);
    return;
  }
  console.log("✅ topic_scope actualizado");

  // Verify
  const { data: verify } = await supabase.from("topic_scope")
    .select("article_numbers")
    .eq("id", scopeEntry.id)
    .single();

  console.log("\nVerificación:", verify.article_numbers.length, "artículos");
  console.log(verify.article_numbers.sort((a,b) => Number(a)-Number(b)).join(", "));

  // Count questions now
  const { data: ceArticles } = await supabase.from("articles")
    .select("id")
    .eq("law_id", ceLaw.id)
    .in("article_number", newArticles);

  const artIds = ceArticles.map(a => a.id);
  const { count } = await supabase.from("questions")
    .select("id", { count: "exact" })
    .in("primary_article_id", artIds)
    .eq("is_active", true);

  console.log("\nPreguntas activas en Tema 1 (CE):", count);
})();
