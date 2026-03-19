require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.9.3 principios publicidad, legalidad y responsabilidad
  const exp1 = `**Articulo 9.3 de la Constitucion Espanola - Principios constitucionales:**

> "La Constitucion garantiza el principio de **legalidad**, la **jerarquia normativa**, la **publicidad de las normas**, la **irretroactividad** de las disposiciones sancionadoras no favorables o restrictivas de derechos individuales, la **seguridad juridica**, la **responsabilidad** y la **interdiccion de la arbitrariedad** de los poderes publicos."

**Por que C es correcta (publicidad, legalidad y responsabilidad):**
Los tres principios de la opcion C (**publicidad de las normas**, **legalidad** y **responsabilidad**) aparecen expresamente en el art. 9.3 CE. Son 3 de los 7 principios garantizados por este articulo.

**Por que las demas son incorrectas (incluyen principios que NO estan en el art. 9.3):**

- **A)** "**Libertad**, seguridad juridica e interdiccion de la arbitrariedad." Falso: seguridad juridica e interdiccion de la arbitrariedad si estan en el art. 9.3, pero "**libertad**" no es uno de los 7 principios del art. 9.3. La libertad aparece en otros articulos (art. 1.1, art. 17), pero no en el 9.3.

- **B)** "Jerarquia normativa, **igualdad** y seguridad juridica." Falso: jerarquia normativa y seguridad juridica si estan en el art. 9.3, pero "**igualdad**" no. La igualdad esta consagrada en el art. 14 CE, no en el 9.3.

- **D)** "Legalidad, **igualdad** e irretroactividad." Falso: legalidad e irretroactividad si estan en el art. 9.3, pero "**igualdad**" no, como se ha explicado.

**Los 7 principios del art. 9.3 CE (lista exhaustiva):**

| N.o | Principio |
|-----|-----------|
| 1 | **Legalidad** |
| 2 | **Jerarquia normativa** |
| 3 | **Publicidad de las normas** |
| 4 | **Irretroactividad** (sancionadoras no favorables/restrictivas) |
| 5 | **Seguridad juridica** |
| 6 | **Responsabilidad** |
| 7 | **Interdiccion de la arbitrariedad** de los poderes publicos |

**NO estan en el art. 9.3 (trampas habituales):** libertad, igualdad, justicia, pluralismo politico (estos estan en el art. 1.1 CE como valores superiores).

**Clave:** El art. 9.3 tiene exactamente 7 principios. Ni "libertad" ni "igualdad" estan entre ellos. Memorizarlos con la frase: "Le-Je-Pu-Irre-Se-Re-Inter".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "b992473d-7af5-4653-99d7-c37df93e5256");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.9.3 principios (" + exp1.length + " chars)");

  // #2 - CE art.162 recurso inconstitucionalidad legitimados
  const exp2 = `**Articulo 162.1 de la Constitucion Espanola - Legitimacion ante el TC:**

> "Estan legitimados:
> a) Para interponer el **recurso de inconstitucionalidad**: el **Presidente del Gobierno**, el **Defensor del Pueblo**, **50 Diputados**, **50 Senadores**, los **organos colegiados ejecutivos** de las CCAA y, en su caso, las **Asambleas** de las mismas.
> b) Para interponer el **recurso de amparo**: toda persona natural o juridica que invoque un interes legitimo, asi como el Defensor del Pueblo y el Ministerio Fiscal."

**Por que C es correcta:**
La opcion C reproduce fielmente el art. 162.1.a) CE: Presidente del Gobierno, Defensor del Pueblo, 50 Diputados, 50 Senadores, organos colegiados ejecutivos de las CCAA y sus Asambleas. Son exactamente los 6 legitimados para el recurso de inconstitucionalidad.

**Por que las demas son incorrectas:**

- **A)** Mezcla legitimados del recurso de **inconstitucionalidad** con los del recurso de **amparo**. Incluye "toda persona natural o juridica que invoque un interes legitimo" y "el Ministerio Fiscal", que son legitimados del recurso de **amparo** (art. 162.1.b), no del de inconstitucionalidad. Ademas, omite a los 50 Diputados, 50 Senadores y organos de las CCAA.

- **B)** Incluye al "**Rey**" entre los legitimados. Falso: el Rey **no** esta legitimado para interponer el recurso de inconstitucionalidad. El art. 162.1.a) no lo menciona. El Rey sanciona y promulga las leyes (art. 62.a), pero no tiene legitimacion para impugnarlas ante el TC.

- **D)** Dice "**25** Diputados, **25** Senadores" en lugar de 50 y 50. Falso: el art. 162.1.a) exige **50** Diputados y **50** Senadores. Ademas, dice "organos colegiados **superiores** ejecutivos" cuando el articulo dice "organos colegiados ejecutivos" (sin "superiores").

**Legitimados para recurso de inconstitucionalidad vs amparo:**

| Recurso de inconstitucionalidad (art. 162.1.a) | Recurso de amparo (art. 162.1.b) |
|------------------------------------------------|----------------------------------|
| Presidente del Gobierno | Persona natural/juridica con interes |
| Defensor del Pueblo | Defensor del Pueblo |
| 50 Diputados | Ministerio Fiscal |
| 50 Senadores | |
| Organos ejecutivos CCAA | |
| Asambleas legislativas CCAA | |

**Clave:** Inconstitucionalidad = 6 legitimados institucionales (50+50, no 25+25). El Rey NO esta legitimado. No confundir con el recurso de amparo (personas + Defensor + Fiscal).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ccca4289-e45c-4812-9b28-1e8658d494a7");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.162 legitimados inconstitucionalidad (" + exp2.length + " chars)");

  // #3 - CE art.2 autonomía nacionalidades y regiones
  const exp3 = `**Articulo 2 de la Constitucion Espanola - Unidad y autonomia:**

> "La Constitucion se fundamenta en la **indisoluble unidad** de la Nacion espanola, patria comun e indivisible de todos los espanoles, y **reconoce y garantiza el derecho a la autonomia** de las **nacionalidades y regiones** que la integran y la **solidaridad** entre todas ellas."

**Por que D es correcta (art. 2):**
El derecho a la autonomia de las nacionalidades y regiones se reconoce expresamente en el **articulo 2** de la Constitucion Espanola, ubicado en el Titulo Preliminar. Este articulo combina dos principios: la unidad de la Nacion espanola y el reconocimiento del derecho a la autonomia de sus nacionalidades y regiones.

**Por que las demas son incorrectas:**

- **A)** "Si, en el **articulo 150**." Falso: el art. 150 CE regula las leyes marco, leyes de transferencia y leyes de armonizacion (relaciones Estado-CCAA), pero **no** es el articulo que reconoce el derecho a la autonomia. El reconocimiento esta en el art. 2.

- **B)** "**No, en ningun caso**." Falso: la CE si reconoce expresamente el derecho a la autonomia. El art. 2 dice "reconoce y garantiza el derecho a la autonomia". Negar este reconocimiento contradice el texto constitucional.

- **C)** "Si, en el **articulo 149**." Falso: el art. 149 CE establece las **competencias exclusivas del Estado** (32 materias), pero no es donde se reconoce el derecho a la autonomia. El reconocimiento esta en el art. 2.

**Articulos clave del Titulo VIII CE (Organizacion territorial):**

| Articulo | Contenido |
|----------|-----------|
| **Art. 2** | **Reconoce el derecho a la autonomia** |
| Art. 137 | Division territorial: municipios, provincias, CCAA |
| Art. 143 | Iniciativa del proceso autonomico |
| Art. 148 | Competencias que pueden asumir las CCAA |
| Art. 149 | Competencias exclusivas del Estado |
| Art. 150 | Leyes marco, transferencia y armonizacion |

**Clave:** El derecho a la autonomia se reconoce en el art. 2 CE (Titulo Preliminar), no en los arts. 149 o 150 (Titulo VIII). Es uno de los articulos mas fundamentales de la CE.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "90d0c277-f8cb-4eb3-871e-b154a344e435");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.2 autonomia nacionalidades (" + exp3.length + " chars)");
})();
