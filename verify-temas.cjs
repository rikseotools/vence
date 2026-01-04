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
  {
    name: "Tema 8 - AGE",
    folder: "Tema_8,_La_Administración_General_del_Estado",
    lawIds: ["95680d57-feb1-41c0-bb27-236024815feb", "1ed89e01-ace0-4894-8bd4-fa00db74d34a"]
  },
  {
    name: "Tema 9 - Org Territorial",
    folder: "Tema_9,_La_Organización_territorial_del_Estado",
    lawIds: ["6ad91a6c-41ec-431f-9c80-5f5566834941"]
  },
  {
    name: "Tema 10 - Adm Local",
    folder: "Tema_10,_La_Administración_Local",
    lawIds: ["06784434-f549-4ea2-894f-e2e400881545", "6ad91a6c-41ec-431f-9c80-5f5566834941", "d69ff916-62c3-4a31-85f0-394a88cc8adf"]
  },
  {
    name: "Tema 11 - UE",
    folder: "Tema_11,_La_organización_de_la_Unión_Europea",
    lawIds: ["ddc2ffa9-d99b-4abc-b149-ab47916ab9da", "eba370d3-73d9-44a9-9865-48d2effabaf4"]
  },
  {
    name: "Bloque II T1 - Atención",
    folder: "Tema_1,_Atención_al_público",
    lawIds: ["72f03ccb-9a56-4bfc-ac17-6f98f54a8e5a", "ec5d4dea-90f7-48ad-a5f0-2b3a2e320fc7", "08c9fba7-8a6d-4ab9-ad8e-01d794cba2d9"]
  }
];

(async () => {
  for (const tema of temas) {
    const folderPath = "/home/manuel/Documentos/github/vence/preguntas-para-subir/" + tema.folder;
    if (!fs.existsSync(folderPath)) {
      console.log("⚠️ " + tema.name + " - Carpeta no encontrada");
      continue;
    }

    // Obtener artículos de todas las leyes del tema
    const allArticles = new Set();
    for (const lawId of tema.lawIds) {
      const { data: arts } = await supabase.from("articles").select("article_number").eq("law_id", lawId);
      if (arts) {
        arts.forEach(a => allArticles.add(a.article_number.toLowerCase()));
      }
    }

    // Leer preguntas y extraer artículos mencionados
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
    const mencionados = new Set();

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(folderPath, file)));
      for (const q of data.questions) {
        const exp = q.explanation || "";
        const regex = /[Aa]rt[íi]culo\s+(\d+(?:\s*(?:bis|ter|quater|quinquies|sexies))?)/gi;
        let match;
        while ((match = regex.exec(exp)) !== null) {
          mencionados.add(match[1].trim().toLowerCase());
        }
      }
    }

    // Encontrar faltantes
    const faltantes = [];
    for (const art of mencionados) {
      if (!allArticles.has(art)) {
        faltantes.push(art);
      }
    }

    if (faltantes.length > 0) {
      console.log("❌ " + tema.name);
      console.log("   Artículos faltantes: " + faltantes.sort((a,b) => parseInt(a) - parseInt(b)).join(", "));
    } else {
      console.log("✅ " + tema.name + " - OK (" + mencionados.size + " artículos verificados)");
    }
  }
})();
