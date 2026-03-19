require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/2007 art.10 consecuencias discriminacion
  const exp1 = `**Articulo 10 de la LO 3/2007** (Consecuencias juridicas de las conductas discriminatorias):

> "Los actos y las clausulas de los negocios juridicos que constituyan o causen discriminacion por razon de sexo se consideraran **nulos y sin efecto**, y daran lugar a responsabilidad a traves de un sistema de **reparaciones o indemnizaciones** que sean reales, efectivas y proporcionadas al perjuicio sufrido, asi como [...] un sistema **eficaz y disuasorio de sanciones**."

**Por que C es la INCORRECTA:**
La opcion C dice "se consideraran **anulables** de oficio o a instancia de parte". Falso: el art. 10 dice que son **nulos y sin efecto**, no "anulables". La diferencia es juridicamente crucial:
- **Nulo**: el acto no produce efectos desde el inicio, es nulidad radical
- **Anulable**: el acto produce efectos hasta que alguien lo impugna

Los actos discriminatorios por razon de sexo son **nulos de pleno derecho** (nulidad radical, no anulabilidad).

**Por que las demas son correctas:**

- **A)** "Indemnizaciones reales, efectivas y proporcionadas". SI: el art. 10 lo menciona expresamente.

- **B)** "Sistema eficaz y disuasorio de sanciones". SI: el art. 10 lo menciona expresamente para prevenir conductas discriminatorias.

- **D)** "Reparaciones reales, efectivas y proporcionadas". SI: el art. 10 dice "reparaciones **o** indemnizaciones" reales, efectivas y proporcionadas. Tanto A como D son parcialmente correctas.

**Clave:** Nulo (radical, sin efectos desde el inicio) vs anulable (produce efectos hasta impugnacion). Los actos discriminatorios son NULOS.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ff11c9ae-62d8-4b70-8ac6-c5be58f25eef");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/2007 art.10 discriminacion (" + exp1.length + " chars)");

  // #2 - CE art.67 mandato imperativo
  const exp2 = `**Articulo 67.2 de la Constitucion Espanola:**

> "Los miembros de las Cortes Generales **no estaran ligados por mandato imperativo**."

**Por que B es correcta:**
El art. 67.2 establece la prohibicion del mandato imperativo. Esto significa que los parlamentarios representan al pueblo en su conjunto y votan segun su conciencia, no segun instrucciones vinculantes de sus electores, partidos o grupos de presion. Es una garantia de la libertad del parlamentario.

**Por que las demas son incorrectas:**

- **A)** "Potestativo". El mandato potestativo no es un concepto juridico reconocido en este contexto. La CE no menciona ninguna forma de mandato "potestativo" para los parlamentarios.

- **C)** "Autoritario". El mandato "autoritario" no es un termino juridico constitucional. Es un distractor que suena plausible pero no tiene base en la CE ni en la doctrina constitucional.

- **D)** "Perceptivo". Este termino no existe en el vocabulario juridico-constitucional. Es un distractor inventado (posible confusion con "preceptivo").

**Que significa la prohibicion del mandato imperativo:**
- Los parlamentarios no estan obligados a votar lo que su partido les ordene (aunque en la practica la disciplina de partido sea fuerte)
- Representan a todo el pueblo, no solo a sus electores
- No pueden ser revocados por no seguir instrucciones de sus votantes`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e27ac7f8-8cb8-426d-a46f-3d54529a1527");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.67 mandato imperativo (" + exp2.length + " chars)");

  // #3 - CE art.78 Diputacion Permanente
  const exp3 = `**Articulo 78 de la Constitucion Espanola** (Diputacion Permanente):

> **78.1:** "En cada Camara habra una Diputacion Permanente compuesta por un **minimo de veintiun miembros**."

> **78.2:** "Las Diputaciones Permanentes estaran presididas por el **Presidente de la Camara respectiva** y tendran como funciones [...] la de **velar por los poderes de las Camaras** cuando estas no esten reunidas."

> **78.3:** "Expirado el mandato [...] las Diputaciones Permanentes **seguiran ejerciendo** sus funciones hasta la constitucion de las nuevas Cortes Generales."

**Por que A es correcta:**
El art. 78.2 establece que las Diputaciones Permanentes velan por los poderes de las Camaras cuando estas no estan reunidas. Reproduccion literal del texto constitucional.

**Por que las demas son incorrectas:**

- **B)** "Un **maximo** de veintiun miembros". Falso: el art. 78.1 dice un **minimo** de 21 miembros, no un maximo. Pueden ser mas de 21. Es un cambio de una sola palabra que invierte el significado.

- **C)** "Presidida por el Presidente del Senado y viceversa". Falso: el art. 78.2 dice "Presidente de la **Camara respectiva**". Cada Diputacion Permanente la preside el Presidente de su propia Camara, no el de la otra. No hay cruce de presidencias.

- **D)** "Dejan de ejercer sus funciones". Falso: dice exactamente lo contrario del art. 78.3. Las Diputaciones Permanentes **siguen ejerciendo** sus funciones hasta que se constituyan las nuevas Cortes. Es su razon de ser: garantizar la continuidad parlamentaria.

**Truco:** Tres cambios sutiles: minimo/maximo (B), respectiva/cruzada (C), siguen/dejan (D). Todas invierten el sentido del articulo.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "7fa5738f-01eb-45d7-bb04-9c4a8bbb2e58");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.78 Diputacion Permanente (" + exp3.length + " chars)");
})();
