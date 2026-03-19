require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Tema 1
  const { data: t1 } = await supabase.from("topics")
    .select("id, title, description")
    .eq("topic_number", 1)
    .eq("position_type", "auxiliar_administrativo")
    .single();

  console.log("=== TEMA 1 ===");
  console.log("Título:", t1.title);
  console.log("Descripción:", t1.description);

  // Topic scope para Tema 1
  const { data: scopes } = await supabase.from("topic_scope")
    .select("law_id, article_numbers")
    .eq("topic_id", t1.id);

  console.log("\n=== TOPIC SCOPE TEMA 1 ===");
  for (const s of scopes) {
    const { data: law } = await supabase.from("laws").select("short_name").eq("id", s.law_id).single();
    console.log("\n" + (law?.short_name || "?") + ":");
    console.log("  Articles:", JSON.stringify(s.article_numbers));
    
    // Check specific articles
    const arts = s.article_numbers || [];
    if (arts.includes("117")) console.log("  ⚠️ INCLUYE art. 117 (Poder Judicial)");
    if (arts.includes("159")) console.log("  ⚠️ INCLUYE art. 159 (TC composición)");
    if (arts.includes("161")) console.log("  ⚠️ INCLUYE art. 161 (TC competencias)");
  }

  // Now check: the CE scope for Tema 1 - what range covers?
  const ceScope = scopes.find(s => {
    // Find the CE law scope
    return true; // We'll check all
  });
  
  // Get the CE law ID
  const { data: ceLaw } = await supabase.from("laws").select("id").eq("short_name", "CE").single();
  const ceEntry = scopes.find(s => s.law_id === ceLaw.id);
  
  if (ceEntry) {
    const arts = ceEntry.article_numbers || [];
    console.log("\n\n=== CE ARTICLES EN TEMA 1 ===");
    console.log("Total articles:", arts.length);
    console.log("Sorted:", arts.map(Number).sort((a,b) => a-b).join(", "));
    
    // What does Tema 1 epigrafe say?
    console.log("\n=== EPÍGRAFE TEMA 1 ===");
    console.log(t1.description);
    console.log("\nPreguntas clave:");
    console.log("- Art. 117 (Poder Judicial) en scope?", arts.includes("117") ? "SÍ" : "NO");
    console.log("- Art. 159 (TC composición) en scope?", arts.includes("159") ? "SÍ" : "NO");
    console.log("- Art. 161 (TC competencias) en scope?", arts.includes("161") ? "SÍ" : "NO");
  }
})();
