require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.68.5 Estado facilita sufragio espanoles extranjero
  const exp1 = `**Articulo 68.5 de la Constitucion Espanola:**

> "La ley **reconocera** y **el Estado facilitara** el ejercicio del derecho de sufragio a los espanoles que se encuentren fuera del territorio de Espana."

**Por que A es correcta (el Estado):**
El art. 68.5 CE distingue dos acciones: la ley **reconoce** el derecho y **el Estado** lo **facilita**. La pregunta pide quien **facilita** el ejercicio del sufragio en el extranjero, y la respuesta es el **Estado**. Facilitar implica medidas practicas: consulados, voto por correo, censo de residentes ausentes (CERA), etc.

**Por que las demas son incorrectas:**

- **B)** "Las Cortes Generales". Falso: las Cortes Generales son el organo legislativo. Pueden aprobar leyes sobre el sufragio, pero el art. 68.5 no les atribuye la funcion de "facilitar" el voto en el extranjero. Esa funcion corresponde al Estado (poder ejecutivo y sus organos en el exterior).

- **C)** "La Ley". Trampa sutil: el art. 68.5 dice que "la ley **reconocera**" el derecho, pero no que la ley lo "facilitara". La ley reconoce; el Estado facilita. Son dos verbos y dos sujetos distintos en la misma frase. La trampa confunde "reconocer" con "facilitar".

- **D)** "El Rey". Falso: el Rey como Jefe del Estado tiene funciones representativas y simbolicas (art. 56 CE), pero no se le atribuye la facilitacion del sufragio en el extranjero. El art. 68.5 habla del "Estado" como organizacion administrativa, no del Rey.

**Clave:** "La ley **reconocera**" (reconoce) + "el Estado **facilitara**" (facilita). Dos sujetos, dos verbos distintos. La pregunta pide quien facilita: el Estado.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "9a59a7a8-e4f2-4b9d-8a7c-e0baf8d9249c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.68.5 Estado facilita sufragio (" + exp1.length + " chars)");

  // #2 - LOREG art.162 Congreso 350 diputados (no CE 300-400)
  const exp2 = `**Articulo 162.1 de la LOREG (LO 5/1985):**

> "El Congreso esta formado por **trescientos cincuenta Diputados**."

**Articulo 68.1 de la Constitucion Espanola:**

> "El Congreso se compone de un **minimo de 300 y un maximo de 400** Diputados."

**Por que D es correcta (350 diputados):**
La pregunta dice "**Segun la LOREG**", no "segun la CE". La CE establece un rango (300-400), pero la LOREG concreta el numero exacto: **350 diputados**. Desde 1985, el Congreso tiene siempre 350 escanos.

**Por que las demas son incorrectas:**

- **A)** "Un minimo de 300 y un maximo de 400". Esta es la horquilla de la **CE** (art. 68.1), no la cifra de la LOREG. La pregunta pide la respuesta segun la LOREG, que fija un numero exacto (350), no un rango. Esta es la trampa principal: confundir CE con LOREG.

- **B)** "300 diputados". Falso: 300 es el **minimo** constitucional (art. 68.1 CE). La LOREG no fija 300 sino 350.

- **C)** "400 diputados". Falso: 400 es el **maximo** constitucional (art. 68.1 CE). La LOREG no fija 400 sino 350.

**CE vs LOREG:**

| Norma | Cifra |
|-------|-------|
| CE art. 68.1 | Minimo 300, maximo 400 |
| **LOREG art. 162.1** | **350** (cifra exacta) |

**Clave:** La CE da el rango (300-400), la LOREG lo concreta en 350. Si la pregunta dice "segun la LOREG", la respuesta es 350, no el rango de la CE.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "b6452a74-e078-4682-a02f-d6598171d681");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOREG art.162 350 diputados (" + exp2.length + " chars)");

  // #3 - Ley 39/2015 art.5.5 acreditacion condicion representante
  const exp3 = `**Articulo 5.5 de la Ley 39/2015 (LPAC):**

> "El organo competente para la tramitacion del procedimiento debera incorporar al expediente administrativo acreditacion de la **condicion de representante** y de los poderes que tiene reconocidos en dicho momento. El documento electronico que acredite el resultado de la consulta al **registro electronico de apoderamientos** correspondiente tendra la condicion de acreditacion a estos efectos."

**Por que A es correcta (condicion de representante):**
El art. 5.5 LPAC exige que se incorpore al expediente la acreditacion de la **condicion de representante**. Es decir, lo que debe quedar probado es **que la persona es representante** y cuales son sus poderes. Esta es la obligacion sustantiva del organo tramitador.

**Por que las demas son incorrectas:**

- **B)** "Del resultado de la consulta al registro electronico de apoderamientos". Trampa sutil: el registro electronico de apoderamientos es el **medio** o instrumento para acreditar la representacion, no **lo que** se acredita. El art. 5.5 dice que el documento del registro "tendra la condicion de acreditacion a estos efectos", es decir, es la forma de probar la condicion de representante, no el objeto de la acreditacion en si.

- **C)** "Del numero de procedimientos en que va a intervenir como representante". Falso: el art. 5.5 no exige acreditar en cuantos procedimientos interviene el representante. Este dato es irrelevante para la incorporacion al expediente. Es un distractor inventado.

- **D)** "Las respuestas A y C son correctas". Falso: como C es incorrecta (el numero de procedimientos no se acredita), D tambien es incorrecta.

**Clave:** Se acredita la **condicion** de representante (A), no el medio de consulta (B) ni el numero de procedimientos (C). El registro electronico es el instrumento, no el objeto de la acreditacion.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "a079073d-9d40-4b24-9b39-f2a48940ca4b");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 39/2015 art.5.5 representante (" + exp3.length + " chars)");
})();
