const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();

async function main() {
  console.log('=== ANÁLISIS PROFUNDO DE ENDPOINTS ===\n');

  // 1. Exámenes con embedded=questions
  console.log('1. Exámenes con embedded=questions');
  let res = await fetch('https://admin.opositatest.com/api/v2.0/exams?opposition=10&embedded=questions&pageSize=1', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  let data = await res.json();
  console.log('Status:', res.status);

  if (data.resources && data.resources[0]) {
    const exam = data.resources[0];
    console.log('Exam:', exam.title);
    console.log('Keys:', Object.keys(exam).join(', '));
    if (exam.questions) {
      console.log('🚨 ¡PREGUNTAS ENCONTRADAS!');
      console.log('Total preguntas:', exam.questions.length);
      if (exam.questions[0]) {
        console.log('Primera pregunta:', JSON.stringify(exam.questions[0]).substring(0, 400));
      }
    } else {
      console.log('✓ Sin preguntas en la respuesta');
    }
  }

  // 2. Intentar obtener un examen específico con preguntas
  console.log('\n\n2. Examen específico ID=2 con embedded=questions');
  res = await fetch('https://admin.opositatest.com/api/v2.0/exams/2?embedded=questions', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', res.status);

  if (res.status === 200) {
    data = await res.json();
    console.log('Keys:', Object.keys(data).join(', '));
    if (data.questions) {
      console.log('🚨 ¡PREGUNTAS!');
      console.log('Total:', data.questions.length);
      console.log('Primera:', JSON.stringify(data.questions[0]).substring(0, 500));
    }
  }

  // 3. Probar endpoint de preguntas de examen oficial
  console.log('\n\n3. Preguntas de examen de convocatoria anterior');
  res = await fetch('https://api.opositatest.com/api/v2.0/exams/2/questions', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', res.status);
  if (res.status === 200) {
    const text = await res.text();
    console.log('🚨 RESPUESTA:', text.substring(0, 500));
  }

  // 4. Probar crear test random y ver si devuelve preguntas
  console.log('\n\n4. Intentar iniciar examen de convocatoria anterior');
  res = await fetch('https://api.opositatest.com/api/v2.0/exams/2/start', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  console.log('Status:', res.status);
  if (res.status === 200 || res.status === 201) {
    data = await res.json();
    console.log('🚨 EXAMEN INICIADO!');
    console.log('Response:', JSON.stringify(data).substring(0, 500));
  } else {
    const text = await res.text();
    console.log('Response:', text.substring(0, 200));
  }

  // 5. Probar con el subscriptions endpoint si hay bypass
  console.log('\n\n5. Verificar subscripciones disponibles');
  res = await fetch('https://subscriptions.opositatest.com/api/v2.0/subscriptions', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  data = await res.json();
  console.log('Subscripciones activas:');
  if (data.resources) {
    data.resources.forEach(s => {
      console.log(`  - ${s.resourceType}: ${s.externalResourceId} (${s.state})`);
    });
  }
}

main().catch(console.error);
