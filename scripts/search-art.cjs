const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: laws } = await supabase
    .from("laws")
    .select("id")
    .eq("short_name", "LO 1/2004")
    .single();

  if (!laws) { console.log("No encontrada LO 1/2004"); return; }

  const { data: arts } = await supabase
    .from("articles")
    .select("id, article_number, title, content")
    .eq("law_id", laws.id)
    .or("content.ilike.%funcionari%,content.ilike.%excedencia%,title.ilike.%funcionari%");

  for (const a of arts || []) {
    console.log("Art", a.article_number, "-", a.title);
    console.log(a.content?.substring(0, 400));
    console.log("ID:", a.id);
    console.log("---");
  }
})();
