const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const [,, lawShortName, artNum, searchTerm] = process.argv;

(async () => {
  if (!lawShortName) {
    console.log("Uso: node scripts/search-art.cjs <ley> [artNum] [searchTerm]");
    console.log("Ejemplo: node scripts/search-art.cjs LOPDGDD 1");
    console.log("Ejemplo: node scripts/search-art.cjs LOPDGDD '' 18.4");
    return;
  }

  const { data: law } = await supabase
    .from("laws")
    .select("id, short_name, name")
    .eq("short_name", lawShortName)
    .single();

  if (!law) {
    // Intentar búsqueda parcial
    const { data: laws } = await supabase
      .from("laws")
      .select("id, short_name, name")
      .ilike("short_name", "%" + lawShortName + "%")
      .limit(5);

    if (laws && laws.length > 0) {
      console.log("Leyes encontradas:");
      for (const l of laws) {
        console.log("-", l.short_name, "-", l.name);
      }
    } else {
      console.log("No encontrada ley:", lawShortName);
    }
    return;
  }

  let query = supabase
    .from("articles")
    .select("id, article_number, title, content")
    .eq("law_id", law.id);

  if (artNum) {
    query = query.eq("article_number", artNum);
  }

  if (searchTerm) {
    query = query.or(`content.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%`);
  }

  const { data: arts } = await query.order("article_number").limit(10);

  console.log("Ley:", law.short_name, "-", law.name);
  console.log("---");

  for (const a of arts || []) {
    console.log("Art", a.article_number, "-", a.title);
    console.log("ID:", a.id);
    console.log(a.content?.substring(0, 400) || "(sin contenido)");
    console.log("---");
  }
})();
