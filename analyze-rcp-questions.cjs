const fs = require("fs");
const path = require("path");

const folder = "/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_El_personal_al_servicio_de_las_Administraciones_públicas/";
const file = path.join(folder, "Registro_Central_de_Personal.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

console.log("=== ANÁLISIS DE PREGUNTAS DEL RCP ===\n");
console.log("Total preguntas:", data.questions.length);

let citaRD2073EnPregunta = 0;
let citaRD2073SoloExplicacion = 0;
let citaRD1405EnPregunta = 0;
let otrasCitas = 0;

const preguntasConRD2073 = [];
const preguntasConRD1405 = [];
const preguntasSinCitaEspecifica = [];

for (let i = 0; i < data.questions.length; i++) {
  const q = data.questions[i];
  const pregunta = q.question || "";
  const exp = q.explanation || "";

  const tieneRD2073EnPregunta = pregunta.includes("2073/1999");
  const tieneRD2073EnExp = exp.includes("2073/1999");
  const tieneRD1405EnPregunta = pregunta.includes("1405/1986");
  const tieneRD1405EnExp = exp.includes("1405/1986");

  if (tieneRD2073EnPregunta) {
    citaRD2073EnPregunta++;
    preguntasConRD2073.push({ idx: i, pregunta: pregunta.substring(0, 150) + "..." });
  } else if (tieneRD1405EnPregunta) {
    citaRD1405EnPregunta++;
    preguntasConRD1405.push({ idx: i, pregunta: pregunta.substring(0, 150) + "..." });
  } else if (tieneRD2073EnExp || tieneRD1405EnExp) {
    citaRD2073SoloExplicacion++;
    preguntasSinCitaEspecifica.push({
      idx: i,
      pregunta: pregunta.substring(0, 120) + "...",
      citaExp: tieneRD2073EnExp ? "2073/1999" : "1405/1986"
    });
  } else {
    otrasCitas++;
  }
}

console.log("\nPreguntas que CITAN RD 2073/1999 en el enunciado:", citaRD2073EnPregunta);
console.log("Preguntas que CITAN RD 1405/1986 en el enunciado:", citaRD1405EnPregunta);
console.log("Preguntas que solo citan en explicación:", citaRD2073SoloExplicacion);
console.log("Preguntas sin cita específica:", otrasCitas);

console.log("\n=== PREGUNTAS QUE CITAN RD 2073/1999 EN ENUNCIADO (MANTENER) ===\n");
preguntasConRD2073.forEach((p, i) => {
  console.log(`${i+1}. [${p.idx}] ${p.pregunta}`);
});

console.log("\n=== PREGUNTAS QUE CITAN RD 1405/1986 EN ENUNCIADO (MANTENER) ===\n");
preguntasConRD1405.forEach((p, i) => {
  console.log(`${i+1}. [${p.idx}] ${p.pregunta}`);
});

console.log("\n=== PREGUNTAS SIN CITA EN ENUNCIADO (ACTUALIZAR A CONSOLIDADO) ===\n");
preguntasSinCitaEspecifica.forEach((p, i) => {
  console.log(`${i+1}. [${p.idx}] (exp: ${p.citaExp}) ${p.pregunta}`);
});
