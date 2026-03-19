const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();

async function main() {
  const examId = 52732041; // El test que creamos

  console.log('=== BUSCANDO PREGUNTAS DEL TEST CREADO ===');
  console.log('Exam ID:', examId);
  console.log('');

  // Probar MUCHOS endpoints diferentes
  const endpoints = [
    // Tests (no exams)
    `https://api.opositatest.com/api/v2.0/tests?examId=${examId}`,
    `https://api.opositatest.com/api/v2.0/tests/mine?examId=${examId}`,
    `https://api.opositatest.com/api/v2.0/user/tests/${examId}`,
    `https://api.opositatest.com/api/v2.0/my-tests/${examId}`,

    // Con UUID
    `https://api.opositatest.com/api/v2.0/tests?filters[examId]=${examId}`,

    // Exams con diferentes paths
    `https://api.opositatest.com/api/v2.0/exams/${examId}/continue`,
    `https://api.opositatest.com/api/v2.0/exams/${examId}/resume`,
    `https://api.opositatest.com/api/v2.0/exams/${examId}/details`,

    // Questions directas
    `https://api.opositatest.com/api/v2.0/exam-questions?examId=${examId}`,
    `https://api.opositatest.com/api/v2.0/questions?examId=${examId}`,
    `https://api.opositatest.com/api/v2.0/questions?filters[examId]=${examId}`,

    // Student tests
    `https://api.opositatest.com/api/v2.0/students/tests/${examId}`,
    `https://api.opositatest.com/api/v2.0/students/exams/${examId}`,

    // Saved tests
    `https://api.opositatest.com/api/v2.0/tests/saved/${examId}`,
    `https://api.opositatest.com/api/v2.0/saved-tests/${examId}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const shortUrl = url.split('.com')[1].substring(0, 60);
      process.stdout.write(`${res.status} - ${shortUrl}`);

      if (res.status === 200) {
        const text = await res.text();
        if (text.length > 50) {
          const hasQuestions = text.toLowerCase().includes('question') ||
                               text.toLowerCase().includes('pregunta') ||
                               text.toLowerCase().includes('"text"');
          if (hasQuestions) {
            console.log(' 🚨 PREGUNTAS!');
            console.log(text.substring(0, 600));
            console.log('...');
          } else {
            console.log(` (${text.length} bytes, sin preguntas)`);
          }
        } else {
          console.log(` (${text.length} bytes)`);
        }
      } else {
        console.log('');
      }
    } catch (e) {
      console.log(`ERROR - ${url.split('.com')[1].substring(0, 40)}`);
    }
  }

  // Probar crear otro test y ver la respuesta completa
  console.log('\n\n=== CREAR NUEVO TEST Y VER RESPUESTA ===');
  const res = await fetch('https://api.opositatest.com/api/v2.0/exams', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'random',
      oppositionId: 7,
      numberOfQuestions: 3,
      contents: ['be6c71de-58a8-4b62-a5c9-d94d95e3a8b6'] // Content de Auxilio
    })
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response completa:', JSON.stringify(data, null, 2));

  // Si tenemos ID, buscar en tests del usuario
  if (data.id) {
    console.log('\nBuscando en mis tests...');
    const testsRes = await fetch('https://api.opositatest.com/api/v2.0/tests/saved?pageSize=5', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const tests = await testsRes.json();
    console.log('Últimos tests:', JSON.stringify(tests, null, 2).substring(0, 1500));
  }
}

main().catch(console.error);
