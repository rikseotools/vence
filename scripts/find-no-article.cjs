const fs = require('fs');
const path = require('path');

const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_Protección_de_datos_personales';
const FILES = [
  'La_protección_de_datos_personales._Régimen_Jurídico.json',
  'Principios.json',
  'Derechos.json',
  'Responsable_del_tratamiento,_encargado_del_tratamiento_y_delegado_de_protección_de_datos.json',
  'Autoridades_de_protección_de_datos.json',
  'Garantía_de_los_derechos_digitales.json',
  'Breve_referencia_al_régimen_sancionador.json'
];

let count = 0;
for (const fileName of FILES) {
  const filePath = path.join(BASE_PATH, fileName);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const q of data.questions) {
    const exp = q.explanation || '';

    // Sin número de artículo
    const hasArticle = /Artículo\s+\d+/i.test(exp);
    if (!hasArticle) {
      count++;
      console.log('\n=== Pregunta #' + count + ' ===');
      console.log('Q:', q.question.substring(0, 100));
      console.log('Respuesta:', q.correctAnswer);
      console.log('Explicación:', exp.substring(0, 300));
    }
  }
}
console.log('\n\nTotal sin artículo:', count);
