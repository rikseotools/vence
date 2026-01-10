const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const correctIds = [
  '87fb632c-07bf-4c45-878e-dc6428efda76',
  '1eb3e21f-6742-4542-9e9b-1fc47755250f',
  '206f6c0d-9c58-4754-a0b6-adc5b0dfa751',
  'a1a0a08f-d995-41a3-9c31-2e36349ed1e3',
  'e4bccfbc-f86a-4cd6-ac74-bca711e0f97f',
  'aff05949-0b56-4070-9458-eb6b29b16557',
  'f95ea476-9c7c-4d40-bf8c-f5cf0ef0900a',
  '60ccc27a-25f4-43d3-9e5d-5a033c36b5f2',
  '1357eff9-feab-4e31-9c09-5ea45dcce1bf',
  'c97679e1-f92c-47ce-bdfa-dc7343c646d0',
  'c4b70047-b88c-48f1-9006-252ad66ea4ed',
  'd6b3c040-47e2-436d-a734-a7cb7610c5b3',
  '9836e635-bee7-4c97-acbd-bc3fddab6212',
  '65292f9b-19ef-4bc2-bf51-b189fd3c052c',
  '109afd7f-be08-4fa7-9ea9-086df7b60e83',
  'b189b9b8-6873-4202-b815-04d0feb46666',
  'e479c6f2-b56f-4666-8b9b-76c96a7146c3',
  'f97af704-0b5a-4c5f-b6e3-9929a6486d75',
  '596b585c-ed24-47d6-9a1e-7be9372d2f98',
  '3b9ac6bf-d2bb-43b9-bbad-0aa6318286d0',
  'fcb0c504-956f-45ff-a638-95e14ce388db',
  'e5084d00-cbc6-416f-bf9b-989a24d92ad2',
  '262d0394-aa9d-4859-b332-d8ab514e1f8c',
  '11d34e48-2e40-4961-8467-3cf265c0d41f',
  'f7995806-bd66-46ce-93c6-eb38c62e0863',
  'bbc57168-d959-4fc6-9186-50d7cd5cb769',
  '8e2b252a-b3da-4206-abc4-bbacd947e64d',
  '3897af0c-c197-49a2-b284-aa1846b81a7e',
  '1526f566-6723-42f3-a798-4b0ddd27bb6f',
  '2e84e19d-4486-42f2-8b9d-d4d9b1085cd6',
  'e2083af1-8a43-4cf7-b2c2-4b86e200ebf7',
  '7e788e19-ea87-4871-adf1-62caea5cf285',
  '28298c80-ffbe-431a-890c-4dc214bfa828',
  '93422947-8ac0-4cc5-a088-2496b9a2caa9',
  '0942bd42-33f2-401d-af85-337e872fc45c',
  '508562a7-f32f-4ab3-b228-9b839c8a07f5',
  'e12e4d10-6d92-45c0-9d78-3cb6ed1e1e24',
  '2e87d1f4-8b12-479d-a89b-9f64144300af',
  '46e197db-030f-40ca-ac3f-cfb17d8b3212',
  '4222c5c8-d2ad-4104-adb6-7a76dc6de4c6',
  '23414f70-1edd-47d3-96b7-1e4501433cc1',
  'd3ae1a61-2468-4fa9-be67-67388fb35f7e',
  '91da0189-b57c-4f25-97b9-8cf1565046ce',
  '215692c8-c3fd-4b8e-ab6c-c8196a6b2b6c',
  'd122dc87-059d-40f1-93e9-6c58860023f7',
  '47b5df52-48f3-467c-ae6a-b33b4025f83f',
  '1dab15b8-31ae-41f9-835d-69d440dbcf76',
  'd8cabae3-5255-4ef5-a07f-91b188ec382d',
  'a9e8740b-26be-4ed4-a3bc-ee8ac552755f',
  '8c79afe6-4006-41bf-b3f0-7bf97287ee37',
];

(async () => {
  for (const id of correctIds) {
    await s.from('questions').update({ topic_review_status: 'perfect' }).eq('id', id);
    await s.from('ai_verification_results').update({
      article_ok: true, answer_ok: true, explanation_ok: true,
      explanation: 'Verificación manual T303: respuesta y artículo correctos'
    }).eq('question_id', id);
    console.log(id.substring(0,8), 'OK');
  }
  console.log('Total corregidas:', correctIds.length);
})();
