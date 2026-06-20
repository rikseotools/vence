// Batch IA T211 (documentación) Administrativo C1 Asturias: 27 preguntas sobre los
// 3 decretos asturianos del epígrafe. batch=ia_t211_decretos_ast. Inserta DRAFT.
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const L = ['A', 'B', 'C', 'D']
const LAW = { ARCH: '9cddff64-cc12-4f4f-9e32-63b717b3f839', ATEN: '0eea72d8-0b12-4eaf-a4f9-42df4bb9cc79', TELE: '49f24880-6681-4cfe-96b6-a491e7158a1f' }
const BATCH = 'ia_t211_decretos_ast'

function expl(cite, co, quote, reason, dist) {
  let e = `> **${cite}**\n> "${quote}"\n\n**Por qué ${L[co]} es correcta:** ${reason}\n\n**Por qué las demás son incorrectas:**\n`
  let di = 0
  for (let i = 0; i < 4; i++) { if (i === co) continue; e += `- **${L[i]})** ${dist[di].why}\n`; di++ }
  return e.trim()
}
function build(lawKey, artNum, cite, q, correct, qr, dist, co) {
  const opts = new Array(4); opts[co] = correct
  let di = 0
  for (let i = 0; i < 4; i++) { if (i === co) continue; opts[i] = dist[di].text; di++ }
  return { lawKey, artNum: String(artNum), cite, question_text: q, option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3], correct_option: co, explanation: expl(cite, co, qr.quote, qr.reason, dist) }
}

const Q = [
  // ===== D 21/1996 Archivos =====
  build('ARCH', 1, 'Art. 1 Decreto 21/1996', 'Según el artículo 1 del Decreto 21/1996, el Decreto establece...',
    'el sistema de archivos administrativos del Principado de Asturias y las normas generales de su organización y funcionamiento.',
    { quote: 'El presente Decreto establece el sistema de archivos administrativos del Principado de Asturias y las normas generales de su organización y funcionamiento.', reason: 'El objeto del Decreto es el sistema de archivos administrativos y sus normas de organización y funcionamiento.' },
    [{ text: 'el régimen jurídico del patrimonio documental y bibliográfico del Principado de Asturias y su difusión cultural.', why: 'El Decreto regula el sistema de archivos administrativos, no el patrimonio bibliográfico ni su difusión.' },
     { text: 'la organización del Archivo Histórico de Asturias y las normas de acceso a sus fondos documentales históricos.', why: 'No regula el Archivo Histórico, sino el sistema de archivos administrativos.' },
     { text: 'el procedimiento de expurgo y eliminación de los documentos administrativos del Principado de Asturias.', why: 'El expurgo es una materia concreta del Decreto, no su objeto general.' }], 0),
  build('ARCH', 4, 'Art. 4.1 Decreto 21/1996', 'Conforme al artículo 4.1 del Decreto 21/1996, ¿qué se entiende por documento?',
    'Toda expresión del lenguaje oral o escrito, natural o codificado, y cualquier otra expresión gráfica, sonora o en imágenes, recogidas en cualquier tipo de soporte material, incluidos los mecánicos o magnéticos.',
    { quote: 'Se entiende por documento toda expresión del lenguaje oral o escrito, natural o codificado y cualquier otra expresión gráfica, sonora o en imágenes, recogidas en cualquier tipo de soporte material, incluidos los mecánicos o magnéticos.', reason: 'La definición abarca cualquier expresión del lenguaje y cualquier soporte material, incluidos mecánicos o magnéticos.' },
    [{ text: 'Toda expresión del lenguaje escrito o gráfico recogida exclusivamente en soporte papel o documental, con exclusión expresa de los soportes mecánicos, magnéticos o informáticos.', why: 'El artículo incluye cualquier soporte material, incluidos los mecánicos o magnéticos, no solo el papel.' },
     { text: 'Toda información estructurada en soporte electrónico susceptible de ser cargada, almacenada, editada o intercambiada entre sistemas informáticos como una unidad diferenciada.', why: 'Esa es la definición de documento electrónico de otra norma, no la del artículo 4.1.' },
     { text: 'Todo expediente administrativo finalizado y conservado en los archivos de gestión de las oficinas productoras hasta su transferencia al archivo central respectivo.', why: 'El concepto de documento no se limita a expedientes finalizados ni a su ubicación.' }], 2),
  build('ARCH', 5, 'Art. 5.1 Decreto 21/1996', 'Según el artículo 5.1 del Decreto 21/1996, el sistema de archivos administrativos del Principado de Asturias está integrado por...',
    'los archivos de gestión o de oficina, los archivos centrales de las respectivas Consejerías, Organismos Autónomos o Entes Públicos y el Archivo General.',
    { quote: 'El sistema de archivos administrativos del Principado de Asturias está integrado por los archivos de gestión o de oficina, los archivos centrales de las respectivas Consejerías, Organismos Autónomos o Entes Públicos, en su caso, y el Archivo General.', reason: 'Lo integran los archivos de gestión, los centrales y el Archivo General.' },
    [{ text: 'los archivos de gestión, los archivos centrales de cada Consejería y el Archivo Histórico de Asturias como cabecera del sistema.', why: 'La cabecera del sistema es el Archivo General, no el Archivo Histórico.' },
     { text: 'los archivos de oficina, el Archivo General y el Archivo Histórico de Asturias, bajo la dirección de la Consejería de Cultura.', why: 'El Archivo Histórico no integra el sistema de archivos administrativos del artículo 5.1.' },
     { text: 'los archivos centrales de las Consejerías y el Archivo General, sin incluir los archivos de gestión de las oficinas.', why: 'Los archivos de gestión o de oficina sí forman parte del sistema.' }], 1),
  build('ARCH', 7, 'Art. 7.1 Decreto 21/1996', 'Conforme al artículo 7.1 del Decreto 21/1996, el Archivo General actuará como...',
    'cabecera del sistema, estableciendo las normas técnicas y operativas de todos los archivos incluidos en la red de archivos administrativos.',
    { quote: 'El Archivo General actuará como cabecera del sistema, estableciendo las normas técnicas y operativas de todos los archivos incluidos en la red de archivos administrativos de la Administración del Principado de Asturias.', reason: 'Es la cabecera del sistema y fija las normas técnicas y operativas de todos los archivos.' },
    [{ text: 'archivo intermedio de la documentación inactiva con valor histórico, bajo la dirección de la Consejería de Cultura.', why: 'El Archivo General custodia documentación semiactiva, no la inactiva con valor histórico (esa va al Archivo Histórico).' },
     { text: 'órgano consultivo en materia de valoración y selección de los documentos administrativos del Principado de Asturias.', why: 'La valoración y selección corresponde a la Comisión de Calificación y Valoración, no define al Archivo General.' },
     { text: 'archivo de gestión de la documentación activa de las oficinas productoras hasta su transferencia a los archivos centrales.', why: 'La documentación activa la custodian los archivos de gestión, no el Archivo General.' }], 3),
  build('ARCH', 9, 'Art. 9.4 Decreto 21/1996', 'Según el artículo 9.4 del Decreto 21/1996, la documentación depositada en los archivos centrales será transferida al Archivo General al cumplirse...',
    'los quince años de su ingreso en los mismos.',
    { quote: 'La documentación depositada en los archivos centrales será transferida al Archivo General al cumplirse los quince años de su ingreso en los mismos.', reason: 'El plazo de transferencia al Archivo General es de quince años desde el ingreso en el archivo central.' },
    [{ text: 'los cinco años de su ingreso en los mismos.', why: 'El plazo legal es de quince años, no de cinco.' },
     { text: 'los treinta años de su ingreso en los mismos.', why: 'El plazo es de quince años, no de treinta.' },
     { text: 'los diez años desde la finalización del procedimiento.', why: 'El cómputo es desde el ingreso en el archivo central y el plazo es de quince años.' }], 0),
  build('ARCH', 10, 'Art. 10.2 Decreto 21/1996', 'El artículo 10.2 del Decreto 21/1996 reconoce a todos los ciudadanos el derecho a...',
    'la consulta libre y gratuita de los documentos depositados en el Archivo General de la Administración del Principado de Asturias.',
    { quote: 'Todos los ciudadanos tienen derecho a la consulta libre y gratuita de los documentos depositados en el Archivo General de la Administración del Principado de Asturias...', reason: 'El derecho reconocido es el de consulta libre y gratuita de los documentos del Archivo General.' },
    [{ text: 'la consulta gratuita de los documentos del Archivo General, previa acreditación de un interés legítimo y directo en su contenido.', why: 'La consulta es libre; no se exige acreditar un interés legítimo y directo.' },
     { text: 'la obtención de copias auténticas de cualquier documento del Archivo General sin necesidad de autorización ni pago de exacciones.', why: 'La obtención de copias requiere autorización y, en su caso, el pago de las exacciones establecidas.' },
     { text: 'el acceso libre a la documentación semiactiva custodiada en los archivos de gestión de las oficinas productoras.', why: 'El derecho del artículo 10.2 se refiere a los documentos del Archivo General, no a los archivos de gestión.' }], 2),
  build('ARCH', 11, 'Art. 11.2 Decreto 21/1996', 'Conforme al artículo 11.2 del Decreto 21/1996, en ningún caso se podrán destruir documentos mientras...',
    'subsista su valor probatorio de derechos y obligaciones de las personas o de los entes públicos.',
    { quote: 'En ningún caso se podrán destruir documentos mientras subsista su valor probatorio de derechos y obligaciones de las personas o de los entes públicos.', reason: 'La prohibición de destrucción opera mientras subsista el valor probatorio de derechos y obligaciones.' },
    [{ text: 'no haya transcurrido el plazo de treinta años desde la finalización del procedimiento del que traen causa.', why: 'El criterio es el valor probatorio, no un plazo fijo de treinta años.' },
     { text: 'no lo autorice expresamente el Archivo Histórico de Asturias previo informe de la Consejería de Cultura.', why: 'La eliminación la dispone la Comisión de Calificación y Valoración, no el Archivo Histórico.' },
     { text: 'conserven valor histórico o cultural para la investigación, aunque hayan perdido su utilidad administrativa.', why: 'El artículo 11.2 se refiere al valor probatorio, no al histórico o cultural.' }], 1),
  build('ARCH', 13, 'Art. 13.2 Decreto 21/1996', 'Según el artículo 13.2 del Decreto 21/1996, la Presidencia de la Comisión de Calificación y Valoración de documentos administrativos corresponde a...',
    'el Secretario General Técnico de la Consejería de Cooperación.',
    { quote: 'Presidente: El Secretario General Técnico de la Consejería de Cooperación.', reason: 'La Presidencia recae en el Secretario General Técnico de la Consejería de Cooperación.' },
    [{ text: 'el Jefe del Archivo General de la Administración del Principado de Asturias.', why: 'El Jefe del Archivo General es vocal, no Presidente de la Comisión.' },
     { text: 'un técnico en archivos en representación de la Consejería de Cultura.', why: 'Ese técnico es vocal de la Comisión, no su Presidente.' },
     { text: 'el Consejero competente en materia de patrimonio documental.', why: 'La Presidencia corresponde al Secretario General Técnico de Cooperación, no al Consejero.' }], 3),
  build('ARCH', 8, 'Art. 8.2 Decreto 21/1996', 'Según el artículo 8.2 del Decreto 21/1996, los archivos centrales de las Consejerías, Organismos y Entes desarrollan en su ámbito las funciones del Archivo General referidas en...',
    'los epígrafes a), b), c), d) y e) del apartado anterior.',
    { quote: 'Los archivos centrales de las distintas Consejerías, Organismos y Entes desarrollarán en su ámbito respectivo las funciones del Archivo General referidas en los epígrafes a), b), c), d) y e) del apartado anterior.', reason: 'Los archivos centrales asumen solo las funciones de los epígrafes a) a e).' },
    [{ text: 'todos los epígrafes del apartado anterior, salvo la elaboración de la memoria anual de actividades.', why: 'Asumen únicamente los epígrafes a) a e), no todos salvo uno.' },
     { text: 'los epígrafes a) a j) del apartado anterior, en idénticos términos que el Archivo Central.', why: 'No asumen los epígrafes f) a j), reservados al Archivo Central.' },
     { text: 'los epígrafes f) a j) del apartado anterior, relativos al control y la dirección funcional.', why: 'Asumen los epígrafes a) a e), no los f) a j).' }], 0),

  // ===== D 89/2017 Atención Ciudadana (Tít II) =====
  build('ATEN', 13, 'Art. 13.1 Decreto 89/2017', 'Según el artículo 13.1 del Decreto 89/2017, son oficinas de asistencia en materia de registros de la Administración del Principado de Asturias...',
    'la Oficina Central, la oficina general de asistencia en materia de registros de cada Consejería y las oficinas auxiliares de cada Consejería.',
    { quote: 'Son oficinas de asistencia en materia de registros (...): a) La Oficina Central (...). b) La oficina general de asistencia en materia de registros de cada Consejería. c) Las oficinas auxiliares de asistencia en materia de registros de cada Consejería.', reason: 'El artículo enumera tres tipos: Oficina Central, oficina general de cada Consejería y oficinas auxiliares.' },
    [{ text: 'la Oficina Central, las oficinas generales de cada Consejería y las oficinas de los ayuntamientos adheridos por convenio.', why: 'El artículo no incluye oficinas de ayuntamientos, sino las auxiliares de cada Consejería.' },
     { text: 'la oficina general de cada Consejería y las oficinas auxiliares, sin que exista una oficina central de coordinación.', why: 'Sí existe la Oficina Central, que el artículo enumera en primer lugar.' },
     { text: 'la Oficina Central y las oficinas auxiliares de cada Consejería, integradas en la sede electrónica del Principado.', why: 'Falta la oficina general de cada Consejería, que también es de asistencia en materia de registros.' }], 1),
  build('ATEN', 14, 'Art. 14.1 Decreto 89/2017', 'Conforme al artículo 14.1 del Decreto 89/2017, la Oficina Central de asistencia en materia de registros, además de sus funciones propias...',
    'coordina las oficinas generales y auxiliares de asistencia en materia de registros, bajo la dependencia de la Consejería competente en materia de coordinación de registros.',
    { quote: 'La Oficina Central (...) desarrolla las funciones propias de las oficinas de asistencia en materia de registros y coordina las oficinas generales y auxiliares de asistencia en materia de registros bajo la dependencia de la Consejería competente en materia de coordinación de registros administrativos...', reason: 'Coordina las oficinas generales y auxiliares, bajo la Consejería competente en coordinación de registros.' },
    [{ text: 'supervisa los registros telemáticos de los organismos y entes públicos pertenecientes al sector público autonómico del Principado de Asturias.', why: 'Su función es coordinar las oficinas de registro, no supervisar los registros telemáticos.' },
     { text: 'resuelve los recursos administrativos interpuestos contra las anotaciones registrales practicadas por las oficinas generales y auxiliares de registro.', why: 'La Oficina Central coordina; no resuelve recursos contra asientos registrales.' },
     { text: 'gestiona la sede electrónica del Principado y mantiene actualizada la relación de modelos normalizados de solicitudes, escritos y comunicaciones.', why: 'Esas competencias corresponden a otras Consejerías, no definen a la Oficina Central.' }], 3),
  build('ATEN', 15, 'Art. 15.1 Decreto 89/2017', 'Según el artículo 15.1 del Decreto 89/2017, la oficina general de asistencia en materia de registros existente en cada Consejería será gestionada por...',
    'la Secretaría General Técnica.',
    { quote: 'En cada Consejería existirá una oficina general de asistencia en materia de registros que será gestionada por la Secretaría General Técnica.', reason: 'La gestión de la oficina general corresponde a la Secretaría General Técnica de cada Consejería.' },
    [{ text: 'la Oficina Central de asistencia en materia de registros.', why: 'La Oficina Central coordina, pero la oficina general la gestiona la Secretaría General Técnica.' },
     { text: 'la Consejería competente en materia de coordinación de registros.', why: 'La gestión recae en la Secretaría General Técnica de la propia Consejería.' },
     { text: 'el órgano competente para la tramitación de cada procedimiento.', why: 'No es el órgano tramitador, sino la Secretaría General Técnica.' }], 0),
  build('ATEN', 16, 'Art. 16.a Decreto 89/2017', 'Entre las funciones de las oficinas de asistencia en materia de registros, el artículo 16.a) del Decreto 89/2017 incluye la recepción y digitalización de solicitudes, escritos y comunicaciones...',
    'devolviéndose los originales al interesado, salvo los supuestos en que la norma determine su custodia por la Administración o la presentación en soporte específico no digitalizable.',
    { quote: 'La recepción y digitalización de las solicitudes, escritos y comunicaciones (...) devolviéndose los originales al interesado, sin perjuicio de aquellos supuestos en que la norma determine la custodia por la Administración de los documentos presentados o resulte obligatoria la presentación de objetos o de documentos en un soporte específico no susceptibles de digitalización.', reason: 'Tras digitalizar, los originales se devuelven al interesado, salvo custodia obligatoria o soporte no digitalizable.' },
    [{ text: 'conservando los originales en la oficina de asistencia en materia de registros durante un plazo mínimo de cinco años a disposición del interesado.', why: 'Los originales se devuelven al interesado, no se conservan cinco años.' },
     { text: 'remitiendo los originales al órgano competente para la tramitación del procedimiento junto con la copia digitalizada de cada uno de los documentos.', why: 'Lo que se remite es la copia digitalizada; los originales se devuelven al interesado.' },
     { text: 'destruyendo los originales una vez digitalizados e incorporados al expediente, salvo que el interesado solicite expresamente su devolución.', why: 'No se destruyen: se devuelven al interesado con carácter general.' }], 2),
  build('ATEN', 17, 'Art. 17.1 Decreto 89/2017', 'Según el artículo 17.1 del Decreto 89/2017, deben registrarse de entrada las solicitudes, escritos y comunicaciones presentados, siempre que...',
    'estén claramente identificados el interesado y el órgano o unidad al que se dirigen, y la solicitud, escrito o comunicación presentada sea original.',
    { quote: '...siempre que estén claramente identificados tanto el interesado como el órgano o unidad administrativa al que se dirigen y la solicitud, escrito o comunicación presentada sea original.', reason: 'Se exige identificación clara del interesado y del órgano destinatario, y que el documento sea original.' },
    [{ text: 'se presenten en los modelos normalizados aprobados y vayan acompañados de la documentación exigida en la convocatoria.', why: 'El artículo 17.1 no condiciona el registro al uso de modelos normalizados.' },
     { text: 'se acompañen de la traducción oficial al castellano cuando estén redactados en una lengua extranjera o cooficial.', why: 'Eso afecta a qué NO se registra (art. 17.3), no a la condición general del 17.1.' },
     { text: 'el interesado disponga de un sistema de firma electrónica reconocida admitido por la sede electrónica del Principado.', why: 'El 17.1 no exige firma electrónica reconocida como condición del registro de entrada.' }], 1),
  build('ATEN', 17, 'Art. 17.3 Decreto 89/2017', 'Conforme al artículo 17.3 del Decreto 89/2017, NO serán objeto de registro, de entrada o salida...',
    'las solicitudes, escritos y comunicaciones redactados en lenguas extranjeras, salvo que se acompañen de traducción.',
    { quote: 'No serán objeto de registro, de entrada o salida: a) Las solicitudes, escritos y comunicaciones redactados en lenguas extranjeras, salvo que se acompañen de traducción...', reason: 'No se registran los escritos en lenguas extranjeras salvo que se acompañe traducción.' },
    [{ text: 'las solicitudes, escritos y comunicaciones presentados fuera del horario de atención al público de la oficina.', why: 'El horario no es causa de exclusión del registro en el artículo 17.3.' },
     { text: 'los escritos y comunicaciones oficiales que se dirijan a otros órganos administrativos o a particulares.', why: 'Esos sí pueden registrarse de salida (art. 17.2).' },
     { text: 'las solicitudes presentadas por personas que no se hallen identificadas mediante firma electrónica reconocida.', why: 'La falta de firma electrónica no figura entre los supuestos del artículo 17.3.' }], 3),
  build('ATEN', 18, 'Art. 18.2 Decreto 89/2017', 'Según el artículo 18.2 del Decreto 89/2017, los modelos normalizados estarán disponibles...',
    'en la sede electrónica y en las oficinas de asistencia en materia de registros de la Administración del Principado de Asturias.',
    { quote: 'Los modelos normalizados estarán disponibles en la sede electrónica y en las oficinas de asistencia en materia de registros de la Administración del Principado de Asturias...', reason: 'Están disponibles tanto en la sede electrónica como en las oficinas de asistencia en materia de registros.' },
    [{ text: 'exclusivamente en las oficinas de asistencia en materia de registros, en soporte papel, a disposición de los solicitantes.', why: 'También están en la sede electrónica, no solo en las oficinas.' },
     { text: 'en el Boletín Oficial del Principado de Asturias, donde se publicarán junto con sus instrucciones de cumplimentación.', why: 'El artículo cita la sede electrónica y las oficinas, no el BOPA.' },
     { text: 'en el portal corporativo de cada Consejería, que los mantendrá actualizados conforme a sus procedimientos propios.', why: 'El lugar de disponibilidad es la sede electrónica y las oficinas de registro.' }], 0),
  build('ATEN', 19, 'Art. 19.1 Decreto 89/2017', 'Según el artículo 19.1 del Decreto 89/2017, ¿quién tiene competencia para expedir copias auténticas respecto de la documentación presentada por los ciudadanos para su registro?',
    'Las oficinas de asistencia en materia de registros.',
    { quote: 'Tendrán competencia para la expedición de copias auténticas (...): a) Las oficinas de asistencia en materia de registros respecto de la documentación presentada por los ciudadanos para su registro.', reason: 'Respecto de la documentación presentada para su registro, la competencia es de las oficinas de asistencia en materia de registros.' },
    [{ text: 'Las unidades de digitalización de la Consejería de Cultura.', why: 'Las unidades de digitalización se crean en las Consejerías por resolución, no son competentes en este supuesto concreto.' },
     { text: 'El Archivo General de la Administración del Principado.', why: 'El Archivo General no figura entre los órganos competentes del artículo 19.1.' },
     { text: 'Exclusivamente los órganos que hayan emitido el documento.', why: 'Ese supuesto es para documentos públicos administrativos (otra letra), no para la documentación presentada para registro.' }], 2),
  build('ATEN', 16, 'Art. 16 Decreto 89/2017', '¿Cuál de las siguientes es una función de las oficinas de asistencia en materia de registros conforme al artículo 16 del Decreto 89/2017?',
    'La recepción y digitalización de las solicitudes, escritos y comunicaciones dirigidos a cualquier órgano administrativo, Organismo público o Entidad vinculado o dependiente.',
    { quote: 'Las oficinas de asistencia en materia de registros desarrollarán (...): a) La recepción y digitalización de las solicitudes, escritos y comunicaciones, así como de los documentos que las acompañen, dirigidos a cualquier órgano administrativo, Organismo público o Entidad vinculado o dependiente a éstos...', reason: 'La recepción y digitalización es función propia de estas oficinas (art. 16.a).' },
    [{ text: 'La resolución de los procedimientos administrativos iniciados mediante las solicitudes y escritos presentados en el registro electrónico.', why: 'Las oficinas registran y asisten, no resuelven los procedimientos.' },
     { text: 'La valoración y selección de los documentos administrativos presentados para determinar su conservación, transferencia o eliminación.', why: 'Esa función corresponde a los archivos (Comisión de Valoración), no a las oficinas de registro.' },
     { text: 'La custodia definitiva de los documentos originales presentados por los ciudadanos durante un plazo mínimo de quince años en la oficina.', why: 'Los originales se devuelven al interesado; no hay custodia definitiva de quince años.' }], 1),

  // ===== D 111/2005 Registro Telemático =====
  build('TELE', 1, 'Art. 1 Decreto 111/2005', 'Según el artículo 1 del Decreto 111/2005, es objeto del Decreto...',
    'la regulación del servicio de registro telemático, la creación del Registro Telemático del Principado de Asturias y el establecimiento de los requisitos para la creación de otros registros telemáticos.',
    { quote: 'Es objeto del presente Decreto la regulación del servicio de registro telemático, la creación del Registro Telemático del Principado de Asturias, así como el establecimiento de los requisitos necesarios para la creación de otros registros telemáticos.', reason: 'El objeto abarca regular el servicio, crear el Registro Telemático del Principado y fijar requisitos para crear otros.' },
    [{ text: 'la regulación de la sede electrónica del Principado de Asturias y el establecimiento de los sistemas de identificación y firma electrónica admitidos a los ciudadanos.', why: 'El objeto es el registro telemático, no la sede electrónica ni los sistemas de firma.' },
     { text: 'la creación del Archivo Electrónico Único del Principado de Asturias y la regulación de la conservación y custodia de los documentos electrónicos del sector público.', why: 'No regula un archivo electrónico único, sino el registro telemático.' },
     { text: 'la regulación del expediente administrativo electrónico y de la digitalización de los documentos presentados por los ciudadanos en las oficinas de registro.', why: 'El objeto es el servicio de registro telemático, no el expediente electrónico.' }], 3),
  build('TELE', 5, 'Art. 5.1 Decreto 111/2005', 'Conforme al artículo 5.1 del Decreto 111/2005, la presentación en el registro telemático tendrá...',
    'carácter voluntario para las personas interesadas, siendo alternativa a la utilización de los demás medios, salvo que una norma con rango de ley establezca otra cosa.',
    { quote: 'La presentación en el registro telemático tendrá carácter voluntario para las personas interesadas, siendo alternativa a la utilización de los medios señalados en el apartado 4 del artículo 38 de la Ley 30/1992 (...), salvo que una norma con rango de ley establezca otra cosa.', reason: 'Es voluntaria y alternativa a los demás medios, salvo que una ley disponga otra cosa.' },
    [{ text: 'carácter obligatorio para las personas jurídicas y voluntario para las personas físicas interesadas, conforme a la legislación básica estatal.', why: 'El artículo 5.1 declara la presentación voluntaria, sin distinguir personas físicas y jurídicas.' },
     { text: 'carácter preferente frente a los demás medios de presentación admitidos, que solo se admitirán de forma subsidiaria o con carácter excepcional.', why: 'Es alternativa a los demás medios, no preferente.' },
     { text: 'carácter voluntario, pero exclusivo para los trámites que la norma reguladora del registro declare de tramitación electrónica obligatoria.', why: 'La voluntariedad es general; no se limita a trámites de tramitación electrónica obligatoria.' }], 0),
  build('TELE', 6, 'Art. 6.1 Decreto 111/2005', 'Según el artículo 6.1 del Decreto 111/2005, la presentación de solicitudes en el registro telemático se podrá realizar...',
    'todos los días del año durante las veinticuatro horas, rigiéndose por la fecha y hora oficial española correspondiente a la Península Ibérica.',
    { quote: 'La presentación de solicitudes, escritos y comunicaciones en registro telemático se podrá realizar todos los días del año durante las veinticuatro horas. El registro telemático se regirá por la fecha y hora oficial española correspondiente a la Península Ibérica.', reason: 'Disponible 24 horas todos los días, con la hora oficial peninsular como referencia.' },
    [{ text: 'todos los días hábiles durante el horario de atención al público de las oficinas de asistencia en materia de registros.', why: 'Funciona todos los días del año y las 24 horas, no solo en días y horario hábiles.' },
     { text: 'de lunes a viernes durante las veinticuatro horas, salvo los días declarados inhábiles en el calendario de la Administración.', why: 'Está disponible todos los días del año, incluidos fines de semana e inhábiles.' },
     { text: 'todos los días del año durante las veinticuatro horas, rigiéndose por la hora oficial del lugar de residencia del interesado.', why: 'La referencia es la hora oficial peninsular, no la del lugar de residencia.' }], 2),
  build('TELE', 9, 'Art. 9.b Decreto 111/2005', 'A efectos del cómputo de plazos, el artículo 9.b) del Decreto 111/2005 establece que la presentación realizada en un día inhábil se entenderá recibida...',
    'a primera hora del primer día hábil siguiente.',
    { quote: 'La presentación realizada en un día inhábil se entenderá recibida a primera hora del primer día hábil siguiente.', reason: 'La presentación en día inhábil se entiende recibida a primera hora del primer día hábil siguiente.' },
    [{ text: 'en la fecha y hora en que efectivamente se produjo la presentación.', why: 'Esa es la fecha de presentación que se inscribe, pero la de recepción se traslada al primer día hábil.' },
     { text: 'a última hora del mismo día inhábil en que se realizó la presentación.', why: 'Se entiende recibida el primer día hábil siguiente, no el mismo día inhábil.' },
     { text: 'a primera hora del día natural siguiente al de la presentación.', why: 'Es el primer día hábil siguiente, no el día natural siguiente.' }], 1),
  build('TELE', 10, 'Art. 10.2 Decreto 111/2005', 'Según el artículo 10.2 del Decreto 111/2005, las solicitudes relativas a servicios, trámites o procedimientos no recogidos expresamente en la norma reguladora del Registro Telemático...',
    'se tendrán por no presentados y se archivarán, comunicándolo así al remitente.',
    { quote: 'Se tendrán por no presentados las solicitudes, escritos y comunicaciones relativos a servicios, trámites o procedimientos que no estén expresamente recogidos en la norma reguladora del Registro Telemático; en estos casos se archivarán, teniéndolas por no presentadas, comunicándolo así al remitente.', reason: 'Se tienen por no presentados, se archivan y se comunica al remitente.' },
    [{ text: 'se remitirán de oficio al órgano competente para su tramitación por el medio que corresponda.', why: 'No se remiten de oficio: se tienen por no presentados y se archivan.' },
     { text: 'se admitirán a trámite, requiriéndose al interesado para que subsane la presentación en el plazo de diez días.', why: 'No se admiten a trámite ni hay subsanación: se tienen por no presentados.' },
     { text: 'se inadmitirán mediante resolución motivada susceptible de recurso ante el órgano superior jerárquico.', why: 'El artículo prevé tenerlos por no presentados y archivarlos, no una resolución de inadmisión recurrible.' }], 3),
  build('TELE', 11, 'Art. 11.2 Decreto 111/2005', 'Conforme al artículo 11.2 del Decreto 111/2005, en cada asiento del registro telemático constará, entre otros datos...',
    'un número correlativo de asiento, la fecha y hora de presentación, la fecha y hora de recepción o de remisión y los datos identificativos de la persona remitente y del destinatario.',
    { quote: 'Los asientos quedarán ordenados cronológicamente, constando en cada uno de ellos, un número correlativo de asiento, la fecha y hora de presentación, la fecha y hora de recepción o de remisión, los datos identificativos de la persona remitente y los datos identificativos del destinatario/a...', reason: 'El asiento recoge número correlativo, fechas y horas de presentación y de recepción/remisión, y datos de remitente y destinatario.' },
    [{ text: 'el número de expediente administrativo, el órgano competente para resolver y el plazo máximo de resolución y el sentido del silencio del procedimiento.', why: 'El asiento no recoge el número de expediente ni el plazo de resolución, sino los datos registrales.' },
     { text: 'el sistema de firma electrónica empleado, la dirección IP del equipo remitente y el resultado de la verificación de la validez de la firma.', why: 'El artículo 11.2 no enumera la IP ni el resultado de verificación de firma como contenido del asiento.' },
     { text: 'un código seguro de verificación del asiento, la huella digital del documento presentado y la identidad del funcionario que lo practica.', why: 'Esos elementos no figuran en el contenido del asiento del artículo 11.2.' }], 0),
  build('TELE', 8, 'Art. 8.1 Decreto 111/2005', 'Según el artículo 8.1 del Decreto 111/2005, el registro telemático recibirá las solicitudes presentadas siempre que, entre otras condiciones...',
    'se refieran a trámites, servicios o procedimientos recogidos en la norma reguladora del registro.',
    { quote: 'El registro telemático recibirá las solicitudes, escritos y comunicaciones que le sean presentados siempre que se cumplan las siguientes condiciones: a) Que las solicitudes, escritos y comunicaciones se refieran a trámites, servicios o procedimientos recogidos en la norma reguladora del registro.', reason: 'Una condición es que se refieran a trámites recogidos en la norma reguladora del registro.' },
    [{ text: 'se presenten dentro del horario de atención al público fijado para las oficinas de registro presencial.', why: 'El registro telemático funciona 24 horas; no se condiciona al horario presencial.' },
     { text: 'vayan acompañadas de la traducción al castellano cuando estén redactadas en una lengua extranjera.', why: 'Esa no es una de las condiciones del artículo 8.1.' },
     { text: 'se dirijan a órganos de la Administración del Principado con competencia resolutoria sobre la materia.', why: 'La condición es referirse a trámites recogidos en la norma reguladora, no la competencia resolutoria del órgano.' }], 2),
  build('TELE', 15, 'Art. 15.1 Decreto 111/2005', 'Según el artículo 15.1 del Decreto 111/2005, el Registro Telemático del Principado de Asturias se adscribe a...',
    'la Consejería competente en materia de coordinación de registros de entrada y salida de documentos.',
    { quote: 'Se crea el Registro Telemático del Principado de Asturias, que se adscribe a la Consejería competente en materia de coordinación de registros de entrada y salida de documentos.', reason: 'Se adscribe a la Consejería competente en coordinación de registros de entrada y salida de documentos.' },
    [{ text: 'la Consejería competente en materia de definición e implantación de políticas de seguridad informática.', why: 'Esa Consejería es la responsable de la seguridad (art. 17), no la de adscripción del registro.' },
     { text: 'la Secretaría General Técnica de cada Consejería en el ámbito de sus respectivos procedimientos.', why: 'El Registro se adscribe a una Consejería concreta, no a cada Secretaría General Técnica.' },
     { text: 'el órgano competente para la resolución de los trámites o procedimientos de que se trate en cada caso.', why: 'La adscripción es a la Consejería competente en coordinación de registros, no al órgano resolutor.' }], 1),
  build('TELE', 20, 'Art. 20.2 Decreto 111/2005', 'Conforme al artículo 20.2 del Decreto 111/2005, la creación de otros registros telemáticos se acordará por el titular de la Consejería, organismo o ente público competente...',
    'previo informe favorable de la Consejería competente en materia de coordinación de registros de entrada y salida de documentos.',
    { quote: 'La creación de estos registros se acordará por el titular de la Consejería, organismo o ente público competente para la resolución de los trámites o procedimientos de que se trate, previo informe favorable de la Consejería competente en materia de coordinación de registros de entrada y salida de documentos.', reason: 'Se exige informe favorable previo de la Consejería competente en coordinación de registros.' },
    [{ text: 'previa autorización del Consejo de Gobierno del Principado de Asturias a propuesta de la Consejería competente.', why: 'No se exige autorización del Consejo de Gobierno, sino informe favorable de la Consejería competente.' },
     { text: 'previo informe preceptivo y vinculante del órgano responsable de la seguridad de los sistemas informáticos.', why: 'El informe favorable lo emite la Consejería competente en coordinación de registros, no el responsable de seguridad.' },
     { text: 'previa publicación de la disposición de creación en el Boletín Oficial del Principado de Asturias y en el portal corporativo.', why: 'El requisito que exige el 20.2 es el informe favorable previo, no la publicación como condición de la creación.' }], 2),
]

;(async () => {
  // resolver UUIDs de artículos
  const ids = {}
  for (const k of Object.keys(LAW)) {
    const { data } = await s.from('articles').select('id, article_number').eq('law_id', LAW[k])
    ids[k] = {}; for (const a of data) ids[k][a.article_number] = a.id
  }
  for (const q of Q) { q.primary_article_id = ids[q.lawKey][q.artNum]; if (!q.primary_article_id) throw new Error('no art ' + q.lawKey + ' ' + q.artNum) }

  // distribución posiciones
  const c = [0, 0, 0, 0]; for (const q of Q) c[q.correct_option]++
  console.log('Total:', Q.length, '| posiciones ABCD =', c, '(' + c.map(x => Math.round(x / Q.length * 100) + '%').join('/') + ')')
  // balance longitudes
  let bad = []
  for (const q of Q) { const o = [q.option_a, q.option_b, q.option_c, q.option_d]; const co = q.correct_option; const oth = o.filter((_, i) => i !== co).map(x => x.length).sort((a, b) => b - a); const r = o[co].length / oth[0]; if (r >= 1.3) bad.push(q.cite + ' r=' + r.toFixed(2)) }
  console.log('distractors_balance:', bad.length ? '❌ ' + bad.join('; ') : '✅ todas <1.3x')
  if (bad.length) { console.log('ABORT: reequilibrar antes de insertar'); return }

  // dedup
  const artIds = [...new Set(Q.map(q => q.primary_article_id))]
  const { count: prev } = await s.from('questions').select('*', { count: 'exact', head: true }).in('primary_article_id', artIds)
  console.log('dedup — preguntas previas en esos artículos:', prev)
  if (prev > 0) { console.log('ABORT'); return }

  // idempotencia
  await s.from('questions').delete().contains('tags', ['ia_generada', BATCH]).eq('lifecycle_state', 'draft')

  // insertar draft
  const inserted = []
  for (const q of Q) {
    const { data, error } = await s.from('questions').insert({
      question_text: q.question_text, question_type: 'single',
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
      correct_option: q.correct_option, explanation: q.explanation,
      primary_article_id: q.primary_article_id, difficulty: 'medium',
      tags: ['ia_generada', BATCH], lifecycle_state: 'draft',
    }).select('id').single()
    if (error) throw new Error(error.message)
    inserted.push(data.id)
  }
  fs.writeFileSync('/tmp/t211_inserted_ids.json', JSON.stringify(inserted, null, 2))
  console.log('✅ insertadas draft:', inserted.length)
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
