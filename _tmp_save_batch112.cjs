require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.78 Comision interministerial Administracion periferica
  const exp1 = `**Articulo 78.2 de la Ley 40/2015:**

> "La **Comision interministerial de coordinacion de la Administracion periferica del Estado** se encargara de coordinar la actuacion de la Administracion periferica del Estado con los distintos Departamentos ministeriales."

**Por que D es correcta:**
El art. 78 crea un organo colegiado con un nombre muy especifico: "Comision interministerial de coordinacion de la Administracion periferica del Estado". Esta adscrito al Ministerio de Hacienda y Administraciones Publicas (art. 78.1) y su funcion es coordinar la Administracion periferica (Delegaciones y Subdelegaciones del Gobierno) con los distintos ministerios.

**Por que las demas son incorrectas (nombres inventados):**

- **A)** "Delegacion de coordinacion del Ministerio de Politica Territorial y Memoria Democratica". Falso: no existe ningun organo con ese nombre en la Ley 40/2015. El nombre mezcla "Delegacion" (que recuerda a las Delegaciones del Gobierno) con un ministerio concreto. El organo real es una **Comision interministerial**, no una "Delegacion".

- **B)** "Secretaria de coordinacion interministerial General de Funcion Publica". Falso: nombre completamente inventado. No existe una "Secretaria de coordinacion interministerial". Ademas, la Funcion Publica se ocupa del empleo publico, no de coordinar la Administracion periferica.

- **C)** "Subsecretaria de coordinacion periferica de Politica Territorial y Memoria Democratica". Falso: nombre inventado. Las Subsecretarias son organos directivos de cada Ministerio (art. 63), no organos de coordinacion interministerial. Ademas, el organo no depende de un ministerio concreto sino que es **interministerial**.

**Dato clave del art. 78:**
- Organo: Comision **interministerial**
- Funcion: Coordinar Administracion **periferica** con los ministerios
- Adscripcion: Ministerio de Hacienda y Administraciones Publicas
- Regulacion: por Real Decreto (composicion y funcionamiento)

**Clave:** "Comision interministerial de coordinacion de la Administracion periferica del Estado". Memorizar el nombre completo. Las demas opciones usan nombres inventados que suenan plausibles.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f9b541b3-7945-4e1a-84a3-6389d1fc1b68");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.78 Comision periferica (" + exp1.length + " chars)");

  // #2 - LBRL art.42 comarcas interprovinciales informe Diputaciones
  const exp2 = `**Articulo 42.2 (ultimo parrafo) de la Ley 7/1985 (LBRL):**

> "Cuando la comarca deba agrupar a Municipios de **mas de una Provincia**, sera necesario el **informe favorable de las Diputaciones Provinciales** a cuyo ambito territorial pertenezcan tales Municipios."

**Por que D es correcta (informe favorable de las Diputaciones Provinciales):**
La LBRL permite a las CCAA crear comarcas (agrupaciones de municipios con intereses comunes). Cuando una comarca cruza los limites de una Provincia, se exige el informe favorable de las Diputaciones afectadas. La logica es clara: las Diputaciones son los entes que representan los intereses de cada Provincia, y al agrupar municipios de varias Provincias se afecta su ambito territorial.

**Por que las demas son incorrectas:**

- **A)** "El informe favorable del Consejo de Estado u organo consultivo de la CCAA respectiva". Falso: el art. 42 no exige informe del Consejo de Estado ni de ningun organo consultivo para crear comarcas interprovinciales. El Consejo de Estado interviene en otros supuestos (disolucion de entidades locales, conflictos competenciales), pero no en la creacion de comarcas.

- **B)** "El informe favorable del Consejo de Ministros". Falso: el Consejo de Ministros no interviene en la creacion de comarcas. Las comarcas son creacion de las CCAA (art. 42.1 LBRL), no del Estado. El Consejo de Ministros no tiene competencia sobre la organizacion comarcal.

- **C)** "El informe favorable de las Cortes Generales". Falso: las Cortes Generales no intervienen en la creacion de comarcas. La creacion de comarcas es competencia autonomica, y cuando es interprovincial se requiere el informe de las Diputaciones, no del parlamento estatal.

**Reglas de creacion de comarcas (art. 42 LBRL):**
- Competencia: **Comunidades Autonomas**
- No puede crearse si se oponen **2/5 de los Municipios** que representen al menos **1/2 de la poblacion**
- Si es interprovincial: informe favorable de las **Diputaciones Provinciales** afectadas

**Clave:** Comarca interprovincial = informe Diputaciones. No intervienen ni Consejo de Estado, ni Consejo de Ministros, ni Cortes.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "5e4bd56d-ca34-4dde-9aa9-29f67c9faa10");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LBRL art.42 comarcas Diputaciones (" + exp2.length + " chars)");
})();
