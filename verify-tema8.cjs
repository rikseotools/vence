const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const LEY_40_ID = "95680d57-feb1-41c0-bb27-236024815feb";
  const LEY_50_ID = "1ed89e01-ace0-4894-8bd4-fa00db74d34a";

  const { data: arts40 } = await supabase.from("articles").select("article_number").eq("law_id", LEY_40_ID);
  const { data: arts50 } = await supabase.from("articles").select("article_number").eq("law_id", LEY_50_ID);

  const set40 = new Set(arts40.map(a => a.article_number.toLowerCase()));
  const set50 = new Set(arts50.map(a => a.article_number.toLowerCase()));

  const folder = "/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_8,_La_Administración_General_del_Estado/";
  const files = fs.readdirSync(folder).filter(f => f.endsWith(".json"));

  const mencionados = new Set();
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(folder, file)));
    for (const q of data.questions) {
      const exp = q.explanation || "";
      const regex = /[Aa]rt[íi]culo\s+(\d+(?:\s*(?:bis|ter|quater|quinquies|sexies))?)/gi;
      let match;
      while ((match = regex.exec(exp)) !== null) {
        mencionados.add(match[1].trim().toLowerCase());
      }
    }
  }

  console.log("=== VERIFICACIÓN TEMA 8 ===");
  console.log("Artículos mencionados:", mencionados.size);

  const faltantes = [];
  for (const art of mencionados) {
    if (!set40.has(art) && !set50.has(art)) {
      faltantes.push(art);
    }
  }

  if (faltantes.length > 0) {
    console.log("\n❌ ARTÍCULOS FALTANTES:", faltantes.sort((a,b) => parseInt(a) - parseInt(b)).join(", "));
  } else {
    console.log("\n✅ Todos los artículos mencionados existen en la BD");
  }
})();
