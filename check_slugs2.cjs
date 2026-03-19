require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { mapLawSlugToShortName } = require("./lib/lawMappingUtils.ts");

// All slugs from /leyes-de-oposiciones
const slugs = [
  "constitucion-espanola",
  "ley-organica-3-2007",
  "ley-39-2015",
  "ley-40-2015",
  "ley-organica-3-2018",
  "ley-7-1985",
  "rdl-5-2015",
  "ley-organica-1-2004",
  "ley-31-1995",
  "codigo-penal",
  "ley-enjuiciamiento-criminal",
  "ley-fuerzas-cuerpos-seguridad",
  "ley-poder-judicial",
  "haciendas-locales",
  "proteccion-seguridad-ciudadana",
  "trafico-seguridad-vial",
  "transparencia-buen-gobierno",
  "ley-29-1998",
  "igualdad-trans-lgtbi",
  "proteccion-civil",
];

for (const slug of slugs) {
  const result = mapLawSlugToShortName(slug);
  if (result) {
    console.log("  ✅", slug, "→", result);
  } else {
    console.log("  ❌", slug, "→ NO MAPEADO");
  }
}
