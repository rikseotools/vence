const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

const allIds = [
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

async function main() {
  const allQuestions = [];

  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const { data: questions } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, topic_review_status, primary_article_id,
        articles(id, article_number, title, content, law_id,
          laws(id, short_name))
      `)
      .in('id', batch);

    allQuestions.push(...(questions || []));
  }

  // Format for review
  const formatted = allQuestions.map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
    explanation: q.explanation,
    status: q.topic_review_status,
    article_id: q.primary_article_id,
    article_number: q.articles?.article_number || null,
    article_content: q.articles?.content || null,
    law_short_name: q.articles?.laws?.short_name || null,
  }));

  console.log('Total extraidas:', formatted.length);

  // Split into 5 batches of ~28
  const batchSize = Math.ceil(formatted.length / 5);
  for (let i = 0; i < 5; i++) {
    const batch = formatted.slice(i * batchSize, (i + 1) * batchSize);
    fs.writeFileSync(`t10_verify_batch_${i+1}.json`, JSON.stringify(batch, null, 2));
    console.log(`t10_verify_batch_${i+1}.json: ${batch.length} preguntas`);
  }
}

main().catch(console.error);
