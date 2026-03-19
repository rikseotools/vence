const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();

async function graphql(query, variables = {}) {
  const res = await fetch('https://aula.opositatest.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  return res.json();
}

async function main() {
  console.log('=== EXPLORACIÓN GRAPHQL ===\n');

  // 1. Introspección - obtener tipos disponibles
  console.log('1. Introspección del schema...');
  let data = await graphql(`{
    __schema {
      types {
        name
        kind
      }
    }
  }`);

  if (data.data?.__schema?.types) {
    const types = data.data.__schema.types
      .filter(t => !t.name.startsWith('__'))
      .map(t => t.name);
    console.log('Tipos encontrados:', types.length);

    // Buscar tipos relacionados con preguntas
    const questionTypes = types.filter(t =>
      t.toLowerCase().includes('question') ||
      t.toLowerCase().includes('exam') ||
      t.toLowerCase().includes('test') ||
      t.toLowerCase().includes('answer')
    );
    console.log('Tipos relacionados con preguntas:', questionTypes);
  } else {
    console.log('No se pudo obtener schema:', JSON.stringify(data).substring(0, 300));
  }

  // 2. Obtener queries disponibles
  console.log('\n2. Queries disponibles...');
  data = await graphql(`{
    __schema {
      queryType {
        fields {
          name
          description
        }
      }
    }
  }`);

  if (data.data?.__schema?.queryType?.fields) {
    const queries = data.data.__schema.queryType.fields;
    console.log('Queries:', queries.map(q => q.name).join(', '));

    // Buscar queries de preguntas
    const questionQueries = queries.filter(q =>
      q.name.toLowerCase().includes('question') ||
      q.name.toLowerCase().includes('exam') ||
      q.name.toLowerCase().includes('test')
    );
    if (questionQueries.length > 0) {
      console.log('\n🎯 Queries potenciales:');
      questionQueries.forEach(q => console.log(`  - ${q.name}: ${q.description || 'Sin descripción'}`));
    }
  }

  // 3. Intentar query directa de preguntas
  console.log('\n3. Probando queries directas...');
  const tryQueries = [
    'questions(oppositionId: 10) { id text }',
    'questions(opposition: 10) { id text }',
    'examQuestions(oppositionId: 10) { id question }',
    'exam(id: 10) { questions { id text } }',
    'opposition(id: 10) { questions { id text } }',
  ];

  for (const q of tryQueries) {
    data = await graphql(`{ ${q} }`);
    console.log(`Query: ${q.substring(0, 40)}...`);
    if (data.errors) {
      console.log('  Error:', data.errors[0]?.message?.substring(0, 80));
    } else if (data.data) {
      console.log('  🚨 DATOS:', JSON.stringify(data.data).substring(0, 200));
    }
  }

  // 4. Mutations disponibles
  console.log('\n4. Mutations disponibles...');
  data = await graphql(`{
    __schema {
      mutationType {
        fields {
          name
        }
      }
    }
  }`);

  if (data.data?.__schema?.mutationType?.fields) {
    const mutations = data.data.__schema.mutationType.fields.map(m => m.name);
    console.log('Mutations:', mutations.join(', '));

    const examMutations = mutations.filter(m =>
      m.toLowerCase().includes('exam') ||
      m.toLowerCase().includes('test') ||
      m.toLowerCase().includes('question')
    );
    if (examMutations.length > 0) {
      console.log('🎯 Mutations de examen:', examMutations);
    }
  }
}

main().catch(console.error);
