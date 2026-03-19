require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.2 qué artículo reconoce derecho autonomía
  const exp1 = `**Articulo 2 de la Constitucion Espanola:**

> "La Constitucion se fundamenta en la indisoluble unidad de la Nacion espanola [...] y **reconoce y garantiza el derecho a la autonomia** de las nacionalidades y regiones que la integran [...]"

**Por que B es correcta (articulo 2):**
El derecho a la autonomia de las nacionalidades y regiones se reconoce en el **articulo 2** CE, ubicado en el **Titulo Preliminar** (arts. 1-9). Es uno de los articulos mas fundamentales y citados de la Constitucion, ya que establece el equilibrio entre unidad nacional y autonomia territorial.

**Por que las demas son incorrectas (articulos con otro contenido):**

- **A)** "Articulo **3**." Falso: el art. 3 CE regula las **lenguas oficiales** (castellano como lengua oficial del Estado y las demas lenguas cooficiales en sus respectivas CCAA). No menciona el derecho a la autonomia.

- **C)** "Articulo **6**." Falso: el art. 6 CE regula los **partidos politicos** ("expresan el pluralismo politico, concurren a la formacion y manifestacion de la voluntad popular"). No trata sobre la autonomia territorial.

- **D)** "Articulo **4**." Falso: el art. 4 CE regula la **bandera de Espana** (roja, amarilla y roja) y las banderas de las CCAA. No menciona el derecho a la autonomia.

**Contenido del Titulo Preliminar (arts. 1-9 CE):**

| Articulo | Contenido |
|----------|-----------|
| Art. 1 | Estado social y democratico de Derecho + valores superiores |
| **Art. 2** | **Unidad nacional + derecho a la autonomia** |
| Art. 3 | Lenguas oficiales |
| Art. 4 | Bandera de Espana |
| Art. 5 | Capital del Estado (Madrid) |
| Art. 6 | Partidos politicos |
| Art. 7 | Sindicatos y asociaciones empresariales |
| Art. 8 | Fuerzas Armadas |
| Art. 9 | Sujecion a la CE + principios (9.3) |

**Clave:** Derecho a la autonomia = art. 2 CE. Los demas articulos del Titulo Preliminar regulan lenguas (3), bandera (4) y partidos (6).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "21b88cc0-4b93-41eb-8d38-7d53f488d755");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.2 derecho autonomia (" + exp1.length + " chars)");

  // #2 - CE art.3.1 castellano deber conocer y derecho a usar
  const exp2 = `**Articulo 3.1 de la Constitucion Espanola:**

> "El castellano es la lengua espanola oficial del Estado. Todos los espanoles tienen el **deber de conocerla** y el **derecho a usarla**."

**Por que D es correcta (deber de conocer + derecho a usar):**
El art. 3.1 CE establece una formula asimetrica muy precisa: respecto al castellano, los espanoles tienen un **deber** (conocerla) y un **derecho** (usarla). No son dos derechos ni dos deberes, sino una combinacion de deber y derecho. La opcion D reproduce fielmente esta formula: "el deber de conocerla y el derecho a usarla".

**Por que las demas son incorrectas (invierten o alteran deber/derecho):**

- **A)** "El **derecho** de conocerla y el **deber** a usarla." Falso: invierte completamente la formula. Conocerla es un **deber** (no un derecho) y usarla es un **derecho** (no un deber). Esta opcion es exactamente al reves.

- **B)** "El **deber** de conocerla y **usarla**." Falso: convierte ambas en deber. Usarla es un **derecho**, no un deber. Nadie puede ser obligado a usar el castellano, pero si tiene derecho a hacerlo en cualquier parte de Espana.

- **C)** "El **derecho** de conocerla y **usarla**." Falso: convierte ambas en derecho. Conocerla es un **deber**, no un derecho. La Constitucion impone la obligacion de conocer el castellano (es el unico deber linguistico constitucional).

**Formula del art. 3.1 CE:**

| Accion | Naturaleza |
|--------|-----------|
| **Conocer** el castellano | **DEBER** (obligatorio) |
| **Usar** el castellano | **DERECHO** (facultativo) |

**Nota sobre lenguas cooficiales (art. 3.2):** Las demas lenguas espanolas son oficiales en sus CCAA segun sus Estatutos, pero la CE no impone el deber de conocerlas (solo del castellano).

**Clave:** DEBER de conocer + DERECHO a usar. Las trampas invierten los terminos o convierten ambos en derechos o en deberes.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e848b2b8-b46c-49af-8eb2-759c1c5a9c73");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.3.1 castellano deber derecho (" + exp2.length + " chars)");

  // #3 - CE art.3.2 lenguas cooficiales según Estatutos
  const exp3 = `**Articulo 3.2 de la Constitucion Espanola:**

> "Las demas lenguas espanolas seran tambien oficiales en las respectivas Comunidades Autonomas **de acuerdo con sus Estatutos**."

**Por que A es correcta (oficiales según Estatutos):**
El art. 3.2 CE establece que las lenguas distintas del castellano seran cooficiales en sus respectivas CCAA, pero la condicion es que asi lo dispongan **sus Estatutos de Autonomia**. La clave esta en "de acuerdo con sus Estatutos": son los Estatutos (no las leyes estatales) los que determinan la cooficialidad.

**Por que las demas son incorrectas:**

- **B)** "De acuerdo con lo que dispongan las **leyes estatales**." Falso: el art. 3.2 dice "de acuerdo con sus **Estatutos**", no "de acuerdo con leyes estatales". La cooficialidad la establecen los Estatutos de Autonomia de cada CCAA, no las leyes del Estado central.

- **C)** "**No seran oficiales en ningun caso**. Lengua oficial es unicamente el castellano." Falso: el art. 3.2 dice expresamente que las demas lenguas "**seran tambien oficiales**" en sus respectivas CCAA. Negar la cooficialidad contradice el texto constitucional. Espana tiene un sistema de pluralidad linguistica.

- **D)** "De acuerdo con lo que dispongan las **leyes estatales y los Estatutos**." Falso: el art. 3.2 solo menciona "sus Estatutos", no anade "leyes estatales". Incluir "leyes estatales" es un anadido que no esta en el texto constitucional y alteraria el reparto competencial.

**Regimen linguistico en la CE (art. 3):**

| Apartado | Contenido |
|----------|-----------|
| **3.1** | Castellano = lengua oficial del Estado. Deber de conocer, derecho a usar |
| **3.2** | Demas lenguas = oficiales en sus CCAA **segun sus Estatutos** |
| **3.3** | Riqueza linguistica = patrimonio cultural, especial respeto y proteccion |

**Lenguas cooficiales actuales:** catalan/valenciano, gallego, euskera, aranes (occitano en Cataluna).

**Clave:** Las lenguas cooficiales se regulan "de acuerdo con sus Estatutos" (no leyes estatales). Son los Estatutos de cada CCAA los que establecen la cooficialidad.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "e689e21e-059b-4705-a5d5-8b4ec9f1f13c");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.3.2 lenguas cooficiales (" + exp3.length + " chars)");
})();
