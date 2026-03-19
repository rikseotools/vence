require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.142 Haciendas locales
  const exp1 = `**Articulo 142 de la Constitucion Espanola:**

> "Las **Haciendas locales** deberan disponer de los medios suficientes para el desempeno de las funciones que la ley atribuye a las Corporaciones respectivas y se nutriran fundamentalmente de tributos propios y de participacion en los del Estado y de las CCAA."

**Por que C es correcta:**
El art. 142 CE habla expresamente de "Haciendas **locales**" y de "Corporaciones respectivas" (Ayuntamientos, Diputaciones). Es el principio de suficiencia financiera local.

**Por que las demas son incorrectas:**

- **A)** "Hacienda estatal". El art. 142 no se refiere a la Hacienda del Estado. La Hacienda estatal tiene su propia regulacion en los arts. 133-136 CE (PGE, Tribunal de Cuentas, etc.).

- **B)** "Haciendas autonomicas". El art. 142 no se refiere a las CCAA. La financiacion autonomica se regula en el art. 156-157 CE (autonomia financiera de las CCAA, LOFCA).

- **D)** "Haciendas provinciales". Las Diputaciones forman parte de las "Haciendas locales", pero el art. 142 no usa el termino "provinciales". Ademas, esta opcion es mas restringida: "locales" incluye Ayuntamientos, Diputaciones, Cabildos, etc.

**Financiacion de las Haciendas locales (art. 142):**
1. Tributos propios
2. Participacion en tributos del Estado
3. Participacion en tributos de las CCAA`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0d122f57-819c-425d-9d65-5b176de22904");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.142 Haciendas locales (" + exp1.length + " chars)");

  // #2 - CE art.11.1 nacionalidad
  const exp2 = `**Articulo 11.1 de la Constitucion Espanola:**

> "La nacionalidad espanola se adquiere, se conserva y se pierde de acuerdo con lo establecido por **la ley**."

**Por que D es correcta:**
El art. 11.1 establece una **reserva de ley** para la regulacion de la nacionalidad. La adquisicion, conservacion y perdida se rigen por la ley (en concreto, el Codigo Civil, arts. 17-28). No por tratados, normas internacionales ni la propia Constitucion.

**Por que las demas son incorrectas:**

- **A)** "Tratados y convenios internacionales firmados al efecto". Falso: el art. 11.1 remite a "la ley", no a tratados. El art. 11.3 si menciona tratados, pero solo para la doble nacionalidad con paises iberoamericanos, no para la regulacion general.

- **B)** "Normas del derecho internacional". Falso: el art. 11.1 no remite al derecho internacional. Aunque existen convenciones internacionales sobre nacionalidad, la CE atribuye la regulacion a la ley interna espanola.

- **C)** "Los preceptos de la propia Constitucion". Falso: la CE establece principios (art. 11.2: ningun espanol de origen puede ser privado de nacionalidad; art. 11.3: doble nacionalidad), pero la regulacion concreta la delega en "la ley" (Codigo Civil).

**Estructura del art. 11 CE:**
- 11.1: Reserva de ley para nacionalidad
- 11.2: Prohibicion de privar de nacionalidad a espanoles de origen
- 11.3: Doble nacionalidad con paises iberoamericanos o con vinculacion especial`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "c988940f-3840-4b4f-9ac9-1396d0e4d33c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.11.1 nacionalidad (" + exp2.length + " chars)");

  // #3 - CE art.149 competencias exclusivas (ejecucion SS)
  const exp3 = `**Articulo 149.1.17a de la Constitucion Espanola:**

> "**Legislacion basica y regimen economico de la Seguridad Social**, sin perjuicio de la **ejecucion de sus servicios por las Comunidades Autonomas**."

**Por que B es la INCORRECTA (NO es competencia exclusiva del Estado):**
La opcion B dice "ejecucion de los servicios de la Seguridad Social". El art. 149.1.17a atribuye al Estado solo la **legislacion basica y el regimen economico**, pero la **ejecucion** de los servicios la pueden realizar las CCAA. Por tanto, la ejecucion NO es competencia exclusiva del Estado.

**Por que las demas son correctas (SI son exclusivas del Estado):**

- **A)** "Sanidad exterior". SI: art. 149.1.16a incluye expresamente "sanidad exterior" como competencia exclusiva del Estado.

- **C)** "Bases del regimen juridico de las Administraciones publicas y del regimen estatutario de sus funcionarios". SI: art. 149.1.18a lo incluye expresamente como competencia exclusiva del Estado.

- **D)** "Hacienda general y Deuda del Estado". SI: art. 149.1.14a lo incluye expresamente como competencia exclusiva del Estado.

**Truco de examen:** Muchas competencias del art. 149 reservan al Estado solo las "bases" o la "legislacion basica", dejando la **ejecucion** a las CCAA. En Seguridad Social: Estado = legislacion basica + regimen economico; CCAA = ejecucion de servicios.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "31743848-93ec-443b-bf00-caf7116b480a");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.149 ejecucion SS (" + exp3.length + " chars)");
})();
