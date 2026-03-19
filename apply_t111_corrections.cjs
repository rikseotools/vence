const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const now = new Date().toISOString();

  // ============================================
  // 1. FALSOS POSITIVOS - Actualizar a "perfect"
  // ============================================
  const falsosPositivos = [
    // Batch 1 (14)
    'd79b6af9-6876-4be2-950d-7461ac2fdc70',
    '48986710-3510-42cb-bb58-58a830f04efb',
    'd1bd0235-4525-476f-aaa9-fa404b03569c',
    '2a3d8fba-00d4-4f51-825b-aae27eea38de',
    '301c6cbd-b3b0-43ae-b4b8-97b988cfa74c',
    '0487ace9-aff2-4282-99f3-6bda911825f3',
    'c1d9a335-50db-4c32-acd0-a0ad2f101a15',
    'd20bfc00-2037-4010-80d4-d844b3717cff',
    'b926db13-a981-46c2-9da4-40ea91ae2458',
    'b72d124a-bcb7-4ac4-9531-bc68dd2206d5',
    'b90bbd05-30e5-47ce-b5cf-8bff9204af14',
    'e9cf32a5-c83f-4db9-8090-440bf203494a',
    '397a0235-37a9-415e-a97a-6af5914a5c49',
    '413ae814-5164-4ab5-87a5-201d2b2ddb76',
    // Batch 2 (13)
    '2d7b47cb-7323-47d9-9bf8-3b58e406ae0b',
    '6b058626-fa2b-44fe-86fd-1251b30de944',
    '2dc71edd-1333-403d-922b-05f5ad349187',
    '81a7377a-07f7-4461-9f0f-2dd9b1638ad8',
    '6b6d0262-2df6-4e83-aff8-aacf6179180e',
    '51458dda-57b8-4235-91de-4ab318a357f3',
    'a396fde6-3975-46c8-a776-5cc3b8e7a620',
    'f2f05702-bd42-4b3a-8a70-fbab075c8c53',
    '61c68419-b1fd-48a4-99b1-414ed03d1fa0',
    '7532b49d-9626-4c98-94fe-9c1db5c70036',
    '7ad723e1-a153-464e-9096-5959e080d983',
    'df83d991-fe5b-4520-9fb5-06909ab4b600',
    '9d7b64e3-ac11-4e67-93f5-d426719cf586',
    // Batch 3 (18)
    '02abd999-85ec-4399-9373-810232df2790',
    'ead0bffa-a27b-415a-b3be-18fcea38779b',
    'e876c74a-6efc-48d7-a619-bb6bb659e32f',
    '183042ee-6a4e-4ef3-a26c-cccec87bc2a7',
    '5cd3a491-79a3-43f8-b17a-f8ba583549a7',
    '201fc3d8-908a-4176-9c01-e2f42b0d11ee',
    'fbbc774e-4360-4557-a81c-7e98f8b6f844',
    '623b0689-3b30-4bfe-b8d3-ed55ddb70aa3',
    '9bb446c3-01fd-42e4-9f88-0993df125083',
    'd84db96e-fec6-40a3-a6b3-86051fd36dec',
    '6edd346a-aec2-4dcb-b18d-4b2371b85200',
    '5ff7a71c-fe98-4742-8f24-eb14d4c68276',
    '781b6b73-8ac8-4ca6-b346-79f2105621e3',
    '1d4d8114-a559-4dcf-b8bf-fba78b2e19d9',
    '16dba912-280f-46f4-bfe1-0cf75f191bb6',
    '884c2b5f-79ad-4a93-9518-9da098ac708c',
    '5c220709-81af-41b5-a58f-50071d88a29a',
    'e815fdcb-544c-47de-b3be-c4eb12050e3b',
    // Batch 4 (14)
    '6b3d534c-5ec0-41a8-a03b-d276c3a3ebe3',
    '5f0f31c6-0e93-4da0-bcb1-893b70032015',
    '39cb186d-9d3a-4586-916e-00dfabfa822a',
    'eb34b65d-48b8-4b2f-a710-6603856e6efd',
    'fd75866f-44ec-4727-939e-d6f4bc6685b1',
    '0378b105-1a40-480b-b7e7-ce0696dc30d2',
    '4bf1bc27-24ba-430f-af3d-174e2d3e9f90',
    'cb617faf-ce8f-42b8-9979-6f01d0339810',
    'd885e7ed-2f13-40fc-a907-ccadf40162fa',
    '2e5fadc0-cd64-4670-88f8-072a8e201a95',
    'bc67dfc9-08a6-43ce-a1c3-6b85679dacfe',
    'c5aca51d-50ac-4ef5-8a3c-63c06125df37',
    '6e68dac1-654e-430e-9755-7be8dac63e91',
    'db1750b3-47d0-4fcc-85f8-83bedfaa11c1',
    // Batch 5 (17)
    'a825413d-4903-4c15-bbc4-58b0d62ea61e',
    '43f3f783-6077-483d-9969-5b320f2613e7',
    '4769855e-1459-45c2-8f39-ad0fc7d35e3e',
    '544fdc24-ef7d-4fdd-bb09-b60dca1df47d',
    'd69910fd-c356-481b-a921-0d5136b75ade',
    '87604836-3ff1-49fb-9cf3-e913e2865f74',
    'fd470a04-283f-4d49-a084-340803deb998',
    '89567403-9392-49d0-8bb3-eb955e2a791b',
    'a206d1c9-a7e1-45c9-b279-84216448f724',
    'f243ff75-2f5d-4df0-93f5-93ad262f4947',
    '4395d20b-4f18-4989-8799-5e45b0a88e30',
    'e89dde07-5b35-49ef-8433-fbe8f018f38c',
    '81ee7276-a47b-48ef-911c-54ddc41d3dcd',
    'b8084d8a-3900-49f6-be93-a88527d3780b',
    'd970d0cf-c4bd-4dd3-aacb-aa9e1de7baa8',
    'a097958e-1cf8-4ee1-9c65-b6352ecf986c',
    '1ff3d8e3-86a0-4c08-8285-2c3c8b9fa63c',
  ];

  console.log(`\n=== ACTUALIZANDO ${falsosPositivos.length} FALSOS POSITIVOS A "perfect" ===`);

  // Supabase tiene limite de 100 items en .in(), dividir en lotes
  for (let i = 0; i < falsosPositivos.length; i += 50) {
    const batch = falsosPositivos.slice(i, i + 50);
    const { error } = await supabase
      .from('questions')
      .update({
        topic_review_status: 'tech_perfect',
        verified_at: now,
        verification_status: 'ok'
      })
      .in('id', batch);

    if (error) console.error(`Error batch FP ${i}:`, error);
    else console.log(`  Batch ${i}-${i + batch.length}: ${batch.length} actualizadas`);
  }

  // ============================================
  // 2. CORRECCIONES DE SOLO EXPLICACIÓN
  // ============================================
  console.log('\n=== CORRECCIONES DE EXPLICACIÓN ===');

  const explanationFixes = [
    {
      id: '65297931-d6cd-4c74-a035-b1a8d67525a1',
      desc: 'Reenviar - explicación mejorada',
      explanation: 'La función **Reenviar** (Forward) en el correo electrónico permite enviar una copia completa del mensaje seleccionado (incluyendo el cuerpo del texto, imágenes y archivos adjuntos) a nuevos destinatarios que nosotros elijamos.\n\nEs la función que se utiliza cuando queremos **compartir un mensaje recibido** con otras personas que no estaban en la lista original de destinatarios.\n\nA diferencia de "Responder" o "Responder a todos", que dirigen la respuesta al remitente original (y demás destinatarios), Reenviar nos permite elegir libremente los nuevos destinatarios.'
    },
    {
      id: 'fb3edb0b-f710-4444-9457-53846768bda9',
      desc: 'Calendario vistas - explicación mejorada',
      explanation: 'En Outlook 365, el calendario ofrece cuatro vistas principales para visualizar los eventos y citas: **Día** (muestra las horas de un solo día), **Semana laboral** (muestra los días laborables de lunes a viernes), **Semana** (muestra los 7 días de la semana) y **Mes** (muestra el mes completo).\n\nEstas vistas se pueden seleccionar desde la pestaña **Inicio** en el grupo **Organizar** o desde la pestaña **Vista**. Los atajos de teclado correspondientes son: Ctrl+Alt+1 (Día), Ctrl+Alt+2 (Semana laboral), Ctrl+Alt+3 (Semana) y Ctrl+Alt+4 (Mes).\n\nNo existe una vista "Año" ni una vista "Hora" como opciones independientes en el calendario de Outlook.'
    },
    {
      id: '8174b182-d47a-45a4-9715-689aafbd5fd9',
      desc: 'Ctrl+F Reenviar - explicación añadida',
      explanation: 'En Outlook 365, la combinación de teclas **Ctrl+F** se utiliza para **Reenviar** (Forward) un mensaje de correo electrónico. Al pulsar este atajo con un mensaje seleccionado, se abre una nueva ventana con el contenido del mensaje original, permitiendo al usuario elegir nuevos destinatarios.\n\n**Nota importante:** En Outlook clásico de escritorio, el atajo para Reenviar es Ctrl+F, mientras que Ctrl+Alt+F reenvía como dato adjunto. En el Nuevo Outlook y en Outlook Web App (OWA), el comportamiento puede variar.\n\nLas demás opciones corresponden a: Ctrl+P (Imprimir), Ctrl+O (Abrir mensaje en ventana independiente) y Ctrl+R (Responder al remitente).'
    },
  ];

  for (const fix of explanationFixes) {
    const { error } = await supabase
      .from('questions')
      .update({
        explanation: fix.explanation,
        topic_review_status: 'tech_perfect',
        verified_at: now,
        verification_status: 'ok'
      })
      .eq('id', fix.id);

    if (error) console.error(`  Error ${fix.id}:`, error);
    else console.log(`  ✅ ${fix.desc} (${fix.id})`);
  }

  // ============================================
  // 3. CORRECCIONES DE RESPUESTA + EXPLICACIÓN
  // ============================================
  console.log('\n=== CORRECCIONES DE RESPUESTA ===');

  const answerFixes = [
    {
      id: '42425e28-0fcb-4d0b-86b9-23706de80579',
      desc: 'Parte derecha del @ = Dominio (D→A)',
      correct_option: 0,
      explanation: 'En una dirección de correo electrónico con formato **usuario@dominio.extensión**, la parte que aparece a la derecha del símbolo **@** se denomina **dominio**.\n\nEl dominio identifica el servidor de correo que gestiona el buzón del destinatario. Por ejemplo, en **usuario@gmail.com**, **gmail.com** es el dominio.\n\nLa opción B (Organización) no es correcta porque, aunque un dominio puede pertenecer a una organización, el término técnico estándar para esa parte de la dirección es exclusivamente **dominio**.'
    },
    {
      id: 'c09e805d-d949-4ab9-8f29-ef78f9b08f8e',
      desc: 'Búsqueda Outlook prefix matching (C→A)',
      correct_option: 0,
      explanation: 'En **Outlook 365**, cuando escribimos una palabra en la barra de búsqueda, Outlook utiliza **coincidencia por prefijo** (prefix matching). Esto significa que si escribimos **"proyecto"**, Outlook devolverá todos los mensajes que contengan palabras que comiencen por "proyecto", como **"proyectos"**, **"proyector"**, **"proyectando"**, etc.\n\nAdemás, la búsqueda se realiza en todos los campos del mensaje: **nombre del remitente**, **asunto**, **cuerpo del mensaje** y **contenido de los datos adjuntos**. Por defecto, Outlook incluye automáticamente el contenido de los adjuntos de Microsoft 365 en sus resultados de búsqueda.'
    },
    {
      id: 'bbe2cfb8-d429-4244-98d0-b43def0e7057',
      desc: 'Ctrl+3 = Contactos, no Ctrl+4 (B→A)',
      correct_option: 0,
      explanation: 'En Outlook 365, los atajos de teclado para cambiar entre las vistas principales son:\n\n- **Ctrl+1**: Correo\n- **Ctrl+2**: Calendario\n- **Ctrl+3**: Contactos (Personas)\n- **Ctrl+4**: Tareas\n- **Ctrl+5**: Notas\n\nPor tanto, para acceder a la carpeta de **Contactos**, el atajo correcto es **Ctrl+3**.'
    },
    {
      id: 'f383f6a8-c66e-48e2-a0c3-5800b6387681',
      desc: 'CTRL+O abre mensaje seleccionado (C→A)',
      correct_option: 0,
      explanation: 'El método abreviado **CTRL+O** se utiliza en Outlook para abrir el mensaje recibido que se tiene seleccionado en la bandeja de entrada en una ventana independiente.\n\nOtros atajos relacionados: **CTRL+Q** marca como leído, **CTRL+U** marca como no leído, **CTRL+N** crea nuevo elemento según la vista activa, y **CTRL+F** reenvía el mensaje.'
    },
    {
      id: 'e3ce04ff-4718-4caf-b095-4ae376348ab4',
      desc: 'Marcar todos como leídos = pestaña Inicio (D→C)',
      correct_option: 2,
      explanation: 'En Outlook 365 (clásico), la opción **"Marcar todos como leídos"** se encuentra en la pestaña **Inicio** (Home) de la cinta de opciones, no en la pestaña Carpeta.\n\nTambién se puede acceder haciendo clic derecho sobre la carpeta y seleccionando "Marcar todo como leído" en el menú contextual.'
    },
    {
      id: '8c01a2ed-2660-4596-9747-c6861837085f',
      desc: 'Hoja de cálculo NO es dato de contacto (D→A)',
      correct_option: 0,
      explanation: 'En la ficha de contacto de Outlook se pueden incluir: nombre, email, teléfono, dirección, empresa, cargo, notas, foto y fecha de nacimiento, entre otros campos estándar.\n\nUna **"Hoja de cálculo"** NO es un tipo de información que se pueda incluir como campo en la ficha de un contacto de Outlook. Las hojas de cálculo son documentos de Excel, no datos de contacto.'
    },
  ];

  for (const fix of answerFixes) {
    const { error } = await supabase
      .from('questions')
      .update({
        correct_option: fix.correct_option,
        explanation: fix.explanation,
        topic_review_status: 'tech_perfect',
        verified_at: now,
        verification_status: 'ok'
      })
      .eq('id', fix.id);

    if (error) console.error(`  Error ${fix.id}:`, error);
    else console.log(`  ✅ ${fix.desc} (${fix.id})`);
  }

  // ============================================
  // 4. CORRECCIÓN DE TEXTO DE PREGUNTA
  // ============================================
  console.log('\n=== CORRECCIONES DE TEXTO DE PREGUNTA ===');

  // Pregunta sobre Ctrl+Mayús+T → Ctrl+Mayús+K (crear tarea)
  {
    const { error } = await supabase
      .from('questions')
      .update({
        question_text: '¿Qué ocurre al presionar Ctrl + Mayúsc + K en Outlook 365?',
        explanation: 'El atajo de teclado **Ctrl + Mayúsc + K** crea una **nueva tarea** en Outlook 365. Este atajo permite agregar rápidamente una tarea pendiente sin necesidad de navegar por los menús.\n\nOtros atajos relacionados son: **Ctrl + Mayúsc + M** (nuevo mensaje de correo), **Ctrl + Mayúsc + A** (nueva cita), **Ctrl + Mayúsc + Q** (nueva reunión), y **Ctrl + Mayúsc + C** (nuevo contacto).',
        topic_review_status: 'tech_perfect',
        verified_at: now,
        verification_status: 'ok'
      })
      .eq('id', 'd7f53aba-1824-4d38-96dd-4dd1e9f11f88');

    if (error) console.error('  Error d7f53aba:', error);
    else console.log('  ✅ Ctrl+Mayús+T → Ctrl+Mayús+K (d7f53aba)');
  }

  // b9e56e90: cambiar option_d de "Ctrl + Shift + T" a "Ctrl + Shift + K"
  {
    const { error } = await supabase
      .from('questions')
      .update({
        option_d: 'Ctrl + Shift + K',
        explanation: 'El atajo para crear una nueva tarea en Outlook es **Ctrl + Shift + K**.\n\nOtros atajos de creación rápida: **Ctrl + Shift + A** (nueva cita), **Ctrl + Shift + Q** (nueva reunión), **Ctrl + Shift + C** (nuevo contacto), **Ctrl + Shift + M** (nuevo mensaje).',
        topic_review_status: 'tech_perfect',
        verified_at: now,
        verification_status: 'ok'
      })
      .eq('id', 'b9e56e90-0436-4304-adf0-9d7b38205fdd');

    if (error) console.error('  Error b9e56e90:', error);
    else console.log('  ✅ Option D: Ctrl+Shift+T → Ctrl+Shift+K (b9e56e90)');
  }

  // ============================================
  // 5. DESACTIVAR PREGUNTAS DEFECTUOSAS
  // ============================================
  console.log('\n=== DESACTIVANDO PREGUNTAS DEFECTUOSAS ===');

  const toDeactivate = [
    { id: 'c9adf05e-44c1-447f-b352-dc28bb8f76d3', reason: 'Atajo "Ir a fecha" es Ctrl+G, no aparece entre opciones' },
    { id: 'a89c31c1-9a19-4fe8-89a2-76fe51631784', reason: 'Atajo formato fuente es Ctrl+D, no aparece entre opciones' },
  ];

  for (const q of toDeactivate) {
    const { error } = await supabase
      .from('questions')
      .update({
        is_active: false,
        topic_review_status: 'pending',
        verification_status: null,
        verified_at: null
      })
      .eq('id', q.id);

    if (error) console.error(`  Error ${q.id}:`, error);
    else console.log(`  ❌ Desactivada: ${q.reason} (${q.id})`);

    // Eliminar verificación existente
    await supabase
      .from('ai_verification_results')
      .delete()
      .eq('question_id', q.id);
  }

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log('\n========================================');
  console.log('RESUMEN DE ACTUALIZACIONES:');
  console.log('========================================');
  console.log(`  Falsos positivos → tech_perfect: ${falsosPositivos.length}`);
  console.log(`  Explicaciones corregidas: ${explanationFixes.length}`);
  console.log(`  Respuestas corregidas: ${answerFixes.length}`);
  console.log(`  Textos de pregunta corregidos: 2`);
  console.log(`  Preguntas desactivadas: ${toDeactivate.length}`);
  console.log(`  TOTAL procesadas: ${falsosPositivos.length + explanationFixes.length + answerFixes.length + 2 + toDeactivate.length}`);
  console.log('========================================');
}

main().catch(console.error);
