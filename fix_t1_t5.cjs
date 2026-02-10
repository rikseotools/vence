const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // T1 - Constitución Española - 58 falsos positivos (excluyendo 3 errores reales)
  const t1FP = [
    '5b0fbeff-75f0-4c63-8bb1-ba54c157a449',
    'b4d6ddf6-0320-4597-93d0-b5cb364661b5',
    '96e24da8-ab7b-44dc-9ba6-b2de28fa2c06',
    '57fe32ee-0f0a-4210-9ca8-828d6876217a',
    'fc70eb42-bfed-4250-9668-3fd6e8729163',
    'd6482ad1-c931-46d4-901c-64e0d38bb246',
    '15707043-3a11-4b35-8d5b-1af1b986ab03',
    '8a845f9c-446e-4094-9c73-27c14f170f99',
    '483fd85f-1b94-49cc-a815-cd26325c9890',
    '350de943-5f9b-48d6-b0ae-f4b3ca103e3a',
    'a13606ae-e05f-4643-b69e-d7cf15a968ff',
    'e32bc3b2-552e-4d79-b2ea-f4cce2a06765',
    'ea3c4d4b-061c-45e3-be2c-98c758cd4241',
    '5fae34ce-acab-4514-bb4c-549e761e0bdd',
    '91f366fd-9bdb-4baf-b523-84a707862abc',
    '42995433-8419-4429-834d-bdfa77e745e5',
    'b0fad5e7-0f77-4733-82eb-54d744910a3a',
    '9fdae908-f842-4dfa-a855-a67fad049979',
    'a7a3b6fc-cb7e-49ed-9375-b8b4e94cccc8',
    'ab6f3ca1-a092-4217-a20d-282c14da9605',
    '615e7c70-c87b-4666-80a4-087b942bc610',
    '7fd6c2f3-e8e4-4b41-a630-09c9818ad884',
    '9cde9240-fb56-44e7-aaf9-2ab27277dfbd',
    'd67d43f3-3129-4e55-8b31-d80be41c56c2',
    '9b3b5414-a264-46ea-a521-8e064cf5abcb',
    'b11a6198-cebc-4201-b694-acd931fac63a',
    '27290fdb-3be5-4405-b666-8955e680d972',
    '7239a7bb-d26c-4449-9c7b-b215dd672b1f',
    '1223e165-4a31-4f34-8829-4d1b18d086a2',
    '1920cb3c-2ecf-40d9-8030-977a44b2f129',
    '4aa31ac1-27e4-4730-8b17-3143b0e3307a',
    'f6036dce-0cf8-4a84-a386-f0d2b321f688',
    '1fc98c98-76d1-497e-b811-9258d1761d62',
    '5856fa68-ed85-4807-8d3f-408d15df70b4',
    '1d68ed6e-1f09-4429-b55a-fd4df362e56b',
    '44b555cd-e46e-4aaa-b276-0ff1c4a7fe91',
    'b8651a40-6bbd-4252-a831-57b2c541bcf2',
    '201e37ce-e18e-4dda-9b9a-7069407dfebb',
    '952edcf6-f451-489a-954d-76c0a5f6f97d',
    '3900bee0-1917-435c-9b1d-f5a8e52127be',
    '79977f1f-0043-4ddd-a0c0-c7fdcd663a3d',
    '0599341a-7eac-4934-a51b-9e9e82d629e7',
    'a138603f-9741-4b47-b533-a61990061dbf',
    '3c781368-6f01-448b-ae0c-8548133fd8ac',
    'aa61445a-bdb3-44a7-a540-557543dcd72e',
    'a8cd32e0-8bdf-415d-8b15-cc691b2357e3',
    'e52e863d-1292-4542-a304-49e90a858960',
    '27b39247-96a0-4f12-846d-83226e9bca8e',
    '1add3f6f-b9bc-4fba-b1a2-60b74a16da8b',
    'e00daf08-ffbf-4baa-b0de-e484f2537d2b',
    '49660545-2074-41b7-bc20-1aab8342d6d5',
    '08b126e0-ba2a-4885-a585-386c1ec6edf7',
    'e848b2b8-b46c-49af-8eb2-759c1c5a9c73',
    'bdd12543-7d10-423f-a365-f7b7c24ba436',
    'e516e767-4493-4f99-b3a0-7dfd54340718',
    '158bdf33-4083-4f32-918e-8cb9f6d68c28',
    'd009d627-979e-46b7-aa5f-205df7d3fb1a',
    '5298c7ab-24e4-4b60-849d-63f7c5363dea'
  ];

  console.log('T1: Actualizando', t1FP.length, 'preguntas a perfect...');

  const { error: e1 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', t1FP);

  if (e1) console.log('❌ T1 Error:', e1.message);
  else console.log('✅ T1:', t1FP.length, 'preguntas actualizadas');

  // T5 - Gobierno y Administración - 78 falsos positivos
  const t5FP = [
    '3f19159e-bceb-429f-a230-9f844189285f',
    'c5681529-eecb-49e0-9feb-1e50102ed379',
    'f32ff32f-a614-4640-a002-7110695402bb',
    'd1d30b6d-ea66-41e3-ae1f-1e7057cb3894',
    '6a5b1654-4c3a-42cf-a2fe-5c55293a2ffc',
    'ad64641a-2d87-41ad-99d7-1a98a5d282fe',
    '226d2f8b-9513-4283-a346-17ae158a60ed',
    '57fe32ee-0f0a-4210-9ca8-828d6876217a',
    'fc70eb42-bfed-4250-9668-3fd6e8729163',
    '15707043-3a11-4b35-8d5b-1af1b986ab03',
    'e6c05033-d40a-4c5a-8986-058b712caea1',
    '8a845f9c-446e-4094-9c73-27c14f170f99',
    '5d750f94-3640-4195-9d95-a9386fc460a6',
    'c0bbf6d1-3cfd-4d20-acc0-82928266849b',
    '483fd85f-1b94-49cc-a815-cd26325c9890',
    '5e1a98fd-9255-4b38-9842-ebd25fc23434',
    '9ca592ac-9832-4e53-9c4a-ec171a712a67',
    'e32bc3b2-552e-4d79-b2ea-f4cce2a06765',
    '5fae34ce-acab-4514-bb4c-549e761e0bdd',
    '519312d4-7e38-4bc8-9824-bf15ba2960ad',
    '41bcfa9f-a205-401b-89a5-6349fc792b3a',
    'c7f9c8dd-b479-493d-b1c2-f7b26b26dbf8',
    '9d64ba31-1dd7-4929-bda2-cd601fb3c4c8',
    'd4e1dac5-dbdc-4fcc-84d2-a19d9a7302df',
    '615e7c70-c87b-4666-80a4-087b942bc610',
    '4302222a-ec0b-4669-adc7-4870cda68d49',
    '7831a142-9fd9-4206-846d-33686890f8a6',
    '08d83816-d587-496a-a7e4-6f6678a7d2f6',
    'd19cc0b8-559d-405c-8269-6428f629075c',
    '4030968b-bb6c-4b31-b4fe-11b9007c8816',
    '7239a7bb-d26c-4449-9c7b-b215dd672b1f',
    '63fb4116-d689-403c-aeb2-30a95805d396',
    '1fc98c98-76d1-497e-b811-9258d1761d62',
    '51545c24-3039-41f5-b77f-2ffb60f14000',
    'c88dd331-ba3b-4ae4-96e2-a7877b818fb7',
    'b8651a40-6bbd-4252-a831-57b2c541bcf2',
    'd7a24a83-6079-4990-892d-21fe827ae48a',
    '8f9fd1af-1069-43e7-9390-1266e244b82e',
    '201e37ce-e18e-4dda-9b9a-7069407dfebb',
    'ff8c2cb4-74b3-4a8d-b52b-7913bf877403',
    '952edcf6-f451-489a-954d-76c0a5f6f97d',
    '66b5399b-f63f-4c61-8a4a-8787437dfb8b',
    '1ed82657-7abf-4eb9-a11d-1d82c7760147',
    '79977f1f-0043-4ddd-a0c0-c7fdcd663a3d',
    '0597741a-ef6d-42a0-ba63-d2e9f98a1452',
    '8de585c4-a9c1-4407-8e22-7227227a37e8',
    'ab4ac8ab-0c61-41d7-abdc-00dd84d451f4',
    'da7bb00a-2b65-4d61-9a68-4ff1a599341a',
    'ed3ec0bc-a2a1-4a32-b2e8-9a8b29943176',
    '213e02fc-c861-4b79-9b47-e56806e22e14',
    '66371cbd-4311-49f0-9e09-fa1b67306cc1',
    'aa61445a-bdb3-44a7-a540-557543dcd72e',
    '41f8dbce-589b-48b9-ab0a-364a828249af',
    'e52e863d-1292-4542-a304-49e90a858960',
    '27b39247-96a0-4f12-846d-83226e9bca8e',
    'e00daf08-ffbf-4baa-b0de-e484f2537d2b',
    '39b672e0-60d6-4e4e-9ec7-f69944ade695',
    '0e1d8c30-f326-4ea8-8bae-fae5cca76a5c',
    '4f0fa59c-593d-4b4e-85a7-3055682b4120',
    '0c43707a-21ef-4b70-ad3c-3471723af1e2',
    '46b4b37d-7ede-4a0e-a092-b94b3769241c',
    '2f5930ca-78ae-435e-88d5-37fed5e69e9e',
    'a6cd5a26-51c5-4bac-85c4-7cce8bc984eb',
    '91aaddf3-9ebb-46ca-a36b-c9076175f321',
    '364d45ac-50c3-426e-8977-23d62eddae9b',
    'a352ffe7-4b93-4ad3-b29f-8b9aabf64748',
    '32115ed1-31ca-4df9-92f7-92d417b71a03',
    '0f87c2e2-8f9d-47ab-a756-014737826b79',
    '3c41f6ff-ccf1-49a9-b0e4-71a532a65c24',
    'd75e7506-9257-4ec4-8d10-2857c9377210',
    '402ea382-4660-4de5-8c2c-d59a954e4cef',
    'f23e2752-b21d-42b8-837d-35dc3ca33c2a',
    '5c2347ef-06a9-4aa6-87ba-c798cca66587',
    '3fe6dda0-b00d-43a3-b125-16472eab53cc',
    'fb0e15c2-ab74-418d-8596-0beae36d84b2',
    'e8e19b12-b30a-4abc-92ef-006c928a119e',
    'f4e77807-ab31-4b62-99a7-d9a87bb2056b',
    '27f9e30b-cf7c-47f0-a171-9cc4e10c4bd6',
    '9f02b4b3-e60e-4ccd-a556-7ac4339b90be',
    'b2f9265e-0431-4226-b54d-64480d0c9233'
  ];

  console.log('T5: Actualizando', t5FP.length, 'preguntas a perfect...');

  const { error: e5 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', t5FP);

  if (e5) console.log('❌ T5 Error:', e5.message);
  else console.log('✅ T5:', t5FP.length, 'preguntas actualizadas');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESUMEN:');
  console.log('  T1:', t1FP.length, '→ 0 errores (3 pendientes revisión)');
  console.log('  T5:', t5FP.length, '→ 0 errores (10 pendientes revisión)');
  console.log('═══════════════════════════════════════════════════════════════');
})();
