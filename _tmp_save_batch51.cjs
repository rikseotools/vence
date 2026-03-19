require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.152 sufragio diputados autonomicos
  const exp1 = `**Articulo 152.1 de la Constitucion Espanola** (Organizacion institucional autonomica):

> "La organizacion institucional autonomica se basara en una **Asamblea Legislativa**, elegida por **sufragio universal**, con arreglo a un sistema de representacion proporcional [...]"

Los Estatutos de Autonomia desarrollan las caracteristicas del sufragio: **universal, igual, libre, directo y secreto**, en la forma establecida por **la ley**.

**Por que B es correcta:**
La forma del sufragio se establece por **la ley** (leyes electorales autonomicas y la LOREG). Es la fuente normativa adecuada para regular el procedimiento electoral.

**Por que las demas son incorrectas:**
La unica diferencia entre las cuatro opciones esta en **quien establece la forma**:

| Opcion | Quien establece la forma | Correcta |
|--------|-------------------------|----------|
| A | El **Gobierno** | NO - el Gobierno no puede regular el sufragio por si mismo |
| **B** | **La ley** | **SI** - la ley electoral es la fuente adecuada |
| C | La **Constitucion** | NO - la CE no regula la forma concreta del sufragio autonomico |
| D | El **derecho** | NO - "el derecho" es un termino demasiado generico e impreciso |

- **A)** El Gobierno no puede regular el sufragio porque los derechos electorales requieren **reserva de ley** (art. 53.1 CE).
- **C)** La Constitucion establece las bases (art. 152.1) pero no la forma concreta. Son las leyes las que la desarrollan.
- **D)** "El derecho" es un concepto juridico generico que no aparece como fuente en este contexto.

**Clave:** Las cuatro opciones son identicas salvo la ultima parte. Solo "la ley" es la fuente correcta.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "eea58f7b-d9b1-443f-bf01-c9ff5c9ee572");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.152 sufragio (" + exp1.length + " chars)");

  // #2 - CE art.1.1 pluralismo politico valor superior
  const exp2 = `**Articulo 1.1 de la Constitucion Espanola:**

> "Espana se constituye en un Estado social y democratico de Derecho, que propugna como **valores superiores** de su ordenamiento juridico la **libertad**, la **justicia**, la **igualdad** y el **pluralismo politico**."

**Por que B es correcta:**
El pluralismo politico es uno de los **4 valores superiores** del ordenamiento juridico espanol, recogidos en el art. 1.1 CE, que forma parte del **Titulo Preliminar** (arts. 1-9).

**Por que las demas son incorrectas:**

- **A)** "Derecho protegido por el art. 53.2". Falso: el pluralismo politico NO es un derecho fundamental protegido por el recurso de amparo (art. 53.2). Es un **valor** del ordenamiento, no un derecho subjetivo individual. Los derechos del art. 53.2 son los de la Seccion 1a del Capitulo II del Titulo I (arts. 14-29).

- **C)** "Se recoge en el **preambulo**". Falso: aunque el preambulo menciona una "sociedad democratica avanzada", el pluralismo politico como valor superior se recoge en el **art. 1.1**, no en el preambulo. Ademas, el preambulo no tiene fuerza normativa directa.

- **D)** "Se recoge en el **Titulo Primero** como fundamento del orden politico". Falso en dos aspectos: (1) el art. 1.1 esta en el **Titulo Preliminar**, no en el Titulo Primero; (2) "fundamento del orden politico y de la paz social" es la expresion del **art. 10.1** CE (referida a la dignidad y los derechos inherentes), no al pluralismo politico.

**Los 4 valores superiores (art. 1.1 CE):** libertad, justicia, igualdad, pluralismo politico.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "8afb85b2-f458-4823-a378-8e3a50d9dc67");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.1.1 pluralismo (" + exp2.length + " chars)");

  // #3 - Ley 19/2013 art.38 funciones Presidente Consejo
  const exp3 = `**Articulo 38 de la Ley 19/2013** (Funciones del Consejo de Transparencia y Buen Gobierno):

El art. 38.2 enumera las funciones especificas del **Presidente** del Consejo. La pregunta pide identificar cual NO es funcion del Presidente.

**Por que D es la que NO es funcion del Presidente:**
"Promover la elaboracion de borradores de recomendaciones y de directrices y normas de desarrollo de buenas practicas" es una funcion del **Consejo** como organo colegiado (art. 38.1), no una funcion especifica del Presidente. El art. 38.2 no la atribuye al Presidente individualmente.

**Por que las demas SI son funciones del Presidente (art. 38.2):**

- **A)** "Responder las consultas que, con caracter **facultativo**, le planteen los organos encargados de tramitar y resolver las solicitudes de acceso a la informacion". SI es funcion del Presidente: art. 38.2.c). El Presidente asesora a los organos cuando estos le consultan voluntariamente.

- **B)** "Adoptar criterios de interpretacion uniforme de las obligaciones contenidas en esta Ley". SI es funcion del Presidente: art. 38.2.b). El Presidente unifica la interpretacion de la ley para evitar criterios dispares.

- **C)** "Aprobar el anteproyecto de presupuesto". SI es funcion del Presidente: art. 38.2.f). El Presidente aprueba el anteproyecto de presupuesto del Consejo.

**Clave:** Distinguir funciones del **Consejo** (organo colegiado, art. 38.1) de funciones del **Presidente** (art. 38.2). La opcion D es del Consejo, no del Presidente.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "911374a8-24dd-4dcf-8434-6578e6b29eb2");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 19/2013 Presidente Consejo (" + exp3.length + " chars)");
})();
