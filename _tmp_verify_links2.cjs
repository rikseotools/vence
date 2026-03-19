require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const artIds = [
    "84e89339-fac1-4c08-a399-56acf689320d",
    "8e5d9ef1-7c80-4e48-a43a-447b69d0bf07",
    "a7e977c1-2f4e-48c8-acff-18797725966d"
  ];

  console.log("=== ARTÍCULOS ===");
  for (const aid of artIds) {
    const { data: a, error } = await supabase.from("articles").select("*").eq("id", aid).single();
    if (error) {
      console.log(aid.substring(0,8), "ERROR:", error.message, error.code, error.details);
    } else if (a) {
      console.log(aid.substring(0,8), "| art:", a.article_number, "| display:", a.display_number, "| law_id:", a.law_id, "| title:", (a.title || "").substring(0,60));
    } else {
      console.log(aid.substring(0,8), "| NO ENCONTRADO");
    }
  }

  // Check: maybe these articles are in a different table?
  // Or maybe articles table has different column names?
  const { data: sample } = await supabase.from("articles").select("*").limit(1);
  if (sample && sample[0]) {
    console.log("\nColumnas de articles:", Object.keys(sample[0]).join(", "));
  }
})();
