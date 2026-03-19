require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOPJ art.60 cuestiones competencia Salas TS
  const exp1 = `**Articulo 60.1 de la Ley Organica del Poder Judicial:**

> "Conocera ademas cada una de las **Salas del Tribunal Supremo** de las recusaciones que se interpusieren contra los Magistrados que las compongan, y de las **cuestiones de competencia** entre Juzgados o Tribunales del propio orden jurisdiccional que **no tengan otro superior comun**."

**Por que B es correcta (cada una de las Salas del TS):**
Cuando dos tribunales del mismo orden jurisdiccional (ej: dos Audiencias Provinciales de lo Penal) tienen un conflicto de competencia y no hay un tribunal superior comun que lo resuelva (porque ambos dependen directamente del TS), la **Sala del TS del mismo orden** resuelve la cuestion. Por ejemplo, la Sala 2a (Penal) del TS resolveria un conflicto entre dos Audiencias Provinciales en materia penal.

**Por que las demas son incorrectas:**

- **A)** "Una Sala formada por el Presidente del TS, los Presidentes de Sala y el Magistrado mas antiguo y el mas moderno de cada una". Falso: esta descripcion se parece a la composicion de la **Sala del art. 61 LOPJ** (Sala Especial del art. 61), que resuelve cuestiones entre tribunales de **distintos ordenes** jurisdiccionales. Pero la pregunta se refiere a conflictos dentro del **mismo orden**, que resuelve la Sala ordinaria del TS.

- **C)** "La Sala de Conflictos de Competencia". Falso: no existe una "Sala de Conflictos de Competencia" como organo del TS. Lo que existe es la Sala Especial del art. 42 LOPJ para conflictos jurisdiccionales entre juzgados/tribunales y la Administracion, y la del art. 61 para conflictos entre ordenes. Pero dentro del mismo orden, conoce la Sala ordinaria del TS.

- **D)** "Una Seccion formada por el Presidente del TS, cinco Magistrados...". Falso: esta composicion no existe en el art. 60. Es una descripcion inventada que mezcla elementos de otros organos del TS.

**Cuestiones de competencia en el TS:**

| Tipo de conflicto | Quien resuelve |
|-------------------|----------------|
| Mismo orden, sin superior comun | **Sala del TS** de ese orden (art. 60) |
| Entre ordenes jurisdiccionales | Sala Especial del art. 42 LOPJ |

**Clave:** Cada Sala del TS resuelve los conflictos de competencia de **su propio orden** jurisdiccional.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ebf87505-c833-4d71-adba-c15208b70fa8");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOPJ art.60 competencias TS (" + exp1.length + " chars)");
})();
