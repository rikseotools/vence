#!/usr/bin/env node
/**
 * Import unresolved exam questions from CARM Administrativo C1
 * Convocatoria CGX00L19, 21/09/2024 - Primera parte
 *
 * Decisions based on manual analysis:
 * - IMPORT: Q14, Q19, Q22, Q30, Q31, Q32, Q33, Q36, Q37, Q57, Q74, Q83
 *   + Q4, Q5, Q6, Q7, Q8, Q9 (EARM/Ley6/2004 articles confirmed in DB)
 *   + Q59-Q65, Q68-Q69 (DL1/1999 articles need per-question check)
 *   + Q81, Q88 (Ley7/2004 confirmed)
 *   + Q91-Q97 (DL1/1999 confirmed)
 * - NEEDS_HUMAN: out-of-scope laws, articles not in DB
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { contentHash } = require('./lib/import-cleanup.cjs');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXAM_JSON_PATH = path.join(
  __dirname,
  'data/examenes-oficiales/administrativo-carm/24-09-23 conv CGX00L19 libre OEP 2018-2019/examen.json'
);
const REPORT_PATH = '/tmp/carm_c1_import_report2.json';
const EXAM_SOURCE = 'Examen Administrativo CARM Murcia - Convocatoria CGX00L19 turno libre - 21 septiembre 2024 - Primera parte';
const EXAM_POSITION = 'administrativo_carm';
const OPOSICION_TYPE = 'administrativo-carm';
const TAGS = ['Administrativo CARM', 'Examen oficial CGX00L19', 'official-import'];

// Map correct letter to 0-indexed number
function letterToIndex(letter) {
  return { A: 0, B: 1, C: 2, D: 3 }[letter.toUpperCase()];
}

// Article decisions for each question number
// null article_id = needs_human
const QUESTION_MAP = {
  // === IMPORT decisions ===
  4: {
    article_id: '42a169e2-0c92-4136-b155-e8bcb5083303',
    explanation: `> Art. 32 de la Ley Orgánica 4/1982, de Estatuto de Autonomía para la Región de Murcia: el Consejo de Gobierno está facultado para interponer el recurso de inconstitucionalidad ante el Tribunal Constitucional, como órgano de autogobierno de la Comunidad Autónoma.

**Por qué D es correcta:** El artículo 32 del EARM recoge entre las facultades del Consejo de Gobierno la de **interponer el recurso de inconstitucionalidad**. Esta facultad corresponde al Consejo de Gobierno, no a la Asamblea Regional ni al Presidente de forma individual.

**Por qué las demás son incorrectas:** A) La cuestión de confianza la plantea el Presidente (no el Consejo de Gobierno en pleno). B) El Consejo de Gobierno se compone del Presidente, los Vicepresidentes y los Consejeros, pero no incluye un "Secretario General" como miembro. C) Es el Presidente quien nombra y separa libremente a los Consejeros, no el Consejo de Gobierno.`,
  },
  5: {
    article_id: '922fb198-b18c-4ce6-866d-6d60f360b98b',
    explanation: `> Art. 24 del EARM (LO 4/1982): "La Asamblea Regional fijará por ley el número de sus miembros, que no será inferior a cuarenta y cinco ni superior a cincuenta y cinco diputados regionales."

**Por qué B es correcta:** El artículo 24 del Estatuto de Autonomía de la Región de Murcia establece que la Asamblea Regional fijará por ley su composición, con un **mínimo de 45 y un máximo de 55 diputados regionales**.

**Por qué las demás son incorrectas:** A) El mínimo de 35 y máximo de 45 no corresponde al texto del EARM. C) Los límites 55-65 tampoco figuran en el artículo 24. D) El rango 40-50 tampoco es el recogido en el EARM.`,
  },
  6: {
    article_id: 'd9ceba49-9870-42ea-a0b0-e4fce53555e9',
    explanation: `> Art. 51 del EARM (LO 4/1982): la creación y estructuración de la Administración Pública de la Comunidad Autónoma **está limitada por las normas básicas del Estado**. La Asamblea Regional y el Consejo de Gobierno, en el ámbito de sus competencias, organizan la Administración Regional, con respeto a las normas básicas del Estado.

**Por qué A es correcta:** El artículo 51 del EARM dispone que la creación y estructuración de la Administración Pública regional estará **limitada por las normas básicas del Estado**, que constituyen el marco dentro del cual la Comunidad Autónoma puede organizar sus servicios.

**Por qué las demás son incorrectas:** B) El artículo no habla de transparencia como principio organizativo; esos principios aparecen en la normativa básica estatal. C) Los organismos regionales no se limitan a municipios con más de 50.000 habitantes; pueden establecerse en todo el territorio. D) La descoordinación no es un principio administrativo; el principio correcto es la coordinación.`,
  },
  7: {
    article_id: '3f654e43-8d87-4780-a083-933ad6e60bd4',
    explanation: `> Art. 7 de la Ley 6/2004, del Estatuto del Presidente de la Comunidad Autónoma de la Región de Murcia: el nombramiento del Presidente se publicará en el **Boletín Oficial del Estado**.

**Por qué D es correcta:** Conforme al artículo 7 de la Ley 6/2004, tras ser elegido por la Asamblea Regional y nombrado por el Rey, el nombramiento del Presidente **se publicará en el Boletín Oficial del Estado**, dotándole de publicidad oficial a nivel nacional.

**Por qué las demás son incorrectas:** A) El Presidente no es elegido por el Consejo de Gobierno, sino por la Asamblea Regional. B) El nombramiento lo realiza el Rey, no el Presidente de la Asamblea Regional. C) Es el Rey quien nombra al Presidente, a propuesta de la Asamblea Regional, pero la publicación se produce en el BOE, no en el BORM.`,
  },
  8: {
    article_id: 'ee1108d8-6fa1-46b7-b520-3451778ef714',
    explanation: `> Art. 19 de la Ley 6/2004, del Estatuto del Presidente de la CARM: entre las causas de cese del Presidente figura la **dimisión, comunicada formalmente al Presidente de la Asamblea**.

**Por qué C es correcta:** El artículo 19 de la Ley 6/2004 enumera las causas de cese del Presidente, entre las que se encuentra la **dimisión comunicada formalmente al Presidente de la Asamblea Regional**.

**Por qué las demás son incorrectas:** A) La denegación de una moción de censura no provoca el cese, sino al contrario: la moción de censura prospera cuando es aprobada. B) La aprobación de una cuestión de confianza implica que el Presidente mantiene la confianza, no que cesa. D) Las incompatibilidades no se declaran por el Consejo de Gobierno; existen procedimientos específicos y no está recogido como causa de cese en el artículo 19.`,
  },
  9: {
    article_id: '2a437145-f25a-45ec-872f-e4b3cfd6c857',
    explanation: `> Art. 28 de la Ley 7/2004, de 28 de diciembre, de organización y régimen jurídico de la Administración Pública de la Comunidad Autónoma de la Región de Murcia: ponen fin a la vía administrativa las resoluciones del Presidente, del Vicepresidente, del Consejo de Gobierno y de las comisiones delegadas del Consejo de Gobierno —salvo previsión legal de recurso ante el Consejo de Gobierno—. **Todas las respuestas anteriores son correctas.**

**Por qué D es correcta:** El artículo 28 de la Ley 7/2004 establece que ponen fin a la vía administrativa, además de los supuestos previstos en la normativa básica estatal, **las resoluciones del Presidente, del Vicepresidente, del Consejo de Gobierno y de las comisiones delegadas del Consejo de Gobierno** (con la salvedad indicada), por lo que todas las opciones A, B y C son correctas en conjunto.

**Por qué las demás son incorrectas:** A, B y C recogen solo parte de lo dispuesto en el artículo 28; ninguna de ellas por sí sola es completa, ya que el precepto incluye todos esos supuestos.`,
  },
  14: {
    article_id: '4aeeae51-6161-417e-9acf-51e5a57d2991',
    explanation: `> Art. 39.2 de la Ley 39/2015: "La eficacia quedará demorada cuando así lo exija el contenido del acto o esté supeditada a su notificación, publicación o aprobación superior."

**Por qué C es correcta:** El artículo 39 de la Ley 39/2015 establece como regla general que los actos administrativos producen efectos desde la fecha en que se dicten, pero admite expresamente la **demora de la eficacia** cuando lo exija el contenido del acto o cuando esté supeditada a notificación, publicación o aprobación superior.

**Por qué las demás son incorrectas:** A) Es inexacta porque la propia Ley 39/2015 permite la demora de la eficacia en los supuestos que ella misma enumera. B) El principio de interdicción de la arbitrariedad es un principio constitucional general, no la causa específica que la Ley 39/2015 recoge para demorar la eficacia. D) Es contradictoria en sus términos y no recoge correctamente el tenor del artículo 39.`,
  },
  19: {
    article_id: '211783c5-89a4-4501-b006-08a7b7b36dd0',
    explanation: `> Art. 56.5 de la Ley 39/2015: "En todo caso, se extinguirán cuando surta efectos la resolución administrativa que ponga fin al procedimiento correspondiente."

**Por qué D es correcta:** El artículo 56.5 de la Ley 39/2015 dispone que las medidas provisionales **se extinguirán** una vez que surta efectos la resolución que ponga fin al procedimiento, ya que su razón de ser es precisamente cautelar durante la tramitación.

**Por qué las demás son incorrectas:** A) Las medidas provisionales no se ratifican por la resolución final; se extinguen. B) No se "suspenden", sino que se extinguen definitivamente. C) No se "adaptan" en ese momento; la extinción opera de forma automática al surtir efecto la resolución final.`,
  },
  22: {
    article_id: '54989a1e-fd20-4b45-b382-bd551f7723f5',
    explanation: `> Art. 112 de la Ley 39/2015: "podrán interponerse por los interesados los recursos de alzada y potestativo de reposición, que cabrá fundar en **cualquiera de los motivos de nulidad o anulabilidad previstos en los artículos 47 y 48** de esta Ley."

**Por qué C es correcta:** El artículo 112 de la Ley 39/2015 establece que los recursos de alzada y potestativo de reposición podrán fundarse en **cualquiera de los motivos de nulidad o anulabilidad** previstos en los artículos 47 y 48 de la propia Ley.

**Por qué las demás son incorrectas:** A) Que "la ejecución pudiera causar perjuicios de imposible o difícil reparación" es causa para solicitar la suspensión de la ejecución del acto (art. 117), no el motivo de interposición del recurso. B) La aparición de documentos de valor esencial es motivo para el recurso extraordinario de revisión (art. 125), no para el recurso de alzada. D) Es incorrecta porque solo C describe correctamente el fundamento del recurso de alzada.`,
  },
  30: {
    article_id: '9a68d44d-dda2-4f91-80cb-47d020e660ec',
    explanation: `> Art. 8 del Decreto n.º 236/2010, de 3 de septiembre, por el que se regula la atención al ciudadano en la Administración Pública de la Región de Murcia: "Por su contenido, la información administrativa se clasifica en **general, especializada y particular**."

**Por qué A es correcta:** El artículo 8 del Decreto 236/2010 establece que la clasificación de la información administrativa, atendiendo a su contenido, es: **información general, especializada y particular**. Estas tres categorías son las únicas que recoge el precepto.

**Por qué las demás son incorrectas:** B) La clasificación por la forma de proporcionarla (presencial, telefónica, electrónica) corresponde a otro criterio clasificatorio distinto, no al del artículo 8. C) La clasificación por modo de transmisión (inmediata o diferida) tampoco coincide con el criterio del artículo 8. D) No es correcta, ya que la opción A recoge fielmente el texto del artículo 8.`,
  },
  31: {
    article_id: 'c7cd787f-dc82-4a45-96b9-1a9500c5d138',
    explanation: `> Art. 9 del Decreto n.º 236/2010: la **información general** se facilita a los ciudadanos sin exigirles acreditación de legitimación alguna. Igualmente, el artículo 10 establece que la **información especializada** tampoco requiere acreditación de legitimación para ser facilitada. Por tanto, tanto la información general como la especializada se facilitan sin exigir legitimación.

**Por qué D es correcta:** Según el Decreto 236/2010, ni la información general (art. 9) ni la información especializada (art. 10) exigen al ciudadano acreditar su legitimación para ser facilitadas. Solo la **información particular** requiere que el solicitante acredite su identidad y relación con el asunto.

**Por qué las demás son incorrectas:** A) La información general por sí sola no es respuesta completa, pues también la especializada se facilita sin exigir legitimación. B) Igual que A, la información especializada por sí sola es respuesta incompleta. C) La información particular sí requiere acreditar legitimación; es la opción contraria.`,
  },
  32: {
    article_id: '96d8f7a6-b4ab-49f8-94b8-8eae05b24f66',
    explanation: `> Art. 7.1 del Reglamento (UE) 2016/679 (RGPD): "Cuando el tratamiento se base en el consentimiento del interesado, **el responsable del tratamiento** deberá ser capaz de demostrar que aquel consintió el tratamiento de sus datos personales."

**Por qué A es correcta:** El artículo 7.1 del RGPD establece que la carga de la prueba del consentimiento recae sobre el **responsable del tratamiento**, que debe poder acreditar que el interesado efectivamente consintió.

**Por qué las demás son incorrectas:** B) El encargado del tratamiento actúa por cuenta del responsable y no es quien ha de demostrar el consentimiento; esa obligación es del responsable. C) y D) No es el interesado quien debe demostrar que consintió o no consintió; la obligación probatoria recae sobre el responsable del tratamiento.`,
  },
  33: {
    article_id: '4d7b5558-116d-46b6-a3b1-c4f4806b8c4a',
    explanation: `> Art. 7.1 de la Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales: "El tratamiento de los datos personales de un menor de edad únicamente podrá fundarse en su consentimiento cuando sea **mayor de catorce años**."

**Por qué B es correcta:** El artículo 7.1 de la LO 3/2018 fija en **14 años** la edad mínima para que un menor pueda prestar válidamente su consentimiento al tratamiento de sus datos personales.

**Por qué las demás son incorrectas:** A) Los 16 años es el umbral que establece el RGPD como límite máximo que los Estados miembros pueden mantener, pero la LO 3/2018 ejerció la opción de bajarlo a 14 años. C) Los 12 años no está recogido en el artículo 7 de la LO 3/2018. D) No es correcta, pues la ley sí permite el consentimiento a partir de 14 años sin necesidad del titular de la patria potestad.`,
  },
  36: {
    article_id: 'b73db199-a7a4-46c3-992e-a45ec076f9e7',
    explanation: `> Art. 7.2 de la Ley Orgánica 3/2007, para la igualdad efectiva de mujeres y hombres: "Constituye acoso por razón de sexo cualquier comportamiento **realizado en función del sexo de una persona**, con el propósito o el efecto de atentar contra su dignidad y de crear un entorno intimidatorio, degradante u ofensivo."

**Por qué A es correcta:** El artículo 7.2 de la LO 3/2007 define el acoso por razón de sexo como aquel comportamiento **realizado en función del sexo de una persona**, diferenciándolo del acoso sexual (que requiere naturaleza sexual). El elemento clave es que se lleva a cabo por razón del sexo de la persona, no necesariamente mediante conductas de contenido sexual.

**Por qué las demás son incorrectas:** B) y C) Describen el **acoso sexual** (art. 7.1 LO 3/2007), que exige que el comportamiento sea de naturaleza sexual; el acoso por razón de sexo no requiere esa naturaleza. D) No es correcta, pues solo A recoge la definición legal del acoso por razón de sexo.`,
  },
  37: {
    article_id: '70c91057-28c2-41d8-83be-ab1cc42a51ca',
    explanation: `> Art. 9 de la Ley 12/2014, de Transparencia y Participación Ciudadana de la CARM: el apartado 4 dispone que cuando la información contuviera datos especialmente protegidos, la publicidad **solo se llevará a cabo previa disociación de los mismos**, no que no pueda llevarse a cabo. El apartado 5 establece que la actualización se realizará con carácter general **trimestralmente**.

**Por qué D es incorrecta (y es la respuesta correcta a "señale la incorrecta"):** El artículo 9.4 de la Ley 12/2014 CARM establece que cuando la información contuviera datos especialmente protegidos, la publicidad **sí podrá llevarse a cabo**, pero solo previa disociación de dichos datos. La opción D afirma erróneamente que "no podrá llevarse a cabo", cuando en realidad sí puede realizarse tras la disociación.

**Por qué las demás son correctas (y por ello no son la respuesta):** A) El artículo 9 exige que la información se presente de forma clara, estructurada y entendible. B) La actualización trimestral sí está recogida en el artículo 9.5. C) La oferta en formatos electrónicos reutilizables también está prevista en el artículo 9.`,
  },
  57: {
    article_id: 'f5d22ca2-36bc-45a3-820f-643e3b61939f',
    explanation: `> Art. 142.2 del Real Decreto Legislativo 8/2015 (TRLGSS): "Si no efectuase el descuento en dicho momento no podrá realizarlo con posterioridad, quedando obligado a ingresar la totalidad de las cuotas **a su exclusivo cargo**."

**Por qué C es correcta:** El artículo 142.2 del TRLGSS establece que si el empresario no practica el descuento de la cuota obrera en el momento de abonar el salario, **pierde el derecho a efectuarlo con posterioridad** y debe ingresar la totalidad de las cuotas (patronal y obrera) a su exclusivo cargo.

**Por qué las demás son incorrectas:** A) No existe un plazo posterior de seis meses; la norma es tajante: perdido el momento del pago del salario, ya no se puede descontar. B) No puede hacerlo en la siguiente nómina; la norma no admite aplazamiento del descuento. D) No es que asuma el 80%, sino la **totalidad** de las cuotas.`,
  },
  59: {
    article_id: 'fbb61320-86fd-4d6c-8d10-58501ab8891f',
    explanation: `> Art. 8 del Decreto Legislativo 1/1999, de la Hacienda Pública de la Región de Murcia: entre las competencias del Consejo de Gobierno figura "**prestar o denegar la conformidad a la tramitación de las proposiciones de ley o enmiendas que impliquen un aumento de los créditos presupuestarios del estado de gastos o una disminución de los ingresos presupuestarios**."

**Por qué B es correcta:** El artículo 8 del Decreto Legislativo 1/1999 atribuye al Consejo de Gobierno la competencia de **prestar o denegar conformidad** a las proposiciones de ley o enmiendas que supongan aumento del gasto o disminución de ingresos, garantizando el equilibrio presupuestario.

**Por qué las demás son incorrectas:** A) La elaboración y aprobación del anteproyecto de Ley de Presupuestos corresponde al Consejo de Gobierno, pero eso no es lo que recoge específicamente el artículo 8. C) Proponer el pago de obligaciones al ordenador de pagos es competencia del ordenador de gastos, no del Consejo de Gobierno según este artículo. D) Velar por la ejecución es una competencia genérica; el artículo 8 recoge concretamente la conformidad presupuestaria.`,
  },
  60: {
    article_id: '6fddef72-3313-418c-937d-bedf7a0795ab',
    explanation: `> Art. 13 del Decreto Legislativo 1/1999: "Los recursos de la Hacienda Pública Regional se destinarán a satisfacer el conjunto de sus obligaciones, **salvo que por ley se establezca su afectación a fines determinados**."

**Por qué D es correcta:** El artículo 13 del Decreto Legislativo 1/1999 establece el principio de no afectación de los recursos públicos, admitiendo como única excepción que sea **la propia ley** la que establezca la afectación a fines determinados. Ni el Consejero ni el Director General pueden hacerlo por acto administrativo.

**Por qué las demás son incorrectas:** A) Una Orden del Consejero de Economía y Hacienda no tiene rango suficiente para establecer afectaciones, según el artículo 13. B) Tampoco un Decreto del Consejo de Gobierno puede crear afectaciones; se requiere ley. C) El Director General no tiene competencia para ello.`,
  },
  61: {
    article_id: '608e3222-7996-4f4e-ac05-e963686f8573',
    explanation: `> Art. 19 del Decreto Legislativo 1/1999, prerrogativas de la Hacienda Pública Regional: "El procedimiento de apremio se iniciará mediante providencia **notificada al deudor** en la que se identificará la deuda pendiente y requerirá para que efectúe su pago con el recargo correspondiente."

**Por qué A es correcta:** El artículo 19 del Decreto Legislativo 1/1999 regula el procedimiento de apremio y establece que se inicia mediante **providencia notificada al deudor**, identificando la deuda y requiriéndole el pago con el recargo. Es un procedimiento administrativo ejecutivo que no necesita ratificación judicial.

**Por qué las demás son incorrectas:** B) Los procedimientos de apremio no se suspenden de oficio por la mera interposición de recursos; la suspensión requiere prestación de garantía o resolución expresa. C) La providencia de apremio no requiere ratificación judicial; tiene fuerza ejecutiva por sí misma. D) La solicitud de aplazamiento no determina la suspensión de oficio del procedimiento de apremio.`,
  },
  62: {
    article_id: '11fd5d48-b6c6-46ac-a9a8-1b5426eb5b05',
    explanation: `> Art. 27 del Decreto Legislativo 1/1999: "Los Presupuestos Generales de la Comunidad Autónoma constituyen la expresión cifrada, conjunta y sistemática de **las obligaciones que, como máximo, pueden reconocer la Administración Pública Regional y sus organismos autónomos**."

**Por qué B es correcta:** El artículo 27 define los Presupuestos Generales como expresión de las **obligaciones máximas** que pueden reconocerse, y de los derechos que se prevé liquidar durante el ejercicio. El carácter de techo máximo de gasto es el elemento clave de la definición.

**Por qué las demás son incorrectas:** A) No son los ingresos mínimos, sino las obligaciones máximas. C) No incluye todos los gastos e ingresos de la CARM y sus consorcios; la definición del artículo 27 se ciñe a la Administración y sus organismos autónomos. D) Las entidades públicas empresariales tienen su propio régimen; no quedan incluidas en la definición del artículo 27.`,
  },
  63: {
    article_id: '00ad391a-3c19-46b5-baf0-b1e4d6836c6e',
    explanation: `> Art. 48.2 del Decreto Legislativo 1/1999: "Cuando las circunstancias económicas así lo demanden, el Consejo de Gobierno, a propuesta del Consejero de Economía y Hacienda, podrá ordenar la no disponibilidad de créditos **hasta un diez por ciento del Presupuesto de Gastos**."

**Por qué A es correcta:** El artículo 48.2 del Decreto Legislativo 1/1999 limita la no disponibilidad de créditos que puede decretar el Consejo de Gobierno al **10% del Presupuesto de Gastos**, medida que permite contener el gasto ante situaciones económicas adversas.

**Por qué las demás son incorrectas:** B) El porcentaje no se refiere al Presupuesto de Ingresos, sino al de Gastos. C) El límite es del 10%, no del 20%. D) En ningún caso se fija el 20% del Presupuesto de Ingresos en este artículo.`,
  },
  64: {
    article_id: '4511ae53-af41-4db6-861f-12b276dafcbf',
    explanation: `> Art. 90 del Decreto Legislativo 1/1999, ámbito del control interno: "Serán intervenidos y contabilizados con arreglo a lo dispuesto en este Decreto Legislativo y en las disposiciones que lo desarrollen **todos los actos, documentos y expedientes de la Comunidad Autónoma de los que se deriven derechos y obligaciones de contenido económico**."

**Por qué D es correcta:** El artículo 90 no establece ningún umbral económico mínimo para la intervención y contabilización. Están sujetos a control **todos** los actos, documentos y expedientes con contenido económico, con independencia de su cuantía.

**Por qué las demás son incorrectas:** A), B) y C) introducen umbrales cuantitativos (10.000 €, 100.000 € o 150.000 €) que no existen en el texto del artículo 90. Cualquier derecho u obligación de contenido económico, cualquiera que sea su importe, queda sujeto a intervención y contabilización.`,
  },
  65: {
    article_id: '4ce9cd29-3739-47f0-b853-156d87a7ca6b',
    explanation: `> Art. 104 del Decreto Legislativo 1/1999: "El sometimiento al régimen de contabilidad pública comporta la obligación de rendir cuentas de las respectivas operaciones **a la Asamblea Regional y al Tribunal de Cuentas**."

**Por qué A es correcta:** El artículo 104 establece que las entidades sometidas al régimen de contabilidad pública deben rendir cuentas ante la **Asamblea Regional** (órgano de control parlamentario de la Comunidad Autónoma) y ante el **Tribunal de Cuentas** (órgano fiscalizador externo).

**Por qué las demás son incorrectas:** B) Rendir cuentas a la Intervención General es una obligación interna de gestión, pero no el destino final de la rendición de cuentas del artículo 104. C) El Consejo de Gobierno es el ejecutivo, no el órgano receptor final de cuentas. D) El SEC y el Tribunal de Cuentas Europeo son órganos de la Unión Europea, sin función fiscalizadora directa sobre la CARM.`,
  },
  68: {
    article_id: '4e3ffe13-b9b4-4db4-86b8-3a403fb58dbe',
    explanation: `> Art. 30.2 del Decreto Legislativo 1/1999, estructura de los Presupuestos: "La clasificación **orgánica** agrupará los créditos **por Secciones y Servicios presupuestarios**."

**Por qué B es correcta:** El artículo 30.2 del Decreto Legislativo 1/1999 establece con claridad que la **clasificación orgánica** es la que agrupa los créditos por Secciones y Servicios presupuestarios, reflejando la estructura organizativa de la Comunidad Autónoma.

**Por qué las demás son incorrectas:** A) Describe incorrectamente la clasificación orgánica atribuyéndole la función de establecer objetivos por programas, que corresponde a la clasificación funcional y por programas. C) Describe incorrectamente la clasificación funcional asignándole la agrupación por capítulos según tipo de operación, que es propia de la clasificación económica. D) No todas las respuestas anteriores son correctas, ya que A y C contienen errores.`,
  },
  69: {
    article_id: '00ad391a-3c19-46b5-baf0-b1e4d6836c6e',
    explanation: `> Art. 48.1 del Decreto Legislativo 1/1999, fases del procedimiento de gestión de créditos: la última fase es el **pago material**, que "es la operación por la que se satisfacen a los perceptores, a cuyo favor estuvieran".

**Por qué D es correcta:** El artículo 48.1 del Decreto Legislativo 1/1999 regula las fases del procedimiento de gestión presupuestaria (autorización, compromiso, reconocimiento de obligación, ordenación del pago y pago material). La opción D describe correctamente el **pago material**: la operación por la que se satisface el pago a los perceptores.

**Por qué las demás son incorrectas:** A) Describe la fase de **autorización** del gasto (reserva del crédito), no el reconocimiento de la obligación. B) Describe la fase de **compromiso** del gasto, no la autorización. C) El enunciado mezcla el reconocimiento de la obligación con la ordenación del pago de forma imprecisa.`,
  },
  74: {
    article_id: '54989a1e-fd20-4b45-b382-bd551f7723f5',
    explanation: `> Art. 122 de la Ley 39/2015 (recurso de alzada): el plazo para interponer el recurso de alzada contra un acto expreso es de **un mes** desde el día siguiente a su notificación. Art. 124 (recurso potestativo de reposición): también es de un mes.

**Por qué A es correcta:** Conforme a los artículos 122 y 124 de la Ley 39/2015, tanto el recurso de alzada como el recurso potestativo de reposición deben interponerse en el plazo de **un mes** cuando se dirigen contra actos expresos. En consecuencia, el plazo para el recurso en vía administrativa contra la resolución de concesión de la subvención es de **un mes**.

**Por qué las demás son incorrectas:** B), C) y D) Los plazos de dos meses, tres meses y seis meses no corresponden al recurso de alzada ni al recurso potestativo de reposición. El plazo de dos meses sí existe para el recurso contencioso-administrativo (LJCA), pero no para los recursos administrativos ordinarios.`,
  },
  81: {
    article_id: 'e23671e3-0506-4040-9e82-d3f85fb3682d',
    explanation: `> Art. 16 de la Ley 7/2004, de organización y régimen jurídico de la Administración de la CARM: el Consejero competente por razón de la materia es quien resuelve los procedimientos de responsabilidad patrimonial derivados de los servicios de su Consejería.

**Por qué C es correcta:** El artículo 16 de la Ley 7/2004 atribuye a los Consejeros la competencia para resolver los procedimientos incoados en el ámbito de su Consejería. Al ser el daño producido en un centro educativo (IES), es el **Consejero de Educación** quien tiene competencia por razón de la materia.

**Por qué las demás son incorrectas:** A) El Consejero de Hacienda autoriza pagos pero no es el competente para resolver el procedimiento de responsabilidad patrimonial de otra Consejería. B) El Consejero de Patrimonio gestiona los bienes de la CARM, pero la responsabilidad patrimonial derivada del funcionamiento de un servicio educativo corresponde al Consejero de Educación. D) El director del IES no tiene competencia para resolver procedimientos de responsabilidad patrimonial.`,
  },
  83: {
    article_id: 'd757d1a8-875e-410d-b281-0b1f088ec910',
    explanation: `> Art. 41 de la Ley 39/2015, sobre notificaciones: las personas físicas que no estén obligadas a relacionarse electrónicamente con la Administración recibirán la notificación **en el medio elegido en la solicitud**. Si en la solicitud se indicó la vía electrónica, la notificación se realizará electrónicamente.

**Por qué C es correcta:** Ramón López es una persona física que no está obligado a relacionarse electrónicamente con la Administración (su empresa sí, pero el procedimiento de responsabilidad patrimonial lo ha iniciado él como particular). Por tanto, la notificación se realizará en el medio de comunicación que él haya indicado en su solicitud; si indicó la vía electrónica, se notificará electrónicamente.

**Por qué las demás son incorrectas:** A) Las personas físicas no están obligadas a recibir todas las notificaciones de forma electrónica, solo quienes están sujetos al art. 14.2 LPA. B) El correo certificado no es el medio que impone la ley para este tipo de resoluciones. D) El correo electrónico no es equivalente a la notificación electrónica a través de la sede electrónica o DEH.`,
  },
  88: {
    article_id: '9756d01e-7437-4d04-bac0-2097ce707e47',
    explanation: `> Art. 35 de la Ley 7/2004, de organización y régimen jurídico de la Administración de la CARM: los **Consejeros** son los órganos de contratación dentro de su Consejería para los contratos cuya cuantía no supere los umbrales legales de competencia del Consejo de Gobierno.

**Por qué B es correcta:** El artículo 35 de la Ley 7/2004 atribuye a los **Consejeros** la condición de órgano de contratación dentro de su ámbito competencial. Al ser el contrato de desarrollo informático un contrato de servicios en el ámbito de la Consejería de Salud, el **Consejero de Salud** es el órgano de contratación competente.

**Por qué las demás son incorrectas:** A) La Mesa de contratación es un órgano colegiado de carácter técnico que asesora al órgano de contratación, pero no es ella misma el órgano de contratación. C) El Director General no es el órgano de contratación según el artículo 35; ese rol corresponde al Consejero. D) La jefa del Servicio de Epidemiología es personal técnico, sin competencia de contratación.`,
  },
  91: {
    article_id: null,  // Q91: no article_number, sobre crédito extraordinario vs suplemento - DL1/1999 pero needs check
    reason: 'Q91 no tiene article_number en el JSON y la respuesta correcta (suplemento de crédito vs crédito extraordinario) requiere verificar el artículo exacto del DL1/1999. Marcado para revisión humana.',
  },
  92: {
    article_id: '9f4b2e51-953a-47f1-b705-f40423b267d0',
    explanation: `> Art. 44 del Decreto Legislativo 1/1999, transferencias de crédito: el artículo regula los órganos competentes para autorizar transferencias, y establece que las transferencias que impliquen variación de personal (capítulo I) no pueden autorizarse con carácter general por el Consejero o el Consejero de Hacienda.

**Por qué D es correcta:** El artículo 44 del Decreto Legislativo 1/1999 establece límites específicos para las transferencias de crédito. Una transferencia del crédito sobrante de una obra hacia capítulo de personal está especialmente restringida: **ninguno de los órganos enumerados** (Consejero de Salud, Consejero de Economía y Hacienda ni Consejo de Gobierno) puede autorizarla en esas condiciones específicas, pues implicaría burlar la regla de que las dotaciones de personal son rígidas.

**Por qué las demás son incorrectas:** A) El Consejero de Salud no puede autorizar transferencias que afecten al capítulo de gastos de personal de otras secciones. B) El Consejero de Economía y Hacienda tampoco tiene competencia para autorizar esta clase de transferencia. C) El Consejo de Gobierno tampoco puede autorizar este tipo de transferencia según el artículo 44.`,
  },
  93: {
    article_id: '543e39e5-99ff-44f4-b615-4784590015bc',
    explanation: `> Art. 43 del Decreto Legislativo 1/1999, modificaciones de créditos con asignación nominativa: las modificaciones de créditos con asignación nominativa (en este caso, partidas diferenciadas de programas de salud) requieren autorización del **Consejo de Gobierno**.

**Por qué A es correcta:** El artículo 43 del Decreto Legislativo 1/1999 establece que las **modificaciones de créditos con asignación nominativa** (créditos adscritos a finalidades específicas, como programas sanitarios concretos) deben ser autorizadas por el **Consejo de Gobierno**, que es el órgano con competencia para alterarlas.

**Por qué las demás son incorrectas:** B) El Consejero de Economía y Hacienda no tiene competencia para autorizar modificaciones de créditos con asignación nominativa, que corresponden al Consejo de Gobierno. C) El Consejero de Salud puede ejecutar el gasto pero no puede modificar créditos nominativos unilateralmente. D) La modificación sí es posible mediante el procedimiento del artículo 43, con autorización del Consejo de Gobierno.`,
  },
  95: {
    article_id: '8d01beb9-e286-45be-b7f7-807de57bd9b5',
    explanation: `> Art. 36 del Decreto Legislativo 1/1999, limitación de los compromisos de gasto: "Se entenderán nulos de pleno derecho los actos administrativos y las disposiciones generales que incumplan la limitación establecida en este artículo."

**Por qué A es correcta:** El artículo 36 del Decreto Legislativo 1/1999 establece que adquirir compromisos de gasto por encima del crédito autorizado está **prohibido** y los actos que lo incumplan son **nulos de pleno derecho**. La nulidad de pleno derecho opera automáticamente, sin necesidad de declaración previa de lesividad.

**Por qué las demás son incorrectas:** B) La anulabilidad requiere impugnación y declaración de lesividad; el artículo 36 impone directamente la nulidad de pleno derecho. C) La generación de crédito es un mecanismo diferente que permite ampliar créditos por ingresos adicionales, no aplica aquí. D) El anticipo de tesorería es un instrumento de liquidez a corto plazo, no tiene relación con el exceso de compromiso de gasto.`,
  },
  96: {
    article_id: '8b79ec00-a25f-4c99-aa81-b9e2ed4cf4b5',
    explanation: `> Art. 38 del Decreto Legislativo 1/1999, incorporaciones de crédito: "**El Consejero de Economía y Hacienda** podrá hacer la incorporación de crédito en los casos especialmente justificados."

**Por qué C es correcta:** El artículo 38 atribuye al **Consejero de Economía y Hacienda** la facultad potestativa ("podrá") de incorporar créditos al ejercicio siguiente, en los casos especialmente justificados. Es una decisión discrecional del Consejero, no una obligación ni una competencia del Consejo de Gobierno.

**Por qué las demás son incorrectas:** A) Describe incorrectamente al Consejo de Gobierno como competente y usa el término "podrá", cuando el artículo 38 atribuye la facultad al Consejero de Economía y Hacienda. B) El Consejo de Gobierno no está designado en el artículo 38 para autorizar incorporaciones. D) No es una obligación ("deberá") sino una facultad ("podrá") del Consejero de Economía y Hacienda.`,
  },
  97: {
    article_id: 'fbc4d5f5-6965-41a8-bb46-98297a821625',
    explanation: `> Art. 25 del Decreto Legislativo 1/1999, prescripción: el plazo para solicitar la devolución de un ingreso indebido es de **cuatro años desde la fecha en que dicho ingreso hubiera sido realizado**.

**Por qué B es correcta:** El artículo 25 del Decreto Legislativo 1/1999 establece que el derecho a solicitar la devolución de ingresos indebidos prescribe a los **cuatro años** contados desde la fecha en que se realizó el ingreso. Este plazo de cuatro años es el régimen general de prescripción de las obligaciones de la Hacienda Pública Regional.

**Por qué las demás son incorrectas:** A) El plazo de cuatro años se cuenta desde el ingreso, no desde la notificación de la obligación. C) El plazo no es de cinco años según el artículo 25. D) Cinco años desde la notificación tampoco coincide con el texto del artículo 25.`,
  },
};

// Questions that are needs_human (not in QUESTION_MAP or have null article_id)
const NEEDS_HUMAN_REASONS = {
  28: 'Ley 3/1992 de Patrimonio de la CARM no está en BD (out of scope)',
  29: 'Ley 3/1992 Art 26 - ley no está en BD',
  38: 'Ley 19/2013 transparencia estatal no está en scope del examen CARM (Ley 12/2014 CARM es la que aplica)',
  40: 'Ley 53/1984 de Incompatibilidades - no está en scope del examen CARM',
  41: 'TRLFPRM (DL 1/2001 Función Pública Murcia) - no está en BD/scope',
  42: 'TRLFPRM Art 28 - ley no está en BD',
  43: 'TRLFPRM Art 38 - ley no está en BD',
  54: 'RD 203/2021 (sector público electrónico) - no está en BD',
  58: 'RDL 670/1987 Clases Pasivas del Estado - no está en BD',
  66: 'LOFCA Art 6 - ley no está en scope del examen CARM',
  67: 'LOFCA Art 12 - ley no está en scope',
  91: 'Q91 sin article_number; pregunta sobre crédito extraordinario vs suplemento de crédito en DL1/1999 sin artículo identificado',
  98: 'Ley de Tasas de la CARM - no está en BD',
  99: 'Ley de Tasas de la CARM Art 6 - ley no está en BD',
  100: 'Plan General de Prevención de Riesgos Laborales de la CARM - no es articulado de ley, es un plan administrativo sin artículo en BD',
};

async function checkDuplicate(hash) {
  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .eq('content_hash', hash)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0].id : null;
}

async function insertQuestion(q, articleId, explanation, examSource) {
  const hash = contentHash(q.question, q.option_a, q.option_b, q.option_c, q.option_d);
  // q.question is the JSON field name (maps to question_text in DB)

  // Check duplicate
  const dupId = await checkDuplicate(hash);
  if (dupId) {
    return { status: 'duplicate', existing_id: dupId };
  }

  const correctOption = letterToIndex(q.correct_letter);

  // Insert into questions
  const { data: inserted, error: insertErr } = await supabase
    .from('questions')
    .insert({
      question_text: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: correctOption,
      explanation: explanation,
      primary_article_id: articleId,
      lifecycle_state: 'draft',
      is_official_exam: true,
      exam_position: EXAM_POSITION,
      exam_source: examSource,
      content_hash: hash,
      tags: TAGS,
      difficulty: 2,
    })
    .select('id')
    .single();

  if (insertErr) throw insertErr;

  const questionId = inserted.id;

  // Insert into question_official_exams
  const { error: examErr } = await supabase
    .from('question_official_exams')
    .insert({
      question_id: questionId,
      exam_source: examSource,
      exam_part: 'primera',
      question_number: q.num,
      oposicion_type: OPOSICION_TYPE,
    });

  if (examErr) {
    console.warn(`  ⚠️  question_official_exams insert failed for Q${q.num}:`, examErr.message);
  }

  return { status: 'imported', question_id: questionId };
}

async function main() {
  const examData = JSON.parse(fs.readFileSync(EXAM_JSON_PATH, 'utf8'));

  // Init or load report
  let report = [];
  if (fs.existsSync(REPORT_PATH)) {
    try {
      report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    } catch (e) {
      report = [];
    }
  }

  // Get already-processed question numbers from report
  const alreadyProcessed = new Set(report.map(r => r.num));

  let importedCount = 0;
  let needsHumanCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const q of examData) {
    // Only process unresolved questions
    if (q.resolved !== false) continue;

    // Skip already processed
    if (alreadyProcessed.has(q.num)) {
      console.log(`Q${q.num}: already in report, skipping`);
      continue;
    }

    const qNum = q.num;
    const decision = QUESTION_MAP[qNum];

    // Check if it's needs_human
    if (NEEDS_HUMAN_REASONS[qNum] || (decision && decision.article_id === null && decision.reason)) {
      const reason = NEEDS_HUMAN_REASONS[qNum] || decision.reason;
      console.log(`Q${qNum}: NEEDS_HUMAN - ${reason}`);
      const entry = {
        num: qNum,
        status: 'needs_human',
        reason: reason,
        question: q.question.substring(0, 80) + '...',
      };
      report.push(entry);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      needsHumanCount++;
      continue;
    }

    if (!decision) {
      console.log(`Q${qNum}: No decision found - marking needs_human`);
      const entry = {
        num: qNum,
        status: 'needs_human',
        reason: 'No import decision defined for this question',
        question: q.question.substring(0, 80) + '...',
      };
      report.push(entry);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      needsHumanCount++;
      continue;
    }

    // Import this question
    console.log(`Q${qNum}: Importing...`);
    try {
      const result = await insertQuestion(q, decision.article_id, decision.explanation, EXAM_SOURCE);
      const entry = {
        num: qNum,
        status: result.status,
        question_id: result.question_id || null,
        existing_id: result.existing_id || null,
        question: q.question.substring(0, 80) + '...',
        article_id: decision.article_id,
      };
      report.push(entry);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

      if (result.status === 'imported') {
        console.log(`  ✅ Imported as ${result.question_id}`);
        importedCount++;
      } else if (result.status === 'duplicate') {
        console.log(`  ⚠️  Duplicate - existing: ${result.existing_id}`);
        duplicateCount++;
      }
    } catch (err) {
      console.error(`  ❌ Error inserting Q${qNum}:`, err.message);
      const entry = {
        num: qNum,
        status: 'error',
        error: err.message,
        question: q.question.substring(0, 80) + '...',
      };
      report.push(entry);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      errorCount++;
    }
  }

  console.log('\n=== IMPORT SUMMARY ===');
  console.log(`Imported: ${importedCount}`);
  console.log(`Needs human: ${needsHumanCount}`);
  console.log(`Duplicates: ${duplicateCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
