require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.159.5 miembros TC independientes e inamovibles
  const exp1 = `**Articulo 159.5 de la Constitucion Espanola - Estatuto de los miembros del TC:**

> "Los miembros del Tribunal Constitucional seran **independientes** e **inamovibles** en el ejercicio de su mandato."

**Por que A es correcta (independientes):**
El art. 159.5 CE garantiza la **independencia** de los magistrados del TC durante su mandato. Esto significa que no estan sujetos a instrucciones de quien los propuso (Congreso, Senado, Gobierno o CGPJ). Su independencia es esencial para que el TC cumpla su funcion de interprete supremo de la Constitucion.

**Por que las demas son incorrectas:**

- **B)** "**Ecuanimes**." Falso: la CE no utiliza el termino "ecuanimes" para describir a los magistrados del TC. La ecuanimidad puede ser una virtud deseable, pero no es la palabra que emplea el art. 159.5, que dice "independientes".

- **C)** "**Mudables**." Falso: es lo contrario de lo que dice la CE. El art. 159.5 dice "**inamovibles**", no "mudables". Los magistrados del TC no pueden ser cesados, trasladados ni suspendidos fuera de las causas legales. "Mudable" contradice la inamovilidad constitucional.

- **D)** "**Variables**." Falso: "variables" no aparece en la CE ni tiene sentido aplicado a magistrados. El art. 159.5 establece la independencia y la inamovilidad, que son lo opuesto a la variabilidad.

**Estatuto de los magistrados del TC (art. 159 CE):**
- **Independientes** (no reciben instrucciones)
- **Inamovibles** (no pueden ser cesados arbitrariamente)
- Mandato de **9 anos**
- Incompatibilidades (art. 159.4): no pueden ejercer cargos politicos, administrativos, funciones de direccion en partidos, etc.

**Clave:** Independientes + inamovibles. Son las dos garantias constitucionales de los magistrados del TC.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "da5cf3ed-4c0a-4694-aacd-23175358127f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.159.5 TC independientes (" + exp1.length + " chars)");

  // #2 - CE art.1.3 forma política monarquía parlamentaria
  const exp2 = `**Articulo 1.3 de la Constitucion Espanola - Forma politica del Estado:**

> "La forma politica del Estado espanol es la **Monarquia parlamentaria**."

**Por que B es correcta (monarquia parlamentaria):**
El art. 1.3 CE establece literalmente que la forma politica es la "Monarquia **parlamentaria**". Esta expresion implica que el poder politico reside en el Parlamento (Cortes Generales), mientras que el Rey ejerce funciones simbolicas, representativas y arbitrales (art. 56 CE), sin poder ejecutivo directo.

**Por que las demas son incorrectas (cambian el adjetivo):**

- **A)** "Monarquia **constitucional**." Falso: aunque Espana es una monarquia regulada por la Constitucion, el art. 1.3 dice "parlamentaria", no "constitucional". La monarquia constitucional historicamente implica que el Rey comparte poder con el Parlamento, mientras que la parlamentaria subordina al Rey al principio de soberania popular.

- **C)** "Monarquia **democratica**." Falso: aunque la monarquia espanola opera en un marco democratico (art. 1.1), el art. 1.3 no la califica como "democratica". El adjetivo constitucional es "parlamentaria".

- **D)** "Monarquia **de derecho**." Falso: "monarquia de derecho" no es un concepto constitucional reconocido ni aparece en la CE. El art. 1.1 define a Espana como "Estado social y democratico de Derecho", pero la forma politica del art. 1.3 es "Monarquia parlamentaria".

**Articulo 1 CE - Tres pilares:**

| Apartado | Contenido |
|----------|-----------|
| 1.1 | Estado social y democratico de **Derecho** |
| 1.2 | Soberania: **pueblo espanol** |
| **1.3** | Forma politica: **Monarquia parlamentaria** |

**Clave:** La forma politica es "Monarquia parlamentaria" (no constitucional, ni democratica, ni de derecho). Es una expresion literal del art. 1.3.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "6852b21b-2756-4058-b27f-8c9f4f83773e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.1.3 monarquia parlamentaria (" + exp2.length + " chars)");

  // #3 - Prolongación servicio activo funcionarios AGE hasta 70 años
  const exp3 = `**Articulo 67 del TREBEP (RDL 5/2015) - Prolongacion del servicio activo:**

> "Una vez alcanzada la edad de jubilacion forzosa, podra solicitarse la prolongacion de la permanencia en el servicio activo como maximo hasta que el funcionario cumpla los **setenta anos** de edad."

**Por que D es correcta (70 anos):**
El art. 67 TREBEP permite que los funcionarios de la AGE, una vez cumplida la edad de jubilacion forzosa (actualmente 65 anos con caracter general), soliciten prolongar su permanencia en servicio activo hasta los **70 anos** como maximo. Es una solicitud voluntaria, no automatica.

**Por que las demas son incorrectas:**

- **A)** "**Setenta y cinco** anos." Falso: el limite maximo es 70 anos, no 75. Permitir trabajar hasta los 75 excederia ampliamente el tope legal establecido en el TREBEP.

- **B)** "**Sesenta y siete anos y medio**." Falso: 67 anos y medio no es el limite de prolongacion previsto en el art. 67 TREBEP. La edad de 67 se relaciona con la jubilacion ordinaria en el regimen de Seguridad Social, pero no con el limite de prolongacion del servicio activo de los funcionarios.

- **C)** "**Sesenta y cinco** anos." Falso: 65 anos es la edad de jubilacion forzosa con caracter general, no el limite de la prolongacion. La prolongacion se solicita **despues** de cumplir esa edad, hasta los 70. Si el limite fuera 65, no habria prolongacion alguna.

**Jubilacion de funcionarios (art. 67 TREBEP):**

| Concepto | Edad |
|----------|------|
| Jubilacion forzosa (general) | **65** anos |
| Prolongacion maxima | **70** anos |
| Periodo de prolongacion posible | Hasta **5 anos** adicionales |

**Clave:** Jubilacion forzosa a los 65, prolongacion posible hasta los **70**. No confundir la edad de jubilacion (65) con el limite de prolongacion (70).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "7e2d21eb-a99d-416c-8887-56af7e273e41");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - TREBEP art.67 prolongacion 70 anos (" + exp3.length + " chars)");
})();
