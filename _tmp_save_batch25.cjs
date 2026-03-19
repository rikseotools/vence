require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/2007 presencia equilibrada
  const exp1 = `**Articulo 16 de la LO 3/2007** (Nombramientos por poderes publicos):

> "Los Poderes Publicos procuraran atender al principio de **presencia equilibrada** de mujeres y hombres en los nombramientos y designaciones de los cargos de responsabilidad que les correspondan."

**Por que A es correcta:**
La opcion A refleja el art. 16 y el art. 52 de la LO 3/2007: el Gobierno atendera al principio de presencia equilibrada en el nombramiento de titulares de organos directivos de la AGE. "Presencia equilibrada" significa que ninguno de los dos sexos supere el 60% ni sea inferior al 40%.

**Por que las demas son incorrectas:**

- **B)** "Preferencia durante **6 meses** a quienes se incorporen del permiso de maternidad/paternidad". Falso: el art. 60.2 de la LO 3/2007 establece preferencia para la adjudicacion de cursos de formacion, pero no fija un plazo de 6 meses. El plazo de 6 meses es inventado para confundir.

- **C)** "No seran admisibles **en ningun caso** las diferencias de trato". Falso: el art. 69 de la LO 3/2007 permite diferencias de trato entre hombres y mujeres en el acceso a bienes y servicios cuando esten **justificadas por un proposito legitimo** y los medios sean adecuados y necesarios. La expresion "en ningun caso" la hace incorrecta.

- **D)** "En los procesos de **caracter penal**, la carga de la prueba se invierte". Falso: el art. 13 de la LO 3/2007 establece la inversion de la carga de la prueba, pero **excluye expresamente los procesos penales**. La inversion solo opera en procedimientos civiles, laborales y contencioso-administrativos.

**Clave:** Presencia equilibrada (40%-60%) en nombramientos de la AGE. Cuidado con las trampas: 6 meses inventado, "en ningun caso" absolutista, y exclusion penal de la inversion de prueba.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "46c34d03-fef3-4b4b-b9d3-af92eb89fa67");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/2007 presencia equilibrada (" + exp1.length + " chars)");

  // #2 - CE art.158.1 asignacion CCAA
  const exp2 = `**Articulo 158.1 de la Constitucion Espanola:**

> "En los PGE podra establecerse una asignacion a las CCAA en funcion del volumen de los servicios y actividades **estatales** que hayan asumido y de la **garantia de un nivel minimo** en la prestacion de los servicios publicos fundamentales en todo el territorio espanol."

**Por que D es correcta:**
La opcion D reproduce uno de los dos criterios del art. 158.1: la garantia de un nivel minimo en la prestacion de los servicios publicos fundamentales en todo el territorio. Es un criterio de equidad territorial.

**Por que las demas son incorrectas:**

- **A)** "Servicios y actividades **autonomicas** que hayan asumido". Falso: el art. 158.1 dice "servicios y actividades **estatales**", no "autonomicas". La diferencia es crucial: la asignacion se calcula por los servicios **del Estado** que las CCAA han asumido (traspaso de competencias), no por sus propios servicios autonomicos.

- **B)** "Medios economicos, materiales y personales disponibles". Falso: este criterio no aparece en el art. 158.1. La disponibilidad de medios es un concepto presupuestario general, pero no es un factor del calculo de la asignacion a CCAA segun este articulo.

- **C)** "Programacion del sector publico estatal y principios de estabilidad presupuestaria". Falso: esta descripcion mezcla conceptos de los arts. 134 CE (PGE) y del art. 135 CE (estabilidad presupuestaria), pero no corresponde al criterio del art. 158.1.

**Los dos criterios del art. 158.1:**
1. Volumen de servicios **estatales** asumidos
2. Garantia de nivel minimo en servicios publicos fundamentales`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e15e0502-01a9-4a3a-bbe8-68dbbecbed24");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.158.1 asignacion CCAA (" + exp2.length + " chars)");
})();
