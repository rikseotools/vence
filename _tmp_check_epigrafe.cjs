require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get all topics for auxiliar_administrativo with their descriptions (epígrafes)
  const { data: topics } = await supabase
    .from("topics")
    .select("topic_number, title, description")
    .eq("position_type", "auxiliar_administrativo")
    .eq("is_active", true)
    .order("topic_number", { ascending: true });

  console.log("=== TODOS LOS TEMAS DE AUXILIAR ADMINISTRATIVO ===\n");
  for (const t of topics) {
    console.log("Tema " + t.topic_number + ": " + t.title);
    console.log("  Epígrafe: " + (t.description || "SIN DESCRIPCIÓN"));
    console.log();
  }
})();
