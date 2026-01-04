const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join("/home/manuel/Documentos/github/vence", ".env.local"), "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const folder = "/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_El_personal_al_servicio_de_las_Administraciones_públicas/";

(async () => {
  // Leer todas las preguntas y extraer leyes mencionadas
  const files = fs.readdirSync(folder).filter(f => f.endsWith(".json"));

  const lawMentions = {};
  const articlesByLaw = {};

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(folder, file)));
    for (const q of data.questions) {
      const exp = q.explanation || "";

      // Detectar leyes mencionadas
      const patterns = [
        { name: "TREBEP/EBEP", pattern: /TREBEP|EBEP|Estatuto\s+B[aá]sico\s+del\s+Empleado\s+P[uú]blico|Real\s+Decreto\s+Legislativo\s+5\/2015/gi },
        { name: "RD 208/1996", pattern: /RD\s+208\/1996|Real\s+Decreto\s+208\/1996|Registro\s+Central\s+de\s+Personal/gi },
        { name: "RD 951/2005", pattern: /RD\s+951\/2005|Real\s+Decreto\s+951\/2005/gi },
        { name: "RD 364/1995", pattern: /RD\s+364\/1995|Real\s+Decreto\s+364\/1995|Reglamento\s+General\s+de\s+Ingreso/gi },
        { name: "RD 365/1995", pattern: /RD\s+365\/1995|Real\s+Decreto\s+365\/1995|Situaciones\s+administrativas/gi },
        { name: "RD 366/2007", pattern: /RD\s+366\/2007|Real\s+Decreto\s+366\/2007/gi },
        { name: "Ley 30/1984", pattern: /Ley\s+30\/1984/gi },
        { name: "CE", pattern: /Constituci[oó]n\s+Espa[nñ]ola/gi },
      ];

      for (const p of patterns) {
        if (p.pattern.test(exp)) {
          if (!lawMentions[p.name]) lawMentions[p.name] = 0;
          lawMentions[p.name]++;

          // Extraer artículos mencionados
          const artPattern = /[Aa]rt[íi]culo\s+(\d+(?:\.\d+)?)/g;
          let match;
          while ((match = artPattern.exec(exp)) !== null) {
            if (!articlesByLaw[p.name]) articlesByLaw[p.name] = new Set();
            articlesByLaw[p.name].add(match[1].split('.')[0]);
          }
        }
      }
    }
  }

  console.log("=== LEYES MENCIONADAS EN PREGUNTAS ===\n");
  for (const [law, count] of Object.entries(lawMentions).sort((a,b) => b[1] - a[1])) {
    const arts = articlesByLaw[law] ? [...articlesByLaw[law]].sort((a,b) => parseInt(a) - parseInt(b)).join(", ") : "(ninguno)";
    console.log(`${law}: ${count} menciones`);
    console.log(`  Artículos: ${arts}\n`);
  }

  // Buscar las leyes en la BD
  console.log("\n=== LEYES EN BASE DE DATOS ===\n");

  const lawNames = ["TREBEP", "EBEP", "208/1996", "951/2005", "364/1995", "365/1995", "366/2007", "30/1984"];

  for (const name of lawNames) {
    const { data: laws } = await supabase.from("laws")
      .select("id, short_name, name")
      .or(`short_name.ilike.%${name}%,name.ilike.%${name}%`);

    if (laws && laws.length > 0) {
      for (const law of laws) {
        console.log(`✅ ${law.short_name}: ${law.name.substring(0, 60)}...`);

        // Contar artículos
        const { count } = await supabase.from("articles")
          .select("id", { count: "exact", head: true })
          .eq("law_id", law.id);
        console.log(`   Artículos en BD: ${count || 0}\n`);
      }
    } else {
      console.log(`❌ ${name}: No encontrada en BD\n`);
    }
  }
})();
