require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.29.1 derecho petición "todos los españoles"
  const exp1 = `**Articulo 29.1 de la Constitucion Espanola - Derecho de peticion:**

> "**Todos los espanoles** tendran el derecho de peticion **individual y colectiva**, por escrito, en la forma y con los efectos que determine la ley."

**Por que C es correcta (todos los espanoles):**
El art. 29.1 CE utiliza la expresion literal "**todos los espanoles**". No dice "todas las personas", ni "los ciudadanos", ni "los espanoles y extranjeros". El sujeto del derecho de peticion esta claramente definido: espanoles. Es importante distinguir que la CE usa diferentes formulas segun el derecho: "todos" (art. 15), "toda persona" (art. 17), "los ciudadanos" (art. 23), "los espanoles" (art. 29).

**Por que las demas son incorrectas (sujeto diferente):**

- **A)** "Los **espanoles y extranjeros**." Falso: el art. 29.1 solo menciona "los espanoles". No incluye expresamente a los extranjeros. Los derechos de los extranjeros en Espana se regulan en el art. 13 CE, que remite a los tratados y la ley.

- **B)** "**Todas las personas**." Falso: "todas las personas" no es la formula del art. 29.1. Otros articulos si usan formulas mas amplias (ej: art. 15: "todos tienen derecho a la vida"; art. 17.1: "toda persona tiene derecho a la libertad"), pero el art. 29 restringe el sujeto a "los espanoles".

- **D)** "Los **ciudadanos**." Falso: el art. 29.1 dice "los espanoles", no "los ciudadanos". Aunque ambos terminos pueden parecer similares, la CE los usa en contextos distintos. "Ciudadanos" aparece en el art. 23 (participacion politica), mientras que "espanoles" se usa en el art. 29.

**Formulas de titularidad en la CE (quien tiene el derecho):**

| Formula | Ejemplo | Alcance |
|---------|---------|---------|
| "Todos" | Art. 15 (vida) | Universal |
| "Toda persona" | Art. 17 (libertad) | Universal |
| **"Todos los espanoles"** | **Art. 29 (peticion)** | **Solo espanoles** |
| "Los ciudadanos" | Art. 23 (participacion) | Ciudadanos |

**Clave:** Art. 29.1 = "todos los espanoles" (literal). La CE distingue cuidadosamente entre "todos", "toda persona", "los espanoles" y "los ciudadanos".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "396e3285-0a94-4a5f-a28b-ac72813aad66");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.29.1 todos los espanoles (" + exp1.length + " chars)");

  // #2 - CE art.8.2 organización militar ley orgánica
  const exp2 = `**Articulo 8.2 de la Constitucion Espanola - Fuerzas Armadas:**

> "Una **ley organica** regulara las bases de la organizacion militar conforme a los principios de la presente Constitucion."

**Por que A es correcta (ley organica):**
El art. 8.2 CE reserva las bases de la organizacion militar a una **ley organica**. Las leyes organicas requieren mayoria absoluta del Congreso para su aprobacion (art. 81.2 CE) y se reservan para materias especialmente importantes. La organizacion militar es una de ellas por su relevancia para la soberania, defensa e integridad territorial (art. 8.1 CE).

**Por que las demas son incorrectas (rango normativo diferente):**

- **B)** "Por la **Constitucion Espanola**." Falso: la CE establece los principios generales sobre las FFAA (art. 8.1: mision, composicion), pero remite a una ley organica la regulacion de las "bases de la organizacion militar". La CE no las regula directamente, sino que hace una reserva normativa.

- **C)** "Por **ley ordinaria**." Falso: el art. 8.2 exige "ley organica", no ley ordinaria. La diferencia es significativa: las leyes organicas requieren mayoria absoluta del Congreso, mientras que las leyes ordinarias solo mayoria simple. La organizacion militar tiene rango de ley organica por su importancia.

- **D)** "Por **reglamento**." Falso: un reglamento es una norma inferior a la ley (Real Decreto, Orden Ministerial). Las bases de la organizacion militar no pueden regularse por reglamento, sino que requieren el rango mas alto: ley organica.

**Jerarquia normativa y organizacion militar:**

| Rango normativo | Aprobacion | Organizacion militar |
|----------------|-----------|---------------------|
| Constitucion | Poder constituyente | Principios generales (art. 8) |
| **Ley organica** | Mayoria absoluta Congreso | **Bases de organizacion (art. 8.2)** |
| Ley ordinaria | Mayoria simple | No para las bases |
| Reglamento | Gobierno | Desarrollo, no bases |

**Clave:** Bases de la organizacion militar = ley organica (art. 8.2 CE). Es una de las materias reservadas a LO junto con derechos fundamentales, Estatutos de Autonomia y regimen electoral (art. 81.1 CE).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "db34d3a1-2f38-4794-aa8f-36940c964a17");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.8.2 organizacion militar LO (" + exp2.length + " chars)");

  // #3 - LOTC art.9 Vicepresidente TC 3 años
  const exp3 = `**Articulo 9 de la LO 2/1979 (LOTC) - Vicepresidente del Tribunal Constitucional:**

> "El Tribunal en Pleno elegira entre sus miembros [...] un **Vicepresidente** [...] por el mismo periodo de **tres anos**."

**Por que C es correcta (3 anos):**
Segun el art. 9.4 LOTC, el Vicepresidente del TC es elegido por el Tribunal en Pleno entre sus miembros por un periodo de **3 anos**, pudiendo ser reelegido una sola vez. El mismo periodo se aplica al Presidente (art. 9.3). El nombramiento corresponde al Rey, a propuesta del Tribunal en Pleno.

**Por que las demas son incorrectas (periodos diferentes):**

- **A)** "**6 anos**." Falso: 6 anos es el periodo maximo que podria ejercer si es reelegido una vez (3 + 3), pero el periodo por el que es nombrado es de 3 anos. Ademas, 6 anos podria confundirse con la duracion del mandato de los magistrados del TC que se renuevan por tercios (cada 3 anos se renueva un tercio de los 12 magistrados).

- **B)** "**9 anos**." Falso: 9 anos es el mandato de los **magistrados** del TC (art. 159.3 CE: "Los miembros del Tribunal Constitucional seran designados por un periodo de nueve anos"). No confundir el mandato del magistrado (9 anos) con el del cargo de Vicepresidente (3 anos).

- **D)** "**2 anos**." Falso: no hay ningun cargo en el TC con un periodo de 2 anos. El Vicepresidente se elige por 3 anos.

**Periodos en el Tribunal Constitucional:**

| Cargo/Concepto | Periodo |
|----------------|---------|
| Magistrado del TC | **9 anos** (art. 159.3 CE) |
| Renovacion por tercios | Cada **3 anos** (4 magistrados) |
| **Presidente del TC** | **3 anos** (reelegible 1 vez) |
| **Vicepresidente del TC** | **3 anos** (reelegible 1 vez) |

**Clave:** Vicepresidente del TC = 3 anos (art. 9.4 LOTC). No confundir con los 9 anos de mandato de magistrado (art. 159.3 CE).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "08c50873-8a5e-481d-8471-ccf96d5e2119");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LOTC art.9 Vicepresidente TC 3 anos (" + exp3.length + " chars)");
})();
