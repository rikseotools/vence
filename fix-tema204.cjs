require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Obtener artículos del RGPD
  const rgpdId = 'a227ef14-439f-4b94-9b3c-a161a3355ae5';
  const { data: rgpdArts } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', rgpdId);

  const rgpdMap = {};
  rgpdArts?.forEach(a => rgpdMap[a.article_number] = a.id);

  console.log('RGPD artículos disponibles:', Object.keys(rgpdMap).length);

  // IDs de preguntas a corregir que mencionan RGPD pero están en LO
  const fixes = [
    // P9 - Art. 1 RGPD
    { id: '699c840b-3faa-4741-ad52-af402afc8149', art: '1' },
    // P35 - Art. 1 RGPD (objeto)
    { id: 'b7004d4f-f4cc-4f68-9cf0-c28647e52564', art: '1' },
    // P47 - Art. 1 RGPD
    { id: 'd14ec9dd-99ba-490c-896d-b491ae82929f', art: '1' },
    // P49 - Art. 11 RGPD
    { id: 'c20333db-f5db-4384-a3bc-75b0f6bb044c', art: '11' },
    // P53 - Art. 2 RGPD (ámbito)
    { id: '14095591-0d25-4abf-8ae1-05f9d3db189c', art: '2' },
    // P58 - Art. 2 RGPD
    { id: 'ffed616c-0afc-4534-b607-822871e8537c', art: '2' },
    // P77 - Art. 23 RGPD
    { id: '1cc5414c-75ac-49fe-987b-38ac97dae87c', art: '23' },
    // P136 - Art. 34 RGPD
    { id: 'eea834e1-1527-475e-b064-4f66f2550420', art: '34' },
    // P157 - Art. 31 RGPD
    { id: '25aaa84b-4806-41f1-9336-58d808b0b29d', art: '31' },
    // P246 - Art. 83 RGPD
    { id: 'b6a9cfe0-5251-4eea-9621-b0deaf73f315', art: '83' },
    // P252 - Art. 77 RGPD
    { id: 'a217a71c-1b6d-44c0-b4e9-9fa0ff4855e5', art: '77' },
    // P254 - Art. 79 RGPD
    { id: '493609d8-e414-4a04-9ca7-9dd4314f7f9b', art: '79' },
    // P257 - Art. 83 RGPD
    { id: '8f070643-ab07-41c2-a3ef-5cbdd35f8877', art: '83' },
    // P261 - Art. 77 RGPD
    { id: '54fc07ca-cb10-422c-a733-086273261866', art: '77' },
    // P263 - Art. 82 RGPD
    { id: '84e817d2-1a5a-4c76-992e-29bfd33c91ab', art: '82' },
    // P266 - Art. 78 RGPD
    { id: '1777c1fb-1706-413b-ac31-a8db079be6a3', art: '78' },
    // P269 - Art. 78 RGPD
    { id: 'c9f024d4-0337-47f4-b499-4a57aa76fdec', art: '78' },
    // P270 - Art. 83 RGPD
    { id: '1ce50a21-467d-4b5b-a6d4-154afa7bec17', art: '83' }
  ];

  let fixed = 0;
  let errors = 0;

  for (const fix of fixes) {
    const newArticleId = rgpdMap[fix.art];
    if (!newArticleId) {
      console.log('⚠ Art.', fix.art, 'RGPD no existe en BD');
      errors++;
      continue;
    }

    const { error } = await supabase
      .from('questions')
      .update({ primary_article_id: newArticleId })
      .eq('id', fix.id);

    if (error) {
      console.log('Error:', fix.id, error.message);
      errors++;
    } else {
      console.log('✓ Corregido -> Art.', fix.art, 'RGPD');
      fixed++;
    }
  }

  console.log('\nTotal corregidas:', fixed);
  console.log('Errores:', errors);
})();
