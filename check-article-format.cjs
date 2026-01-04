const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: all } = await supabase
    .from("articles")
    .select("article_number, laws(short_name)")
    .limit(1000);

  // Buscar artículos que contengan letras
  const conLetras = all.filter(a => {
    const num = a.article_number;
    // Si tiene letras que NO sean bis/ter/quater/etc
    if (/[a-zA-Z]/.test(num)) {
      // Excluir los que son número + bis/ter/etc
      if (/^\d+\s*(bis|ter|quater|quinquies|sexies|septies)?$/i.test(num)) {
        return false;
      }
      return true;
    }
    return false;
  });

  console.log("Artículos guardados con texto (no solo números):");
  if (conLetras.length === 0) {
    console.log("  Ninguno encontrado - todos están en formato numérico");
  } else {
    conLetras.slice(0, 30).forEach(a => {
      console.log(" -", a.article_number, "(" + a.laws.short_name + ")");
    });
  }

  // Mostrar algunos ejemplos de diferentes leyes
  console.log("\n=== Ejemplos por ley ===");
  const leyes = ["CE", "Ley 39/2015", "Ley 40/2015", "LO 5/1985"];
  for (const ley of leyes) {
    const { data } = await supabase
      .from("articles")
      .select("article_number, laws!inner(short_name)")
      .eq("laws.short_name", ley)
      .limit(5);

    if (data && data.length > 0) {
      console.log("\n" + ley + ":");
      data.forEach(a => console.log("  -", a.article_number));
    }
  }
})();
