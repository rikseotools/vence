const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/home/manuel/Documentos/github/vence/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Ver las leyes disponibles
  const { data: laws, error: err1 } = await supabase
    .from("laws")
    .select("id, short_name, full_name")
    .order("short_name");
  
  console.log("=== LEYES DISPONIBLES ===");
  laws.forEach(l => {
    console.log(l.short_name + " -> " + l.full_name?.substring(0, 60) + " (ID: " + l.id + ")");
  });
  
  // Contar artículos por ley
  console.log("\n=== ARTÍCULOS POR LEY ===");
  for (const law of laws) {
    const { data: articles, count } = await supabase
      .from("articles")
      .select("id", { count: "exact" })
      .eq("law_id", law.id);
    if (count > 0) {
      console.log(law.short_name + ": " + count + " artículos");
    }
  }
})();
