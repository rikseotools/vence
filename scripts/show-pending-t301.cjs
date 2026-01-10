const fs = require('fs');
const path = require('path');

const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_Fuentes_del_derecho_administrativo';

const files = [
  'Fuentes_del_derecho_administrativo._Jerarquía_de_las_fuentes.json',
  'La_Ley.json'
];

// Preguntas que no se importaron (por texto parcial)
const pendingTexts = [
  'Dentro del estudio de las fuentes del Derecho Administrativo',
  'De acuerdo con lo previsto en el Código Civil, las normas ju',
  'En qué se diferencia un decreto-ley de un decreto legislati',
  'Qué materia no se encuentra reservada a Ley orgánica'
];

console.log('=== PREGUNTAS PENDIENTES DE VINCULAR ===\n');

files.forEach(file => {
  const content = fs.readFileSync(path.join(basePath, file), 'utf8');
  const data = JSON.parse(content);

  data.questions.forEach((q, i) => {
    const isPending = pendingTexts.some(t => q.question.includes(t));
    if (isPending) {
      console.log('=' .repeat(80));
      console.log('ARCHIVO:', file);
      console.log('PREGUNTA:', q.question);
      console.log('\nOPCIONES:');
      q.options.forEach(o => console.log('  ' + o.letter + ') ' + o.text));
      console.log('\nRESPUESTA:', q.correctAnswer);
      console.log('\nEXPLICACIÓN:', q.explanation);
      console.log('');
    }
  });
});
