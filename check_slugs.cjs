require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const slugs = [
    "transparencia-buen-gobierno",
    "trafico-seguridad-vial",
    "proteccion-seguridad-ciudadana",
    "ley-poder-judicial",
    "ley-fuerzas-cuerpos-seguridad",
    "ley-enjuiciamiento-criminal",
    "ley-organica-1-2004",
    "ley-organica-3-2018",
    "ley-organica-3-2007"
  ];

  const { data: laws } = await supabase
    .from("laws")
    .select("slug, short_name, name")
    .in("slug", slugs);

  console.log("Encontradas en BD:", laws?.length || 0);
  for (const l of (laws || [])) {
    console.log("  ✅", l.slug, "→", l.short_name);
  }

  const foundSlugs = new Set((laws || []).map(l => l.slug));
  const missing = slugs.filter(s => !foundSlugs.has(s));
  console.log("\nNo encontrados en BD:", missing.length);

  for (const m of missing) {
    console.log("  ❌", m);
    // Buscar similares
    const parts = m.replace("ley-", "").split("-");
    const keyword = parts[0];
    const { data: similar } = await supabase
      .from("laws")
      .select("slug, short_name")
      .ilike("slug", "%" + keyword + "%");
    if (similar && similar.length > 0) {
      console.log("     Similares:", similar.map(s => s.slug + " (" + s.short_name + ")").join(", "));
    }
  }
})();
