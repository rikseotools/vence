const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TUE_ID = "ddc2ffa9-d99b-4abc-b149-ab47916ab9da";
const TFUE_ID = "eba370d3-73d9-44a9-9865-48d2effabaf4";

(async () => {
  // Artículos existentes en BD
  const { data: tueBD } = await supabase.from("articles").select("article_number").eq("law_id", TUE_ID);
  const { data: tfueBD } = await supabase.from("articles").select("article_number").eq("law_id", TFUE_ID);

  const existentesTUE = new Set(tueBD?.map(a => a.article_number) || []);
  const existentesTFUE = new Set(tfueBD?.map(a => a.article_number) || []);

  console.log("=== ARTÍCULOS EXISTENTES EN BD ===");
  console.log("TUE:", [...existentesTUE].sort((a,b) => parseInt(a) - parseInt(b)).join(", "));
  console.log("TFUE:", [...existentesTFUE].sort((a,b) => parseInt(a) - parseInt(b)).join(", "));

  // Leer preguntas y extraer artículos mencionados con contexto
  const folder = "/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_11,_La_organización_de_la_Unión_Europea/";
  const files = fs.readdirSync(folder).filter(f => f.endsWith(".json"));

  const articulosMencionados = {
    TUE: new Map(),  // artículo -> [contextos]
    TFUE: new Map(),
    desconocido: new Map()
  };

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(folder, file)));
    for (const q of data.questions) {
      const exp = q.explanation || "";

      // Buscar menciones de artículos con contexto de ley
      // Patrones: "artículo X del TUE", "artículo X TFUE", "art. X TUE", etc.

      // TUE
      const tuePat = /[Aa]rt[íi]culo\s+(\d+)(?:\.\d+)?\s*(?:del\s+)?(?:TUE|Tratado\s+de\s+la\s+Uni[oó]n\s+Europea)/gi;
      let match;
      while ((match = tuePat.exec(exp)) !== null) {
        const art = match[1];
        if (!articulosMencionados.TUE.has(art)) articulosMencionados.TUE.set(art, []);
        articulosMencionados.TUE.get(art).push(exp.substring(Math.max(0, match.index - 20), match.index + 80));
      }

      // TFUE
      const tfuePat = /[Aa]rt[íi]culo\s+(\d+)(?:\.\d+)?\s*(?:del\s+)?(?:TFUE|Tratado\s+de\s+Funcionamiento)/gi;
      while ((match = tfuePat.exec(exp)) !== null) {
        const art = match[1];
        if (!articulosMencionados.TFUE.has(art)) articulosMencionados.TFUE.set(art, []);
        articulosMencionados.TFUE.get(art).push(exp.substring(Math.max(0, match.index - 20), match.index + 80));
      }

      // Artículos sin ley específica (solo "artículo X")
      const genericPat = /[Aa]rt[íi]culo\s+(\d+)(?![^<]*(?:TUE|TFUE|Tratado))/gi;
      while ((match = genericPat.exec(exp)) !== null) {
        const art = match[1];
        // Solo si no está ya en TUE o TFUE
        if (!articulosMencionados.TUE.has(art) && !articulosMencionados.TFUE.has(art)) {
          if (!articulosMencionados.desconocido.has(art)) articulosMencionados.desconocido.set(art, []);
          articulosMencionados.desconocido.get(art).push(exp.substring(Math.max(0, match.index - 20), match.index + 80));
        }
      }
    }
  }

  console.log("\n=== ARTÍCULOS MENCIONADOS EN PREGUNTAS ===");

  const tueArts = [...articulosMencionados.TUE.keys()].sort((a,b) => parseInt(a) - parseInt(b));
  console.log("\nTUE (" + tueArts.length + " artículos):", tueArts.join(", "));

  const tfueArts = [...articulosMencionados.TFUE.keys()].sort((a,b) => parseInt(a) - parseInt(b));
  console.log("\nTFUE (" + tfueArts.length + " artículos):", tfueArts.join(", "));

  const descArts = [...articulosMencionados.desconocido.keys()].sort((a,b) => parseInt(a) - parseInt(b));
  console.log("\nSin ley especificada (" + descArts.length + " artículos):", descArts.join(", "));

  // Artículos faltantes
  console.log("\n=== ARTÍCULOS FALTANTES EN BD ===");

  const faltantesTUE = tueArts.filter(a => !existentesTUE.has(a));
  console.log("\nTUE faltan:", faltantesTUE.join(", ") || "(ninguno)");

  const faltantesTFUE = tfueArts.filter(a => !existentesTFUE.has(a));
  console.log("TFUE faltan:", faltantesTFUE.join(", ") || "(ninguno)");
})();
