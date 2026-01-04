const fs = require("fs");
const path = require("path");

const folder = "/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_11,_La_organización_de_la_Unión_Europea/";
const files = fs.readdirSync(folder).filter(f => f.endsWith(".json"));

let count = 0;
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(folder, file)));
  for (const q of data.questions) {
    const exp = q.explanation || "";

    // Buscar artículos mencionados
    const artMatch = exp.match(/[Aa]rt[íi]culo\s+(\d+)/);
    if (artMatch) {
      // Verificar si tiene contexto de ley
      const tieneTUE = /TUE|Tratado\s+de\s+la\s+Uni[oó]n\s+Europea/i.test(exp);
      const tieneTFUE = /TFUE|Tratado\s+de\s+Funcionamiento/i.test(exp);

      if (!tieneTUE && !tieneTFUE) {
        count++;
        if (count <= 5) {  // Mostrar solo las primeras 5
          console.log("=== PREGUNTA " + count + " ===");
          console.log("Archivo:", file);
          console.log("Pregunta:", q.question.substring(0, 150) + "...");
          console.log("Artículo mencionado:", artMatch[1]);
          console.log("Explicación:", exp.substring(0, 300) + "...");
          console.log("");
        }
      }
    }
  }
}

console.log("Total preguntas sin ley especificada:", count);
