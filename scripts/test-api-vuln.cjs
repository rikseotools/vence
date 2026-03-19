const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();

async function test() {
  // Ver tipos de examen
  console.log('=== Tipos de examen para oposición 10 ===');
  let res = await fetch('https://api.opositatest.com/api/v2.0/exam-types?filters[opposition]=10', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', res.status);
  if (res.status === 200) {
    const data = await res.json();
    console.log('Tipos:', JSON.stringify(data, null, 2).substring(0, 500));
  }

  // Probar con diferentes tipos de test
  console.log('\n=== Probando diferentes formatos de creación ===');

  const types = ['random', 'personalizado', 'RANDOM', 'PERSONALIZADO', 'test', 'quick'];

  for (const type of types) {
    res = await fetch('https://api.opositatest.com/api/v2.0/exams', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: type,
        opposition: 10,
        numQuestions: 5
      })
    });

    const responseText = await res.text();
    console.log(`type="${type}": ${res.status} - ${responseText.substring(0, 100)}`);

    if (res.status === 200 || res.status === 201) {
      console.log('\n🚨 ¡TEST CREADO CON TIPO:', type);
      break;
    }
  }

  // Probar acceso directo a preguntas de un examen existente
  console.log('\n=== Probando acceso a preguntas de examen ID=39 ===');
  res = await fetch('https://admin.opositatest.com/api/v2.0/exams/39/questions', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', res.status);
  if (res.status === 200) {
    const data = await res.json();
    console.log('🚨 PREGUNTAS ACCESIBLES!');
    if (data.items || data.resources) {
      const questions = data.items || data.resources;
      console.log('Total:', questions.length);
      if (questions[0]) {
        console.log('Primera pregunta:', JSON.stringify(questions[0]).substring(0, 300));
      }
    }
  } else {
    const text = await res.text();
    console.log('Response:', text.substring(0, 200));
  }
}

test().catch(console.error);
