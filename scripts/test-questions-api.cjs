const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();

async function tryEndpoint(url, description) {
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const text = await res.text();

    console.log(`\n${description}`);
    console.log(`URL: ${url}`);
    console.log(`Status: ${res.status}`);

    if (res.status === 200 && text.length > 10) {
      try {
        const data = JSON.parse(text);

        // Buscar preguntas en la respuesta
        const hasQuestions = text.includes('question') || text.includes('pregunta') ||
                            text.includes('answer') || text.includes('respuesta') ||
                            text.includes('option');

        if (hasQuestions) {
          console.log('🚨 ¡POSIBLES PREGUNTAS ENCONTRADAS!');
          console.log('Preview:', text.substring(0, 500));
          return true;
        } else {
          console.log('✓ Respuesta OK pero sin preguntas visibles');
          console.log('Keys:', Object.keys(data).join(', '));
        }
      } catch (e) {
        console.log('Response (no JSON):', text.substring(0, 200));
      }
    } else if (res.status === 404) {
      console.log('✗ No existe');
    } else if (res.status === 403) {
      console.log('✓ Bloqueado (403)');
    } else {
      console.log('Response:', text.substring(0, 150));
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  return false;
}

async function main() {
  console.log('=== BÚSQUEDA DE ENDPOINTS DE PREGUNTAS ===');
  console.log('Oposición objetivo: Auxilio Judicial (ID=10)');
  console.log('Suscripción activa: Tramitación Procesal (ID=7)');

  const oppositionId = 10;

  // APIs versión 2.0
  const endpoints = [
    // Preguntas directas
    [`https://api.opositatest.com/api/v2.0/questions?opposition=${oppositionId}`, 'API v2.0 - Questions'],
    [`https://api.opositatest.com/api/v2.0/questions?filters[opposition]=${oppositionId}`, 'API v2.0 - Questions con filtro'],
    [`https://admin.opositatest.com/api/v2.0/questions?opposition=${oppositionId}`, 'Admin v2.0 - Questions'],
    [`https://admin.opositatest.com/api/v2.0/questions?filters[opposition]=${oppositionId}`, 'Admin v2.0 - Questions filtro'],

    // APIs versión 1.0 (potencialmente sin verificación)
    [`https://api.opositatest.com/api/v1.0/questions?opposition=${oppositionId}`, 'API v1.0 - Questions'],
    [`https://admin.opositatest.com/api/v1.0/questions?opposition=${oppositionId}`, 'Admin v1.0 - Questions'],
    [`https://api.opositatest.com/api/v1/questions?opposition=${oppositionId}`, 'API v1 - Questions'],

    // Sin versión
    [`https://api.opositatest.com/api/questions?opposition=${oppositionId}`, 'API sin versión'],
    [`https://admin.opositatest.com/api/questions?opposition=${oppositionId}`, 'Admin sin versión'],

    // Contenido con preguntas
    [`https://admin.opositatest.com/api/v2.0/oppositions/${oppositionId}/questions`, 'Oppositions/questions'],
    [`https://admin.opositatest.com/api/v2.0/contents/be6c71de-58a8-4b62-a5c9-d94d95e3a8b6/questions`, 'Content/questions (Tema 1)'],

    // Exámenes con preguntas
    [`https://api.opositatest.com/api/v2.0/exams/random?opposition=${oppositionId}`, 'Exams random'],
    [`https://admin.opositatest.com/api/v2.0/exams?opposition=${oppositionId}&embedded=questions`, 'Exams embedded questions'],

    // Tests guardados
    [`https://api.opositatest.com/api/v2.0/tests?opposition=${oppositionId}`, 'Tests'],

    // Respuestas (podrían tener preguntas)
    [`https://api.opositatest.com/api/v2.0/responses?opposition=${oppositionId}`, 'Responses'],
  ];

  let found = false;
  for (const [url, desc] of endpoints) {
    const hasQuestions = await tryEndpoint(url, desc);
    if (hasQuestions) found = true;
    await new Promise(r => setTimeout(r, 500)); // Rate limiting
  }

  if (!found) {
    console.log('\n\n✅ No se encontraron endpoints que expongan preguntas sin suscripción');
  } else {
    console.log('\n\n🚨 SE ENCONTRARON ENDPOINTS VULNERABLES');
  }
}

main().catch(console.error);
