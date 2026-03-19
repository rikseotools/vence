require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/2018 art.49 Consejo Consultivo AEPD no vinculante
  const exp1 = `**Articulo 49.5 de la LO 3/2018 (LOPDGDD):**

> "Las decisiones tomadas por el Consejo Consultivo **no tendran en ningun caso caracter vinculante**."

**Por que A es correcta (no vinculante):**
El Consejo Consultivo de la AEPD es un organo **asesor** que orienta a la Presidencia de la Agencia, pero sus decisiones no obligan. "No vinculante" significa que la Presidencia puede actuar sin seguir las recomendaciones del Consejo. Esto preserva la **independencia** del Director/a de la AEPD para tomar decisiones autonomas.

**Por que las demas son incorrectas:**

- **B)** "Vinculante y general". Falso: el art. 49.5 dice expresamente lo contrario: "no tendran **en ningun caso** caracter vinculante". Ademas, "general" implicaria efectos erga omnes, algo propio de normas, no de un organo consultivo.

- **C)** "Vinculante". Falso: contradice directamente el art. 49.5. Si fueran vinculantes, el Consejo Consultivo tendria poder de decision real, pero la ley lo configura como organo meramente asesor.

- **D)** "La LO 3/2018 no establece nada al respecto". Falso: el art. 49.5 establece **expresamente** que no son vinculantes. La ley SI regula este aspecto.

**Estructura de la AEPD (arts. 44-49 LOPDGDD):**
- **Presidencia** (art. 48): organo decisorio, independiente
- **Adjunto/a** (art. 48): sustitucion y funciones delegadas
- **Consejo Consultivo** (art. 49): organo asesor, **no vinculante**

**Clave:** Consejo Consultivo = asesor, no vinculante. "En ningun caso" vinculante.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "3a854e30-8a02-472d-b545-0350401c7309");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/2018 Consejo Consultivo AEPD (" + exp1.length + " chars)");

  // #2 - CE art.61.2 juramento Principe heredero al mayoria de edad
  const exp2 = `**Articulo 61.2 de la Constitucion Espanola:**

> "El Principe heredero, **al alcanzar la mayoria de edad**, y el Regente o Regentes **al hacerse cargo de sus funciones**, prestaran el mismo juramento, asi como el de **fidelidad al Rey**."

**Por que A es correcta:**
El Principe heredero presta juramento **al alcanzar la mayoria de edad** (18 anos). No espera a ser proclamado Rey ni lo hace durante la minoria de edad. Ademas del juramento general (guardar la CE, leyes, derechos), anade el juramento de **fidelidad al Rey**.

**Por que las demas son incorrectas:**

- **B)** "El Regente, al **rendir cuenta** de sus funciones". Falso: el art. 61.2 dice que el Regente jura "al **hacerse cargo** de sus funciones", no "al rendir cuenta". La trampa invierte el momento: es al inicio del ejercicio (hacerse cargo), no al final (rendir cuenta).

- **C)** "El Principe heredero, tras su nombramiento y los Regentes en el momento de **rendir cuenta** de sus funciones". Doble error: (1) el Principe no jura "tras su nombramiento" sino al alcanzar la mayoria de edad; (2) los Regentes juran al "hacerse cargo", no al "rendir cuenta".

- **D)** "El Principe heredero durante su minoria de edad, y ratificarlo al alcanzar la mayoria". Falso: no hay juramento durante la minoria de edad. El unico momento previsto es al alcanzar la mayoria de edad. No existe mecanismo de "ratificacion".

**Juramentos del art. 61 CE:**

| Quien | Cuando | Contenido |
|-------|--------|-----------|
| **Rey** | Al ser proclamado | Funciones + CE + leyes + derechos |
| **Principe heredero** | Al cumplir 18 anos | El mismo + fidelidad al Rey |
| **Regente/s** | Al hacerse cargo | El mismo + fidelidad al Rey |

**Clave:** Principe = mayoria de edad. Regentes = al hacerse cargo (no al rendir cuenta). Ambos anaden fidelidad al Rey.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "05369299-bb6b-4b8d-a6f1-119f76dfa132");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.61.2 juramento Principe (" + exp2.length + " chars)");

  // #3 - CE art.61 contenido juramento Principe heredero fidelidad al Rey
  const exp3 = `**Articulo 61 de la Constitucion Espanola:**

> Art. 61.1: "El Rey [...] prestara juramento de **desempenar fielmente sus funciones**, **guardar y hacer guardar la Constitucion y las leyes** y **respetar los derechos de los ciudadanos y de las Comunidades Autonomas**."

> Art. 61.2: "El Principe heredero [...] prestara **el mismo juramento**, asi como el de **fidelidad al Rey**."

**Por que B es correcta:**
El juramento del Principe incluye TODO lo del Rey (desempenar funciones, guardar CE y leyes, respetar derechos de ciudadanos **y de las CCAA**) MAS un elemento adicional: la **fidelidad al Rey**. La opcion B es la unica que incluye los cuatro elementos: fidelidad al Rey + funciones + CE/leyes + ciudadanos y CCAA.

**Por que las demas son incorrectas:**

- **A)** "Jurara fidelidad al Rey, desempenar fielmente sus funciones, guardar la Constitucion y respetar los derechos **de los ciudadanos**". Falso: falta "y **de las Comunidades Autonomas**". El art. 61.1 menciona expresamente el respeto a los derechos de los ciudadanos **y** de las CCAA. La trampa omite la referencia a las CCAA.

- **C)** "Jurara desempenar fielmente sus funciones, guardar la Constitucion y respetar los derechos de los ciudadanos y de las Comunidades Autonomas". Falso: falta "**fidelidad al Rey**". El art. 61.2 anade este elemento adicional respecto al juramento del Rey. Sin fidelidad al Rey, seria el juramento del art. 61.1 (solo del Rey), no el del Principe.

- **D)** "El Principe heredero no jurara al cumplir la mayoria de edad, sino al ser proclamado Rey". Falso: el art. 61.2 dice expresamente que el Principe jura "al **alcanzar la mayoria de edad**". El juramento al ser proclamado es del Rey (art. 61.1); el Principe tiene su propio momento.

**Estructura del juramento:**
- **Rey** (art. 61.1): funciones + CE + leyes + ciudadanos + CCAA
- **Principe** (art. 61.2): lo mismo + **fidelidad al Rey**

**Clave:** La opcion correcta debe incluir: fidelidad al Rey + ciudadanos + CCAA. Si falta alguno, es incorrecta.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "c68f7069-783f-43be-8446-9bbef066dcd4");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.61 juramento contenido (" + exp3.length + " chars)");
})();
