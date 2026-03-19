require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {

  // Primero necesito el contenido completo del art 114 para la pregunta #10
  const { data: art114 } = await supabase
    .from("articles")
    .select("content")
    .eq("id", (await supabase.from("questions").select("primary_article_id").eq("id", "193dc6e6-f391-464c-b1f0-38a5b9a1d192").single()).data.primary_article_id)
    .single();
  console.log("Art 114 completo:", art114?.content);

  // Y el art 7 completo
  const { data: art7 } = await supabase
    .from("articles")
    .select("content")
    .eq("id", (await supabase.from("questions").select("primary_article_id").eq("id", "c7448c86-98c3-4b38-ab01-f12b311935c5").single()).data.primary_article_id)
    .single();
  console.log("\nArt 7 LO3/2007 completo:", art7?.content);

  // Art 77 completo
  const { data: art77 } = await supabase
    .from("articles")
    .select("content")
    .eq("id", (await supabase.from("questions").select("primary_article_id").eq("id", "5e2d7489-0f5f-41bd-9763-26c819dec1df").single()).data.primary_article_id)
    .single();
  console.log("\nArt 77 Ley 39/2015 completo:", art77?.content);
})();
