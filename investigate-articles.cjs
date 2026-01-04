const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getBOEArticles(url) {
  const response = await fetch(url);
  const html = await response.text();

  const articles = [];
  const regex = /<h5[^>]*class="articulo"[^>]*>Artículo\s+([^<]+)<\/h5>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    articles.push(match[1].trim().replace(/\.$/, ''));
  }
  return articles;
}

(async () => {
  // Verificar varias leyes
  const leyes = [
    { name: "LO 5/1985", id: "d69ff916-62c3-4a31-85f0-394a88cc8adf", url: "https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672" },
    { name: "Ley 39/2015", id: "4b8e4c67-4b8e-4c67-4b8e-4c674b8e4c67", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565" },
    { name: "CE", id: "6ad91a6c-41ec-431f-9c80-5f5566834941", url: "https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229" }
  ];

  for (const ley of leyes) {
    console.log("\n========================================");
    console.log("LEY:", ley.name);
    console.log("========================================");

    // Obtener de BD
    const { data: dbArticles } = await supabase
      .from("articles")
      .select("article_number")
      .eq("law_id", ley.id)
      .order("article_number")
      .limit(20);

    console.log("\nEN BASE DE DATOS (primeros 20):");
    if (dbArticles && dbArticles.length > 0) {
      dbArticles.forEach(a => console.log("  -", JSON.stringify(a.article_number)));
    } else {
      console.log("  (no encontrados o ID incorrecto)");
    }

    // Obtener de BOE
    console.log("\nEN BOE (primeros 20):");
    try {
      const boeArticles = await getBOEArticles(ley.url);
      boeArticles.slice(0, 20).forEach(a => console.log("  -", JSON.stringify(a)));

      // Buscar bis/ter
      const conBis = boeArticles.filter(a => /bis|ter|quater/i.test(a));
      if (conBis.length > 0) {
        console.log("\nARTÍCULOS CON BIS/TER en BOE:");
        conBis.slice(0, 10).forEach(a => console.log("  -", JSON.stringify(a)));
      }
    } catch (e) {
      console.log("  Error:", e.message);
    }
  }

  // Buscar artículos con bis/ter en la BD
  console.log("\n========================================");
  console.log("ARTÍCULOS CON BIS/TER EN TODA LA BD");
  console.log("========================================");

  const { data: bisTer } = await supabase
    .from("articles")
    .select("article_number, laws(short_name)")
    .or("article_number.ilike.%bis%,article_number.ilike.%ter%,article_number.ilike.%quater%")
    .limit(30);

  if (bisTer) {
    bisTer.forEach(a => console.log("  -", JSON.stringify(a.article_number), "(" + a.laws.short_name + ")"));
  }
})();
