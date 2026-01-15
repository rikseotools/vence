/**
 * Script para parsear exámenes de texto a JSON
 *
 * Uso: node scripts/oposiciones/parsear-examen-txt.cjs <archivo.txt> <salida.json>
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile) {
  console.log('Uso: node scripts/oposiciones/parsear-examen-txt.cjs <archivo.txt> [salida.json]');
  process.exit(1);
}

const text = fs.readFileSync(inputFile, 'utf8');
const lines = text.split('\n');

const preguntas = [];
let currentPregunta = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Detectar inicio de pregunta (número seguido de punto y guión)
  const preguntaMatch = line.match(/^(\d+)\s*[\.\-]+\s*(.+)/);

  if (preguntaMatch) {
    // Guardar pregunta anterior
    if (currentPregunta && currentPregunta.texto) {
      preguntas.push(currentPregunta);
    }

    // Nueva pregunta
    currentPregunta = {
      numero: parseInt(preguntaMatch[1]),
      texto: preguntaMatch[2],
      opciones: {}
    };
    continue;
  }

  // Detectar opciones (a), b), c), d) o a., b., c., d.)
  const opcionMatch = line.match(/^([a-d])[\)\.\-]\s*(.+)/i);

  if (opcionMatch && currentPregunta) {
    const letra = opcionMatch[1].toUpperCase();
    currentPregunta.opciones[letra] = opcionMatch[2];
    continue;
  }

  // Continuar texto de pregunta u opción
  if (currentPregunta && line.length > 0) {
    // Si la última opción existe, añadir a ella
    const ultimaOpcion = ['D', 'C', 'B', 'A'].find(l => currentPregunta.opciones[l]);

    if (ultimaOpcion && !line.match(/^[a-d][\)\.\-]/i)) {
      currentPregunta.opciones[ultimaOpcion] += ' ' + line;
    } else if (!ultimaOpcion) {
      // Añadir al texto de la pregunta
      currentPregunta.texto += ' ' + line;
    }
  }
}

// Guardar última pregunta
if (currentPregunta && currentPregunta.texto) {
  preguntas.push(currentPregunta);
}

// Limpiar textos
for (const p of preguntas) {
  p.texto = p.texto.replace(/\s+/g, ' ').trim();
  for (const [k, v] of Object.entries(p.opciones)) {
    p.opciones[k] = v.replace(/\s+/g, ' ').trim();
  }
}

// Filtrar preguntas válidas (con al menos 2 opciones)
const preguntasValidas = preguntas.filter(p =>
  Object.keys(p.opciones).length >= 2 && p.texto.length > 10
);

console.log(`Total líneas: ${lines.length}`);
console.log(`Preguntas encontradas: ${preguntas.length}`);
console.log(`Preguntas válidas: ${preguntasValidas.length}`);

// Guardar JSON
const output = {
  archivo: path.basename(inputFile),
  total_preguntas: preguntasValidas.length,
  preguntas: preguntasValidas
};

const outPath = outputFile || inputFile.replace('.txt', '.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nGuardado en: ${outPath}`);

// Mostrar muestra
console.log('\n=== MUESTRA (primeras 3 preguntas) ===\n');
for (const p of preguntasValidas.slice(0, 3)) {
  console.log(`P${p.numero}: ${p.texto.substring(0, 80)}...`);
  for (const [k, v] of Object.entries(p.opciones)) {
    console.log(`  ${k}) ${v.substring(0, 60)}...`);
  }
  console.log('');
}
