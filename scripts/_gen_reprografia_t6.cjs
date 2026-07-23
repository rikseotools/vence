// Batch T6 (ampliación) — "Reprografía y máquinas de oficina". 12 preguntas DRAFT NUEVAS
// (sin solapar con las 15 existentes). Correcta = cita literal del contenido. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const LAW_PREFIX = 'f98203f0';
const TAG = 'piloto_reprografia_ampliacion_t6';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '1', co: 2,
    q: '¿Qué es la reprografía?',
    o: ['La técnica de archivo y clasificación de documentos en soporte papel.',
        'El sistema de transmisión de documentos por vía telemática.',
        'El conjunto de técnicas que permiten reproducir, copiar o duplicar documentos e imágenes.',
        'El proceso de destrucción segura de documentación confidencial.'],
    cita: 'La reprografía es el conjunto de técnicas que permiten reproducir, copiar o duplicar documentos e imágenes.',
    why: 'La reprografía se define como el conjunto de técnicas para reproducir, copiar o duplicar documentos e imágenes.',
    bad: { A: 'El archivo y la clasificación no son la reprografía.', B: 'La transmisión telemática no define la reprografía.', D: 'La destrucción de documentos es otra tarea distinta.' } },
  { art: '1', co: 0,
    q: 'Las impresoras de impacto o matriciales forman los caracteres:',
    o: ['Golpeando una cinta entintada mediante una matriz de agujas.',
        'Proyectando diminutas gotas de tinta líquida sobre el papel.',
        'Fundiendo tóner sobre el papel mediante calor.',
        'Grabando la imagen con un haz láser sobre un tambor.'],
    cita: 'Impresoras de impacto o matriciales: forman los caracteres golpeando una cinta entintada mediante una matriz de agujas.',
    why: 'Las matriciales golpean una cinta entintada con una matriz de agujas.',
    bad: { B: 'Proyectar gotas de tinta líquida es propio de las de inyección.', C: 'Fundir tóner con calor es propio de las láser.', D: 'El haz láser sobre un tambor es propio de las impresoras láser.' } },
  { art: '1', co: 1,
    q: 'Las impresoras de inyección de tinta reproducen la imagen:',
    o: ['Golpeando una cinta entintada con agujas.',
        'Proyectando diminutas gotas de tinta líquida sobre el papel.',
        'Empleando tóner y el proceso xerográfico.',
        'Mediante un cabezal térmico que quema un papel especial.'],
    cita: 'Impresoras de inyección de tinta: proyectan diminutas gotas de tinta líquida sobre el papel.',
    why: 'Las de inyección proyectan diminutas gotas de tinta líquida sobre el papel.',
    bad: { A: 'Golpear una cinta con agujas es de las matriciales.', C: 'El tóner y el proceso xerográfico son de las láser.', D: 'El papel térmico no es el sistema de las de inyección.' } },
  { art: '1', co: 3,
    q: 'Un equipo multifunción (MFP) se caracteriza por:',
    o: ['Reproducir copias únicamente en color.',
        'Funcionar sin conexión a la red eléctrica.',
        'Imprimir exclusivamente en gran formato.',
        'Integrar en un solo aparato las funciones de impresora, fotocopiadora, escáner y, a menudo, fax.'],
    cita: 'Los equipos multifunción (MFP) integran en un solo aparato las funciones de impresora, fotocopiadora, escáner y, a menudo, fax.',
    why: 'El MFP integra impresora, fotocopiadora, escáner y frecuentemente fax en un único aparato.',
    bad: { A: 'No se limita a copias en color.', B: 'Requiere alimentación eléctrica.', C: 'No se limita al gran formato.' } },
  { art: '2', co: 1,
    q: 'En el proceso xerográfico, la fase de carga consiste en que:',
    o: ['El tóner se fija de forma permanente al papel mediante calor y presión.',
        'El tambor fotoconductor recibe una carga eléctrica uniforme en su superficie.',
        'El tóner pasa del tambor al papel.',
        'Se retira del tambor el tóner residual.'],
    cita: 'Carga: el tambor fotoconductor recibe una carga eléctrica uniforme en su superficie.',
    why: 'En la carga, el tambor fotoconductor recibe una carga eléctrica uniforme.',
    bad: { A: 'La fijación por calor y presión es la fusión.', C: 'El paso del tóner al papel es la transferencia.', D: 'Retirar el tóner residual es la limpieza.' } },
  { art: '2', co: 2,
    q: 'En el proceso xerográfico de fotocopiado, durante la fase de revelado:',
    o: ['El original se ilumina y su imagen se proyecta sobre el tambor.',
        'El papel sale ligeramente caliente al fijarse el tóner.',
        'El tóner, con carga de signo contrario, se adhiere a las zonas del tambor que conservan la carga.',
        'El tambor recibe una carga eléctrica uniforme.'],
    cita: 'Revelado: el tóner, con carga de signo contrario, se adhiere a las zonas del tambor que conservan la carga, haciendo visible la imagen.',
    why: 'En el revelado, el tóner (carga contraria) se adhiere a las zonas cargadas del tambor y hace visible la imagen.',
    bad: { A: 'Iluminar el original y proyectarlo es la exposición.', B: 'El papel caliente corresponde a la fusión.', D: 'La carga uniforme del tambor es la fase de carga.' } },
  { art: '2', co: 0,
    q: 'La función de una fotocopiadora que permite obtener copias por ambas caras del papel se denomina:',
    o: ['Dúplex.', 'Zoom.', 'Colación manual.', 'Escaneo OCR.'],
    cita: 'realizar copias a doble cara (dúplex) o clasificadas (con clasificador o finisher).',
    why: 'La copia a doble cara se denomina dúplex.',
    bad: { B: 'El zoom se relaciona con ampliar o reducir, no con la doble cara.', C: 'La colación/clasificación ordena juegos de copias, no es la doble cara.', D: 'El OCR es reconocimiento de texto en imágenes escaneadas.' } },
  { art: '4', co: 3,
    q: 'El tipo de escáner más habitual en la oficina, en el que el documento se coloca sobre un cristal y permanece inmóvil mientras un cabezal lo recorre, es el:',
    o: ['Escáner de mano.', 'Escáner de alimentación de hojas.', 'Escáner de rodillo.', 'Escáner plano o de sobremesa (de cama plana).'],
    cita: 'Escáner plano o de sobremesa (de cama plana): el documento se coloca sobre un cristal y permanece inmóvil mientras un cabezal lo recorre; es el más habitual en oficina.',
    why: 'El escáner plano o de cama plana es el más habitual en oficina.',
    bad: { A: 'El de mano se desplaza manualmente sobre el documento.', B: 'El de alimentación de hojas hace avanzar las hojas por el aparato.', C: 'El de rodillo también hace avanzar las hojas, no las mantiene inmóviles.' } },
  { art: '4', co: 1,
    q: '¿En cuál de los siguientes formatos suele guardarse un documento digitalizado con un escáner?',
    o: ['MP3.', 'PDF.', 'EXE.', 'XLSX.'],
    cita: 'Los documentos digitalizados suelen guardarse en formatos como PDF, JPG, TIFF o PNG.',
    why: 'Los documentos digitalizados se guardan en formatos de imagen/documento como PDF, JPG, TIFF o PNG.',
    bad: { A: 'MP3 es un formato de audio.', C: 'EXE es un archivo ejecutable.', D: 'XLSX es una hoja de cálculo, no un formato de digitalización de imagen.' } },
  { art: '5', co: 2,
    q: 'La máquina de oficina que dobla automáticamente las hojas de papel según distintos tipos de plegado, preparándolas para su envío, es la:',
    o: ['Ensobradora.', 'Encuadernadora.', 'Plegadora.', 'Guillotina.'],
    cita: 'La plegadora es la máquina que dobla automáticamente las hojas de papel según distintos tipos de plegado.',
    why: 'La plegadora dobla automáticamente las hojas según distintos tipos de plegado.',
    bad: { A: 'La ensobradora introduce los documentos en los sobres.', B: 'La encuadernadora une hojas sueltas en un documento.', D: 'La guillotina corta el papel de forma recta.' } },
  { art: '5', co: 0,
    q: 'La máquina que recubre los documentos con una lámina de plástico para protegerlos es la:',
    o: ['Plastificadora.', 'Ensobradora.', 'Plegadora.', 'Encuadernadora.'],
    cita: 'Se consideran máquinas análogas de acabado la plastificadora, que recubre los documentos con una lámina de plástico para protegerlos.',
    why: 'La plastificadora recubre los documentos con una lámina de plástico.',
    bad: { B: 'La ensobradora mete los documentos en sobres.', C: 'La plegadora dobla las hojas.', D: 'La encuadernadora une hojas sueltas.' } },
  { art: '6', co: 3,
    q: 'Según las nociones de mantenimiento de estos equipos, los cartuchos de tóner agotados:',
    o: ['Deben recargarse siempre de forma manual por el propio personal.',
        'Pueden desecharse con la basura orgánica ordinaria.',
        'Han de vaciarse y limpiarse para reutilizar el polvo restante.',
        'No deben manipularse ni recargarse de forma improvisada, sino sustituirse y gestionarse como residuo para su reciclaje.'],
    cita: 'los cartuchos agotados no deben manipularse ni recargarse de forma improvisada, sino sustituirse y gestionarse como residuo para su reciclaje.',
    why: 'Los cartuchos de tóner agotados se sustituyen y se gestionan como residuo para reciclaje, sin manipularlos de forma improvisada.',
    bad: { A: 'No deben recargarse de forma improvisada.', B: 'No se desechan con la basura orgánica: son residuo a reciclar.', C: 'No se vacían para reutilizar el polvo.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Reprografía y máquinas de oficina** (nociones para personal subalterno)\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const lawId = (await c.query("SELECT id FROM laws WHERE id::text LIKE $1", [LAW_PREFIX + '%'])).rows[0].id;
    const arts = await c.query('SELECT id, article_number FROM articles WHERE law_id=$1', [lawId]);
    const idByNum = Object.fromEntries(arts.rows.map(a => [String(a.article_number), a.id]));
    const dist = [0, 0, 0, 0]; Q.forEach(q => dist[q.co]++);
    console.log('Distribución correct_option:', dist.map((n, i) => L[i] + ':' + n).join(' '), '(total ' + Q.length + ')');
    for (const item of Q) {
      if (!idByNum[item.art]) throw new Error('Falta art ' + item.art);
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
           difficulty, question_type, primary_article_id, tags, lifecycle_state, deactivation_reason, topic_review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'easy','single',$8,$9,'draft','Pendiente de revisión post-generación IA','pending')`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.co, buildExplanation(item), idByNum[item.art], ['ia_generada', TAG]]);
    }
    console.log('✅ Insertadas', Q.length, 'preguntas DRAFT con tag', TAG);
  } catch (e) { console.error('❌ error:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
