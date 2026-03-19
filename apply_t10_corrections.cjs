const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

// ======================================================
// T10 CORRECTIONS SCRIPT
// 139 questions: 48 false positives + 91 corrections
// All correct_option values verified as correct - NO answer changes
// ======================================================

// 48 FALSE POSITIVES - just mark as 'perfect'
const falsePositives = [
  '540c9861-ec13-4b2b-afbc-6cc98279bfe9',
  '0451c741-93e6-42f0-a97f-88db56d19b53',
  '5d06d312-eb61-4012-a9de-70d245afe3ea',
  '5245a901-58b3-4294-99de-0bffce4e78fd',
  'f291278b-f8ae-41b4-8a71-b773263a5ab3',
  'cad9b1b8-9206-4d33-afec-570c74f2501c',
  'f0b6e46f-702f-4333-9a6d-d14f9cbc1768',
  '02540797-3e5e-442e-98c2-8a292fe0ae42',
  '39f5d358-e0a2-48b9-ad29-ea4cdf2fe97b',
  '69a7a760-61a5-452b-9443-be544f31b267',
  'fdcb3730-1244-4acc-8929-7fceb4cd4bb5',
  'bfbdb108-57cc-4098-9a84-bcb8dee84e1f',
  '8bcde519-67b7-4d97-b494-26647c6c289e',
  '5e943b80-d1dd-4612-90d2-d73bec29073c',
  'cc9b0cd4-a0bc-4943-bf8b-41a9c12e2758',
  'f07849e1-1c86-4f69-8aa3-e53a21b58445',
  'f51daa25-8a4e-42c1-b17b-eaaa86f04802',
  '728f8fbe-060c-4700-bf32-26419ba47431',
  'f448d294-febc-4819-8637-3c396b2b6f86',
  '38b10220-f1a4-4b52-8ce3-9c38a109ce74',
  '30e4e9a6-b3e8-420c-8fee-4242cc6b16f3',
  '928d36d7-05c8-48d4-8281-ae2de13eedeb',
  'ef1480aa-f100-4f44-8bc8-35a8782d9c69',
  '0ee5b462-f241-49f8-b05e-106284b21f80',
  '7e91bb51-6c7c-4954-b843-389b1507a08b',
  '4b5da340-977e-4d0f-9a44-9d4285df2b67',
  'b611d73e-6896-46ba-b7c1-80f8712e0091',
  'ae9e521b-7277-4011-a798-ace6caf6d4dc',
  '35a18cf4-1972-4993-a6fd-df011a0baa4a',
  '3b33e583-88dc-42fd-b1d8-b4279dbf4915',
  '938f8fba-9ba5-4276-b699-343a7c886482',
  'd9e45e7d-7173-4c3e-8981-0f64bd15b3de',
  'aa570ebf-d851-4a9f-bb65-904008298633',
  '8876f13d-867c-44df-882d-ea00c5c4b284',
  '68f59676-d0c7-4699-8fd6-196972fa6970',
  '1a9a47df-23a3-43ee-bace-4ad0bd5eebc0',
  '9d099b1e-2e0e-413b-8202-8db13bd86348',
  '835c0d28-e8e5-45a5-8ccf-31de98c17217',
  '75bddee6-a92b-42b9-b3d0-342f675a76f9',
  '58629cda-1ad4-4bdb-8894-2968c4471d00',
  '8d276aa9-798b-4d69-aa78-658622095ab9',
  'c0a5a17c-f8f0-4e93-8b56-bf24ec8ea41f',
  '323f8dbf-492c-459a-a7c3-2ea770ac0493',
  '04747ff4-05d5-4e81-9606-47666e2f7571',
  '6bf96f0b-ff92-4a95-8d47-d4a61508942b',
  '784861a4-4083-4bf0-80f9-6d1491bf1b4d',
  '26827a9b-a0aa-46b8-a8cf-f77a70fa9d71',
  'a8b1b251-e82a-46db-87f5-3cbf56e4629a',
];

// 91 CORRECTIONS - article changes and/or explanation improvements
const corrections = [
  // === TUE BATCH 1 ===
  { id: '025d52be-f405-45d8-ae62-558d7850e044', article: null, explanation: 'Seg\u00fan el **art. 50.2 TUE**, "El Estado miembro que decida retirarse notificar\u00e1 su intenci\u00f3n **al Consejo Europeo**." La opci\u00f3n D es la afirmaci\u00f3n incorrecta porque dice "al Consejo" omitiendo la palabra "Europeo". Es una distinci\u00f3n fundamental: el **Consejo** (de Ministros) y el **Consejo Europeo** son instituciones diferentes (art. 13 TUE). Las opciones A, B y C reproducen fielmente el contenido de los arts. 49 y 50 del TUE respectivamente.' },
  { id: 'aac80b17-b379-4615-8fd1-62b4e7b15a80', article: null, explanation: 'Seg\u00fan el **art. 16 del Estatuto del TJUE**, el Tribunal de Justicia act\u00faa en **Pleno** cuando se le somete un asunto en aplicaci\u00f3n de los arts. 228.2 (destituci\u00f3n del Defensor del Pueblo), 245 (incumplimiento de obligaciones de comisarios), 247 (cese de comisarios) o 286.6 TFUE (miembros del Tribunal de Cuentas). En cambio, act\u00faa en **Gran Sala** cuando lo solicita un Estado miembro o una instituci\u00f3n de la Uni\u00f3n que sea parte en el proceso. Por tanto, las opciones B y C corresponden a la Gran Sala (no al Pleno), y solo la opci\u00f3n A es correcta.' },
  { id: '061b90ad-ed9e-4ae9-bb43-1c4cfa312746', article: null, explanation: 'El **Tratado de Lisboa** (firmado el 13 de diciembre de 2007, en vigor desde el 1 de diciembre de 2009) es el que otorg\u00f3 al Consejo Europeo el estatus de **instituci\u00f3n formal de la Uni\u00f3n Europea**, incluy\u00e9ndolo en el **art. 13 TUE** junto con las dem\u00e1s instituciones: Parlamento Europeo, Consejo, Comisi\u00f3n Europea, Tribunal de Justicia de la UE, Banco Central Europeo y Tribunal de Cuentas. Anteriormente, el Consejo Europeo exist\u00eda como foro informal desde 1974 y recibi\u00f3 reconocimiento oficial con el Tratado de Maastricht (1992), pero no fue reconocido como instituci\u00f3n de la UE hasta el Tratado de Lisboa.' },
  { id: '283b0d66-a1cf-433c-96a6-bd25f78e0039', article: '9557e93a-c5a9-46fa-b3c5-b4087ba1b64b', explanation: null },
  { id: '17a2f1fe-dadb-43bc-ac7a-62667c09da86', article: null, explanation: 'Seg\u00fan el **art. 16.1 TUE**: "El Consejo ejercer\u00e1 conjuntamente con el Parlamento Europeo la funci\u00f3n legislativa y la funci\u00f3n presupuestaria. Ejercer\u00e1 funciones de definici\u00f3n de pol\u00edticas y de coordinaci\u00f3n, **en las condiciones establecidas en los Tratados**." La opci\u00f3n C reproduce fielmente este texto. Las opciones A, B y D son incorrectas porque sustituyen "en los Tratados" por "por el Parlamento Europeo", "por la Comisi\u00f3n" y "por los Estados miembros", respectivamente. Nota: el enunciado de la pregunta dice "art. 16 del TFUE", pero el contenido se refiere al art. 16 TUE (Tratado de la Uni\u00f3n Europea).' },
  { id: 'd2885c0c-410b-482d-8ae5-219efc10d3fb', article: '7a191d99-1f6f-4a8b-835d-c8394f38bc70', explanation: 'Seg\u00fan el **art. 3 de la Ley 8/1994**, de 19 de mayo, por la que se regula la Comisi\u00f3n Mixta para la Uni\u00f3n Europea, esta tiene entre sus competencias: a) conocer, tras su publicaci\u00f3n, los decretos legislativos promulgados en aplicaci\u00f3n del derecho derivado comunitario; b) recibir del Gobierno la informaci\u00f3n que obre en su poder sobre las actividades de las instituciones de la Uni\u00f3n Europea; y c) celebrar reuniones conjuntas con los Diputados espa\u00f1oles en el Parlamento Europeo. Dado que las tres opciones A, B y C son correctas, la respuesta es D (todas las anteriores). El **art. 12 TUE** reconoce que los Parlamentos nacionales contribuir\u00e1n activamente al buen funcionamiento de la Uni\u00f3n, y la Comisi\u00f3n Mixta es el instrumento del Parlamento espa\u00f1ol para ejercer este cometido.' },
  { id: 'ce7e7aae-5606-488c-b12c-e0a584af2c68', article: null, explanation: 'Seg\u00fan el **art. 15.2 TUE**, "El Consejo Europeo estar\u00e1 **compuesto** por los Jefes de Estado o de Gobierno de los Estados miembros, as\u00ed como por su Presidente y por el Presidente de la Comisi\u00f3n. **Participar\u00e1 en sus trabajos** el Alto Representante de la Uni\u00f3n para Asuntos Exteriores y Pol\u00edtica de Seguridad." La clave est\u00e1 en la distinci\u00f3n entre **"compuesto por"** (que indica la condici\u00f3n de miembro) y **"participar\u00e1 en sus trabajos"** (que indica asistencia sin ser miembro). El Alto Representante no es miembro del Consejo Europeo, solo participa en sus trabajos. Por tanto, la opci\u00f3n D es la correcta.' },
  { id: '8fdf9311-2ebf-47b7-a38d-12ba2a6cc4b7', article: '9557e93a-c5a9-46fa-b3c5-b4087ba1b64b', explanation: null },
  { id: '125fd7f1-1db8-42f4-a755-e87d77d42de3', article: '9557e93a-c5a9-46fa-b3c5-b4087ba1b64b', explanation: 'Seg\u00fan el **art. 14.4 TUE**, "El Parlamento Europeo elegir\u00e1 a su Presidente y a la Mesa de entre sus diputados." El procedimiento concreto se regula en el **art. 16 del Reglamento Interno del Parlamento Europeo**: las candidaturas se presentan y se procede a votaci\u00f3n. En cada votaci\u00f3n, se requiere obtener la **mayor\u00eda absoluta de los votos emitidos** para ser elegido Presidente. Si despu\u00e9s de tres votaciones ning\u00fan candidato obtiene dicha mayor\u00eda, en la cuarta votaci\u00f3n solo se mantienen las candidaturas de los dos diputados que hubieran obtenido el mayor n\u00famero de votos en la tercera. En caso de empate, ser\u00e1 proclamado electo el candidato de m\u00e1s edad.' },

  // === TUE BATCH 2 ===
  { id: 'fd06f09a-67da-4364-bf6f-f0dba11bb3ad', article: null, explanation: 'Seg\u00fan el **art. 247 TFUE**: "Todo miembro de la Comisi\u00f3n que deje de reunir las condiciones necesarias para el ejercicio de sus funciones o haya cometido una falta grave podr\u00e1 ser cesado por el Tribunal de Justicia, a instancia del Consejo o de la Comisi\u00f3n." Por tanto, el \u00f3rgano competente para el cese es el **Tribunal de Justicia** (no el Tribunal General ni el Tribunal de Funci\u00f3n P\u00fablica). Nota: el enunciado menciona "por mayor\u00eda simple" pero el art. 247 TFUE no especifica el tipo de mayor\u00eda del Consejo para instar el cese, solo indica que actuar\u00e1 "a instancia del Consejo o de la Comisi\u00f3n".' },
  { id: '5304ddb1-2adc-4944-ac2f-b2f89bb23b7b', article: null, explanation: 'La respuesta correcta es A). Seg\u00fan el **art. 17.1 TUE**, "La Comisi\u00f3n promover\u00e1 el inter\u00e9s general de la Uni\u00f3n." Sus miembros son seleccionados a partir de las propuestas de los Estados miembros (art. 17.7 TUE) y nombrados por el Consejo Europeo. Las dem\u00e1s opciones son incorrectas: **B)** es falsa porque la representaci\u00f3n es *decrecientemente proporcional* (art. 14.2 TUE), no igual para todos; **C)** es falsa porque el mandato del Presidente del Consejo Europeo es de **dos a\u00f1os y medio**, no cuatro (art. 15.5 TUE); **D)** es falsa porque el mandato de los eurodiputados es de **cinco a\u00f1os**, no seis (art. 14.3 TUE).' },
  { id: 'd862f3d0-9e20-46fc-bf9b-281125a913dc', article: null, explanation: 'La respuesta incorrecta es A). Seg\u00fan el **art. 17.1 TUE**, la Comisi\u00f3n "supervisar\u00e1 la aplicaci\u00f3n del Derecho de la Uni\u00f3n bajo el control del **Tribunal de Justicia de la Uni\u00f3n Europea**". La opci\u00f3n A sustituye err\u00f3neamente "Tribunal de Justicia de la Uni\u00f3n Europea" por "Parlamento Europeo". Las opciones B, C y D son citas textuales correctas del art. 17.1 TUE.' },
  { id: 'fecef996-6544-4f16-aca4-4cc00e6cde1f', article: '21614da7-3d51-4f27-8ba9-90d55e4f13ce', explanation: 'La respuesta correcta es A). Seg\u00fan el **art. 7.2 TUE**: "El Consejo Europeo, por unanimidad y a propuesta de un tercio de los Estados miembros o de la Comisi\u00f3n y previa aprobaci\u00f3n del Parlamento Europeo, podr\u00e1 constatar la existencia de una violaci\u00f3n grave y persistente por parte de un Estado miembro de los valores contemplados en el art\u00edculo 2, tras invitar al Estado miembro de que se trate a que presente sus observaciones." Es importante distinguir del art. 7.1 TUE, donde es el **Consejo** (no el Consejo Europeo) el que constata un *riesgo claro* de violaci\u00f3n grave.' },
  { id: '277f0fa9-aec4-4f25-9f36-b0ae4dd8736c', article: null, explanation: 'La respuesta correcta es C). Seg\u00fan el **art. 13.4 TUE**: "El Parlamento Europeo, el Consejo y la Comisi\u00f3n estar\u00e1n asistidos por un Comit\u00e9 Econ\u00f3mico y Social y por un Comit\u00e9 de las Regiones que ejercer\u00e1n funciones consultivas." El Banco Central Europeo y el Tribunal de Cuentas son **instituciones** de la UE (art. 13.1 TUE), no \u00f3rganos consultivos. El Defensor del Pueblo Europeo tampoco es un \u00f3rgano consultivo sino una instituci\u00f3n de control.' },
  { id: 'd8a66ffc-74ca-4285-9b4a-d2c1075cfc01', article: null, explanation: 'La respuesta incorrecta es D). Seg\u00fan el **art. 15.6.b) TUE**, el Presidente del Consejo Europeo "velar\u00e1 por la preparaci\u00f3n y continuidad de los trabajos del Consejo Europeo, en cooperaci\u00f3n con el Presidente de la Comisi\u00f3n y **bas\u00e1ndose en los trabajos** del Consejo de Asuntos Generales". La opci\u00f3n D sustituye err\u00f3neamente "bas\u00e1ndose en los trabajos" por "impulsando los trabajos", cambiando el sentido: el Presidente se basa en los trabajos del Consejo de Asuntos Generales (los utiliza como fundamento), no los impulsa. Las opciones A, B y C son correctas seg\u00fan el art. 15.5 y 15.6 TUE.' },
  { id: 'fc2c3b33-8634-45ce-9626-d67e223d0be3', article: '7a191d99-1f6f-4a8b-835d-c8394f38bc70', explanation: 'La respuesta correcta es C). Seg\u00fan el **art. 3 de la Ley 8/1994**, de 19 de mayo, por la que se regula la Comisi\u00f3n Mixta para la Uni\u00f3n Europea, entre sus competencias se encuentra "emitir en nombre de las Cortes Generales, con arreglo a lo dispuesto en la normativa europea aplicable, dictamen motivado sobre la vulneraci\u00f3n del principio de subsidiariedad". Esta funci\u00f3n conecta con el **art. 12.b) TUE**, seg\u00fan el cual los Parlamentos nacionales "velar\u00e1n por que se respete el principio de subsidiariedad de conformidad con los procedimientos establecidos en el Protocolo sobre la aplicaci\u00f3n de los principios de subsidiariedad y proporcionalidad". La Comisi\u00f3n Mixta act\u00faa como el \u00f3rgano parlamentario espa\u00f1ol especializado en asuntos de la UE.' },
  { id: '48e8a1d6-153e-4447-8714-6588bca61021', article: null, explanation: 'La respuesta correcta es B). Seg\u00fan el **art. 16.3 TUE**: "El Consejo se pronunciar\u00e1 por mayor\u00eda cualificada, excepto cuando los Tratados dispongan otra cosa." La mayor\u00eda cualificada es la regla general de votaci\u00f3n del Consejo. Seg\u00fan el art. 16.4 TUE, esta se define como un m\u00ednimo del 55% de los miembros del Consejo que incluya al menos a quince de ellos y represente a Estados miembros que re\u00fanan como m\u00ednimo el 65% de la poblaci\u00f3n de la Uni\u00f3n.' },

  // === TUE BATCH 3 ===
  { id: '223932e6-4bf2-47e8-9b59-169d7bd4c1c5', article: '8bbda2f7-de32-46b1-9ebd-559bad2b5f93', explanation: null },
  { id: '1308fe45-8420-42f6-91af-c7402675a799', article: null, explanation: 'Seg\u00fan el **art\u00edculo 288 del TFUE**, los actos jur\u00eddicos de la Uni\u00f3n son: reglamentos, directivas, decisiones, recomendaciones y dict\u00e1menes.\n\n- Los **reglamentos** son obligatorios en todos sus elementos y directamente aplicables.\n- Las **directivas** obligan en cuanto al resultado, dejando libertad de forma y medios.\n- Las **decisiones** son obligatorias en todos sus elementos.\n- Las **recomendaciones y dict\u00e1menes** **no ser\u00e1n vinculantes**.\n\nPor tanto, los **dict\u00e1menes** (y las recomendaciones) son los \u00fanicos actos que no pueden originar por s\u00ed mismos derechos y obligaciones, al carecer de fuerza jur\u00eddica vinculante.' },
  { id: '4e8773e5-f0a4-4491-a03d-1a79a72df3ab', article: null, explanation: 'Seg\u00fan el **art\u00edculo 19 del Reglamento Interno del Parlamento Europeo**, la duraci\u00f3n del mandato del Presidente, de los Vicepresidentes y de los Cuestores ser\u00e1 de **dos a\u00f1os y medio**.\n\nEl art. 14.4 TUE establece que "el Parlamento Europeo elegir\u00e1 a su Presidente y a la Mesa de entre sus diputados", pero no especifica la duraci\u00f3n, que se regula en el Reglamento Interno.\n\n**No confundir** con el mandato de los diputados (5 a\u00f1os, art. 14.3 TUE) ni con el mandato del Presidente del Consejo Europeo (tambi\u00e9n 2 a\u00f1os y medio, art. 15.5 TUE).' },
  { id: '9ab7d2e6-ec72-4b21-bec1-d1d852a57745', article: 'f7d75ae8-9622-4b9a-9feb-eec237356c9c', explanation: null },
  { id: '2443fa13-822e-4589-a1b9-b5fe3ff3d319', article: '9336b4a1-66cf-4cd2-8a95-a75d0401d3ef', explanation: null },
  { id: '1af246ba-2c1a-4242-9f71-745cf2c63829', article: '6db0ca95-84a4-4636-9a6f-c4e77173e3fd', explanation: null },
  { id: '60c675f0-6c9d-4a7c-9731-56ddffe791ac', article: null, explanation: 'Seg\u00fan el **art\u00edculo 235.2 del TFUE**: "El Consejo Europeo podr\u00e1 invitar al Presidente del Parlamento Europeo a comparecer ante \u00e9l."\n\nEste art\u00edculo complementa al art. 15 TUE que regula el Consejo Europeo, pero la previsi\u00f3n concreta sobre la comparecencia del Presidente del PE se encuentra en el TFUE.\n\nLas dem\u00e1s opciones son incorrectas: el Presidente del Consejo no comparece ante s\u00ed mismo; el Alto Representante ya participa en los trabajos del Consejo Europeo (art. 15.2 TUE); y el Presidente de la Comisi\u00f3n ya es miembro del Consejo Europeo.' },
  { id: '7fcd58bf-d178-4439-a355-6fd63f119975', article: null, explanation: 'Seg\u00fan el **art\u00edculo 15.2 del TUE**, "El Consejo Europeo estar\u00e1 compuesto por los Jefes de Estado o de Gobierno de los Estados miembros, as\u00ed como por su Presidente y por el Presidente de la Comisi\u00f3n."\n\nPor tanto, **todos los mencionados en las opciones B, C y D son miembros** del Consejo Europeo:\n- Los Jefes de Estado o de Gobierno (opci\u00f3n D)\n- El Presidente del Consejo Europeo (opci\u00f3n C)\n- El Presidente de la Comisi\u00f3n Europea (opci\u00f3n B)\n\nLa respuesta correcta es A: todos son miembros.\n\n**Nota:** El Alto Representante de la Uni\u00f3n para Asuntos Exteriores y Pol\u00edtica de Seguridad *participa en sus trabajos* pero no es formalmente "miembro" del Consejo Europeo.' },
  { id: 'f989cdf1-5a50-4ae3-825b-97d060d98452', article: null, explanation: 'Seg\u00fan el **art\u00edculo 4.1 del Reglamento Interno del Consejo Europeo** (Decisi\u00f3n 2009/882/UE): "Cada reuni\u00f3n del Consejo Europeo durar\u00e1 un m\u00e1ximo de **dos d\u00edas**, salvo que el Consejo Europeo o el Consejo de Asuntos Generales decidan otra cosa a propuesta del Presidente del Consejo Europeo."\n\nEl art. 15.3 TUE establece que el Consejo Europeo se re\u00fane dos veces por semestre, pero no especifica la duraci\u00f3n de las sesiones. Esta se regula en su Reglamento Interno.' },
  { id: 'd62682e3-61c5-4c6c-85d1-1a49c2103af3', article: null, explanation: 'Seg\u00fan el **art\u00edculo 17.3 del TUE**: "El mandato de la Comisi\u00f3n ser\u00e1 de **cinco a\u00f1os**."\n\nAdem\u00e1s, el mismo apartado establece que:\n- Los miembros de la Comisi\u00f3n ser\u00e1n elegidos en raz\u00f3n de su **competencia general** y de su **compromiso europeo**.\n- La Comisi\u00f3n ejercer\u00e1 sus responsabilidades con **plena independencia**.\n- Los miembros no solicitar\u00e1n ni aceptar\u00e1n instrucciones de ning\u00fan gobierno, instituci\u00f3n, \u00f3rgano u organismo.' },
  { id: '89bd03b6-586f-4f49-84ad-a98ab6cec1d0', article: null, explanation: 'Seg\u00fan el **art\u00edculo 235.4 del TFUE**: "El Consejo Europeo estar\u00e1 asistido por la **Secretar\u00eda General del Consejo**."\n\nEsta disposici\u00f3n se encuentra en el TFUE (no en el TUE), complementando al art. 15 TUE que regula el Consejo Europeo.\n\nLas dem\u00e1s opciones son inventadas: no existe la "Secretar\u00eda General T\u00e9cnica del Consejo", ni la "Direcci\u00f3n General del Consejo", ni la "Subsecretar\u00eda General del Consejo" como \u00f3rganos de la UE.' },
  { id: '3a7fe901-b66f-4867-83d2-92e5af7041f4', article: null, explanation: 'El n\u00famero de Abogados Generales del TJUE no est\u00e1 fijado en el TUE (el art. 19.2 solo dice que "estar\u00e1 asistido por abogados generales"), sino en el **Estatuto del Tribunal** y decisiones del Consejo.\n\nLa **Decisi\u00f3n del Consejo de 25 de junio de 2013** aument\u00f3 el n\u00famero de Abogados Generales:\n- A **9**, con efectos desde el 1 de julio de 2013\n- A **11**, con efectos desde el 7 de octubre de 2015\n\nPor tanto, en la actualidad el TJUE cuenta con **11 Abogados Generales**.\n\nDe los 11, seis proceden de los Estados miembros de mayor tama\u00f1o (Alemania, Francia, Italia, Espa\u00f1a, Polonia y Pa\u00edses Bajos) y los cinco restantes se designan por rotaci\u00f3n entre los dem\u00e1s Estados miembros.' },

  // === TUE BATCH 4 ===
  { id: '931354a4-8bdd-486b-b924-3c2427210411', article: '199737c7-c813-43b5-9cc5-d3af0fa96a18', explanation: null },
  { id: '571f7fa9-cd81-425a-95fd-f9c623719db3', article: '199737c7-c813-43b5-9cc5-d3af0fa96a18', explanation: null },
  { id: '27aa4f69-8c00-417d-9d1c-807dba3eb5a8', article: null, explanation: 'Seg\u00fan el **art. 10.2 TUE**, "los Estados miembros estar\u00e1n representados en el **Consejo Europeo** por su **Jefe de Estado o de Gobierno** y en el Consejo por sus Gobiernos". Esto tambi\u00e9n se confirma en el art. 15.2 TUE, que detalla la composici\u00f3n del Consejo Europeo. No debe confundirse con el Consejo de la UE (art. 16 TUE), donde los Estados est\u00e1n representados por un representante de rango ministerial.' },
  { id: 'd98b1a14-6667-49e7-bfbd-2054af2a64b8', article: null, explanation: 'La respuesta correcta es A). Las sesiones del **Consejo Europeo no son p\u00fablicas** en ning\u00fan caso. A diferencia del Consejo de la UE, cuyas deliberaciones son p\u00fablicas cuando delibera y vota sobre un proyecto de acto legislativo (art. 16.8 TUE), el Consejo Europeo se re\u00fane siempre a puerta cerrada. Esto se debe a que, conforme al art. 15.1 TUE, el Consejo Europeo **no ejerce funci\u00f3n legislativa alguna**, por lo que no le aplica la regla de publicidad del art. 16.8. La opci\u00f3n D es un distractor habitual que confunde Consejo Europeo con Consejo de la UE.' },
  { id: 'd0656264-5355-4f99-a32e-84a2782c0535', article: null, explanation: 'La respuesta correcta es A). El sistema de **presidencia rotatoria** del Consejo de la UE se establece en el art. 16.9 TUE. A partir del 1 de enero de 2025, el tr\u00edo de presidencias lo conforman: **Polonia** (enero-junio 2025), **Dinamarca** (julio-diciembre 2025) y **Chipre** (enero-junio 2026). Los tr\u00edos fijan objetivos a largo plazo y preparan una agenda com\u00fan para un periodo de 18 meses. La opci\u00f3n B (Francia, Rep\u00fablica Checa, Suecia) corresponde al tr\u00edo de 2022. La opci\u00f3n D (Suecia, B\u00e9lgica, Hungr\u00eda) corresponde al tr\u00edo anterior (2023-2024).' },
  { id: '97a32930-8126-4946-ae37-096bd8cbf788', article: null, explanation: 'La respuesta correcta es C). **En la actualidad**, el Tribunal de Justicia de la Uni\u00f3n Europea comprende el **Tribunal de Justicia** y el **Tribunal General**. Aunque el art. 19.1 TUE menciona tambi\u00e9n "los tribunales especializados", el \u00fanico que existi\u00f3 fue el **Tribunal de la Funci\u00f3n P\u00fablica**, creado en 2004 y **suprimido el 1 de septiembre de 2016**, tras la reforma que duplic\u00f3 el n\u00famero de jueces del Tribunal General. Actualmente no existe ning\u00fan tribunal especializado operativo. La opci\u00f3n B es incorrecta porque el Tribunal de la Funci\u00f3n P\u00fablica ya no existe.' },
  { id: '7931d9a7-d29a-446b-9570-bbdb1ca67fd8', article: null, explanation: 'La respuesta correcta es D). Seg\u00fan el **art. 15 TUE**, el **Consejo Europeo** est\u00e1 compuesto por los Jefes de Estado o de Gobierno de los Estados miembros, as\u00ed como por su Presidente y por el Presidente de la Comisi\u00f3n. Participar\u00e1 en sus trabajos el Alto Representante de la Uni\u00f3n para Asuntos Exteriores y Pol\u00edtica de Seguridad (art. 15.2). Se re\u00fane **dos veces por semestre** por convocatoria de su Presidente (art. 15.3). No debe confundirse con el **Consejo de la UE** (art. 16 TUE), compuesto por ministros sectoriales, ni con el **Consejo de Europa**, que es una organizaci\u00f3n internacional distinta de la UE.' },
  { id: '54964d31-42dc-4ee1-90d0-0129c0a18478', article: null, explanation: 'La respuesta correcta es D). Seg\u00fan el **art. 16.4 TUE**, cuando el Consejo vota a propuesta de la Comisi\u00f3n o del Alto Representante, la **mayor\u00eda cualificada** requiere un m\u00ednimo del **55%** de los miembros del Consejo (al menos 15 miembros) que representen al menos el **65%** de la poblaci\u00f3n de la UE. La minor\u00eda de bloqueo requiere al menos 4 miembros del Consejo. **Atenci\u00f3n**: cuando el Consejo NO act\u00faa a propuesta de la Comisi\u00f3n ni del Alto Representante, el art. 238.2 TFUE establece un umbral m\u00e1s alto: **72%** de los miembros que representen al menos el **65%** de la poblaci\u00f3n (opciones A y B mezclan estos umbrales).' },
  { id: '0a3512b4-abf2-43f2-9c5d-34e0387089d7', article: null, explanation: 'La respuesta correcta es B). El Consejo de la UE se re\u00fane en **10 formaciones diferentes**, seg\u00fan lo establecido en el **Anexo I de su Reglamento Interno** (Decisi\u00f3n 2009/937/UE), en desarrollo del art. 16.6 TUE. Las 10 formaciones son: 1) Asuntos Generales; 2) Asuntos Exteriores; 3) Asuntos Econ\u00f3micos y Financieros (ECOFIN); 4) Justicia y Asuntos de Interior; 5) Empleo, Pol\u00edtica Social, Salud y Consumidores; 6) Competitividad; 7) Transporte, Telecomunicaciones y Energ\u00eda; 8) Agricultura y Pesca; 9) Medio Ambiente; 10) Educaci\u00f3n, Juventud, Cultura y Deporte. Seg\u00fan el art. 16.9 TUE, la presidencia de estas formaciones (excepto Asuntos Exteriores, presidida por el Alto Representante) se desempe\u00f1a por rotaci\u00f3n.' },
  { id: '444b146d-01c3-4a02-8544-0faa39642b2d', article: null, explanation: 'La respuesta incorrecta es A). Seg\u00fan el **art. 16.6 TUE**, "El Consejo se reunir\u00e1 en **diferentes formaciones**", no en una \u00fanica formaci\u00f3n. Actualmente existen 10 formaciones distintas (Asuntos Generales, Asuntos Exteriores, ECOFIN, etc.). Las opciones B, C y D son textos literales del art. 16 TUE: la minor\u00eda de bloqueo de al menos 4 miembros (art. 16.4), la funci\u00f3n legislativa y presupuestaria conjunta con el PE (art. 16.1), y la regla general de mayor\u00eda cualificada (art. 16.3).' },
  { id: 'c94cc358-7cda-48d6-89df-0edfd85c3bed', article: '3e032b52-5b26-4125-8908-8168dded0104', explanation: null },
  { id: '59b2b849-1e27-48c9-9c9b-fb4dd8efb3bd', article: '199737c7-c813-43b5-9cc5-d3af0fa96a18', explanation: null },
  { id: '04181da8-b0f9-47a9-89ba-56f513993ddd', article: '199737c7-c813-43b5-9cc5-d3af0fa96a18', explanation: 'La respuesta correcta es A). El **Tratado CECA** fue firmado en Par\u00eds el **18 de abril de 1951** por 6 pa\u00edses: **B\u00e9lgica, Alemania, Francia, Italia, Luxemburgo y Pa\u00edses Bajos**. Gran Breta\u00f1a (Reino Unido) **no fue miembro fundador** de ninguna de las Comunidades Europeas. El Reino Unido no ingresar\u00eda en las Comunidades hasta el **1 de enero de 1973**, junto con Irlanda y Dinamarca, en la primera ampliaci\u00f3n. El Tratado CECA entr\u00f3 en vigor el 23 de julio de 1952 y expir\u00f3 en 2002 al haberse firmado por un periodo de 50 a\u00f1os.' },
  { id: '98885e00-086b-4995-a0ce-263f5f14803f', article: null, explanation: 'La respuesta correcta es D). El **Reino Unido abandon\u00f3 la Uni\u00f3n Europea el 31 de enero de 2020** a las 23:00 hora de Londres (medianoche hora de Bruselas). El Acuerdo de Retirada, firmado el 24 de enero de 2020, entr\u00f3 en vigor en ese momento conforme a su art. 185. Este proceso se desarroll\u00f3 en aplicaci\u00f3n del **art. 50 TUE**, que permite a todo Estado miembro decidir retirarse de la Uni\u00f3n. Se inici\u00f3 un **periodo transitorio** hasta el 31 de diciembre de 2020, durante el cual el Derecho de la UE sigui\u00f3 aplic\u00e1ndose al Reino Unido. Desde el 1 de enero de 2021, el Reino Unido qued\u00f3 plenamente fuera del marco jur\u00eddico de la UE.' },

  // === TUE BATCH 5 ===
  { id: 'e19bf192-015c-4e09-a99f-e2f7518da233', article: null, explanation: 'Seg\u00fan el **art. 18.3 del TUE**, "el Alto Representante presidir\u00e1 el Consejo de Asuntos Exteriores". Por tanto, **no es** el Presidente de la Comisi\u00f3n (A), ni el Presidente del Consejo (B), ni el Presidente del Parlamento Europeo (C), sino el **Alto Representante de la Uni\u00f3n para Asuntos Exteriores y Pol\u00edtica de Seguridad**, que no aparece entre las opciones A, B y C. La respuesta correcta es **D) Ninguna de las anteriores**.' },
  { id: '5de987e7-7e71-4045-8ef2-95e5014dec43', article: null, explanation: 'La opci\u00f3n B es **FALSA** porque la funci\u00f3n de "dar a la Uni\u00f3n los impulsos necesarios para su desarrollo y definir sus orientaciones y prioridades pol\u00edticas generales" corresponde al **Consejo Europeo** (art. 15.1 TUE), **no** a la Comisi\u00f3n Europea. Las dem\u00e1s opciones son correctas seg\u00fan el **art. 17.1 TUE**: la Comisi\u00f3n vela por la aplicaci\u00f3n de los Tratados (A), asume la representaci\u00f3n exterior con excepci\u00f3n de la PESC (C) y promueve el inter\u00e9s general de la Uni\u00f3n (D).' },
  { id: '970a92c3-b317-448c-b9dd-75a15ee853c5', article: '5191e8f7-0a35-4b85-a529-a9869916b1c9', explanation: null },
  { id: '7fed454d-5f72-4026-9752-f48ec9dbdfad', article: '199737c7-c813-43b5-9cc5-d3af0fa96a18', explanation: null },
  { id: '403cc7c2-ced6-4b96-a5c0-a4e1278cfb96', article: null, explanation: 'Seg\u00fan el **art. 16.6 del TUE**, "el Consejo de Asuntos Generales velar\u00e1 por la coherencia de los trabajos de las diferentes formaciones del Consejo. Preparar\u00e1 las reuniones del Consejo Europeo y garantizar\u00e1 su actuaci\u00f3n subsiguiente, en contacto con el Presidente del Consejo Europeo y la Comisi\u00f3n". Por tanto, la respuesta correcta es **B) El Consejo de Asuntos Generales**.' },
  { id: 'af130da5-4e3f-4067-bef3-5c9dbd916005', article: null, explanation: 'El mandato del Presidente del Tribunal de Justicia de la UE es de **3 a\u00f1os**, renovable. Esto se establece en el **art. 253 TFUE** y en el **art. 8 del Protocolo n. 3** (Estatuto del Tribunal de Justicia): "Los jueces elegir\u00e1n de entre ellos al Presidente y al Vicepresidente del Tribunal de Justicia, por un periodo de tres a\u00f1os. Su mandato ser\u00e1 renovable." No debe confundirse con el mandato de los jueces y abogados generales, que es de **6 a\u00f1os** (art. 19.2 TUE).' },
  { id: 'a6a886ec-9cd7-4822-b3f4-b733dcd8b462', article: null, explanation: 'El Reino Unido notific\u00f3 su intenci\u00f3n de retirarse de la UE el **29 de marzo de 2017**, conforme al **art. 50 del TUE**. El plazo de 2 a\u00f1os del art. 50.3 venc\u00eda el 29 de marzo de 2019, pero se concedieron sucesivas pr\u00f3rrogas (hasta el 12 de abril de 2019, luego hasta el 31 de octubre de 2019, y finalmente hasta el 31 de enero de 2020). El **Acuerdo de Retirada** entr\u00f3 en vigor el **1 de febrero de 2020** y estableci\u00f3 un **periodo transitorio** que finaliz\u00f3 el **31 de diciembre de 2020**. Durante este periodo, el Derecho de la UE sigui\u00f3 aplic\u00e1ndose al Reino Unido. La respuesta correcta es **C)**.' },
  { id: '780974a2-08a9-4566-9a16-44af3f3426f7', article: '370eaa17-b8f3-4524-96c4-c6cf16ec5d00', explanation: null },
  { id: '7697e4d7-97b0-4bf1-92e4-af1ceec1e3a1', article: null, explanation: 'La respuesta correcta es **A)**. Seg\u00fan el **art. 4.3 del Reglamento interno del Consejo Europeo**, "las sesiones del Consejo Europeo no son p\u00fablicas". Esto se entiende porque el **art. 15.1 del TUE** establece que el Consejo Europeo "no ejercer\u00e1 funci\u00f3n legislativa alguna". A diferencia del **Consejo** (art. 16.8 TUE), que se re\u00fane en p\u00fablico cuando delibera y vota sobre proyectos de actos legislativos, el Consejo Europeo no tiene esa obligaci\u00f3n de publicidad. Las opciones B y C son incorrectas porque el Consejo Europeo no delibera sobre actos legislativos, y la opci\u00f3n D inventa un mecanismo de decisi\u00f3n inexistente.' },
  { id: '214f5c52-bc29-4325-86ab-9c80f7309589', article: null, explanation: 'La opci\u00f3n B es **incorrecta** porque seg\u00fan el **art. 15.5 del TUE**, el Consejo Europeo elegir\u00e1 a su Presidente por mayor\u00eda cualificada para un mandato de **dos a\u00f1os y medio** (no "dos a\u00f1os" como dice la opci\u00f3n B), renovable una sola vez. Las dem\u00e1s opciones son correctas: el Alto Representante participa en los trabajos del Consejo Europeo (art. 15.2), se re\u00fane dos veces por semestre (art. 15.3) y no ejerce funci\u00f3n legislativa (art. 15.1).' },
  { id: 'c55edc4d-5520-4e8f-9757-b0c967306d58', article: null, explanation: 'Seg\u00fan el **art. 15.6 del TUE** (\u00faltimo p\u00e1rrafo), "el Presidente del Consejo Europeo **no podr\u00e1 ejercer mandato nacional alguno**". Es decir, es incompatible con cualquier cargo o mandato a nivel nacional de un Estado miembro. Las opciones A (laboral), B (judicial) y C (econ\u00f3mico) no se corresponden con el texto del Tratado. La prohibici\u00f3n se refiere espec\u00edficamente a **mandatos nacionales**, por lo que la respuesta correcta es **D)**.' },
  { id: 'e8c41a31-3949-408b-987d-1c30d4a5d2f5', article: '9336b4a1-66cf-4cd2-8a95-a75d0401d3ef', explanation: null },
  { id: '139d52f4-c524-447c-8563-2151a1ba3f39', article: null, explanation: 'Seg\u00fan el **art. 20.1 del TUE** (segundo p\u00e1rrafo), "la finalidad de las cooperaciones reforzadas ser\u00e1 **impulsar los objetivos de la Uni\u00f3n, proteger sus intereses y reforzar su proceso de integraci\u00f3n**". Las cooperaciones reforzadas permiten a un grupo de al menos 9 Estados miembros avanzar en \u00e1mbitos de competencia no exclusiva cuando la Uni\u00f3n en su conjunto no pueda alcanzar esos objetivos en un plazo razonable. Estar\u00e1n abiertas permanentemente a todos los Estados miembros. La respuesta correcta es **A)**.' },
  { id: 'f2887b76-eb93-4b7a-b063-a6db5c05820a', article: null, explanation: 'Seg\u00fan el **art. 28.1 del TUE**, "cuando una situaci\u00f3n internacional exija una acci\u00f3n operativa de la Uni\u00f3n, **el Consejo** adoptar\u00e1 las decisiones necesarias". Estas decisiones fijar\u00e1n los objetivos, el alcance, los medios que haya que facilitar a la Uni\u00f3n, las condiciones de su ejecuci\u00f3n y, en caso necesario, su duraci\u00f3n. Adem\u00e1s, ser\u00e1n vinculantes para los Estados miembros (art. 28.2). La respuesta correcta es **A) El Consejo**.' },

  // === TFUE BATCH 1 ===
  { id: 'f22fa050-9e17-4abd-8cb4-3854f31fd576', article: null, explanation: 'Seg\u00fan el art. 305 TFUE, el Consejo adopta por unanimidad la composici\u00f3n del Comit\u00e9 de las Regiones. En aplicaci\u00f3n de este art\u00edculo, la **Decisi\u00f3n (UE) 2019/852 del Consejo** establece que Espa\u00f1a cuenta con **21 miembros**: 17 representan a las Comunidades Aut\u00f3nomas (uno por cada una) y 4 a las Entidades Locales. El Comit\u00e9 tiene un total de 329 miembros tras la salida del Reino Unido.' },
  { id: 'd3c86c9d-5781-4b43-b829-a8c13c57839b', article: null, explanation: 'Seg\u00fan el **art. 287.4 TFUE**, el Tribunal de Cuentas elabora un **informe anual despu\u00e9s del cierre de cada ejercicio**. Dicho informe se transmite a las instituciones de la Uni\u00f3n y se publica en el **Diario Oficial de la UE acompa\u00f1ado de las respuestas de estas instituciones** a las observaciones del Tribunal. Por tanto, la publicaci\u00f3n se produce **despu\u00e9s de recibir las observaciones** de las instituciones (opci\u00f3n A), no antes de transmitirlo (opci\u00f3n C) ni antes del cierre del ejercicio (opci\u00f3n B).' },
  { id: '0ed68922-001d-49e4-b30f-057ad118b3c8', article: null, explanation: 'Seg\u00fan el **art. 234 TFUE**, si la moci\u00f3n de censura es aprobada por **mayor\u00eda de dos tercios** de los votos emitidos, que representen a su vez la **mayor\u00eda de los diputados** que componen el PE, los miembros de la Comisi\u00f3n deber\u00e1n dimitir **colectivamente** de sus cargos y el Alto Representante **deber\u00e1** dimitir del cargo que ejerce en la Comisi\u00f3n. Permanecen en sus cargos despachando asuntos de administraci\u00f3n ordinaria hasta ser sustituidos. La clave est\u00e1 en que la dimisi\u00f3n es **colectiva** (no individual) y que el Alto Representante **deber\u00e1** (no podr\u00e1) dimitir.' },
  { id: 'b493ce29-2c36-4611-afa0-de01b710f300', article: null, explanation: 'Seg\u00fan el **art. 228.2 TFUE**, el Defensor del Pueblo ser\u00e1 elegido **despu\u00e9s de cada elecci\u00f3n del Parlamento Europeo para toda la legislatura**. Su mandato ser\u00e1 renovable. Dado que la legislatura del PE dura **5 a\u00f1os** (art. 14.3 TUE), el mandato del Defensor del Pueblo es de **5 a\u00f1os renovables**. Las dem\u00e1s opciones (2,5 a\u00f1os, 3 a\u00f1os, 6 a\u00f1os) no se corresponden con la duraci\u00f3n de la legislatura del PE.' },
  { id: '5ad5fe38-d416-4152-aed3-5fe050a94d66', article: '557c0730-fae1-4dd2-9269-f0c9df1fb5f4', explanation: 'Seg\u00fan el **art. 234 TFUE**, si la moci\u00f3n de censura es aprobada por **mayor\u00eda de dos tercios de los votos emitidos** que representen la mayor\u00eda de los diputados del PE, los miembros de la Comisi\u00f3n deber\u00e1n **dimitir colectivamente** de sus cargos y el Alto Representante deber\u00e1 dimitir del cargo que ejerce en la Comisi\u00f3n. Permanecen en sus cargos despachando asuntos de administraci\u00f3n ordinaria hasta su sustituci\u00f3n conforme al art. 17 TUE. Las opciones A, B y C son incorrectas: la moci\u00f3n s\u00ed est\u00e1 contemplada en el TFUE y no requiere ratificaci\u00f3n del Consejo ni examen del TJUE.' },
  { id: 'c32bbf90-b68e-4231-842f-d916f6c4d1ad', article: '2bfa1458-1a47-4a10-ac71-5bfb3e9371d1', explanation: null },
  { id: '9a978574-494e-4b0d-8aad-0f41a2a2ae8d', article: null, explanation: 'Seg\u00fan el **art. 305 TFUE**, el n\u00famero de miembros del Comit\u00e9 de las Regiones no exceder\u00e1 de 350, y el Consejo adoptar\u00e1 por unanimidad su composici\u00f3n. Tras la salida del Reino Unido, la **Decisi\u00f3n (UE) 2019/852 del Consejo** fij\u00f3 la composici\u00f3n en **329 miembros**. A Espa\u00f1a le corresponden 21 miembros. Los 329 miembros representan a los entes regionales y locales de los 27 Estados miembros de la UE.' },
  { id: '5f3cf341-edf7-40bf-8e13-d4ef8331de62', article: null, explanation: 'Seg\u00fan el **art. 314 TFUE**, el **Parlamento Europeo y el Consejo** establecer\u00e1n el presupuesto anual de la Uni\u00f3n con arreglo a un **procedimiento legislativo especial**. La **Comisi\u00f3n** es quien presenta la propuesta (proyecto de presupuesto) a m\u00e1s tardar el 1 de septiembre del a\u00f1o que precede al de su ejecuci\u00f3n (art. 314.2). Por tanto, la opci\u00f3n D es correcta: lo aprueban PE y Consejo a propuesta de la Comisi\u00f3n. La opci\u00f3n C es incorrecta porque el procedimiento es **especial**, no ordinario.' },
  { id: '3fa4bc19-5dc3-46e4-86a4-d4c385ae5fcc', article: 'ed32e229-46aa-49c1-9b29-a69c6208fe3b', explanation: null },
  { id: '034a16d1-a6cc-402b-9ec7-d37920752635', article: null, explanation: 'Seg\u00fan el **art. 287 TFUE**:\n\n- **Opci\u00f3n A (CORRECTA):** El apartado 1 establece que el Tribunal de Cuentas "examinar\u00e1 las cuentas de la totalidad de los ingresos y gastos de la Uni\u00f3n."\n- **Opci\u00f3n B (INCORRECTA):** El apartado 2 dice que el control de los gastos se efectuar\u00e1 "sobre la base de los **compromisos asumidos y** los pagos realizados." La opci\u00f3n B omite los compromisos asumidos.\n- **Opci\u00f3n C (INCORRECTA):** El apartado 4 dice que asistir\u00e1 "al PE y al **Consejo**" (no a la Comisi\u00f3n) en el control de la ejecuci\u00f3n del presupuesto.\n- **Opci\u00f3n D:** Al ser B y C incorrectas, D tambi\u00e9n lo es.' },
  { id: '7dd2252e-f0ff-4b81-90ae-05ec1c7d380d', article: '9e5aa15b-8cf9-4be7-93b2-79c5e6ad3d6e', explanation: null },
  { id: 'b1c7301a-f519-4077-ad28-4c12157f74c6', article: '836a3320-5aa9-4fb0-858d-0ec0299cadf5', explanation: null },

  // === TFUE BATCH 2 ===
  { id: '60099a46-9409-4b5c-ab22-78f52e8b5af4', article: 'f912ff22-c245-47f4-9d72-51e9a2bb419a', explanation: null },
  { id: '2017734e-3838-4c49-ab58-53959d12a7b6', article: '43b8026e-2faf-48aa-b348-1cd71ed1fe2c', explanation: 'Seg\u00fan el **art\u00edculo 4.2 TFUE**, las competencias compartidas entre la Uni\u00f3n y los Estados miembros incluyen, entre otras: el mercado interior, la pol\u00edtica social, la cohesi\u00f3n econ\u00f3mica, social y territorial, la agricultura y la pesca, el medio ambiente, la protecci\u00f3n de los consumidores, los transportes, las redes transeuropeas, **la energ\u00eda** (letra i), el espacio de libertad, seguridad y justicia, y los asuntos comunes de seguridad en materia de salud p\u00fablica.\n\n- La **industria** (opci\u00f3n A) es competencia de apoyo/complementaria seg\u00fan el art. 6 TFUE.\n- La **pol\u00edtica comercial com\u00fan** (opci\u00f3n B) y la **uni\u00f3n aduanera** (opci\u00f3n D) son competencias **exclusivas** de la Uni\u00f3n seg\u00fan el art. 3 TFUE.' },
  { id: 'fc81fa60-6e0f-44bd-a26b-62975ef95b7b', article: null, explanation: 'Seg\u00fan el **art\u00edculo 231 TFUE**: "Salvo disposici\u00f3n en contrario de los Tratados, el Parlamento Europeo decidir\u00e1 por **mayor\u00eda de los votos emitidos**. El reglamento interno fijar\u00e1 el qu\u00f3rum."\n\nEs importante distinguir entre **mayor\u00eda de los votos emitidos** (regla general del art. 231) y **mayor\u00eda de los miembros que lo componen** (requerida en casos espec\u00edficos como la aprobaci\u00f3n del reglamento interno del PE, seg\u00fan el art. 232 TFUE).' },
  { id: '71d0ced1-b426-46dc-b353-e13178d964cf', article: null, explanation: 'Seg\u00fan el **art\u00edculo 228.2 TFUE**: "A petici\u00f3n del **Parlamento Europeo**, el Tribunal de Justicia podr\u00e1 destituir al Defensor del Pueblo si este dejare de cumplir las condiciones necesarias para el ejercicio de sus funciones o hubiere cometido una falta grave."\n\nEs decir, la destituci\u00f3n la realiza el **Tribunal de Justicia**, pero solo puede hacerlo **a petici\u00f3n del Parlamento Europeo**. Ni el Consejo Europeo, ni el Consejo, ni el BCE tienen legitimaci\u00f3n para solicitar dicha destituci\u00f3n.' },
  { id: '80a7a71e-0244-4d67-8675-050c49f17b36', article: null, explanation: 'Seg\u00fan la **Decisi\u00f3n (UE) 2019/853 del Consejo, de 21 de mayo de 2019**, tras la retirada del Reino Unido, los 24 puestos vacantes se redistribuyeron entre los Estados miembros para restablecer el equilibrio. En su art\u00edculo 1, se establece que a **Espa\u00f1a le corresponden 21 miembros** en el Comit\u00e9 Econ\u00f3mico y Social Europeo.\n\nLa base jur\u00eddica de esta Decisi\u00f3n es el **art\u00edculo 301 TFUE**, que dispone que "el Consejo adoptar\u00e1 por unanimidad, a propuesta de la Comisi\u00f3n, una decisi\u00f3n por la que se establezca la composici\u00f3n del Comit\u00e9."' },
  { id: '4b3fa73a-b080-4b0a-a6db-c5dd0af35b8d', article: 'f912ff22-c245-47f4-9d72-51e9a2bb419a', explanation: 'Seg\u00fan el **art\u00edculo 303 TFUE**: "El Comit\u00e9 ser\u00e1 convocado por **su Presidente**, a instancia del Parlamento Europeo, del Consejo o de la Comisi\u00f3n. Tambi\u00e9n podr\u00e1 reunirse por propia iniciativa."\n\nEs importante distinguir: quien **convoca** el Comit\u00e9 es su **Presidente** (opci\u00f3n D). El Parlamento Europeo, el Consejo y la Comisi\u00f3n pueden **instar** (solicitar) al Presidente que lo convoque, pero la convocatoria formal la realiza el Presidente.' },
  { id: 'a3398a7d-1ef1-407e-8b59-db7cb2d5bc2a', article: null, explanation: 'Seg\u00fan el **art\u00edculo 6 TFUE**, la Uni\u00f3n dispone de competencia para apoyar, coordinar o complementar la acci\u00f3n de los Estados miembros en los siguientes \u00e1mbitos: a) protecci\u00f3n y mejora de la salud humana; **b) la industria**; c) la cultura; d) el turismo; e) la educaci\u00f3n, la formaci\u00f3n profesional, la juventud y el deporte; f) la protecci\u00f3n civil; g) la cooperaci\u00f3n administrativa.\n\nLas dem\u00e1s opciones son **competencias compartidas** seg\u00fan el art. 4.2 TFUE:\n- Las **redes transeuropeas** (letra h)\n- La **energ\u00eda** (letra i)\n- El **medio ambiente** (letra e)' },
  { id: '5777bb8d-5f8c-419a-a7dd-3ca0e027c04b', article: '2bfa1458-1a47-4a10-ac71-5bfb3e9371d1', explanation: null },
  { id: '1b19a7e5-0da8-477c-91bc-dc91c255772c', article: '743487cc-e728-41cb-b2e4-d59a4b1b0105', explanation: 'Seg\u00fan el **art\u00edculo 288 TFUE**, las instituciones de la Uni\u00f3n adoptar\u00e1n: reglamentos, directivas, decisiones, recomendaciones y dict\u00e1menes.\n\nSon **vinculantes**:\n- El **reglamento**: alcance general, obligatorio en todos sus elementos y directamente aplicable.\n- La **directiva**: obliga al Estado destinatario en cuanto al resultado, dejando libertad de forma y medios.\n- La **decisi\u00f3n**: obligatoria en todos sus elementos (si designa destinatarios, solo para estos).\n\n**No son vinculantes**: las **recomendaciones** y los **dict\u00e1menes**.\n\nPor tanto, la \u00fanica opci\u00f3n que incluye **solo** instrumentos vinculantes es la D) Reglamento, Directiva y Decisi\u00f3n. Las opciones A, B y C incluyen recomendaciones o dict\u00e1menes, que no son vinculantes.' },
  { id: '7a14dff0-e46b-4e76-b521-5ddf1c5afa24', article: null, explanation: 'La opci\u00f3n **A es INCORRECTA** porque a\u00f1ade la palabra "cualificada". Seg\u00fan el **art\u00edculo 231 TFUE**: "Salvo disposici\u00f3n en contrario de los Tratados, el Parlamento Europeo decidir\u00e1 por **mayor\u00eda de los votos emitidos**" (no "mayor\u00eda cualificada").\n\nLas dem\u00e1s opciones son correctas:\n- **B)** Art. 233 TFUE: "El Parlamento Europeo proceder\u00e1 a la discusi\u00f3n, en sesi\u00f3n p\u00fablica, del informe general anual que le presentar\u00e1 la Comisi\u00f3n."\n- **C)** Art. 232 TFUE: "El Parlamento Europeo establecer\u00e1 su propio reglamento interno por mayor\u00eda de los miembros que lo componen."\n- **D)** Art. 232 TFUE: "Los documentos del Parlamento Europeo se publicar\u00e1n en la forma prevista en los Tratados y en dicho reglamento."' },
  { id: '4655f4a4-f12c-4c19-87df-f71af56a1126', article: '5aeda8ff-3b78-4594-8aac-f31e50eedd89', explanation: 'Seg\u00fan el **art\u00edculo 304 TFUE**: "Si lo estimaren necesario, el Parlamento Europeo, el Consejo o la Comisi\u00f3n fijar\u00e1n al Comit\u00e9 un plazo para la presentaci\u00f3n de su dictamen, que no podr\u00e1 ser inferior a **un mes** a partir de la fecha de la notificaci\u00f3n. **Transcurrido el plazo fijado sin haberse recibido el dictamen, podr\u00e1 prescindirse del mismo.**"\n\nEs decir, una vez vencido el plazo sin respuesta del Comit\u00e9 Econ\u00f3mico y Social, las instituciones pueden continuar el procedimiento sin dicho dictamen. No se prev\u00e9 ampliaci\u00f3n de plazo ni recurso al Tribunal de Justicia en este supuesto.' },
  { id: 'e128b452-d2e5-404b-88dd-990385a03963', article: '836a3320-5aa9-4fb0-858d-0ec0299cadf5', explanation: null },
  { id: '9d11beca-8a40-42be-b20c-6dc7cb67ba19', article: null, explanation: 'Seg\u00fan el **art\u00edculo 301 TFUE**: "El Consejo adoptar\u00e1 por unanimidad, a propuesta de la Comisi\u00f3n, una decisi\u00f3n por la que se establezca la composici\u00f3n del Comit\u00e9 [Econ\u00f3mico y Social]."\n\nEs decir, es el **Consejo** (no el Consejo Europeo, ni la Comisi\u00f3n, ni el Parlamento) quien adopta la decisi\u00f3n sobre la composici\u00f3n. La Comisi\u00f3n tiene un papel de **propuesta**, pero la **decisi\u00f3n** la toma el Consejo, y adem\u00e1s debe hacerlo por **unanimidad**.' },

  // === OTHERS BATCH ===
  { id: '42968c3f-6da0-4a6a-895c-1a2b9f1e483b', article: null, explanation: 'Seg\u00fan el **art\u00edculo 2.1.e)** de la Ley 19/2013 de Transparencia: "Las corporaciones de Derecho P\u00fablico, **en lo relativo a sus actividades sujetas a Derecho Administrativo**." La clave de la pregunta: la opci\u00f3n A dice "en lo relativo a **todas** sus actividades", mientras que el art\u00edculo dice "en lo relativo a sus actividades **sujetas a Derecho Administrativo**". Las corporaciones de Derecho P\u00fablico (Colegios Profesionales, C\u00e1maras de Comercio, etc.) S\u00cd est\u00e1n incluidas en el \u00e1mbito de la ley, pero **solo** respecto a sus actividades sujetas a Derecho Administrativo, **no** respecto a todas sus actividades.' },
  { id: 'ee2ea147-1731-48f1-8677-e740f76e1591', article: null, explanation: 'Seg\u00fan el **art\u00edculo 2.1.g)** de la Ley 19/2013 de Transparencia: "Las sociedades mercantiles en cuyo capital social la participaci\u00f3n, directa o indirecta, de las entidades previstas en este art\u00edculo sea **superior al 50 por 100**." La clave est\u00e1 en el porcentaje: el art\u00edculo exige participaci\u00f3n **"superior al 50%"** (es decir, m\u00e1s del 50%), pero la opci\u00f3n A dice **"el 50 por 100"** (exactamente el 50%). Con exactamente 50% no se cumple el requisito de "superior al 50%", por lo que no se les aplicar\u00eda el T\u00edtulo I.' },
  { id: 'e21178f6-85e0-43e3-bb5e-adbd3808ae52', article: null, explanation: 'Seg\u00fan la **Disposici\u00f3n Adicional Sexta** de la Ley 19/2013 de Transparencia: "La Secretar\u00eda General de la Presidencia del Gobierno ser\u00e1 el \u00f3rgano competente para tramitar el procedimiento mediante el que se solicite el acceso a la informaci\u00f3n que obre en poder de la Casa de Su Majestad el Rey, as\u00ed como para conocer de cualquier otra cuesti\u00f3n que pudiera surgir de la aplicaci\u00f3n por dicho \u00f3rgano de las disposiciones de esta Ley." La Casa Real est\u00e1 incluida en el \u00e1mbito de la ley (art. 2.1.f) pero tiene un **r\u00e9gimen especial** para las solicitudes de acceso a informaci\u00f3n.' },
  { id: 'a8300e74-9cff-46a2-a127-92308be8360e', article: null, explanation: 'Seg\u00fan el **art\u00edculo 1** del Reglamento Interno del Consejo de la UE: "Cada miembro del grupo ejercer\u00e1 la Presidencia por rotaci\u00f3n durante un periodo de **seis meses**." Se forman **grupos de 3 Estados miembros** que presiden durante **18 meses** en total. Dentro de cada grupo, cada Estado ejerce la Presidencia durante **6 meses** por rotaci\u00f3n. **Excepci\u00f3n:** la formaci\u00f3n de Asuntos Exteriores, que preside el Alto Representante.' },
  { id: 'b3dade2e-eefc-441f-80c9-a8a7158e1931', article: null, explanation: 'Seg\u00fan el **art\u00edculo 1** del Reglamento Interno del Consejo de la UE: "La Presidencia de todas las formaciones del Consejo, con excepci\u00f3n de la formaci\u00f3n de Asuntos Exteriores, ser\u00e1 ejercida por **grupos predeterminados de tres Estados miembros** durante un periodo de **dieciocho meses**." Los grupos se forman de manera equilibrada, teniendo en cuenta la diversidad de los Estados miembros y el equilibrio geogr\u00e1fico en el seno de la Uni\u00f3n.' },
  { id: '73efcd1d-ab3a-47fc-a711-2a05ebcab72f', article: null, explanation: 'Seg\u00fan el **art\u00edculo 1** del Reglamento Interno del Consejo de la UE: "Cada miembro del grupo ejercer\u00e1 la Presidencia por rotaci\u00f3n durante un periodo de **seis meses**." No confundir con el periodo del grupo (tr\u00edo de Estados) que dura **18 meses** en total. L\u00f3gica: 3 Estados x 6 meses = 18 meses.' },
  { id: '3bfa85ca-b81d-42cf-8aa7-01a4cdbf1fba', article: null, explanation: 'Seg\u00fan el **art\u00edculo 1** del Reglamento Interno del Consejo de la UE: "La Presidencia de todas las formaciones del Consejo, con excepci\u00f3n de la formaci\u00f3n de Asuntos Exteriores, ser\u00e1 ejercida por **grupos predeterminados de tres Estados miembros** durante un periodo de **dieciocho meses**." Adem\u00e1s, "los grupos se formar\u00e1n de manera equilibrada, teniendo en cuenta la diversidad de los Estados miembros y el equilibrio geogr\u00e1fico en el seno de la Uni\u00f3n." Regla mnemot\u00e9cnica: 3 Estados x 6 meses cada uno = 18 meses de grupo.' },
  { id: '89abb3f4-e9ed-4ca6-bac4-065052db2d68', article: 'c158d47f-f3b6-4fee-a210-5e686e2ed9a8', explanation: 'Seg\u00fan el **art\u00edculo 3** del Reglamento Interno del Consejo de la UE: "El Consejo tendr\u00e1 su sede en Bruselas. Durante los meses de **abril, junio y octubre**, el Consejo celebrar\u00e1 sus sesiones en Luxemburgo." Regla mnemot\u00e9cnica: A-J-O (Abril, Junio, Octubre).' },
  { id: '23ff5f8f-5ea3-4839-9950-c0036dbc0a99', article: null, explanation: 'Seg\u00fan el **art\u00edculo 17** del Reglamento Interno del Parlamento Europeo (9.\u00aa legislatura): "El n\u00famero de Vicepresidentes ser\u00e1 de **catorce**." Los Vicepresidentes se eligen por **votaci\u00f3n secreta** y son elegidos por el mismo periodo que el Presidente. La Mesa del PE est\u00e1 compuesta por 1 Presidente, **14 Vicepresidentes** y 5 Cuestores (con voz consultiva).' },
];

async function main() {
  console.log('=== SCRIPT DE CORRECCIONES T10 ===');
  console.log(`Falsos positivos: ${falsePositives.length}`);
  console.log(`Correcciones: ${corrections.length}`);
  console.log(`Total: ${falsePositives.length + corrections.length}`);

  let fpOk = 0, fpFail = 0;
  let corrOk = 0, corrFail = 0;
  let artChanged = 0, explChanged = 0;

  // STEP 1: Mark false positives as 'perfect'
  console.log('\n--- PASO 1: Falsos positivos -> perfect ---');
  for (const id of falsePositives) {
    const { error } = await supabase
      .from('questions')
      .update({
        topic_review_status: 'perfect',
        verified_at: new Date().toISOString(),
        verification_status: 'ok'
      })
      .eq('id', id);

    if (error) {
      console.log(`  ❌ FP ${id.substring(0,8)}: ${error.message}`);
      fpFail++;
    } else {
      fpOk++;
    }
  }
  console.log(`  FP completados: ${fpOk} OK, ${fpFail} fallos`);

  // STEP 2: Apply corrections
  console.log('\n--- PASO 2: Correcciones ---');
  for (const c of corrections) {
    const updateData = {
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    };

    if (c.article) {
      updateData.primary_article_id = c.article;
      artChanged++;
    }

    if (c.explanation) {
      updateData.explanation = c.explanation;
      explChanged++;
    }

    const { error } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', c.id);

    if (error) {
      console.log(`  ❌ CORR ${c.id.substring(0,8)}: ${error.message}`);
      corrFail++;
    } else {
      corrOk++;
      const changes = [];
      if (c.article) changes.push('art');
      if (c.explanation) changes.push('expl');
      if (changes.length > 0) {
        console.log(`  ✅ ${c.id.substring(0,8)}: ${changes.join('+')}`);
      }
    }
  }
  console.log(`  Correcciones completadas: ${corrOk} OK, ${corrFail} fallos`);
  console.log(`  Artículos cambiados: ${artChanged}`);
  console.log(`  Explicaciones actualizadas: ${explChanged}`);

  // STEP 3: Verify all 139 are now perfect
  console.log('\n--- PASO 3: Verificación ---');
  const allIds = [...falsePositives, ...corrections.map(c => c.id)];
  let perfectAfter = 0, notPerfect = 0;
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const { data: qs } = await supabase
      .from('questions')
      .select('id, topic_review_status')
      .in('id', batch);
    for (const q of qs || []) {
      if (q.topic_review_status === 'perfect') perfectAfter++;
      else notPerfect++;
    }
  }
  console.log(`  De las 139 preguntas: ${perfectAfter} perfect, ${notPerfect} NO perfect`);

  // STEP 4: Random sample verification
  console.log('\n--- PASO 4: Muestra aleatoria ---');
  const sampleIds = [
    // Article changes
    '283b0d66-a1cf-433c-96a6-bd25f78e0039', // -> art. 14 TUE
    'fecef996-6544-4f16-aca4-4cc00e6cde1f', // -> art. 7 TUE
    '5ad5fe38-d416-4152-aed3-5fe050a94d66', // -> art. 234 TFUE
    '89abb3f4-e9ed-4ca6-bac4-065052db2d68', // -> art. 3 Reglamento Consejo
    // False positives
    '540c9861-ec13-4b2b-afbc-6cc98279bfe9',
    '02540797-3e5e-442e-98c2-8a292fe0ae42',
    // Explanation changes
    '125fd7f1-1db8-42f4-a755-e87d77d42de3',
    '48e8a1d6-153e-4447-8714-6588bca61021',
  ];

  for (const id of sampleIds) {
    const { data: q } = await supabase
      .from('questions')
      .select('id, topic_review_status, primary_article_id, explanation')
      .eq('id', id)
      .single();

    if (q) {
      const isPerfect = q.topic_review_status === 'perfect';
      const icon = isPerfect ? '✅' : '❌';
      console.log(`  ${icon} ${id.substring(0,8)} | status=${q.topic_review_status} | art=${q.primary_article_id?.substring(0,8)} | expl=${q.explanation?.substring(0,60)}...`);
    }
  }

  console.log('\n=== RESUMEN FINAL ===');
  console.log(`Total procesadas: ${fpOk + fpFail + corrOk + corrFail}`);
  console.log(`OK: ${fpOk + corrOk}`);
  console.log(`Fallos: ${fpFail + corrFail}`);
  console.log(`Artículos cambiados: ${artChanged}`);
  console.log(`Explicaciones actualizadas: ${explChanged}`);
}

main().catch(console.error);
