require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LEC art.814 peticion monitorio sede electronica valida con documentos
  const exp1 = `**Articulo 814.1 de la Ley 1/2000 (LEC) - Peticion inicial del monitorio:**

> "La peticion podra extenderse en impreso o formulario obtenido **en papel o a traves de la sede electronica**, que facilite la expresion de los extremos a que se refiere el apartado anterior."

**Por que C es correcta (si, a traves de sede electronica con documentos):**
El art. 814.1 LEC admite expresamente la presentacion de la peticion monitoria a traves de la **sede electronica**. Pero exige que se faciliten todos los datos obligatorios: identidad de las partes, domicilios, origen y cuantia de la deuda, y se acompanen los **documentos del art. 812** (documento acreditativo de la deuda).

**Por que las demas son incorrectas:**

- **A)** "No, unicamente podra extenderse en impreso presentandose en la oficina". Falso: el art. 814 dice "en papel **o a traves de la sede electronica**". La via electronica es perfectamente valida. Ademas, A omite la opcion de "formulario", reduciendo las posibilidades a solo "impreso".

- **B)** "No, unicamente podra extenderse en impreso o formulario obtenido en papel". Falso: aunque menciona correctamente "impreso o formulario", elimina la via electronica. El art. 814 dice expresamente "en papel **o a traves de la sede electronica**". La trampa reproduce casi todo el texto pero corta justo antes de mencionar la sede electronica.

- **D)** "Si, sin necesidad de acompanar los documentos del art. 812". Falso: la presentacion electronica **si** requiere acompanar los documentos del art. 812. El art. 814 exige que se acompane "el documento o documentos a que se refiere el articulo 812" independientemente de la via utilizada (papel o electronica). La via electronica no exime de aportar prueba documental.

**Clave:** La peticion monitoria puede presentarse por sede electronica, pero SIEMPRE con documentos del art. 812. Las opciones A y B niegan falsamente la via electronica. La opcion D acepta la via pero elimina los documentos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a2aaafc0-6489-47db-aab1-21aff8202876");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LEC art.814 monitorio electronica (" + exp1.length + " chars)");

  // #2 - LEC art.706 hacer no personalisimo resarcimiento danos y perjuicios
  const exp2 = `**Articulo 706.1 de la Ley 1/2000 (LEC) - Obligacion de hacer no personalisimo:**

> "Cuando el hacer a que obligue el titulo ejecutivo **no sea personalisimo**, si el ejecutado no lo llevara a cabo en el plazo senalado [...], el ejecutante podra pedir que se le faculte para **encargarlo a un tercero**, a costa del ejecutado, o reclamar el **resarcimiento de danos y perjuicios**."

**Por que C es correcta (resarcimiento de danos y perjuicios):**
Ante el incumplimiento de una obligacion de hacer **no personalisimo**, el art. 706.1 ofrece al ejecutante dos opciones:
1. Pedir que un **tercero** realice la prestacion a costa del ejecutado
2. Reclamar el **resarcimiento de danos y perjuicios**

La opcion C recoge la segunda alternativa.

**Por que las demas son incorrectas:**

- **A)** "Nuevo requerimiento al ejecutado". Falso: el art. 706 no preve un segundo requerimiento. Una vez transcurrido el plazo sin cumplimiento, se pasa directamente a las dos opciones del ejecutante (tercero o resarcimiento). No hay "segunda oportunidad".

- **B)** "Imposicion de multas". Falso: las **multas coercitivas** son el instrumento previsto para las obligaciones de hacer **personalisimo** (art. **709** LEC), no para las no personalisimas. En el hacer personalisimo, como no puede encomendarse a un tercero, se presiona al deudor con multas mensuales. La trampa confunde los dos tipos de hacer.

- **D)** "Equivalente economico de la prestacion de hacer". Falso: el "equivalente economico" es el remedio para las obligaciones de **no hacer** (art. **710** LEC), cuando se ha hecho lo que no debia hacerse y no puede deshacerse. La trampa confunde "hacer no personalisimo" con "no hacer".

**Tipos de obligaciones y remedios (LEC):**

| Obligacion | Articulo | Remedio principal |
|------------|----------|-------------------|
| Hacer **no personalisimo** | Art. 706 | Tercero a costa del ejecutado o **resarcimiento** |
| Hacer **personalisimo** | Art. 709 | Multas coercitivas mensuales |
| **No hacer** | Art. 710 | Deshacer o equivalente economico |

**Clave:** Hacer no personalisimo = resarcimiento (art. 706). Multas = personalisimo (art. 709). Equivalente economico = no hacer (art. 710).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "06fb485d-7637-44de-9c65-5796407e2b3b");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LEC art.706 hacer no personalisimo (" + exp2.length + " chars)");

  // #3 - LEC art.442.2 demandado no comparece juicio verbal se celebra el juicio
  const exp3 = `**Articulo 442.2 de la Ley 1/2000 (LEC):**

> "Si no compareciere el demandado, **se procedera a la celebracion del juicio**."

**Por que C es correcta (se procede a celebrar el juicio):**
El art. 442.2 LEC es claro: si el demandado no acude a la vista del juicio verbal, el juicio se celebra igualmente **sin su presencia**. El proceso sigue adelante y el juez dictara sentencia tras valorar las pruebas practicadas. No se suspende ni se le cita de nuevo.

**Contraste con el art. 442.1 (demandante no comparece):**
Si es el **demandante** quien no comparece, se le tiene por desistido, se le imponen costas y puede ser condenado a indemnizar al demandado. El trato es asimetrico: la incomparecencia del demandante perjudica al demandante; la del demandado simplemente permite continuar sin el.

**Por que las demas son incorrectas:**

- **A)** "Se dictara sentencia condenatoria". Falso: la no comparecencia del demandado **no equivale a una condena automatica**. El juez debe celebrar el juicio y valorar las pruebas antes de dictar sentencia. El resultado puede ser condenatorio o absolutorio segun lo que se acredite. En el proceso civil espanol no existe la "condena en rebeldia" automatica.

- **B)** "Se dictara auto de allanamiento". Falso: el **allanamiento** requiere una declaracion **expresa y voluntaria** del demandado aceptando las pretensiones del demandante (art. 21 LEC). No comparecer no es lo mismo que aceptar. Son dos actos procesales completamente distintos.

- **D)** "Se suspendera el juicio para citarlo nuevamente". Falso: el art. 442.2 no preve suspension ni nueva citacion. El juicio se celebra sin el demandado. Si se suspendiera, se paralizaria el proceso en perjuicio del demandante y se premiaria la incomparecencia.

**Clave:** El demandado no comparece = el juicio se celebra sin el (art. 442.2). No hay condena automatica, ni allanamiento presunto, ni suspension.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "9952a6cb-90aa-4745-bd72-7de74f439c20");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LEC art.442.2 juicio verbal incomparecencia (" + exp3.length + " chars)");
})();
