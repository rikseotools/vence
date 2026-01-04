const fs = require("fs");
const path = require("path");
const folder = "/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_El_personal_al_servicio_de_las_Administraciones_públicas/";
const files = fs.readdirSync(folder).filter(f => f.endsWith(".json"));

const missing = {
  "RD 208/1996": ["11", "12", "13", "14", "15", "16", "33", "37"],
  "RD 365/1995": ["3", "10"],
  "Ley 30/1984": ["1", "2", "11", "13", "20", "21"]
};

const lawPatterns = {
  "RD 208/1996": /RD\s+208\/1996|Real\s+Decreto\s+208\/1996|Registro\s+Central\s+de\s+Personal/gi,
  "RD 365/1995": /RD\s+365\/1995|Real\s+Decreto\s+365\/1995/gi,
  "Ley 30/1984": /Ley\s+30\/1984/gi
};

const found = {};

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(folder, file)));
  for (const q of data.questions) {
    const exp = q.explanation || "";

    for (const [lawName, artNumbers] of Object.entries(missing)) {
      const lawPat = lawPatterns[lawName];
      if (!lawPat.test(exp)) continue;
      lawPat.lastIndex = 0;

      for (const artNum of artNumbers) {
        const artPat = new RegExp(`[Aa]rt[íi]culo\\s+${artNum}(?![0-9])`, "i");
        if (artPat.test(exp)) {
          const key = `${lawName}_${artNum}`;
          if (!found[key]) {
            found[key] = {
              law: lawName,
              article: artNum,
              question: q.question.substring(0, 100),
              explanation: exp
            };
          }
        }
      }
    }
  }
}

console.log("=== ARTÍCULOS ENCONTRADOS EN EXPLICACIONES ===\n");
for (const [key, data] of Object.entries(found).sort()) {
  console.log(`\n--- ${data.law} - Artículo ${data.article} ---`);
  console.log(`Pregunta: ${data.question}...`);
  console.log(`Explicación:\n${data.explanation.substring(0, 800)}`);
  if (data.explanation.length > 800) console.log("...[truncado]");
}

console.log("\n\n=== ARTÍCULOS NO ENCONTRADOS ===");
for (const [lawName, artNumbers] of Object.entries(missing)) {
  const notFound = artNumbers.filter(a => !found[`${lawName}_${a}`]);
  if (notFound.length > 0) {
    console.log(`${lawName}: ${notFound.join(", ")}`);
  }
}
