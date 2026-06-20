// Genera 2 batches de preguntas IA (borrador) para Administrativo C1 Asturias:
//  A) Decreto 71/1992 (subvenciones) → T207   batch=ia_d71_1992_ast
//  B) Ley 3/2003 Sindicatura (control externo) → T405  batch=ia_ley3_2003_ast
// Reglas: correcta = cita literal; distractores ±30% long; posición aleatoria
// uniforme (balanceada en el lote); explicación formato §8.1.
const fs = require('fs')
const L = ['A', 'B', 'C', 'D']

// art ids
const D71 = {1:'ba1fc246-1213-46c2-aed3-504403b677c0',2:'7ec277cc-3ece-4ea2-b914-0ef0f1f3422c',4:'039d5fdd-12da-4ac3-a7e8-31b853189481',5:'bf7d1f4a-1e36-4b66-8031-2f4ff7d7d98b',6:'a968a5dd-cf37-4e2a-b06c-ea4a3e015192',7:'b3870a83-e309-4aa3-ba87-94da5363a9dd',8:'4305ddf5-e344-423e-bde3-626cdea90e07',9:'90c8c923-8a06-42eb-84a6-ab84c1ff261d',10:'1f305e1a-bfcb-408b-bfca-d0f24cf2bb91',12:'a1e3bbee-1be1-4492-a6ab-f18f2fcaa33b',13:'9652b998-3569-4483-9c42-1ec13f771732'}
const L3 = {1:'5dc6dd05',2:'c82c768a',4:'e3a11edb',5:'0bd18d7b',6:'27b0cda4',7:'c0b6b342',8:'9c6c1501',9:'8f4cd66b',12:'d95d8b97',16:'ded5536b',17:'aed15061'}
// los de L3 son prefijos → resolver a uuid completo en runtime
const L3_FULL = {'5dc6dd05':'5dc6dd05','c82c768a':'c82c768a'} // placeholder; se resuelven en el insert

// Builder: coloca la correcta en `co`, reparte distractores en el resto en orden,
// y arma la explicación con la letra correcta + bullets por distractor.
function build(article_id, label, cite, q, correct, why_correct, distractors, co) {
  const opts = new Array(4)
  opts[co] = correct
  let di = 0
  const slotToDist = {}
  for (let i = 0; i < 4; i++) { if (i === co) continue; opts[i] = distractors[di].text; slotToDist[i] = distractors[di]; di++ }
  let expl = `> **${cite}**\n> "${why_correct.quote}"\n\n`
  expl += `**Por qué ${L[co]} es correcta:** ${why_correct.reason}\n\n`
  expl += `**Por qué las demás son incorrectas:**\n`
  for (let i = 0; i < 4; i++) { if (i === co) continue; expl += `- **${L[i]})** ${slotToDist[i].why}\n` }
  return { primary_article_id: article_id, article_label: label, question_text: q,
    option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
    correct_option: co, explanation: expl.trim() }
}

// ===================== BATCH A — Decreto 71/1992 =====================
const A = [
  build(D71[1], 'Art 1 D 71/1992', 'Art. 1 Decreto 71/1992',
    'Según el artículo 1 del Decreto 71/1992, ¿a qué subvenciones y ayudas se aplican las normas del Decreto?',
    'A las subvenciones y ayudas que se otorguen con cargo a los Presupuestos Generales del Principado de Asturias.',
    { quote: 'Las normas contenidas en el presente Decreto serán de aplicación a las subvenciones y ayudas que se otorguen con cargo a los Presupuestos Generales del Principado de Asturias.', reason: 'El ámbito de aplicación se delimita por el origen presupuestario: los Presupuestos Generales del Principado.' },
    [ { text: 'A las subvenciones y ayudas otorgadas con cargo a los Presupuestos Generales del Estado y transferidas al Principado.', why: 'El artículo refiere los Presupuestos Generales del Principado, no los del Estado.' },
      { text: 'A las subvenciones y ayudas que concedan las Entidades locales situadas en el territorio del Principado de Asturias.', why: 'El Decreto regula las subvenciones del Principado, no las de las Entidades locales.' },
      { text: 'A las subvenciones y ayudas financiadas con fondos europeos gestionados directamente por la Comisión Europea.', why: 'El criterio es la imputación a los Presupuestos del Principado, sin distinguir el origen último de los fondos.' } ], 2),
  build(D71[2], 'Art 2 D 71/1992', 'Art. 2 Decreto 71/1992',
    'El artículo 2 del Decreto 71/1992 establece que las subvenciones y ayudas tendrán siempre...',
    'carácter voluntario, sin naturaleza contractual aun cuando fueren otorgadas mediante concurrencia pública.',
    { quote: 'Estas subvenciones y ayudas tendrán siempre carácter voluntario, sin naturaleza contractual aun cuando fueren otorgadas mediante concurrencia pública; no podrán ser invocadas como precedente ni será exigible aumento o revisión.', reason: 'El artículo califica las subvenciones como voluntarias y sin naturaleza contractual, aunque medie concurrencia.' },
    [ { text: 'carácter obligatorio para el órgano concedente, con naturaleza contractual cuando medie concurrencia pública.', why: 'El artículo niega tanto el carácter obligatorio como la naturaleza contractual.' },
      { text: 'carácter voluntario y naturaleza contractual, pudiendo ser invocadas como precedente para ejercicios futuros.', why: 'El artículo dice expresamente que no podrán ser invocadas como precedente ni tienen naturaleza contractual.' },
      { text: 'carácter discrecional, siendo exigible su revisión al alza cuando aumenten las dotaciones del ejercicio.', why: 'El artículo señala que no será exigible aumento ni revisión de la subvención.' } ], 0),
  build(D71[4], 'Art 4 D 71/1992', 'Art. 4.2 Decreto 71/1992',
    '¿Cuál de las siguientes es una obligación del beneficiario según el artículo 4.2 del Decreto 71/1992?',
    'Comunicar al órgano concedente la obtención de subvenciones o ayudas para la misma finalidad procedentes de cualesquiera Administraciones Públicas.',
    { quote: 'Comunicar al órgano concedente la obtención de subvenciones o ayudas para la misma finalidad, procedentes de cualesquiera Administraciones Públicas o de entes públicos o privados, nacionales o internacionales.', reason: 'La letra e) del artículo 4.2 impone comunicar la obtención de otras ayudas para la misma finalidad.' },
    [ { text: 'Reintegrar de oficio el importe de cualquier otra subvención obtenida para la misma finalidad antes de iniciar la actividad.', why: 'La obligación es comunicar la concurrencia, no reintegrar de oficio otras ayudas.' },
      { text: 'Solicitar autorización previa del Consejo de Gobierno para concurrir a subvenciones de otras Administraciones Públicas.', why: 'No se exige autorización previa del Consejo de Gobierno, sino la comunicación al órgano concedente.' },
      { text: 'Renunciar a las subvenciones de otras Administraciones concedidas para una finalidad distinta a la subvencionada.', why: 'La comunicación se refiere a ayudas para la misma finalidad, y no obliga a renunciar a ellas.' } ], 3),
  build(D71[5], 'Art 5 D 71/1992', 'Art. 5.2 Decreto 71/1992',
    'Conforme al artículo 5.2 del Decreto 71/1992, ¿quiénes podrán ser entidades colaboradoras?',
    'Las sociedades públicas y organismos autónomos de la Comunidad Autónoma, las corporaciones de derecho público y las personas jurídicas que reúnan las condiciones de solvencia y eficacia.',
    { quote: 'Podrán ser entidades colaboradoras (...): las sociedades públicas y organismos autónomos de la Comunidad Autónoma, las corporaciones de derecho público, así como las personas jurídicas que reúnan las condiciones de solvencia y eficacia que se establezcan y presten garantías suficientes.', reason: 'El precepto enumera estos tres grupos como posibles entidades colaboradoras.' },
    [ { text: 'Las corporaciones de derecho público y las personas físicas que reúnan las condiciones de solvencia, excluidas las sociedades públicas.', why: 'El artículo habla de personas jurídicas, no físicas, e incluye las sociedades públicas.' },
      { text: 'Únicamente las sociedades públicas y organismos autónomos de la Comunidad Autónoma, con exclusión de toda persona jurídica privada.', why: 'También pueden serlo personas jurídicas privadas que reúnan solvencia y presten garantías.' },
      { text: 'Las Entidades locales del Principado y las personas jurídicas privadas, salvo las corporaciones de derecho público.', why: 'El artículo incluye expresamente las corporaciones de derecho público, que aquí se excluyen.' } ], 1),
  build(D71[6], 'Art 6 D 71/1992', 'Art. 6.2 Decreto 71/1992',
    'Las subvenciones con cargo a dotaciones innominadas, globales o genéricas se otorgarán, según el artículo 6.2 del Decreto 71/1992, de acuerdo con los principios generales de...',
    'publicidad, concurrencia y objetividad.',
    { quote: '...se otorgarán de acuerdo con los principios generales de publicidad, concurrencia y objetividad, ajustándose a los procedimientos establecidos en el presente Decreto.', reason: 'El artículo 6.2 cita literalmente estos tres principios.' },
    [ { text: 'legalidad, eficacia y eficiencia.', why: 'Son los principios del control fiscalizador (Ley de la Sindicatura), no los de concesión del artículo 6.2.' },
      { text: 'igualdad, mérito y capacidad.', why: 'Son principios de acceso al empleo público, ajenos a la concesión de subvenciones.' },
      { text: 'transparencia, proporcionalidad y contradicción.', why: 'No son los principios que enuncia el artículo 6.2.' } ], 0),
  build(D71[6], 'Art 6 D 71/1992', 'Art. 6.3 Decreto 71/1992',
    'Cuando por razones de interés público, social o humanitario no sea posible promover la concurrencia pública, el artículo 6.3 del Decreto 71/1992 exige...',
    'acuerdo del Consejo de Gobierno autorizando la concesión, al que se incorporará informe acreditativo emitido por el centro gestor correspondiente.',
    { quote: '...será necesario acuerdo del Consejo de Gobierno autorizando la concesión de la subvención al que se incorporará necesariamente informe acreditativo de tales extremos emitido por el centro gestor correspondiente.', reason: 'La concesión sin concurrencia exige acuerdo del Consejo de Gobierno con informe del centro gestor.' },
    [ { text: 'resolución motivada del titular de la Consejería competente, con informe favorable de la Intervención General del Principado.', why: 'El órgano competente es el Consejo de Gobierno, y el informe lo emite el centro gestor.' },
      { text: 'autorización previa de la Junta General del Principado, acompañada de informe acreditativo emitido por el centro gestor.', why: 'La autorización corresponde al Consejo de Gobierno, no a la Junta General.' },
      { text: 'acuerdo del Consejo de Gobierno, sin necesidad de informe alguno cuando concurran las razones de interés público.', why: 'El informe acreditativo del centro gestor es necesario en todo caso.' } ], 2),
  build(D71[7], 'Art 7 D 71/1992', 'Art. 7.1 Decreto 71/1992',
    'Según el artículo 7.1 del Decreto 71/1992, las bases reguladoras de la concesión serán objeto de publicación en...',
    'el Boletín Oficial del Principado de Asturias y de la Provincia.',
    { quote: '...aprobarán las bases reguladoras de la concesión, que serán objeto de publicación en el "Boletín Oficial del Principado de Asturias y de la Provincia"...', reason: 'El artículo 7.1 ordena su publicación en el Boletín Oficial del Principado.' },
    [ { text: 'el Boletín Oficial de la Junta General del Principado de Asturias.', why: 'Las bases se publican en el BOPA, no en el Boletín de la Junta General.' },
      { text: 'el Boletín Oficial del Estado y, en su caso, en el portal de transparencia.', why: 'La publicación se realiza en el boletín autonómico, no en el BOE.' },
      { text: 'el tablón de anuncios de la Consejería convocante y su sede electrónica.', why: 'El artículo exige publicación en el boletín oficial, no solo en el tablón.' } ], 1),
  build(D71[8], 'Art 8 D 71/1992', 'Art. 8.2 Decreto 71/1992',
    'Conforme al artículo 8.2 del Decreto 71/1992, ¿qué documento debe acompañar en todo caso a la solicitud, junto al acreditativo de la personalidad?',
    'Una declaración responsable relativa, entre otros extremos, a hallarse al corriente de sus obligaciones tributarias y de Seguridad Social.',
    { quote: 'Declaración responsable del solicitante o responsable legal relativa a los siguientes extremos: hallarse al corriente de sus obligaciones tributarias y de Seguridad Social, no ser deudor de la Hacienda del Principado...', reason: 'El artículo 8.2.b) exige una declaración responsable sobre esos extremos.' },
    [ { text: 'Un certificado original expedido por la Agencia Tributaria acreditando estar al corriente de las obligaciones fiscales.', why: 'En la solicitud basta la declaración responsable; la acreditación documental es posterior (art. 10).' },
      { text: 'Una memoria económica detallada del proyecto y un aval bancario por el importe total de la subvención solicitada.', why: 'El artículo 8.2 no exige aval por el importe total en la solicitud.' },
      { text: 'Un informe de la Intervención General del Principado sobre la solvencia económica y técnica del solicitante.', why: 'No se requiere informe de la Intervención General entre la documentación de la solicitud.' } ], 3),
  build(D71[9], 'Art 9 D 71/1992', 'Art. 9.3 Decreto 71/1992',
    'Según el artículo 9.3 del Decreto 71/1992, el importe de la subvención en ningún caso podrá ser de tal cuantía que, aisladamente o en concurrencia con otras ayudas...',
    'supere el coste de la actividad a desarrollar por el beneficiario.',
    { quote: 'El importe de la subvención o ayuda en ningún caso podrá ser de tal cuantía que, aisladamente o en concurrencia con subvenciones o ayudas de otras Administraciones Públicas (...), supere el coste de la actividad a desarrollar por el beneficiario.', reason: 'El límite es el coste de la actividad subvencionada.' },
    [ { text: 'supere el cincuenta por ciento del coste de la actividad a desarrollar por el beneficiario.', why: 'El artículo fija como límite el coste total, no el 50 %.' },
      { text: 'exceda de la cuantía consignada en la aplicación presupuestaria a la que se imputa el gasto.', why: 'El límite del artículo 9.3 es el coste de la actividad, no la dotación presupuestaria.' },
      { text: 'supere el importe que el beneficiario hubiera solicitado inicialmente en su solicitud.', why: 'El parámetro es el coste de la actividad, no el importe solicitado.' } ], 0),
  build(D71[12], 'Art 12 D 71/1992', 'Art. 12.1 Decreto 71/1992',
    'Con carácter general, el artículo 12.1 del Decreto 71/1992 establece que las subvenciones y ayudas se harán efectivas...',
    'en un único pago, previa justificación de las mismas de acuerdo con lo establecido en el Decreto.',
    { quote: 'Las subvenciones y ayudas se harán efectivas a los beneficiarios en un único pago, previa justificación de las mismas de acuerdo con lo establecido en el presente Decreto.', reason: 'La regla general es pago único previa justificación; los abonos parciales o anticipados son excepcionales.' },
    [ { text: 'en pagos fraccionados trimestrales, previa justificación parcial de cada uno de los abonos realizados.', why: 'El pago fraccionado es excepcional; la regla general es el pago único.' },
      { text: 'mediante un abono anticipado del cincuenta por ciento y el resto previa justificación final del gasto.', why: 'No se fija un anticipo automático del 50 %; el anticipo es excepcional y con garantía.' },
      { text: 'en un único pago anticipado a la realización de la actividad, sin necesidad de justificación previa.', why: 'El pago único se realiza previa justificación, no de forma anticipada sin justificar.' } ], 2),
  build(D71[13], 'Art 13 D 71/1992', 'Art. 13.3 Decreto 71/1992',
    'Según el artículo 13.3 del Decreto 71/1992, las cantidades a reintegrar tendrán la consideración de...',
    'ingresos de derecho público, y su cobranza se llevará a efecto con sujeción a lo establecido para esta clase de ingresos.',
    { quote: 'Las cantidades a reintegrar tendrán la consideración de ingresos de derecho público, y su cobranza se llevará a efecto con sujeción a lo establecido para esta clase de ingresos en la Ley de régimen económico y presupuestario del Principado de Asturias.', reason: 'El reintegro se cobra por el régimen de los ingresos de derecho público.' },
    [ { text: 'ingresos de derecho privado, y su cobranza se efectuará conforme a las normas de la jurisdicción civil ordinaria.', why: 'Son ingresos de derecho público, no privado.' },
      { text: 'deudas tributarias, exigibles únicamente por la vía del procedimiento sancionador previsto en la normativa fiscal.', why: 'No son deudas tributarias ni se exigen por vía sancionadora.' },
      { text: 'ingresos de derecho público cuya cobranza corresponderá en exclusiva al Tribunal de Cuentas del Estado.', why: 'La cobranza se rige por la Ley de régimen económico del Principado, no por el Tribunal de Cuentas.' } ], 3),
]

// ===================== BATCH B — Ley 3/2003 Sindicatura =====================
function B3(prefix) { return prefix } // resuelto en runtime
const B = [
  ['L3#1','Art 1 Ley 3/2003','Art. 1.1 Ley 3/2003',
    'Según el artículo 1.1 de la Ley 3/2003, la Sindicatura de Cuentas del Principado de Asturias es el órgano al que corresponde...',
    'el control externo de la actividad económico-financiera del sector público autonómico, sin perjuicio de las competencias del Tribunal de Cuentas.',
    {quote:'La Sindicatura de Cuentas del Principado de Asturias es el órgano al que corresponde el control externo de la actividad económico-financiera del sector público autonómico (...) sin perjuicio de las competencias que correspondan al Tribunal de Cuentas.',reason:'Es el órgano de control externo, compatible con las competencias del Tribunal de Cuentas.'},
    [{text:'el control interno de la actividad económico-financiera del sector público autonómico, en sustitución de la Intervención General.',why:'La Sindicatura ejerce control externo; el interno corresponde a la Intervención General.'},
     {text:'el asesoramiento jurídico de la actividad económico-financiera del sector público autonómico ante el Tribunal de Cuentas.',why:'Su función nuclear es la fiscalización (control externo), no el asesoramiento jurídico.'},
     {text:'el enjuiciamiento de la responsabilidad contable del sector público autonómico, por delegación del Tribunal de Cuentas.',why:'El enjuiciamiento contable corresponde al Tribunal de Cuentas, no a la Sindicatura.'}],1,1],
  ['L3#2','Art 1 Ley 3/2003','Art. 1.2 Ley 3/2003',
    'Conforme al artículo 1.2 de la Ley 3/2003, la Sindicatura de Cuentas depende directamente de...',
    'la Junta General del Principado de Asturias, ejerciendo sus funciones por delegación de ella.',
    {quote:'La Sindicatura de Cuentas depende directamente de la Junta General del Principado de Asturias, y ejerce sus funciones por delegación de ella en el examen y comprobación de la Cuenta General del Principado.',reason:'Depende de la Junta General (el Parlamento autonómico) y actúa por delegación de ella.'},
    [{text:'el Consejo de Gobierno del Principado de Asturias, ejerciendo sus funciones por delegación de éste.',why:'Depende de la Junta General, no del Consejo de Gobierno (al que fiscaliza).'},
     {text:'el Tribunal de Cuentas del Estado, ejerciendo sus funciones por delegación orgánica de éste.',why:'Es un órgano autonómico dependiente de la Junta General, no del Tribunal de Cuentas.'},
     {text:'la Consejería competente en materia de hacienda, con plena autonomía funcional respecto de ella.',why:'No depende de ninguna Consejería, sino de la Junta General.'}],0,1],
  ['L3#3','Art 1 Ley 3/2003','Art. 1.3 Ley 3/2003',
    'El artículo 1.3 de la Ley 3/2003 dispone que, en el desempeño de sus cometidos, la Sindicatura de Cuentas actuará...',
    'con pleno sometimiento al ordenamiento jurídico y gozará de total independencia funcional para el cumplimiento de sus fines.',
    {quote:'En el desempeño de sus cometidos, la Sindicatura de Cuentas actuará con pleno sometimiento al ordenamiento jurídico y gozará de total independencia funcional para el cumplimiento de sus fines.',reason:'La nota característica es el sometimiento al ordenamiento y la total independencia funcional.'},
    [{text:'con sometimiento a las instrucciones de la Junta General y gozará de autonomía presupuestaria para sus fines.',why:'Goza de independencia funcional; no actúa bajo instrucciones en su función fiscalizadora.'},
     {text:'con pleno sometimiento al ordenamiento jurídico y bajo la dirección funcional del Tribunal de Cuentas del Estado.',why:'No está sujeta a la dirección funcional del Tribunal de Cuentas.'},
     {text:'con sujeción a las directrices del Consejo de Gobierno y gozará de independencia orgánica respecto de la Cámara.',why:'No se sujeta a directrices del Consejo de Gobierno, al que fiscaliza.'}],2,1],
  ['L3#4','Art 2 Ley 3/2003','Art. 2 Ley 3/2003',
    'Según el artículo 2 de la Ley 3/2003, dentro del sector público autonómico el ámbito de actuación de la Sindicatura se extiende a...',
    'las Universidades públicas de la Comunidad Autónoma, así como sus organismos, entes, entidades, fundaciones y empresas.',
    {quote:'Las Universidades públicas de la Comunidad Autónoma, así como sus organismos, entes, entidades, fundaciones y empresas, independientemente de que se rijan por el derecho público o privado.',reason:'El artículo 2.a) incluye expresamente las Universidades públicas y su sector instrumental.'},
    [{text:'las Universidades públicas y privadas de la Comunidad Autónoma que reciban fondos del sector público autonómico.',why:'El artículo se refiere a las Universidades públicas; las privadas no integran el sector público autonómico.'},
     {text:'las corporaciones de derecho público de ámbito estatal con sede en el territorio del Principado de Asturias.',why:'No se mencionan las corporaciones de derecho público estatales como integrantes del sector público autonómico.'},
     {text:'los colegios profesionales y las cámaras de comercio radicados en el territorio del Principado de Asturias.',why:'No figuran en la enumeración del artículo 2 como parte del sector público autonómico.'}],3,1],
  ['L3#5','Art 4 Ley 3/2003','Art. 4 Ley 3/2003',
    '¿Cuál de las siguientes funciones corresponde a la Sindicatura de Cuentas según el artículo 4 de la Ley 3/2003?',
    'La fiscalización de la actividad económico-financiera del sector público autonómico, velando por su adecuación a los principios de legalidad, eficacia y eficiencia.',
    {quote:'La fiscalización de la actividad económico-financiera del sector público autonómico, velando por su adecuación a los principios de legalidad, eficacia y eficiencia.',reason:'Es la función fiscalizadora, función nuclear de la Sindicatura conforme al artículo 4.a).'},
    [{text:'La aprobación definitiva de la Cuenta General del Principado de Asturias, en sustitución de la Junta General.',why:'La Sindicatura examina y comprueba la Cuenta; la aprobación corresponde a la Junta General.'},
     {text:'La gestión recaudatoria de los ingresos de derecho público del sector público autonómico en vía de apremio.',why:'La Sindicatura fiscaliza, no recauda los ingresos del sector público.'},
     {text:'El enjuiciamiento de las responsabilidades contables del sector público autonómico, con imposición de sanciones.',why:'El enjuiciamiento contable corresponde al Tribunal de Cuentas.'}],0,1],
  ['L3#6','Art 5 Ley 3/2003','Art. 5.4 Ley 3/2003',
    'Conforme al artículo 5.4 de la Ley 3/2003, las multas coercitivas que puede imponer la Sindicatura de Cuentas serán de...',
    'un mínimo de 150 euros y un máximo de 3.000 euros, atendiendo a la importancia de la perturbación sufrida.',
    {quote:'Las cuantías de las multas serán de un mínimo de 150 euros y de un máximo de 3.000 euros, atendiendo a la importancia de la perturbación sufrida, a la intencionalidad, a los medios materiales y personales disponibles...',reason:'El artículo 5.4 fija la horquilla entre 150 y 3.000 euros.'},
    [{text:'un mínimo de 300 euros y un máximo de 6.000 euros, atendiendo a la importancia de la perturbación sufrida.',why:'Las cuantías legales son 150 y 3.000 euros, no 300 y 6.000.'},
     {text:'un mínimo de 150 euros y un máximo de 1.500 euros, sin posibilidad de reiteración por nuevos lapsos de tiempo.',why:'El máximo es 3.000 euros y las multas son reiterables.'},
     {text:'un mínimo de 600 euros y un máximo de 3.000 euros, en función exclusivamente de la cuantía de los fondos fiscalizados.',why:'El mínimo es 150 euros y la graduación atiende a varios criterios, no solo a la cuantía.'}],2,1],
  ['L3#7','Art 6 Ley 3/2003','Art. 6 Ley 3/2003',
    'Entre los cometidos de la función fiscalizadora de la Sindicatura, el artículo 6 de la Ley 3/2003 incluye...',
    'la fiscalización de la contabilidad electoral en los términos previstos en la legislación electoral.',
    {quote:'La fiscalización de la contabilidad electoral en los términos previstos en la legislación electoral.',reason:'El artículo 6.f) atribuye la fiscalización de la contabilidad electoral.'},
    [{text:'la fiscalización de la contabilidad de los partidos políticos en los términos previstos en su ley orgánica.',why:'El artículo 6 se refiere a la contabilidad electoral, no a la ordinaria de los partidos.'},
     {text:'la aprobación de la contabilidad electoral en los términos previstos en la legislación electoral autonómica.',why:'La Sindicatura fiscaliza, no aprueba, la contabilidad electoral.'},
     {text:'la fiscalización de la contabilidad mercantil de las empresas privadas adjudicatarias de contratos públicos.',why:'No fiscaliza la contabilidad mercantil de las empresas privadas adjudicatarias.'}],1,1],
  ['L3#8','Art 7 Ley 3/2003','Art. 7.1 Ley 3/2003',
    'Según el artículo 7.1 de la Ley 3/2003, el control de eficiencia se referirá a...',
    'la relación entre los medios empleados y los objetivos realizados, con la finalidad de evaluar el coste efectivo en la realización del gasto público.',
    {quote:'El control de eficiencia se referirá a la relación entre los medios empleados y los objetivos realizados, con la finalidad de evaluar el coste efectivo en la realización del gasto público.',reason:'La eficiencia relaciona medios y objetivos para evaluar el coste efectivo del gasto.'},
    [{text:'el grado de consecución de los objetivos previstos, analizando las posibles desviaciones y el origen de las mismas.',why:'Esa es la definición del control de eficacia, no del de eficiencia.'},
     {text:'la adecuación de la actividad de los sujetos controlados al ordenamiento jurídico vigente en cada momento.',why:'Esa es la definición del control de legalidad.'},
     {text:'la comprobación de que la contabilidad pública refleja la realidad económico-financiera del sujeto controlado.',why:'Eso corresponde al control de la contabilidad pública (art. 7.2), no al de eficiencia.'}],3,1],
  ['L3#9','Art 8 Ley 3/2003','Art. 8.2 Ley 3/2003',
    'El artículo 8.2 de la Ley 3/2003 establece que la Cuenta General del Principado deberá remitirse a la Sindicatura por la Mesa de la Junta General dentro de los...',
    'cinco días siguientes a su presentación por el Consejo de Gobierno en el Registro de la Cámara.',
    {quote:'La Cuenta General del Principado de Asturias deberá remitirse a la Sindicatura de Cuentas por la Mesa de la Junta General dentro de los cinco días siguientes a su presentación por el Consejo de Gobierno en el Registro de la Cámara.',reason:'El plazo de remisión es de cinco días desde la presentación en el Registro de la Cámara.'},
    [{text:'quince días siguientes a su presentación por el Consejo de Gobierno en el Registro de la Cámara.',why:'El plazo es de cinco días, no de quince.'},
     {text:'treinta días siguientes a su aprobación definitiva por el Pleno de la Junta General del Principado.',why:'El cómputo arranca de la presentación en el Registro, no de la aprobación, y son cinco días.'},
     {text:'diez días siguientes a su presentación por la Intervención General en el Registro de la Cámara.',why:'La presenta el Consejo de Gobierno y el plazo es de cinco días.'}],0,1],
  ['L3#10','Art 9 Ley 3/2003','Art. 9 Ley 3/2003',
    'Según el artículo 9 de la Ley 3/2003, la fiscalización de los contratos del sector público autonómico se refiere a...',
    'su preparación, adjudicación, garantía, ejecución, modificación y extinción.',
    {quote:'...refiriéndose dicha fiscalización a su preparación, adjudicación, garantía, ejecución, modificación y extinción.',reason:'La fiscalización abarca todas las fases del contrato enumeradas en el artículo 9.'},
    [{text:'su preparación, adjudicación y ejecución, quedando excluidas la modificación y la extinción del contrato.',why:'El artículo incluye también la modificación y la extinción.'},
     {text:'exclusivamente su adjudicación y la formalización de la garantía definitiva exigida al contratista.',why:'La fiscalización abarca todas las fases, no solo adjudicación y garantía.'},
     {text:'su adjudicación, ejecución y extinción, sin extenderse a la fase de preparación del expediente.',why:'La preparación está expresamente incluida.'}],1,1],
  ['L3#11','Art 12 Ley 3/2003','Art. 12.1 Ley 3/2003',
    'Conforme al artículo 12.1 de la Ley 3/2003, la iniciativa fiscalizadora corresponde a...',
    'la Sindicatura de Cuentas, que desarrollará un programa de fiscalizaciones aprobado por su Consejo.',
    {quote:'La iniciativa fiscalizadora corresponderá a la Sindicatura de Cuentas, que desarrollará un programa de fiscalizaciones aprobado por su Consejo...',reason:'La iniciativa es de la propia Sindicatura, mediante un programa aprobado por su Consejo.'},
    [{text:'la Junta General del Principado, que aprobará anualmente el programa de fiscalizaciones de la Sindicatura.',why:'La Junta puede interesar actuaciones, pero la iniciativa y el programa son de la Sindicatura.'},
     {text:'el Tribunal de Cuentas del Estado, que delegará su ejecución en la Sindicatura de Cuentas del Principado.',why:'La iniciativa corresponde a la Sindicatura, no al Tribunal de Cuentas.'},
     {text:'el Consejo de Gobierno, que remitirá a la Sindicatura el programa anual de actuaciones fiscalizadoras.',why:'El programa lo aprueba el Consejo de la Sindicatura, no el Consejo de Gobierno.'}],2,1],
  ['L3#12','Art 16 Ley 3/2003','Art. 16.2 Ley 3/2003',
    'Según el artículo 16.2 de la Ley 3/2003, la Sindicatura dictará la declaración definitiva sobre la Cuenta General dentro del plazo de...',
    'seis meses a partir de la fecha en que le haya sido remitida por la Mesa de la Junta General.',
    {quote:'La Sindicatura de Cuentas dictará la declaración definitiva que le merezca dentro del plazo de seis meses a partir de la fecha en que le haya sido remitida por la Mesa de la Junta General...',reason:'El plazo para la declaración definitiva es de seis meses desde la remisión.'},
    [{text:'tres meses a partir de la fecha en que le haya sido remitida por la Mesa de la Junta General.',why:'El plazo es de seis meses, no de tres.'},
     {text:'un año a partir de la fecha de aprobación de la Cuenta General por el Consejo de Gobierno.',why:'El plazo es de seis meses y se cuenta desde la remisión por la Mesa, no desde la aprobación.'},
     {text:'seis meses a partir de la terminación del ejercicio económico al que se refiera la Cuenta.',why:'El cómputo arranca de la remisión por la Mesa de la Junta General, no del cierre del ejercicio.'}],3,1],
  ['L3#13','Art 17 Ley 3/2003','Art. 17 Ley 3/2003',
    'El artículo 17 de la Ley 3/2003 dispone que la Sindicatura elaborará una Memoria anual descriptiva de su actividad dentro de los...',
    'tres meses siguientes a la terminación de cada ejercicio económico.',
    {quote:'Dentro de los tres meses siguientes a la terminación de cada ejercicio económico, la Sindicatura de Cuentas elaborará una Memoria anual descriptiva del conjunto de su actividad durante el año precedente...',reason:'El plazo para la Memoria anual es de tres meses desde el cierre del ejercicio.'},
    [{text:'seis meses siguientes a la terminación de cada ejercicio económico.',why:'El plazo de la Memoria anual es de tres meses, no de seis.'},
     {text:'tres meses siguientes a la aprobación de la Cuenta General del Principado.',why:'El cómputo se hace desde la terminación del ejercicio, no desde la aprobación de la Cuenta.'},
     {text:'treinta días siguientes a la terminación de cada ejercicio económico.',why:'El plazo es de tres meses, no de treinta días.'}],0,1],
]

fs.writeFileSync('/tmp/ia_d71_1992_ast_borrador.json', JSON.stringify(A, null, 2))
fs.writeFileSync('/tmp/ia_ley3_2003_ast_RAW.json', JSON.stringify(B))
// distribución de posiciones
const dist = (arr, idx) => { const c = [0,0,0,0]; for (const q of arr) c[idx ? q[idx] : q.correct_option]++; return c }
console.log('Batch A (D71/1992):', A.length, 'preguntas | posiciones ABCD =', dist(A))
console.log('Batch B (Ley 3/2003):', B.length, 'preguntas | posiciones ABCD =', dist(B, 6))
