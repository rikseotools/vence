-- 2026-05-08-psicotecnicas-309-reclasificacion.sql
--
-- Reclasifica 309 preguntas psicotécnicas que estaban en "Razonamiento numérico"
-- con section_id = NULL pero cuyo contenido pertenecía a otras categorías.
--
-- Detectado por __tests__/integration/psychometricSectionIntegrity.test.ts:
-- 316 preguntas activas sin section_id (309 en Razonamiento numérico, 5 en
-- Series numéricas, 2 en Series de letras). Las últimas 7 se migraron en una
-- query previa (única sección por categoría — trivial). Las 309 requirieron
-- clasificación con criterio porque sus contenidos eran heterogéneos:
-- silogismos, parentescos, codificaciones letra↔número, anagramas, etc.
--
-- Clasificación realizada por 4 agentes IA (Sonnet) en paralelo, validada
-- contra la taxonomía existente. Todos los pares (target_category_id,
-- target_section_key) verificados como existentes ANTES de aplicar.
--
-- Distribución resultante:
--   Silogismos y lógica:               87
--   Capacidad administrativa:          59 (clasificacion 53 + atencion 5 + tablas 1)
--   Razonamiento numérico:             62 (ecuaciones, operaciones-combinadas, etc.)
--   Agilidad mental:                   42
--   Razonamiento verbal:               20 (organizacion-frases, definiciones, etc.)
--   Árboles genealógicos:              17
--   Series numéricas/letras/mixtas:    14
--   Pruebas de instrucciones:           8
--   --------------------------------------
--   TOTAL:                            309
--
-- Idempotente: el WHERE filtra por section_id IS NULL, así que aplicar dos
-- veces no afecta filas ya migradas.
--
-- IMPORTANTE: Este SQL cambia category_id de muchas preguntas. Usuarios que
-- ya estuvieran viendo estadísticas de "Razonamiento numérico" verán cambios.
-- Es deuda histórica saneándose, no un bug nuevo.

-- ============================================================================
-- Paso 1: migrar las 7 preguntas triviales (categorías con UNA sola sección)
-- ============================================================================
-- 5 en "Series numéricas" (única sección: series-numericas)
-- 2 en "Series de letras" (única sección: series-letras-correlativas)

UPDATE psychometric_questions q
SET section_id = (
      SELECT s.id FROM psychometric_sections s
      JOIN psychometric_categories c ON c.id = s.category_id
      WHERE c.display_name = 'Series numéricas' AND s.section_key = 'series-numericas'
    ),
    updated_at = NOW()
WHERE q.is_active = true
  AND q.section_id IS NULL
  AND q.category_id = (SELECT id FROM psychometric_categories WHERE display_name = 'Series numéricas');

UPDATE psychometric_questions q
SET section_id = (
      SELECT s.id FROM psychometric_sections s
      JOIN psychometric_categories c ON c.id = s.category_id
      WHERE c.display_name = 'Series de letras' AND s.section_key = 'series-letras-correlativas'
    ),
    updated_at = NOW()
WHERE q.is_active = true
  AND q.section_id IS NULL
  AND q.category_id = (SELECT id FROM psychometric_categories WHERE display_name = 'Series de letras');

-- ============================================================================
-- Paso 2: reclasificar las 309 preguntas heterogéneas (clasificación IA validada)
-- ============================================================================

UPDATE psychometric_questions q
SET category_id = m.category_id,
    section_id = (
      SELECT s.id FROM psychometric_sections s
      WHERE s.category_id = m.category_id AND s.section_key = m.section_key
    ),
    updated_at = NOW()
FROM (VALUES
    ('023b3ac2-4c8c-431c-a85e-510cbb484e47'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('028ac1a6-a8cd-49be-9414-4a8801ea95f8'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('02a881c3-9d19-4943-96c6-2d63cbd67c27'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('02ef3d5a-799b-4dd6-84aa-fee5d8dbb69c'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('04a836a5-fa7d-4baa-bf0f-a9bde6a74c78'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('04b914dc-80dd-4ad7-b782-4e0e766413c1'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'calculo-intervalos'),
    ('06f98fdc-7167-4888-ab11-2406100eb1c7'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('0724d094-d1e8-47cf-a6d2-b58d5bb22788'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('073b214d-18d8-4ddd-97b1-6894dcb4c496'::uuid, 'f9a7a62e-0f76-47bc-b2fb-0c86f10cb6aa'::uuid, 'tablas-instrucciones'),
    ('078d4894-a2b2-4b74-b7bb-c3f5470d349d'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('085a247d-a055-4513-b57c-e76d35bd23a8'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'raices'),
    ('095a993c-4379-4286-ab8c-9214e8a2ded0'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('09b00f67-dad3-4a05-bd24-3c7a6e36a6a0'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('0b1f383d-1920-4b7f-abc4-0a9ff27887b5'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('0b539902-d71f-429a-8c86-b2662f9f9ce8'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('0b6b4bed-efd4-4ad9-b21c-0d16a0a07f63'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'clasificacion-palabras'),
    ('0c35123c-33da-4317-bffa-baf465bc314a'::uuid, 'f9a7a62e-0f76-47bc-b2fb-0c86f10cb6aa'::uuid, 'tablas-instrucciones'),
    ('0cdf49c1-37e0-495b-96a9-28174f3e64e1'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('0ce437b1-4d55-46f0-9028-0bda8325837f'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('0d5ad128-ee56-457a-bc1f-258035e65b98'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('0f0e0ef3-1c12-4055-8669-9f24b3ae7edc'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('0fd9fba1-0d7b-47a8-b3af-01ba6819283a'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('10cd57b5-da4d-46f5-a294-68fb760dce4d'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('1102ae78-ce54-462b-83d4-58c63e472cc6'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('12462b21-9b29-493d-845b-d1c84b0a1e21'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('12965d55-1efd-44a4-ac03-281d982d1d7f'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('1316202c-621c-458e-b040-7e6c35f0124d'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('14d592e9-a269-49d6-a86a-e1faf6d1bfbe'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('15578ca0-2044-49c7-bde6-69ce56350426'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('17be4041-54c6-4925-a4b0-15257a848f9d'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('1805817c-625f-4341-b1e1-930eaa2e1ada'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('1996ce8e-a245-48f9-b45c-38fb1a0b2d7d'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('199cbeb6-68f8-4517-9b7f-9183bfb93f6e'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('1c1e61f4-29ff-43d4-86a6-7a611c2cd983'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('1e606585-3948-427d-903a-409df428e7fb'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('208554bf-4d28-4d9d-beba-feaa079ea92d'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('214481f3-8e99-4d90-9dee-c5763976e71b'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('216e7f50-6d42-484e-8e16-bd37e68d6cfb'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('2292cb53-a197-4120-84bb-bf24906311b1'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('22b10c3e-f404-4bfb-9e08-f9c77a050984'::uuid, 'f9a7a62e-0f76-47bc-b2fb-0c86f10cb6aa'::uuid, 'tablas-instrucciones'),
    ('23d8c940-bc42-4dea-a9e0-81a41fe389be'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('24709bd2-5c89-4c0a-83ce-f6885b0dc579'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('252aff7e-7b97-4007-94bb-78d6a1c36c18'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('2643a0c1-28f0-48d7-ae7c-970ba170b0f7'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'fracciones'),
    ('26a1a21b-3026-49f5-b981-0afac22c961f'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('2741d4f5-7bae-44a4-a5cd-e2942f19e286'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('29542f94-62ce-4604-ba28-ccd3eaf0a502'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('2a56f7bb-2527-41e4-bbbb-70276bc2ba8e'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('2b15d756-fabe-411f-b6a2-953059776fbc'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'clasificacion-palabras'),
    ('2bf57e1a-1173-4850-9c18-e0cd38d6bae1'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('2c9745bb-d2eb-46df-aa71-58f5f40d4191'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('2d4aa451-6324-4367-89a0-6b3dc3f6ab46'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('2d7d4acb-0382-4c8c-ad9a-c0c0256fa411'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('2e5e79b9-c682-426b-8396-085b878ce46d'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('2e7c255d-bf96-411e-83f3-4c8509778cda'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('30866226-2699-459a-b2ed-4c1aa5b7cbc3'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('30a60b2e-01b6-48f5-9dbc-4cb9376d9cbc'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('3161f164-5fc9-41e0-9da4-472c8b7fdd36'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('31d0bb30-d595-466b-a18e-137e8b51af84'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('33144160-c542-4e81-b9ec-00de285bd15c'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('33314117-1b60-4de6-a849-c33fffd954b4'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('33da9911-f006-4a13-b6cb-c0b38dac3b6f'::uuid, '63c15a51-29b2-482a-83ca-989ae462183c'::uuid, 'series-mixtas'),
    ('34df187c-9cf6-41e4-a27b-ea163497eefb'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('34e18d23-4ec0-4295-9d6e-d11c3466d928'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('34efbfa6-45cb-4236-be0d-7771fa9e37cc'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'atencion-percepcion'),
    ('353f8619-bd8f-48bd-970f-5527b1576c69'::uuid, 'f9a7a62e-0f76-47bc-b2fb-0c86f10cb6aa'::uuid, 'tablas-instrucciones'),
    ('3560f3a5-9d04-44c6-ab5b-b736ec66152f'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'tablas'),
    ('35add5cb-f6e5-4922-9942-f9b1d30c7109'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('37370dc6-0be1-44cf-91cb-b8c376e55002'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('37f0fdbd-fcd3-4ca5-a659-4c4b815b2704'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('3e00af36-efc3-4a18-8a64-af596dcf298b'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('3e027afb-e57b-4d52-8b2f-b8bc92c8e1e6'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'atencion-percepcion'),
    ('3e24b64c-111a-482d-89e7-9d73f4287fbf'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-decimales'),
    ('3f610f8c-9f7e-40b9-b5bd-c9f4d99acb9d'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('3f6865a3-85ae-41b1-849b-191a62a517ba'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('3f760c4d-0a84-4058-8867-1469b73db1eb'::uuid, '63c15a51-29b2-482a-83ca-989ae462183c'::uuid, 'series-mixtas'),
    ('3fff93b3-9e82-4d3f-b4ed-b3edfd35c895'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'calculo-intervalos'),
    ('4033ce70-36f3-4a41-94b7-d2ea882e4c58'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('413c6027-9aa5-419a-aa01-df268dce4aeb'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('41ca1499-eeae-4eb7-a94d-d7c4e91c255d'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'definiciones'),
    ('41dd8db4-1474-4445-aacf-b25b69c5c1e7'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('41e94b6c-9806-4337-83ee-fec2f29e06b4'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('42f55f10-5ab0-4379-8112-4ddd67b5a036'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('451cc1c7-64d9-47a2-8862-6adf05a305fd'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('4713b1ca-91fc-4ffe-b5ef-daff86938636'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('482a43d7-c670-4450-8e28-ecc054cc6d08'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('4882ac13-e3f7-4887-8204-fa22e60f8f22'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('4892972a-af02-421c-9852-ae85a62ed28c'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'analogias-verbales'),
    ('48c1c148-acc8-4a16-bd5d-605d610c1484'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('4a203374-3a06-426e-94c4-16440ddda6bb'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('4a4ff2d7-1128-4e41-a455-73ccb297e00f'::uuid, 'f9a7a62e-0f76-47bc-b2fb-0c86f10cb6aa'::uuid, 'tablas-instrucciones'),
    ('4ae59f32-525f-44e7-ac56-dfea3d9d8484'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('4c462f0a-838f-4c67-ad6f-f464ffb81586'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('4c6ed0f4-eba1-416b-994b-46ad37378f7f'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('4ca18dc1-ccc6-4810-b9bd-b8dd9b0eb283'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('4ca7988f-bea2-4183-8c31-730274c5e827'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('4dd2a987-c19d-4381-9dc5-4094640ff6ba'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('50aa817c-7c59-4e7a-8a54-ee06bf3d74eb'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('515158b9-0777-44b8-8c7f-7fbbc7c8a023'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('5267651b-82da-4c72-b98c-7af876e1e960'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('53ec08c8-f19e-4b4a-9409-b4e9511637f1'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('54f017c9-2fba-4439-a191-cc99f8f93cc2'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('5508c8fd-f346-45a5-805c-e14335cb2b81'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('5536761e-a0ff-4372-91c3-7396ee4e90c4'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('56a5feb2-5ec5-4791-85a2-686c1485f712'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('58103143-64cf-442f-b9fa-236d8109073a'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('58c05222-7973-40fb-8932-59d89b564f03'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('591765f8-2bf6-44b5-8bba-33b262a27511'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('5950adce-1f84-465e-a805-7965e2e6f78a'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('5bbd9ab7-c397-4f57-93fe-e1699084d676'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('5cb1d297-7545-4e97-8b24-1aaf170245fb'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('5d6835e6-db3e-42b9-b795-d4cd71b445af'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('5d7c5de4-723e-4139-90d3-23c8b8660f67'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('5e164ff5-db62-4607-8537-5ea1bb3767b9'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('603ad599-9841-4e10-ad15-7a0ea7ecb540'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('606d368c-2daf-4391-8584-6dd1d411ceab'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('60fcc21b-ff30-4acb-8008-acdc7a02b502'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('619c98fd-3db7-4846-8a0c-09532edca337'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('61ecb182-b4f9-4a69-819a-e3071e40841f'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('625058a7-ba8c-4bf9-bc74-ab4615d94b9c'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('626ff8b9-2ba5-4ce9-a800-02eae83537c3'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('62ff28bc-9923-491e-be97-3f932361a331'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('63225b33-70c4-4bdb-a271-a67a919b130f'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('637c2706-b796-42b8-af48-44c02701e9d1'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'analogias-verbales'),
    ('651c4d3c-bdde-44a2-b8c2-e36c3c824e82'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('653c3c2f-fee8-4f0e-b436-72917f1df979'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('662a82b0-4254-4980-8546-03f8f71a6e20'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('663b463d-e44b-40c0-94a1-79e669c07b89'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('671a233e-5eb7-462c-a82e-b9a63514b6b0'::uuid, 'f9a7a62e-0f76-47bc-b2fb-0c86f10cb6aa'::uuid, 'tablas-instrucciones'),
    ('6737c6b3-236b-4556-934e-c44f0a790526'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('6850b8fe-fa5d-4a06-8ff6-e71fc6f0905c'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'definiciones'),
    ('6891ecd0-9f41-4d8c-a2ee-764e1804bb26'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('68a6cafe-7172-468b-ad86-15f700805509'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('695062fd-b49c-4afd-b152-4a2389367846'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'fracciones'),
    ('695fa695-659b-4f8c-8192-e9b14417761d'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'calculo-intervalos'),
    ('6aae6e6e-1b59-4252-8546-bc5455e6cb35'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('6b5532c2-eb52-48f6-b72e-846a22422675'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('6d006fbb-3581-4360-8b9f-26e207bd2cb0'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('6e29d4de-14e4-4907-aba4-a31d90ca2fc9'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('6e9f61c6-035f-4178-9362-bbe0017778ca'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('6f46c312-099c-44f1-912e-fcc990f18b9a'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('70177dcd-4447-4f97-bd0d-9911014c2d64'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'reglas-tres'),
    ('70b94e30-2c3d-4a63-838f-6621f4e9c261'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('71f72f7b-1eb5-4339-b5b5-27badb26b55b'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'atencion-percepcion'),
    ('740a5caa-25c6-4a3c-850c-fb6423d2ad9e'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'fracciones'),
    ('75e130a1-1e9c-471e-845c-f48f9b85c8f3'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('76f2de56-81de-4b1d-866b-3e99f1741683'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'clasificacion-palabras'),
    ('773bcb4e-0160-4f25-a390-1ac996e7c5a6'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('7810c2ef-6e1f-4e9f-93b3-5f236dde7483'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('788d97b4-42ae-45b0-bece-d63bfd6745b0'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('78db4d78-69f3-41a2-b4f5-b8ac1a642ffc'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('7af54bf4-af26-4324-b156-d6996a8a32cb'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('7bb79c9d-1746-4f5e-9b2b-ae03d71d03de'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('7bc76334-f027-4e7b-8ad6-c711c62d5076'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('7d9134c5-1687-4f1d-988b-602b7b5df771'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('7f4cbf27-ab0c-4d3d-a8f5-3bce0fe66d7e'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('7f6af58d-5ebb-4b97-a075-6a5f3e1e57db'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('8090c500-a3d3-4c3e-b6cf-a9aa8ee27ad0'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('81200245-c43c-43c9-a546-3dde2b65ec3b'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'calculo-intervalos'),
    ('81231c6b-5b76-4179-8a02-e650c6a28bdf'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('8183fca4-4c0f-4a93-82ec-3c94f208800a'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('8206cf91-0260-48a6-8942-2085a4a25107'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('829a87d7-fff7-4ee5-be27-5eb6c2c62a72'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('84a6a212-6474-4d7b-9498-092370df8257'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'raices'),
    ('862420aa-1cf1-4ff0-8a97-ccd147dc249d'::uuid, 'f9a7a62e-0f76-47bc-b2fb-0c86f10cb6aa'::uuid, 'tablas-instrucciones'),
    ('88aa589c-fab5-4722-9028-ed26e93dcaae'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'calculo-intervalos'),
    ('89210198-2859-4904-b033-03e25a9157da'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('89817e73-da35-4ed4-922c-ed2b1d24355e'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('89fd7b9f-c130-4813-bd30-8de657cd45fb'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('8a19eb4e-513c-459a-8726-40ef0ae8b8c2'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('8a55a10e-60b9-41f8-b54e-1232bca13f7d'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('8a67ad37-2567-4057-8318-96c106fe12d0'::uuid, '63c15a51-29b2-482a-83ca-989ae462183c'::uuid, 'series-mixtas'),
    ('8ac1f4ff-a14a-4322-8935-b96af991cb87'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('8b4c4a01-e36a-453f-bf97-1f8762f2707c'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('8e49093b-3b8b-49e9-b496-8fa22f8a5817'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('8eb496ca-eeb8-4fbd-9590-a913b3ed99fa'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'atencion-percepcion'),
    ('8f50d794-7cb5-42cc-9485-210723fee40c'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('908999f0-0211-4fc0-975d-9d283374fd47'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('91584afe-58fc-4fc3-be14-59c5855ecd14'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('91638a6d-99ab-4b65-9e5e-b020dc5d1134'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('947d3a21-6b80-45df-852f-16f2ae4f0c19'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('97230450-097b-4d64-aeff-58af16e1e124'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'porcentajes'),
    ('9805be14-aad4-40a8-95a8-fbf028a7bb54'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('9a2ba81d-394e-4438-9adf-bccde6d6c12d'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('9d0aa433-c12a-404d-acf7-06670f6a8cbd'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('9d4b67da-416b-40cb-ab90-aebcaa241e7a'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('9f05510f-c98c-47d8-96cd-7af9cc5f0ce9'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('a0260356-10ee-45bf-9dc2-e4b37850dff7'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('a038484f-fb04-41e3-8631-47413188b401'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('a0c8a982-b4e0-4642-8bdc-800084a8db50'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('a1269cf6-45aa-4416-9990-6fda3d942e50'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('a4cd2dee-9f09-4ed5-8aa2-f5c1a132b51f'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('a4d7b556-7e0c-4302-b591-a8eb54b679e9'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('a5c4c922-9d08-40c0-8c0a-e696075cc114'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('a71dcf8e-35d9-4684-9a32-66220e36e4de'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('a730d637-549b-4a97-a191-003cbda3916e'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('a76848a1-0445-4300-9847-adbbc377d5fb'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('a78694b2-f7ea-491e-9e34-904240a2bc15'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('a7b12791-5b0e-4c35-8715-8a8bf06c7b63'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'calculo-intervalos'),
    ('a8ad11bd-9ae0-4192-a4e0-03b48f5382fb'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('a9e5d7f9-ee2a-44b6-9f46-4b85e68ede75'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'definiciones'),
    ('aa8ed742-93dc-4218-9ea4-f017610e4df4'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('aaef4c43-2b5c-4fa9-b5eb-1875600506d0'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('aaef51bd-2edc-454f-8691-849c64c90ebe'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('ab6038c8-b98c-4991-b50d-cf040f7f38ac'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('ab92152e-18dc-4c48-8639-4a14812b5e59'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('abb30d95-5f50-42d4-bdba-922a1e3f10d6'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('abe0416a-20a5-4838-9321-628f25158031'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('acaf4b83-e913-4139-9404-7538559811c8'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('acbcf029-3050-4d8b-a3e7-8080fd68792e'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('adcb6830-6793-4e88-bbe3-acb74af7f9f4'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('adda9b43-9ba7-45a8-bf92-597732aa5e50'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'calculo-intervalos'),
    ('ae3aa08a-d1ef-4e9a-b67c-e0c47f333201'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('af6c5919-0305-443b-a314-48a31e730199'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('b029a5dd-6044-4b99-8b4f-ea8138aafd39'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('b0dbf28a-addb-43c7-bbce-338eb29adfa9'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('b0f0cde5-4471-4695-b967-3b412d399d21'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('b108e0d1-18fe-4872-9eca-52b8855b3f3b'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('b12475a3-82b3-4a8a-ba60-9795eada5278'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'definiciones'),
    ('b369dc89-e6ff-49f0-9a70-7b2ee0e2c548'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('b4341937-127b-4379-a11e-a7c61f64b19c'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('b4742474-d626-412b-95b9-6fc39d113c4c'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('b4936bc9-c87e-417b-a942-cc3a5e7c8bc3'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('b4e07e4e-1a68-45fa-8a35-10f95151d116'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('b4fb270d-903c-4b09-8e06-f8af1c2229cf'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('b4ffe02e-be85-43bf-a5e1-3ad982a6b894'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('b57d939d-ea14-444c-92bb-06915f688238'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('b5f85cba-da60-4cc6-bd49-586fb44d7a8f'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('b6ab4f2d-054f-483a-84c1-d3b63fe39166'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('b9aa9862-cfc5-41f2-8da9-6ce9c944ca3b'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('ba700e19-9ffc-4af4-9ac1-4c954a68e307'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('baa3e51a-e029-45ab-ac8a-aea793675fe9'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('bada1526-42f7-4266-8f5f-b16da79bbd1b'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('bba2a8a3-0558-4488-951d-d4bb6c1fcb61'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('bbb3b639-69bb-4043-bdfc-b0fe398587d1'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('bbc5b766-760a-478d-9a00-0a1127efb761'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('bbeafb5b-d1c5-4aa0-aaac-bea37c555a8b'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('bc1ca689-47a8-4975-9717-2ed911e0d1cc'::uuid, 'f9a7a62e-0f76-47bc-b2fb-0c86f10cb6aa'::uuid, 'tablas-instrucciones'),
    ('bc984479-2950-43ff-a0ad-599761a69392'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('bd7a945f-b65a-4db8-8a90-daed62e829b9'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('bdc233c3-5566-4b61-8af8-36d7cec3311f'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('beb7ed51-7991-4111-9173-97acccc827f7'::uuid, 'f08ebf08-f51d-4fc0-8e0d-578ae1e83af3'::uuid, 'series-letras-correlativas'),
    ('bff22d51-d094-42d0-a102-ebb2c6885a4e'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('c2c0b949-eaae-47eb-8538-b87615191d9d'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('c617e086-7127-4232-9409-252a8fbf0dea'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('c698a76c-acd5-4c14-a7f7-3be69c6d8e46'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('c7c9f312-02aa-406b-aab2-15346e79dc8e'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('c7e36338-6592-4dc5-9bdc-30bdb061b56a'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('c82a739a-59d3-4fe6-b25d-7829b06730b6'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('c8ed9e5c-2ba0-4cb2-8bb0-832a3da63262'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('c9e06448-757b-40af-ab8a-e298a23010c9'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('c9f64b20-fa01-4802-ab9d-4b4a2eb6f6ac'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('ca9cf39e-44df-46a7-8bb3-0f8f8b73b1f2'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('caa66cb7-552a-4228-8342-7e2ad857b78a'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('cc91d34b-35c9-4bfb-924a-d821892bf4dd'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('cedda8cf-05b2-46a0-a616-5ad960456b7f'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'clasificacion-palabras'),
    ('cfc5eb16-76fb-4a6d-807b-2dfafad30140'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('d078de95-29f6-4df9-b2eb-618de71d0755'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('d1df3789-be03-445f-9efa-4f392a4098d8'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('d42fe801-dec3-42d5-97f3-f9eba0286165'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'sistema-sexagesimal'),
    ('d4a20356-ca2e-4684-a5c7-6bcd1ff8379d'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('d5d8a6a2-d868-45b7-b619-a7beb24688eb'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('d6c076bd-768f-47d2-8942-8f9c76f86340'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('d7353ce8-46c1-4105-90b0-3d91a767b22c'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'atencion-percepcion'),
    ('d75b23aa-f04d-4ea6-9134-ed9dbb1abc50'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'sistema-sexagesimal'),
    ('d7612652-7e6f-4fd3-a635-c2e8363aea6f'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('d982e795-8fb1-4e0e-a8c0-1f63158dd32c'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('da165503-2e71-4ac6-a6a9-88911d23f02c'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('da40cc47-0849-469c-954c-ba32ba138b1e'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('da85298c-431c-4d6b-9129-581e26865a42'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('dd379a93-0c4e-4dcd-a3ca-535643cc6bac'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('de498ff3-34c2-4c68-9288-0761df436bcb'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('dedbc4a3-bd40-4c00-b9f1-bf6e7260644e'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('e198e2ed-413a-4197-ae2f-e55ca02c2da9'::uuid, 'f08ebf08-f51d-4fc0-8e0d-578ae1e83af3'::uuid, 'series-letras-correlativas'),
    ('e33cfeca-bc62-46f1-bab1-dedba8b4f8fa'::uuid, '7da3f87d-7281-4632-9a10-bf0a1f93b52e'::uuid, 'arboles-genealogicos'),
    ('e3d8e8eb-a292-4c75-b761-3ecf10303bb7'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('e4340e92-44f7-45bd-8269-dae0a26bffa7'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('e56cc2e6-2fd5-416c-87f5-76ff12b2e851'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('e6203486-246a-4394-b496-dea42c8e3741'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('e774b90e-af6c-4729-8a6a-ae6690729e21'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('e8126696-32ab-4342-b655-bd52b3b6b7d4'::uuid, '62014ea2-eef2-40b1-883c-39d1a73d95ff'::uuid, 'series-numericas'),
    ('e82f9cc9-2658-4a34-81e7-92a1a4f24f27'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('e8e35989-250f-4981-9707-21ca32876ce6'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('eabec355-cdd4-4b91-8987-acf77d5ff34c'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'raices'),
    ('eba57178-dc8b-453b-ae8d-1ffd3f89548f'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('ec127734-10af-4284-819a-f6f7820b3cad'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'clasificacion-palabras'),
    ('ecba9775-4aa1-4590-a65c-5ff4137b5dff'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'reglas-tres'),
    ('ecd50b40-959c-4615-8370-1a3c8ebfae7a'::uuid, '55fd4bd0-faf2-4737-8203-4c41e30be41a'::uuid, 'clasificacion'),
    ('ecffcf97-e4a2-4658-ad12-461892653969'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('edd461f3-237d-4334-8dac-c539e5ba3657'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('ee7f6fb7-d1ba-4c55-90a4-6d723e91b6e8'::uuid, 'e600ae5e-32b8-420f-b8aa-29d924a85f35'::uuid, 'agilidad-mental'),
    ('ee88587a-9a57-4783-9bd5-abd90f378482'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('ef3e7b8b-0c7a-4c26-858f-d755c6eb5565'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('f026c192-6088-492c-af47-28ed9013a7fb'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('f1571f5f-4707-4484-91b9-257f029d5085'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('f2c2ad0a-1bdd-4947-b98a-043468895a6b'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'numeros-enteros'),
    ('f3da55a0-4940-4311-8bd5-89cd3993f025'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('f3e1c475-ddba-48bf-a549-9864f00e9b05'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('f5496b30-64a0-453a-9400-d24949f65ff0'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('f642beab-478c-451c-b296-bd67941286a0'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('f78e94b4-70d6-48db-8190-39a84ee05386'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas'),
    ('faeeffea-9373-4f56-b3c0-fea52a276157'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('fc35acce-7e2b-485d-a39e-29ee5d746ea6'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('fcda858e-0661-4c12-a3b5-43906b2f074c'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('fcfbe47f-9c3a-4902-ab7a-e5d5abfe3cff'::uuid, 'f0569b20-f011-4e1b-a12f-f8b49b106b2f'::uuid, 'organizacion-frases'),
    ('fd265976-c177-4964-a0f5-062a5805a211'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'ecuaciones'),
    ('fe5c3d3a-42e1-4c5e-b52e-69aa06506cfd'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('fec5046c-bee6-413c-ac6d-c1821fbc0591'::uuid, '6c7a18f2-2f53-44e7-a05f-4033bd520514'::uuid, 'silogismos'),
    ('ff527395-8ad0-45bc-b6b0-c8c83ee2260d'::uuid, 'a0c76a3c-9a8e-4b60-994d-a159f964cc83'::uuid, 'operaciones-combinadas')
) AS m(question_id, category_id, section_key)
WHERE q.id = m.question_id
  AND q.is_active = true
  AND q.section_id IS NULL;

-- Verificación
DO $$
DECLARE
  v_null INT;
  v_cross INT;
BEGIN
  SELECT COUNT(*) INTO v_null FROM psychometric_questions WHERE is_active = true AND section_id IS NULL;
  SELECT COUNT(*) INTO v_cross FROM psychometric_questions q
    INNER JOIN psychometric_sections s ON q.section_id = s.id
    WHERE q.is_active = true AND s.category_id != q.category_id;

  IF v_null > 0 THEN
    RAISE NOTICE 'AVISO: % preguntas activas aún sin section_id.', v_null;
  END IF;
  IF v_cross > 0 THEN
    RAISE NOTICE 'AVISO: % preguntas con section de otra categoría.', v_cross;
  END IF;
  IF v_null = 0 AND v_cross = 0 THEN
    RAISE NOTICE 'OK: integridad de secciones psicotécnicas restaurada.';
  END IF;
END $$;
