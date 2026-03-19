const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/home/manuel/Documentos/github/vence/.env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: laws } = await supabase.from("laws").select("id, short_name").ilike("short_name", "%6/1985%");
  if (!laws || laws.length === 0) {
    const { data: laws2 } = await supabase.from("laws").select("id, short_name").ilike("short_name", "%LOPJ%");
    console.log("By LOPJ:", JSON.stringify(laws2));
    return;
  }
  const lawId = laws[0].id;
  console.log("LOPJ law_id:", lawId, laws[0].short_name);
  
  for (const num of [61, 64, 89, 570]) {
    const { data: arts } = await supabase
      .from("articles")
      .select("id, article_number, title, content")
      .eq("law_id", lawId)
      .gte("article_number", num)
      .lte("article_number", num + 1)
      .order("article_number");
    
    console.log("\n=== Articles around " + num + " ===");
    for (const a of (arts || [])) {
      console.log("Art " + a.article_number + " | " + a.id + " | title: " + (a.title || "").substring(0, 100));
      console.log("  content preview: " + (a.content || "").substring(0, 150));
    }
  }
})();
