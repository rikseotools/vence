const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const TEMA_10_ID = "a21c97ce-dedc-4f56-b661-17f03a5fcc17";

  // Ver topic_scope completo
  const { data: scopes } = await supabase
    .from("topic_scope")
    .select("*, laws(short_name)")
    .eq("topic_id", TEMA_10_ID);

  console.log("=== TOPIC SCOPE TEMA 10 ===");
  if (scopes.length === 0) {
    console.log("  (vacío)");
  } else {
    scopes.forEach(s => console.log("  -", s.laws?.short_name, "- arts:", s.article_numbers?.length || 0));
  }

  // Ver artículos de LOREG en BD
  const LOREG_ID = "d69ff916-62c3-4a31-85f0-394a88cc8adf";
  const { data: artsLoreg } = await supabase
    .from("articles")
    .select("article_number")
    .eq("law_id", LOREG_ID)
    .order("article_number");

  console.log("\n=== ARTÍCULOS LOREG EN BD ===");
  console.log("Total:", artsLoreg?.length || 0);
  if (artsLoreg && artsLoreg.length > 0) {
    console.log("Artículos:", artsLoreg.map(a => a.article_number).join(", "));
  }

  // Verificar si existe el 204
  const tiene204 = artsLoreg?.some(a => a.article_number === "204");
  console.log("\n¿Tiene artículo 204?", tiene204 ? "SÍ" : "NO");
})();
