require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LCSP art.20 regulacion armonizada obras 5.404.000
  const exp1 = `**Articulo 20.1 de la Ley 9/2017 (LCSP)** - Contratos sujetos a regulacion armonizada:

> "Estan sujetos a regulacion armonizada los contratos de obras, de concesion de obras y de concesion de servicios cuyo valor estimado sea igual o superior a **5.404.000 euros**."

**Por que A es correcta (5.404.000 euros):**
El umbral para que un contrato de **obras** este sujeto a regulacion armonizada es **5.404.000 euros**. Este umbral se revisa periodicamente por la Comision Europea.

**Por que las demas son incorrectas:**

- **B)** "5.115.000 euros". Falso: no corresponde al umbral actual. Puede ser un umbral anterior o inventado para generar confusion.

- **C)** "214.000 euros". Falso para obras: este umbral (o similar) corresponde a contratos de **servicios y suministros**, no de obras. Es una trampa que mezcla umbrales de diferentes tipos de contratos.

- **D)** "5.528.000 euros". Falso: no corresponde al umbral actual.

**Umbrales de regulacion armonizada (LCSP):**
| Tipo de contrato | Umbral |
|-----------------|--------|
| **Obras**, concesion de obras, concesion de servicios | **5.404.000** |
| Suministros y servicios (AGE) | 140.000 |
| Suministros y servicios (otros poderes adjudicadores) | 214.000 |

**Clave:** Obras = **5.404.000** euros. No confundir con los umbrales de servicios/suministros.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "4ac39a6f-45d3-4925-bdac-ec73984b5bc6");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP regulacion armonizada (" + exp1.length + " chars)");

  // #2 - Ley 4/2023 persona trans definicion
  const exp2 = `**Articulo 3.g) de la Ley 4/2023:**

> "**Persona trans**: Persona cuya **identidad sexual** no se corresponde con el **sexo** asignado al nacer."

**Por que A es correcta:**
La definicion legal de persona trans combina dos elementos especificos: **identidad sexual** + **sexo** asignado al nacer. La pregunta juega con dos variables para crear confusiones:

| Opcion | Variable 1 | Variable 2 | Correcta |
|--------|-----------|-----------|----------|
| **A** | **Identidad sexual** | **Sexo** asignado | **SI** |
| B | Expresion de genero | Genero asignado | NO (ambas mal) |
| C | Expresion de genero | Sexo asignado | NO (variable 1 mal) |
| D | Identidad sexual | Genero asignado | NO (variable 2 mal) |

**Por que las demas son incorrectas:**

- **B)** Dos errores: dice "expresion de genero" (deberia ser "identidad sexual") y "genero asignado" (deberia ser "sexo asignado").

- **C)** Dice "expresion de genero" en vez de "identidad sexual". La expresion de genero es la manifestacion **externa**, no la vivencia interna. Una persona trans se define por su **identidad** (lo que siente), no por su expresion (lo que muestra).

- **D)** Dice "genero asignado" en vez de "**sexo** asignado". La ley usa "sexo", no "genero". Al nacer se asigna un **sexo** (biologico), no un genero.

**Clave:** Persona trans = **identidad sexual** (no expresion) + **sexo** asignado (no genero).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "4ab58e1e-21e3-47d3-bfcf-7a9a07d555b4");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 4/2023 persona trans (" + exp2.length + " chars)");

  // #3 - CE art.62 funciones del Rey
  const exp3 = `**Articulo 62 de la Constitucion Espanola** (Funciones del Rey):

**Por que B es correcta:**
La opcion B reproduce literalmente el art. 62.b) CE:

> "Corresponde al Rey: [...] b) **Convocar y disolver las Cortes Generales** y convocar elecciones en los terminos previstos en la Constitucion."

**Por que las demas son incorrectas (cada una modifica sutilmente el texto):**

- **A)** "Sancionar y promulgar las Leyes y **ordenar la publicacion de las Ordenes Ministeriales**". La primera parte SI es del Rey (art. 62.a), pero la segunda es FALSA. El Rey no ordena la publicacion de Ordenes Ministeriales. Las Ordenes Ministeriales las dicta y publica el Ministro correspondiente.

- **C)** "Mando supremo de los **Cuerpos y Fuerzas de Seguridad del Estado**". Falso: el art. 62.h) dice "mando supremo de las **Fuerzas Armadas**" (Ejercito de Tierra, Armada, Ejercito del Aire). Los Cuerpos y Fuerzas de Seguridad del Estado (Policia Nacional, Guardia Civil) dependen del **Gobierno** (art. 104 CE), no del Rey.

- **D)** "Derecho de gracia de acuerdo con los **Tratados Internacionales**". Falso: el art. 62.i) dice "con arreglo a la **ley**" (no a los Tratados Internacionales). Ademas, anade que "no podra autorizar indultos generales".

**Trampas de cada opcion:**
| Opcion | Trampa | Texto real |
|--------|--------|-----------|
| A | Anade "Ordenes Ministeriales" | Solo sancionar y promulgar leyes |
| C | "Fuerzas de Seguridad" | **Fuerzas Armadas** |
| D | "Tratados Internacionales" | **Con arreglo a la ley** |`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "2fc787d9-cd07-4b29-88cf-b251760a532f");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.62 funciones Rey (" + exp3.length + " chars)");
})();
