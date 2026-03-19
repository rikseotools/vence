require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.120 procedimiento oral
  const exp1 = `**Articulo 120 de la Constitucion Espanola** (Principios del procedimiento judicial):

> **120.1:** "Las actuaciones judiciales seran **publicas**, con las excepciones que prevean las leyes de procedimiento."
> **120.2:** "El procedimiento sera **predominantemente oral**, sobre todo en materia criminal."
> **120.3:** "Las sentencias seran siempre **motivadas** y se pronunciaran en **audiencia publica**."

**Por que C es correcta:**
Reproduce literalmente el art. 120.2 CE: el procedimiento sera predominantemente oral, sobre todo en materia criminal. Es un mandato constitucional de oralidad procesal.

**Por que las demas son incorrectas:**

- **A)** "Jueces y Magistrados dependen jerarquicamente del Ministerio de Justicia". Falso: el art. 117.1 CE establece que la justicia es **independiente**. Los jueces son independientes, inamovibles, responsables y sometidos unicamente al imperio de la ley. No existe dependencia jerarquica del ejecutivo.

- **B)** "Tribunales de Excepcion". Falso: el art. 117.6 CE **prohibe** expresamente los Tribunales de Excepcion. Los ciudadanos pueden participar en la justicia mediante la institucion del Jurado (art. 125 CE), pero nunca a traves de tribunales excepcionales.

- **D)** "Sentencias en audiencia privada". Falso: el art. 120.3 dice exactamente lo contrario: las sentencias se pronuncian en **audiencia publica**, no privada. La publicidad es un principio fundamental del proceso.

**Tres principios del art. 120 CE:**
- **Publicidad** de las actuaciones judiciales (120.1)
- **Oralidad** del procedimiento, especialmente en lo criminal (120.2)
- **Motivacion** y publicidad de las sentencias (120.3)`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "bc36562b-489c-485d-b9f6-b41fa94b8b7d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.120 (" + exp1.length + " chars)");

  // #2 - CE art.149 competencias exclusivas
  const exp2 = `**Articulo 149 de la Constitucion Espanola** (Competencias exclusivas del Estado):

> **149.1:** "El Estado tiene competencia exclusiva sobre las siguientes materias: [32 materias enumeradas]"

**Por que A es correcta:**
Las competencias exclusivas del Estado se recogen en el **articulo 149** CE. Este articulo enumera 32 materias sobre las que el Estado tiene competencia exclusiva (defensa, relaciones internacionales, nacionalidad, etc.).

**Por que las demas son incorrectas:**

- **B)** Art. 148: Es el articulo que enumera las competencias que las **Comunidades Autonomas** podran asumir (no las exclusivas del Estado). Son 22 materias asumibles por las CCAA.

- **C)** Art. 151: Regula la **via rapida de acceso a la autonomia** (referendum, procedimiento agravado). No tiene relacion con el reparto competencial.

- **D)** Art. 150: Regula las **leyes marco, de transferencia y de armonizacion**, que son mecanismos para flexibilizar el reparto competencial entre Estado y CCAA. No es la lista de competencias exclusivas.

**Esquema de reparto competencial en la CE:**

| Articulo | Contenido |
|----------|-----------|
| **148** | Competencias asumibles por CCAA (22 materias) |
| **149** | Competencias exclusivas del Estado (32 materias) |
| **150** | Leyes marco, transferencia y armonizacion |
| **151** | Via rapida de acceso a la autonomia |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "35b50de2-1bbd-4264-aa62-c96066300b77");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.149 competencias (" + exp2.length + " chars)");

  // #3 - CE art.149 no es competencia exclusiva
  const exp3 = `**Articulos 148 y 149 de la Constitucion Espanola** (Reparto competencial):

**La pregunta pide la que NO es competencia exclusiva del Estado.**

**Por que A es correcta (NO es competencia exclusiva del Estado):**
La **ordenacion del territorio** no aparece en el art. 149.1 (competencias del Estado). Se encuentra en el **art. 148.1.3a** como competencia que las CCAA pueden asumir: "Ordenacion del territorio, urbanismo y vivienda". Es una de las competencias tipicamente autonomicas.

**Por que las demas SI son competencias exclusivas del Estado:**

- **B)** "Legislacion laboral" - **Art. 149.1.7a CE**: "Legislacion laboral; sin perjuicio de su ejecucion por los organos de las Comunidades Autonomas." Es competencia exclusiva del Estado (legislar), aunque la ejecucion puede ser autonomica.

- **C)** "Comercio exterior" - **Art. 149.1.10a CE**: "Comercio exterior." Competencia exclusiva del Estado, sin matices.

- **D)** "Bases del regimen minero" - **Art. 149.1.25a CE**: "Bases del regimen minero y energetico." Competencia exclusiva del Estado (las bases), pudiendo las CCAA desarrollar legislativamente.

**Truco para diferenciar 148 y 149:**
- Art. 148 (CCAA): urbanismo, ordenacion del territorio, ferias, artesania, museos, turismo...
- Art. 149 (Estado): defensa, relaciones internacionales, legislacion laboral/mercantil/penal, comercio exterior...`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "cd80b24a-f8f2-4a6f-9738-18aaa74532fd");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.149 no competencia (" + exp3.length + " chars)");
})();
