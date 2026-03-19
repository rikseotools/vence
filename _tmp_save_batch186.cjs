require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RDL 1/2013 art.23.2 normas internas empresas accesibilidad
  const exp1 = `**Articulo 23.2 del RDL 1/2013 - Condiciones de accesibilidad y no discriminacion:**

> Art. 23.2: "Las condiciones basicas de accesibilidad y no discriminacion estableceran, para cada ambito o area, **medidas concretas** para prevenir o suprimir discriminaciones, y para compensar desventajas o dificultades. Estas medidas podran incluir, entre otras: [...] d) La adopcion de **normas internas** en las empresas o centros que promuevan y estimulen la eliminacion de desventajas."

**Por que B es correcta (dentro del marco de las condiciones basicas):**
El art. 23.2 establece que las medidas concretas (incluidas las normas internas de empresas) se adoptan **dentro del marco** de las condiciones basicas de accesibilidad y no discriminacion reguladas por el Gobierno. Las normas internas son una de las medidas que pueden incluir estas condiciones basicas.

**Por que las demas son incorrectas:**

- **A)** "Requiriendose previa solicitud para su aplicacion." Falso: el art. 23 no exige "previa solicitud" para adoptar normas internas en las empresas. Estas medidas se adoptan dentro del marco de las condiciones basicas, no mediante un procedimiento de solicitud previa.

- **C)** "Regulandose reglamentariamente el procedimiento para su adopcion." Falso: el art. 23 no establece que haya un procedimiento reglamentario especifico para adoptar normas internas en las empresas. Son medidas que las propias empresas implementan dentro del marco general.

- **D)** "Con duracion maxima de 5 anos." Falso: el art. 23 no establece ningun limite temporal de 5 anos para estas medidas. No hay duracion maxima fijada para las normas internas de eliminacion de desventajas.

**Clave:** Las normas internas de empresas para eliminar desventajas son una medida concreta enmarcada **dentro de las condiciones basicas de accesibilidad** que regula el Gobierno. No requieren solicitud previa, procedimiento reglamentario especifico ni tienen duracion maxima.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "fd1679ef-9826-4361-a6bc-175576b22f41");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RDL 1/2013 art.23 accesibilidad (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.39.3 eficacia retroactiva excepcional
  const exp2 = `**Articulo 39 de la Ley 39/2015 (LPAC) - Eficacia de los actos:**

> Art. 39.3: "**Excepcionalmente**, podra otorgarse eficacia retroactiva a los actos cuando se dicten en sustitucion de actos anulados, asi como cuando produzcan efectos favorables al interesado, siempre que los supuestos de hecho necesarios existieran ya en la fecha a que se retrotraiga la eficacia del acto y esta no lesione derechos o intereses legitimos de otras personas."

**Por que A es correcta (excepcional + requisitos legales):**
El art. 39.3 comienza con la palabra "**Excepcionalmente**", lo que deja claro que la retroactividad no es la regla general. Ademas, exige el cumplimiento de **requisitos legalmente establecidos**: sustitucion de actos anulados o efectos favorables, preexistencia de los supuestos de hecho, y no lesion de derechos de terceros.

**Por que las demas son incorrectas:**

- **B)** "**General**, cuando exista una aprobacion superior." Falso por dos razones: (1) la retroactividad no es "general", sino **excepcional** (art. 39.3); (2) la condicion no es una "aprobacion superior". La aprobacion superior aparece en el art. 39.2, pero se refiere a la **demora** de la eficacia, no a la retroactividad. Son conceptos diferentes.

- **C)** "**General**, cuando cumpla los requisitos legalmente establecidos." Falso: acierta en lo de "requisitos legalmente establecidos", pero se equivoca al decir "general". El art. 39.3 dice "**excepcionalmente**", no como regla general.

- **D)** "**Excepcional**, cuando exista una aprobacion superior." Falso: acierta en "excepcional", pero la condicion es erronea. La retroactividad no depende de una "aprobacion superior", sino del cumplimiento de los requisitos del art. 39.3 (sustitucion de anulados, efectos favorables, preexistencia de hechos, no lesion de terceros).

**Art. 39 - Eficacia de los actos:**

| Tipo | Caracter | Condicion |
|------|----------|-----------|
| Eficacia normal | General | Desde la fecha del acto (art. 39.1) |
| Eficacia demorada | Excepcional | Notificacion, publicacion o aprobacion superior (art. 39.2) |
| Eficacia **retroactiva** | **Excepcional** | **Requisitos legales** del art. 39.3 |

**Clave:** Retroactividad = excepcional + requisitos legales. No es "general" y no depende de "aprobacion superior".`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "eb3d4c9f-6782-4e2b-a757-a4c323f102f9");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.39 retroactividad excepcional (" + exp2.length + " chars)");

  // #3 - LO 2/1979 art.14 TC Pleno quórum dos tercios
  const exp3 = `**Articulo 14 de la LO 2/1979 (LOTC) - Quorum del Tribunal Constitucional:**

> "El Tribunal en Pleno puede adoptar acuerdos cuando esten presentes, al menos, **dos tercios** de los miembros que en cada momento lo compongan."

**Por que C es correcta (dos tercios):**
El art. 14 LOTC exige un quorum de **dos tercios** para que el Pleno del TC pueda adoptar acuerdos. Siendo 12 los magistrados del TC (art. 159.1 CE), dos tercios equivalen a **8 magistrados** como minimo.

**Por que las demas son incorrectas:**

- **A)** "Un **cuarto** de los miembros." Falso: un cuarto (3 de 12) seria un quorum demasiado bajo para un organo constitucional de esta importancia. El art. 14 exige dos tercios, no un cuarto.

- **B)** "Tres **cuartos** de los miembros." Falso: tres cuartos (9 de 12) seria un quorum mas elevado del que establece la ley. El art. 14 dice dos tercios, no tres cuartos. Esta opcion es la trampa mas proxima al dato correcto.

- **D)** "Tres **quintos** de los miembros." Falso: tres quintos es la mayoria que exige la CE para proponer magistrados del TC en el Congreso y el Senado (art. 159.1 CE), pero **no** es el quorum del Pleno. No confundir la mayoria de eleccion (3/5) con el quorum de funcionamiento (2/3).

**Quorum en los organos del TC (art. 14 LOTC):**

| Organo | Quorum |
|--------|--------|
| **Pleno** (12 magistrados) | **2/3** (8 magistrados) |
| **Salas** (6 magistrados) | **2/3** (4 magistrados) |
| **Secciones** (3 magistrados) | 2 miembros (3 si hay discrepancia) |

**Clave:** Pleno del TC = 2/3 como quorum. No confundir con 3/5 (mayoria de eleccion de magistrados en las Camaras).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "e589bd4d-c363-4976-beec-67519d54004d");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LOTC art.14 quorum TC (" + exp3.length + " chars)");
})();
