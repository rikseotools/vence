const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const falsePositives = [
  '540c9861-ec13-4b2b-afbc-6cc98279bfe9','0451c741-93e6-42f0-a97f-88db56d19b53',
  '5d06d312-eb61-4012-a9de-70d245afe3ea','5245a901-58b3-4294-99de-0bffce4e78fd',
  'f291278b-f8ae-41b4-8a71-b773263a5ab3','cad9b1b8-9206-4d33-afec-570c74f2501c',
  'f0b6e46f-702f-4333-9a6d-d14f9cbc1768','02540797-3e5e-442e-98c2-8a292fe0ae42',
  '39f5d358-e0a2-48b9-ad29-ea4cdf2fe97b','69a7a760-61a5-452b-9443-be544f31b267',
  'fdcb3730-1244-4acc-8929-7fceb4cd4bb5','bfbdb108-57cc-4098-9a84-bcb8dee84e1f',
  '8bcde519-67b7-4d97-b494-26647c6c289e','5e943b80-d1dd-4612-90d2-d73bec29073c',
  'cc9b0cd4-a0bc-4943-bf8b-41a9c12e2758','f07849e1-1c86-4f69-8aa3-e53a21b58445',
  'f51daa25-8a4e-42c1-b17b-eaaa86f04802','728f8fbe-060c-4700-bf32-26419ba47431',
  'f448d294-febc-4819-8637-3c396b2b6f86','38b10220-f1a4-4b52-8ce3-9c38a109ce74',
  '30e4e9a6-b3e8-420c-8fee-4242cc6b16f3','928d36d7-05c8-48d4-8281-ae2de13eedeb',
  'ef1480aa-f100-4f44-8bc8-35a8782d9c69','0ee5b462-f241-49f8-b05e-106284b21f80',
  '7e91bb51-6c7c-4954-b843-389b1507a08b','4b5da340-977e-4d0f-9a44-9d4285df2b67',
  'b611d73e-6896-46ba-b7c1-80f8712e0091','ae9e521b-7277-4011-a798-ace6caf6d4dc',
  '35a18cf4-1972-4993-a6fd-df011a0baa4a','3b33e583-88dc-42fd-b1d8-b4279dbf4915',
  '938f8fba-9ba5-4276-b699-343a7c886482','d9e45e7d-7173-4c3e-8981-0f64bd15b3de',
  'aa570ebf-d851-4a9f-bb65-904008298633','8876f13d-867c-44df-882d-ea00c5c4b284',
  '68f59676-d0c7-4699-8fd6-196972fa6970','1a9a47df-23a3-43ee-bace-4ad0bd5eebc0',
  '9d099b1e-2e0e-413b-8202-8db13bd86348','835c0d28-e8e5-45a5-8ccf-31de98c17217',
  '75bddee6-a92b-42b9-b3d0-342f675a76f9','58629cda-1ad4-4bdb-8894-2968c4471d00',
  '8d276aa9-798b-4d69-aa78-658622095ab9','c0a5a17c-f8f0-4e93-8b56-bf24ec8ea41f',
  '323f8dbf-492c-459a-a7c3-2ea770ac0493','04747ff4-05d5-4e81-9606-47666e2f7571',
  '6bf96f0b-ff92-4a95-8d47-d4a61508942b','784861a4-4083-4bf0-80f9-6d1491bf1b4d',
  '26827a9b-a0aa-46b8-a8cf-f77a70fa9d71','a8b1b251-e82a-46db-87f5-3cbf56e4629a',
];

const correctionIds = [
  '025d52be-f405-45d8-ae62-558d7850e044','aac80b17-b379-4615-8fd1-62b4e7b15a80',
  '061b90ad-ed9e-4ae9-bb43-1c4cfa312746','283b0d66-a1cf-433c-96a6-bd25f78e0039',
  '17a2f1fe-dadb-43bc-ac7a-62667c09da86','d2885c0c-410b-482d-8ae5-219efc10d3fb',
  'ce7e7aae-5606-488c-b12c-e0a584af2c68','8fdf9311-2ebf-47b7-a38d-12ba2a6cc4b7',
  '125fd7f1-1db8-42f4-a755-e87d77d42de3','fd06f09a-67da-4364-bf6f-f0dba11bb3ad',
  '5304ddb1-2adc-4944-ac2f-b2f89bb23b7b','d862f3d0-9e20-46fc-bf9b-281125a913dc',
  'fecef996-6544-4f16-aca4-4cc00e6cde1f','277f0fa9-aec4-4f25-9f36-b0ae4dd8736c',
  'd8a66ffc-74ca-4285-9b4a-d2c1075cfc01','fc2c3b33-8634-45ce-9626-d67e223d0be3',
  '48e8a1d6-153e-4447-8714-6588bca61021','223932e6-4bf2-47e8-9b59-169d7bd4c1c5',
  '1308fe45-8420-42f6-91af-c7402675a799','4e8773e5-f0a4-4491-a03d-1a79a72df3ab',
  '9ab7d2e6-ec72-4b21-bec1-d1d852a57745','2443fa13-822e-4589-a1b9-b5fe3ff3d319',
  '1af246ba-2c1a-4242-9f71-745cf2c63829','60c675f0-6c9d-4a7c-9731-56ddffe791ac',
  '7fcd58bf-d178-4439-a355-6fd63f119975','f989cdf1-5a50-4ae3-825b-97d060d98452',
  'd62682e3-61c5-4c6c-85d1-1a49c2103af3','89bd03b6-586f-4f49-84ad-a98ab6cec1d0',
  '3a7fe901-b66f-4867-83d2-92e5af7041f4','931354a4-8bdd-486b-b924-3c2427210411',
  '571f7fa9-cd81-425a-95fd-f9c623719db3','27aa4f69-8c00-417d-9d1c-807dba3eb5a8',
  'd98b1a14-6667-49e7-bfbd-2054af2a64b8','d0656264-5355-4f99-a32e-84a2782c0535',
  '97a32930-8126-4946-ae37-096bd8cbf788','7931d9a7-d29a-446b-9570-bbdb1ca67fd8',
  '54964d31-42dc-4ee1-90d0-0129c0a18478','0a3512b4-abf2-43f2-9c5d-34e0387089d7',
  '444b146d-01c3-4a02-8544-0faa39642b2d','c94cc358-7cda-48d6-89df-0edfd85c3bed',
  '59b2b849-1e27-48c9-9c9b-fb4dd8efb3bd','04181da8-b0f9-47a9-89ba-56f513993ddd',
  '98885e00-086b-4995-a0ce-263f5f14803f','e19bf192-015c-4e09-a99f-e2f7518da233',
  '5de987e7-7e71-4045-8ef2-95e5014dec43','970a92c3-b317-448c-b9dd-75a15ee853c5',
  '7fed454d-5f72-4026-9752-f48ec9dbdfad','403cc7c2-ced6-4b96-a5c0-a4e1278cfb96',
  'af130da5-4e3f-4067-bef3-5c9dbd916005','a6a886ec-9cd7-4822-b3f4-b733dcd8b462',
  '780974a2-08a9-4566-9a16-44af3f3426f7','7697e4d7-97b0-4bf1-92e4-af1ceec1e3a1',
  '214f5c52-bc29-4325-86ab-9c80f7309589','c55edc4d-5520-4e8f-9757-b0c967306d58',
  'e8c41a31-3949-408b-987d-1c30d4a5d2f5','139d52f4-c524-447c-8563-2151a1ba3f39',
  'f2887b76-eb93-4b7a-b063-a6db5c05820a','f22fa050-9e17-4abd-8cb4-3854f31fd576',
  'd3c86c9d-5781-4b43-b829-a8c13c57839b','0ed68922-001d-49e4-b30f-057ad118b3c8',
  'b493ce29-2c36-4611-afa0-de01b710f300','5ad5fe38-d416-4152-aed3-5fe050a94d66',
  'c32bbf90-b68e-4231-842f-d916f6c4d1ad','9a978574-494e-4b0d-8aad-0f41a2a2ae8d',
  '5f3cf341-edf7-40bf-8e13-d4ef8331de62','3fa4bc19-5dc3-46e4-86a4-d4c385ae5fcc',
  '034a16d1-a6cc-402b-9ec7-d37920752635','7dd2252e-f0ff-4b81-90ae-05ec1c7d380d',
  'b1c7301a-f519-4077-ad28-4c12157f74c6','60099a46-9409-4b5c-ab22-78f52e8b5af4',
  '2017734e-3838-4c49-ab58-53959d12a7b6','fc81fa60-6e0f-44bd-a26b-62975ef95b7b',
  '71d0ced1-b426-46dc-b353-e13178d964cf','80a7a71e-0244-4d67-8675-050c49f17b36',
  '4b3fa73a-b080-4b0a-a6db-c5dd0af35b8d','a3398a7d-1ef1-407e-8b59-db7cb2d5bc2a',
  '5777bb8d-5f8c-419a-a7dd-3ca0e027c04b','1b19a7e5-0da8-477c-91bc-dc91c255772c',
  '7a14dff0-e46b-4e76-b521-5ddf1c5afa24','4655f4a4-f12c-4c19-87df-f71af56a1126',
  'e128b452-d2e5-404b-88dd-990385a03963','9d11beca-8a40-42be-b20c-6dc7cb67ba19',
  '42968c3f-6da0-4a6a-895c-1a2b9f1e483b','ee2ea147-1731-48f1-8677-e740f76e1591',
  'e21178f6-85e0-43e3-bb5e-adbd3808ae52','a8300e74-9cff-46a2-a127-92308be8360e',
  'b3dade2e-eefc-441f-80c9-a8a7158e1931','73efcd1d-ab3a-47fc-a711-2a05ebcab72f',
  '3bfa85ca-b81d-42cf-8aa7-01a4cdbf1fba','89abb3f4-e9ed-4ca6-bac4-065052db2d68',
  '23ff5f8f-5ea3-4839-9950-c0036dbc0a99',
];

const errorStates = [
  'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
  'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
  'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
];

async function main() {
  console.log('=== DRY RUN - VERIFICACION PREVIA T10 ===');
  console.log('(No se modifica nada en la BD)\n');

  const allIds = [...falsePositives, ...correctionIds];
  console.log(`Total IDs: ${allIds.length} (${falsePositives.length} FP + ${correctionIds.length} correcciones)`);

  // Check for duplicates
  const uniqueIds = new Set(allIds);
  if (uniqueIds.size !== allIds.length) {
    console.log(`DUPLICADOS: ${allIds.length - uniqueIds.size}`);
  } else {
    console.log('No hay IDs duplicados');
  }

  // Fetch all questions
  let found = 0, notFound = 0, wrongStatus = 0, alreadyPerfect = 0;
  const issues = [];
  const statusDist = {};

  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const { data: questions, error } = await supabase
      .from('questions')
      .select('id, topic_review_status, is_active, primary_article_id')
      .in('id', batch);

    if (error) {
      console.log('Error en batch ' + i + ': ' + error.message);
      continue;
    }

    const qMap = {};
    questions.forEach(q => { qMap[q.id] = q; });

    for (const id of batch) {
      const q = qMap[id];
      if (!q) {
        notFound++;
        issues.push('NO ENCONTRADA: ' + id);
        continue;
      }
      found++;

      statusDist[q.topic_review_status] = (statusDist[q.topic_review_status] || 0) + 1;

      if (!q.is_active) {
        issues.push('INACTIVA: ' + id.substring(0,8));
      }

      if (q.topic_review_status === 'perfect') {
        alreadyPerfect++;
      } else if (!errorStates.includes(q.topic_review_status)) {
        wrongStatus++;
        issues.push('STATUS INESPERADO: ' + id.substring(0,8) + ' (' + q.topic_review_status + ')');
      }
    }
  }

  console.log('\n=== RESULTADOS ===');
  console.log('Encontradas: ' + found + '/' + allIds.length);
  console.log('No encontradas: ' + notFound);
  console.log('Ya perfect: ' + alreadyPerfect);
  console.log('Status inesperado: ' + wrongStatus);
  console.log('\nDistribucion de estados:');
  Object.entries(statusDist).sort((a,b) => b[1] - a[1]).forEach(([s, c]) => {
    console.log('  ' + s + ': ' + c);
  });

  if (issues.length > 0) {
    console.log('\n=== PROBLEMAS (' + issues.length + ') ===');
    issues.forEach(i => console.log('  ' + i));
  } else {
    console.log('\nTODAS LAS PREGUNTAS VERIFICADAS - LISTO PARA EJECUTAR');
  }

  // Verify article targets exist
  console.log('\n=== VERIFICACION DE ARTICULOS DESTINO ===');
  const articleChanges = [
    { qid: '283b0d66', artId: '9557e93a-c5a9-46fa-b3c5-b4087ba1b64b' },
    { qid: 'd2885c0c', artId: '7a191d99-1f6f-4a8b-835d-c8394f38bc70' },
    { qid: '8fdf9311', artId: '9557e93a-c5a9-46fa-b3c5-b4087ba1b64b' },
    { qid: '125fd7f1', artId: '9557e93a-c5a9-46fa-b3c5-b4087ba1b64b' },
    { qid: 'fecef996', artId: '21614da7-3d51-4f27-8ba9-90d55e4f13ce' },
    { qid: 'fc2c3b33', artId: '7a191d99-1f6f-4a8b-835d-c8394f38bc70' },
    { qid: '223932e6', artId: '8bbda2f7-de32-46b1-9ebd-559bad2b5f93' },
    { qid: '9ab7d2e6', artId: 'f7d75ae8-9622-4b9a-9feb-eec237356c9c' },
    { qid: '2443fa13', artId: '9336b4a1-66cf-4cd2-8a95-a75d0401d3ef' },
    { qid: '1af246ba', artId: '6db0ca95-84a4-4636-9a6f-c4e77173e3fd' },
    { qid: '931354a4', artId: '199737c7-c813-43b5-9cc5-d3af0fa96a18' },
    { qid: '571f7fa9', artId: '199737c7-c813-43b5-9cc5-d3af0fa96a18' },
    { qid: 'c94cc358', artId: '3e032b52-5b26-4125-8908-8168dded0104' },
    { qid: '59b2b849', artId: '199737c7-c813-43b5-9cc5-d3af0fa96a18' },
    { qid: '04181da8', artId: '199737c7-c813-43b5-9cc5-d3af0fa96a18' },
    { qid: '970a92c3', artId: '5191e8f7-0a35-4b85-a529-a9869916b1c9' },
    { qid: '7fed454d', artId: '199737c7-c813-43b5-9cc5-d3af0fa96a18' },
    { qid: '780974a2', artId: '370eaa17-b8f3-4524-96c4-c6cf16ec5d00' },
    { qid: 'e8c41a31', artId: '9336b4a1-66cf-4cd2-8a95-a75d0401d3ef' },
    { qid: '5ad5fe38', artId: '557c0730-fae1-4dd2-9269-f0c9df1fb5f4' },
    { qid: 'c32bbf90', artId: '2bfa1458-1a47-4a10-ac71-5bfb3e9371d1' },
    { qid: '3fa4bc19', artId: 'ed32e229-46aa-49c1-9b29-a69c6208fe3b' },
    { qid: '7dd2252e', artId: '9e5aa15b-8cf9-4be7-93b2-79c5e6ad3d6e' },
    { qid: 'b1c7301a', artId: '836a3320-5aa9-4fb0-858d-0ec0299cadf5' },
    { qid: '60099a46', artId: 'f912ff22-c245-47f4-9d72-51e9a2bb419a' },
    { qid: '2017734e', artId: '43b8026e-2faf-48aa-b348-1cd71ed1fe2c' },
    { qid: '4b3fa73a', artId: 'f912ff22-c245-47f4-9d72-51e9a2bb419a' },
    { qid: '5777bb8d', artId: '2bfa1458-1a47-4a10-ac71-5bfb3e9371d1' },
    { qid: '1b19a7e5', artId: '743487cc-e728-41cb-b2e4-d59a4b1b0105' },
    { qid: '4655f4a4', artId: '5aeda8ff-3b78-4594-8aac-f31e50eedd89' },
    { qid: 'e128b452', artId: '836a3320-5aa9-4fb0-858d-0ec0299cadf5' },
    { qid: '89abb3f4', artId: 'c158d47f-f3b6-4fee-a210-5e686e2ed9a8' },
  ];

  const artIds = [...new Set(articleChanges.map(a => a.artId))];
  let artOk = 0, artMissing = 0;
  for (let i = 0; i < artIds.length; i += 50) {
    const batch = artIds.slice(i, i + 50);
    const { data: arts } = await supabase
      .from('articles')
      .select('id, article_number, law_id, laws(short_name)')
      .in('id', batch);

    const artMap = {};
    arts.forEach(a => { artMap[a.id] = a; });

    for (const artId of batch) {
      const art = artMap[artId];
      if (art) {
        artOk++;
        console.log('  OK: ' + artId.substring(0,8) + ' -> Art.' + art.article_number + ' ' + (art.laws?.short_name || '?'));
      } else {
        artMissing++;
        console.log('  FALTA: ' + artId);
      }
    }
  }
  console.log('Articulos destino: ' + artOk + ' OK, ' + artMissing + ' no encontrados');
}

main().catch(console.error);
