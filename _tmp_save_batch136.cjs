require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.73.2 sesiones extraordinarias Diputacion Permanente
  const exp1 = `**Articulo 73.2 de la Constitucion Espanola:**

> "Las Camaras podran reunirse en sesiones extraordinarias a peticion del **Gobierno**, de la **Diputacion Permanente** o de la **mayoria absoluta de los miembros** de cualquiera de las Camaras. Las sesiones extraordinarias deberan convocarse sobre un orden del dia determinado y seran clausuradas una vez que este haya sido agotado."

**Por que D es correcta (Diputacion permanente del Congreso):**
El art. 73.2 CE enumera tres sujetos legitimados para solicitar sesiones extraordinarias: el Gobierno, la Diputacion Permanente y la mayoria absoluta de los miembros de cualquiera de las Camaras. La Diputacion Permanente del Congreso es uno de esos tres sujetos.

**Por que las demas son incorrectas:**

- **A)** "El Presidente del Gobierno". Falso: el art. 73.2 dice "**el Gobierno**", no "el Presidente del Gobierno". La distincion es relevante: el Gobierno es un organo colegiado (Consejo de Ministros), mientras que el Presidente es una sola persona. Constitucionalmente, la peticion corresponde al Gobierno como organo, no al Presidente individualmente.

- **B)** "El Presidente del Congreso". Falso: el art. 73.2 no menciona al Presidente del Congreso entre los legitimados. El Presidente del Congreso **convoca** la sesion extraordinaria, pero no es quien la **solicita** (la solicitud viene del Gobierno, la Diputacion Permanente o la mayoria absoluta).

- **C)** "El Presidente de cualquiera de las Camaras". Falso: por la misma razon que B. Los Presidentes de las Camaras no figuran en el art. 73.2 como solicitantes. No confundir el papel de convocar (que corresponde al Presidente de la Camara) con el de solicitar.

**Quien puede solicitar sesiones extraordinarias (art. 73.2):**
1. El **Gobierno** (no su Presidente)
2. La **Diputacion Permanente**
3. La **mayoria absoluta** de los miembros de cualquiera de las Camaras

**Clave:** "Gobierno" (no "Presidente del Gobierno"). Los Presidentes de Camaras convocan, no solicitan. La Diputacion Permanente si puede solicitar.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f225d968-8cc4-4a51-8f09-d8b2b71d090c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.73.2 sesiones extraordinarias (" + exp1.length + " chars)");

  // #2 - CE art.74.2 Fondo Compensacion inicia Senado
  const exp2 = `**Articulo 74.2 de la Constitucion Espanola:**

> "Las decisiones de las Cortes Generales previstas en los articulos **94.1**, **145.2** y **158.2**, se adoptaran por mayoria de cada una de las Camaras. En el **primer caso**, el procedimiento se iniciara por el **Congreso**, y en los **otros dos**, por el **Senado**."

**Por que B es correcta (el Senado):**
El art. 158.2 CE regula el **Fondo de Compensacion Interterritorial**. Segun el art. 74.2, los procedimientos de los arts. 145.2 y 158.2 se inician por el **Senado**. Como el Fondo de Compensacion es el art. 158.2, el procedimiento lo inicia el Senado.

**Distribucion segun art. 74.2:**
- Art. 94.1 (tratados internacionales) → inicia **Congreso**
- Art. 145.2 (convenios entre CCAA) → inicia **Senado**
- Art. 158.2 (Fondo de Compensacion) → inicia **Senado**

**Por que las demas son incorrectas:**

- **A)** "El Presidente del Gobierno". Falso: el art. 74.2 no atribuye al Presidente del Gobierno la iniciacion de ningun procedimiento de los tres. Los sujetos son las propias Camaras (Congreso o Senado).

- **C)** "Ambas Camaras conjuntamente". Falso: la trampa confunde el art. 74.**1** (sesion conjunta para competencias no legislativas del Titulo II) con el art. 74.**2** (decisiones de los arts. 94.1, 145.2 y 158.2 iniciadas por una Camara concreta). El Fondo de Compensacion no se tramita en sesion conjunta.

- **D)** "El Congreso de los Diputados". Falso: esta es la trampa principal. El Congreso inicia el procedimiento del art. **94.1** (tratados), no el del art. 158.2 (Fondo). El Fondo de Compensacion lo inicia el **Senado**. Es facil confundir cual empieza cada Camara.

**Regla mnemotecnica:** El Senado es la Camara de representacion territorial (art. 69.1 CE), por eso inicia los procedimientos de caracter territorial: convenios entre CCAA (145.2) y Fondo de Compensacion (158.2).

**Clave:** Fondo de Compensacion (art. 158.2) → inicia el **Senado**. Tratados (art. 94.1) → inicia el Congreso. No confundir.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1a2f9171-d6ca-4d09-99e2-473ba0a7d37a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.74.2 Fondo Compensacion Senado (" + exp2.length + " chars)");

  // #3 - CE art.74.1 sesion conjunta competencias no legislativas Titulo II
  const exp3 = `**Articulo 74.1 de la Constitucion Espanola:**

> "Las Camaras se reuniran en **sesion conjunta** para ejercer las **competencias no legislativas** que el **Titulo II** atribuye expresamente a las Cortes Generales."

**Por que D es correcta (nombrar al tutor del Rey):**
El art. 60.1 CE (Titulo II - De la Corona) establece que, a falta de tutor testamentario o padre/madre viudos, "lo nombraran las **Cortes Generales**". Esta es una **competencia no legislativa** del Titulo II, exactamente el tipo de funcion para la que las Camaras se reunen en sesion conjunta segun el art. 74.1.

**Competencias del Titulo II ejercidas en sesion conjunta:**
- Nombramiento de tutor del Rey (art. 60)
- Nombramiento de Regente (art. 59.3)
- Reconocimiento de la inhabilitacion del Rey (art. 59.2)
- Proclamacion del Rey (art. 61)

**Por que las demas son incorrectas:**

- **A)** "Siempre que lo soliciten una decima parte de los miembros de cualquiera de las Camaras". Falso: esta referencia corresponde al art. **76** CE (comisiones de investigacion), donde "el Congreso, el Senado o ambas Camaras conjuntamente" pueden nombrar comisiones "a propuesta del Gobierno o de cualquiera de las Camaras". La "decima parte" no aparece en el art. 74.1. Ademas, las comisiones de investigacion no requieren sesion conjunta.

- **B)** "Para autorizar los Tratados del art. 93 CE". Falso: los tratados del art. 94.1 se tramitan por el procedimiento del art. **74.2**, que se inicia en el Congreso y luego pasa al Senado (cada Camara vota por separado). No se requiere sesion conjunta para tratados.

- **C)** "Para otorgar la confianza al Presidente". Falso: la cuestion de confianza (art. 112 CE) es competencia **exclusiva del Congreso**. El Senado no participa. No puede ser sesion conjunta si solo interviene una Camara.

**Clave:** Sesion conjunta = competencias no legislativas del Titulo II (Corona): tutor, Regente, inhabilitacion. No confundir con tratados (art. 74.2, Camaras separadas) ni con cuestion de confianza (solo Congreso).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "06932eed-497d-4ed4-ad29-16e911556fcf");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.74.1 sesion conjunta (" + exp3.length + " chars)");
})();
