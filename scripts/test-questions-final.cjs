const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();

async function main() {
  console.log('=== BÚSQUEDA FINAL DE PREGUNTAS ===\n');

  // Obtener un ID de contenido de Auxilio Judicial
  console.log('1. Obteniendo IDs de contenido de Auxilio Judicial...');
  let res = await fetch('https://admin.opositatest.com/api/v2.0/oppositions/10/contents', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const contents = await res.json();
  const contentIds = contents.resources?.slice(0, 3).map(c => ({ id: c.id, name: c.name })) || [];
  console.log('Contenidos:', contentIds);

  // Probar obtener preguntas de un contenido específico
  if (contentIds[0]) {
    console.log('\n2. Probando endpoints con ID de contenido...');
    const contentId = contentIds[0].id;

    const endpoints = [
      `https://api.opositatest.com/api/v2.0/questions?content=${contentId}`,
      `https://api.opositatest.com/api/v2.0/questions?filters[content]=${contentId}`,
      `https://admin.opositatest.com/api/v2.0/contents/${contentId}?embedded=questions`,
      `https://api.opositatest.com/api/v2.0/contents/${contentId}/questions`,
      `https://api.opositatest.com/api/v2.0/exam-questions?content=${contentId}`,
    ];

    for (const url of endpoints) {
      res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
      console.log(`${res.status} - ${url.split('.com')[1].substring(0, 70)}`);
      if (res.status === 200) {
        const text = await res.text();
        if (text.includes('question') || text.includes('pregunta')) {
          console.log('   🚨 POSIBLE MATCH:', text.substring(0, 200));
        }
      }
    }
  }

  // 3. Probar generar test con los contenidos
  console.log('\n3. Intentando crear test con contenidos de Auxilio...');
  if (contentIds[0]) {
    res = await fetch('https://api.opositatest.com/api/v2.0/exams', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'random',
        oppositionId: 10,
        contents: [contentIds[0].id],
        questionsCount: 5
      })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 300));
  }

  // 4. Buscar en GraphQL si existe
  console.log('\n4. Probando GraphQL...');
  const graphqlEndpoints = [
    'https://api.opositatest.com/graphql',
    'https://admin.opositatest.com/graphql',
    'https://aula.opositatest.com/graphql',
  ];

  for (const url of graphqlEndpoints) {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: '{ __schema { types { name } } }'
        })
      });
      console.log(`${res.status} - ${url}`);
      if (res.status === 200) {
        const data = await res.json();
        if (data.data) {
          console.log('   🚨 GraphQL encontrado!');
        }
      }
    } catch (e) {}
  }

  // 5. Probar www.opositatest.com antiguo
  console.log('\n5. Probando dominio www (posible API antigua)...');
  const oldEndpoints = [
    'https://www.opositatest.com/api/questions?opposition=10',
    'https://www.opositatest.com/api/v1/questions?opposition=10',
    'https://www.opositatest.com/preguntas/10',
  ];

  for (const url of oldEndpoints) {
    try {
      res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
      console.log(`${res.status} - ${url.split('.com')[1]}`);
    } catch (e) {
      console.log(`Error - ${url.split('.com')[1]}`);
    }
  }

  console.log('\n=== FIN DEL ANÁLISIS ===');
}

main().catch(console.error);
