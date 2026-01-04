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

const temas = [
  { name: "Tema 8 - AGE", folder: "Tema_8,_La_Administración_General_del_Estado", leyes: ["Ley 40/2015", "Ley 50/1997"] },
  { name: "Tema 9 - Org Territorial", folder: "Tema_9,_La_Organización_territorial_del_Estado", leyes: ["CE"] },
  { name: "Tema 10 - Adm Local", folder: "Tema_10,_La_Administración_Local", leyes: ["Ley 7/1985"] },
  { name: "Tema 11 - UE", folder: "Tema_11,_La_organización_de_la_Unión_Europea", leyes: ["TUE", "TFUE"] },
  { name: "Bloque II T1 - Atención", folder: "Tema_1,_Atención_al_público", leyes: ["RD 208/1996", "RD 951/2005", "RD 366/2007"] },
];

(async () => {
  const { data: allLaws } = await supabase.from("laws").select("id, short_name");
  const lawMap = {};
  for (const law of allLaws) {
    const { data: arts } = await supabase.from("articles").select("article_number").eq("law_id", law.id);
    lawMap[law.short_name] = new Set(arts.map(a => a.article_number));
  }

  console.log("=== ARTÍCULOS FALTANTES POR TEMA ===\n");

  for (const tema of temas) {
    const folderPath = "/home/manuel/Documentos/github/vence/preguntas-para-subir/" + tema.folder;
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
    const articulosMencionados = {};

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(folderPath, file)));

      for (const q of data.questions) {
        const exp = q.explanation || "";
        const regex = /art[íi]culo\s+(\d+(?:\s*(?:bis|ter|quater|quinquies|sexies))?)/gi;
        let match;
        while ((match = regex.exec(exp)) !== null) {
          const artNum = match[1].trim();
          for (const ley of tema.leyes) {
            if (!articulosMencionados[ley]) articulosMencionados[ley] = new Set();
            articulosMencionados[ley].add(artNum);
          }
        }
      }
    }

    let hayFaltantes = false;
    for (const ley of tema.leyes) {
      if (!articulosMencionados[ley]) continue;
      const existentes = lawMap[ley] || new Set();
      const faltantes = [...articulosMencionados[ley]].filter(a => !existentes.has(a));

      if (faltantes.length > 0) {
        if (!hayFaltantes) {
          console.log("📁 " + tema.name);
          hayFaltantes = true;
        }
        console.log("   " + ley + " - Faltan:", faltantes.sort((a,b) => parseInt(a) - parseInt(b)).join(", "));
      }
    }

    if (!hayFaltantes) {
      console.log("✅ " + tema.name + " - Todo OK");
    }
    console.log("");
  }
})();
