const fs = require("fs");
const path = require("path");

const folder = "/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_El_personal_al_servicio_de_las_Administraciones_públicas/";
const file = path.join(folder, "Registro_Central_de_Personal.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const missing = ["2", "4", "7", "8", "9", "16", "37"];
const found = {};

for (const q of data.questions) {
  const exp = q.explanation || "";

  // Buscar en explicaciones que citen RD 2073/1999
  if (!exp.includes("2073/1999")) continue;

  for (const artNum of missing) {
    // Buscar artículo específico
    const pattern = new RegExp(`Art[íi]culo\\s+${artNum}(?!\\d)[\\s\\S]*?(?=Art[íi]culo\\s+\\d|$)`, "i");
    const match = exp.match(pattern);
    if (match && !found[artNum]) {
      found[artNum] = {
        number: artNum,
        content: match[0].trim().substring(0, 1500)
      };
    }
  }
}

// También buscar en RD 1405/1986
console.log("=== ARTÍCULOS RD 2073/1999 ENCONTRADOS EN EXPLICACIONES ===\n");
for (const [num, data] of Object.entries(found).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log(`--- Artículo ${num} ---`);
  console.log(data.content);
  console.log("\n");
}

console.log("=== NO ENCONTRADOS ===");
const notFound = missing.filter(n => !found[n]);
console.log(notFound.join(", ") || "Todos encontrados");

// Buscar artículos del RD 1405/1986
console.log("\n\n=== ARTÍCULOS RD 1405/1986 EN EXPLICACIONES ===\n");
const found1405 = {};
for (const q of data.questions) {
  const exp = q.explanation || "";
  if (!exp.includes("1405/1986")) continue;

  for (const artNum of ["3", "15", "16"]) {
    const pattern = new RegExp(`Art[íi]culo?\\s+${artNum}(?!\\d)[\\s\\S]*?(?=Art[íi]culo\\s+\\d|Téngase|$)`, "i");
    const match = exp.match(pattern);
    if (match && !found1405[artNum]) {
      found1405[artNum] = match[0].trim().substring(0, 1200);
    }
  }
}

for (const [num, content] of Object.entries(found1405).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log(`--- Art. ${num} ---`);
  console.log(content);
  console.log("\n");
}
