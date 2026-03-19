require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.49.2 nulidad parcial partes independientes
  const exp1 = `**Articulo 49.2 de la Ley 39/2015 (LPAC) - Nulidad o anulabilidad parcial:**

> "La nulidad o anulabilidad en parte del acto administrativo **no implicara** la de las partes del mismo **independientes** de aquella, **salvo** que la parte viciada sea de tal importancia que sin ella el acto administrativo **no hubiera sido dictado**."

**Por que A es correcta:**
El art. 49.2 establece un principio de **conservacion del acto**: si una parte esta viciada, las partes independientes de ella se mantienen validas. La excepcion es que la parte viciada sea tan esencial que sin ella el acto no habria existido. La opcion A reproduce literalmente esta regla.

**Por que las demas son incorrectas:**

- **B)** "Implicara la de la **totalidad** de las partes". Falso: el art. 49.2 dice exactamente lo contrario. La nulidad parcial **no** arrastra a todas las partes del acto. Solo afecta a las que dependan de la parte viciada.

- **C)** "Implicara la de las partes, ya sean **dependientes o independientes**". Falso: el art. 49.2 distingue entre partes dependientes e independientes. Las partes **independientes** no se ven afectadas. Solo las dependientes podrian verse arrastradas por el vicio.

- **D)** "No implicara **en ningun caso** la de las partes independientes". Falso: anade "en ningun caso", que contradice la excepcion del articulo. El art. 49.2 dice "**salvo** que la parte viciada sea de tal importancia que sin ella el acto no hubiera sido dictado". Existe una excepcion: cuando la parte viciada es esencial.

**Clave:** Regla = nulidad parcial no arrastra a partes independientes. Excepcion = si la parte viciada es tan esencial que sin ella el acto no habria existido. No es "nunca" ni "siempre": hay una regla con excepcion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c0ac48c6-87d3-4bf1-ab66-6f73713d3c81");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.49 nulidad parcial (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.52.3 convalidación acto anulable incompetencia jerárquica
  const exp2 = `**Articulos 47, 48 y 52 de la Ley 39/2015 (LPAC) - Convalidacion de actos:**

> Art. 52.1: "La Administracion podra convalidar los actos **anulables**, subsanando los vicios de que adolezcan."
>
> Art. 52.3: "Si el vicio consistiera en **incompetencia no determinante de nulidad**, la convalidacion podra realizarse por el organo competente cuando sea **superior jerarquico** del que dicto el acto."

**Por que C es correcta (anulable + incompetencia jerarquica):**
Para que un acto sea convalidable deben concurrir dos condiciones: (1) debe ser **anulable** (no nulo de pleno derecho) y (2) el vicio debe ser subsanable. La incompetencia jerarquica produce anulabilidad (art. 48), no nulidad, y es convalidable por el superior jerarquico competente (art. 52.3).

**Por que las demas son incorrectas:**

- **A)** "**Nulo** de pleno derecho + incompetencia jerarquica". Falso: los actos nulos de pleno derecho **no** son convalidables (art. 52.1 solo permite convalidar los anulables). Ademas, la incompetencia jerarquica no produce nulidad de pleno derecho.

- **B)** "**Nulo** de pleno derecho + incompetencia funcional". Falso: los actos nulos no son convalidables. Ademas, "incompetencia funcional" no es la terminologia del art. 47 ni del 52.

- **D)** "Anulable + incompetencia por razon de la **materia**". Falso: la incompetencia por razon de la materia produce **nulidad de pleno derecho** (art. 47.1.b), no anulabilidad. Un acto nulo por incompetencia material no puede ser convalidado.

**Tipos de incompetencia y sus consecuencias:**

| Tipo de incompetencia | Consecuencia | Convalidable |
|----------------------|-------------|-------------|
| **Jerarquica** (no manifiesta) | Anulabilidad | **SI** (art. 52.3) |
| Por **materia** (manifiesta) | Nulidad | NO |
| Por **territorio** (manifiesta) | Nulidad | NO |

**Clave:** Solo se convalidan actos **anulables**. La incompetencia **jerarquica** = anulable y convalidable. La incompetencia por **materia o territorio** = nulidad, no convalidable.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "c36e098e-6508-4448-b573-22768547939a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.52 convalidacion (" + exp2.length + " chars)");

  // #3 - CE art.148.1.2ª alteración términos municipales competencia CCAA
  const exp3 = `**Articulo 148.1.2.a de la Constitucion Espanola - Competencia de las CCAA:**

> "Las Comunidades Autonomas podran asumir competencias en: [...] 2.a Las **alteraciones de los terminos municipales** comprendidos en su territorio y, en general, las funciones que correspondan a la Administracion del Estado sobre las Corporaciones locales y cuya transferencia autorice la legislacion sobre Regimen Local."

**Por que B es correcta (competencia de la CCAA):**
El art. 148.1.2.a CE atribuye a las CCAA la competencia sobre las alteraciones de los terminos municipales situados en su territorio. Todas las CCAA han asumido esta competencia en sus Estatutos de Autonomia. Son las leyes autonomicas las que regulan los procedimientos de fusion, segregacion o agregacion de municipios.

**Por que las demas son incorrectas:**

- **A)** "Competencia **compartida** entre Estado y CCAA". Falso: la alteracion de terminos municipales no es una competencia compartida. El art. 148.1.2.a la atribuye a las CCAA. El Estado legisla sobre las bases del regimen local (art. 149.1.18.a), pero la decision concreta de alterar terminos municipales es autonomica.

- **C)** "Competencia **exclusiva del Estado**". Falso: el Estado no tiene competencia exclusiva sobre esta materia. El art. 148.1.2.a la incluye expresamente entre las competencias asumibles por las CCAA, y no aparece en el listado de competencias exclusivas del Estado del art. 149.1.

- **D)** "Competencia de la **Diputacion Provincial**". Falso: la Diputacion Provincial no tiene competencia para alterar terminos municipales. Esta competencia corresponde a la CA, no a la provincia. La Diputacion interviene en otros aspectos del regimen local (asistencia a municipios, coordinacion), pero no decide sobre la alteracion de terminos.

**Clave:** Alteracion de terminos municipales = competencia de la **CCAA** (art. 148.1.2.a CE). No es del Estado, ni compartida, ni de las Diputaciones.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "eb978dc2-afd0-4a59-905b-4dd0b515478a");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.148 alteracion terminos (" + exp3.length + " chars)");
})();
