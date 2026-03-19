require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Agenda 2030 ODS 8
  const exp1 = `**Objetivo de Desarrollo Sostenible n.8 de la Agenda 2030:**

> ODS 8: **"Trabajo decente y crecimiento economico"** - Promover el crecimiento economico sostenido, inclusivo y sostenible, el empleo pleno y productivo y el trabajo decente para todos.

**Por que A es correcta:**
El ODS 8 se denomina literalmente "Trabajo decente y crecimiento economico". Es uno de los 17 ODS aprobados por la ONU en 2015.

**Por que las demas son incorrectas:**

- **B)** "Desnuclearizacion industrial" - No es un ODS. Ningun objetivo de la Agenda 2030 lleva este nombre. La energia limpia se trata en el ODS 7 ("Energia asequible y no contaminante"), pero no habla de desnuclearizacion.

- **C)** "Racionalizacion de usos industriales" - No es un ODS. La industria aparece en el ODS 9 ("Industria, innovacion e infraestructura"), pero con otra denominacion.

- **D)** "Impulso de la extraccion de combustibles fosiles" - No solo no es un ODS, sino que va en contra del espiritu de la Agenda 2030, que promueve la sostenibilidad y la accion por el clima (ODS 13).

**Los 17 ODS (para referencia):**
1-Pobreza, 2-Hambre, 3-Salud, 4-Educacion, 5-Igualdad genero, 6-Agua, 7-Energia, **8-Trabajo decente**, 9-Industria, 10-Desigualdades, 11-Ciudades, 12-Produccion responsable, 13-Clima, 14-Vida submarina, 15-Vida terrestre, 16-Paz y justicia, 17-Alianzas`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "2290ff38-0918-4dcb-98c1-76603893f126");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Agenda 2030 ODS 8 (" + exp1.length + " chars)");

  // #2 - Ley 50/1997 art.6 Comisiones Delegadas
  const exp2 = `**Articulo 6 de la Ley 50/1997 (Ley del Gobierno)** (Comisiones Delegadas del Gobierno):

Las Comisiones Delegadas son organos colegiados del Gobierno que coordinan asuntos que afectan a varios ministerios.

**Por que C es correcta:**
El art. 6.4 atribuye a las Comisiones Delegadas la funcion de "estudiar aquellos asuntos que, afectando a varios Ministerios, requieran la elaboracion de una propuesta conjunta previa a su resolucion por el Consejo de Ministros". Su papel es **preparatorio y coordinador**, no decisorio.

**Por que las demas son incorrectas:**

- **A)** "Aprobar el proyecto de ley de Presupuestos Generales del Estado" - Es competencia del **Consejo de Ministros** (art. 5.1.d Ley 50/1997), no de las Comisiones Delegadas.

- **B)** "Aprobar los proyectos de ley y su remision al Congreso o al Senado" - Es competencia del **Consejo de Ministros** (art. 5.1.b). Las Comisiones Delegadas estudian y preparan, pero no aprueban proyectos de ley.

- **D)** "Aprobar los reglamentos para el desarrollo y ejecucion de las leyes, previo dictamen del Consejo de Estado" - Es competencia del **Consejo de Ministros** (art. 5.1.h). La potestad reglamentaria corresponde al Consejo, no a las Comisiones Delegadas.

**Clave:** Las Comisiones Delegadas **estudian y coordinan**; el Consejo de Ministros **decide y aprueba**. Si la opcion dice "aprobar", es del Consejo de Ministros.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "f7d17965-f685-48d6-af5a-68a9f8e5e248");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 50/1997 Comisiones Delegadas (" + exp2.length + " chars)");

  // #3 - CE art.120 sentencias audiencia publica
  const exp3 = `**Articulo 120 de la Constitucion Espanola** (Principios del proceso judicial):

> **120.1:** "Las actuaciones judiciales seran **publicas**, con las excepciones que prevean las leyes de procedimiento."
> **120.2:** "El procedimiento sera predominantemente **oral**, sobre todo en materia criminal."
> **120.3:** "Las sentencias seran siempre **motivadas** y se pronunciaran en **audiencia publica**."

**Por que B es correcta:**
Reproduce literalmente el art. 120.3 CE: las sentencias se pronuncian en audiencia publica. Es un principio fundamental: la publicidad de las resoluciones judiciales.

**Por que las demas son incorrectas:**

- **A)** "El principio de jerarquia es la base de la organizacion de los tribunales". Falso: el principio fundamental del poder judicial es la **independencia** (art. 117.1 CE), no la jerarquia. Los jueces son independientes y solo estan sometidos al imperio de la ley. La jerarquia es propia de la Administracion (art. 103 CE), no de los tribunales.

- **C)** "Las actuaciones judiciales seran privadas, como regla general". Falso: dice lo contrario del art. 120.1, que establece que seran **publicas** como regla general. Las excepciones son eso: excepciones previstas en leyes de procedimiento.

- **D)** "El procedimiento sera predominantemente escrito, sobre todo en materia criminal". Falso: el art. 120.2 dice **oral**, no escrito. Ademas, la oralidad es especialmente importante en materia criminal (juicio oral).

**Los tres principios del art. 120 CE:**
- **Publicidad** de actuaciones (regla general)
- **Oralidad** del procedimiento (especialmente penal)
- **Motivacion** y publicidad de sentencias`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "23d1a34c-fb98-4e9e-890d-391920923091");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.120 sentencias (" + exp3.length + " chars)");
})();
