require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.159 TC 8 magistrados Cortes Generales 3/5
  const exp1 = `**Articulo 159.1 de la Constitucion Espanola - Composicion del Tribunal Constitucional:**

> "El Tribunal Constitucional se compone de **12 miembros** nombrados por el Rey; de ellos, **cuatro a propuesta del Congreso** por mayoria de **tres quintos** de sus miembros; **cuatro a propuesta del Senado**, con identica mayoria; dos a propuesta del Gobierno, y dos a propuesta del Consejo General del Poder Judicial."

**Por que A es correcta:**
Las Cortes Generales (Congreso + Senado) proponen **8 de los 12** magistrados del TC: 4 el Congreso y 4 el Senado, ambos por mayoria de **3/5** de sus miembros. La opcion A recoge estos tres datos correctamente.

**Por que las demas son incorrectas:**

- **B)** Habla de "miembros del **Consejo General del Poder Judicial**", no del TC. Ademas, dice mayoria de "**3/4**". Falso: la pregunta es sobre el TC (art. 159), no sobre el CGPJ (art. 122). Y la mayoria para el CGPJ tambien es de 3/5, no de 3/4. Doble error.

- **C)** Dice mayoria de "**2/3**" para los magistrados del TC. Falso: el art. 159.1 dice **3/5** (tres quintos), no 2/3 (dos tercios). 3/5 = 60%, 2/3 = 66,7%. Son fracciones distintas.

- **D)** Habla del "**CGPJ**" en vez del TC, y ademas dice mayoria de "**2/3**". Doble error: ni es el organo correcto ni la mayoria correcta. Las Cortes proponen magistrados del TC (no del CGPJ) y la mayoria es 3/5 (no 2/3).

**Composicion del TC (art. 159.1):**

| Proponente | N.o magistrados | Mayoria |
|-----------|----------------|---------|
| **Congreso** | **4** | **3/5** |
| **Senado** | **4** | **3/5** |
| Gobierno | 2 | - |
| CGPJ | 2 | - |
| **Total** | **12** | |

**Clave:** 8 del TC por las Cortes (4+4) con mayoria de 3/5. No confundir TC con CGPJ, ni 3/5 con 2/3 o 3/4.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a828885d-5db4-4fc7-8333-c0b4afae4923");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.159 TC 8 magistrados (" + exp1.length + " chars)");

  // #2 - RGPD art.12.4 un mes desde recepción solicitud
  const exp2 = `**Articulo 12.4 del Reglamento (UE) 2016/679 (RGPD) - Plazo de respuesta al interesado:**

> "Si el responsable del tratamiento no da curso a la solicitud del interesado, le informara sin dilacion, y **a mas tardar transcurrido un mes** de la **recepcion** de la solicitud, de las razones de su no actuacion y de la posibilidad de presentar una **reclamacion** ante una autoridad de control y de **ejercitar acciones judiciales**."

**Por que A es correcta:**
El art. 12.4 RGPD establece tres datos clave: (1) plazo de **un mes**, (2) contado desde la **recepcion** de la solicitud, y (3) se debe informar de las razones y de los recursos disponibles (reclamacion + acciones judiciales). La opcion A reproduce estos tres elementos.

**Por que las demas son incorrectas (trampas de plazo y momento):**

- **B)** Dice "**dos meses** de la **recepcion**". Falso: el plazo es un mes, no dos. Los dos meses aparecen en otro contexto del RGPD: el art. 12.3 permite prorrogar el plazo de respuesta en **dos meses mas** cuando las solicitudes son complejas, pero el plazo base del art. 12.4 es de un mes.

- **C)** Dice "un mes de la **emision**". Falso: el plazo se cuenta desde la **recepcion** de la solicitud, no desde su emision. La diferencia importa porque entre la emision y la recepcion pueden pasar dias (correo postal, tramitacion, etc.).

- **D)** Contiene **dos errores**: (1) dice "**dos meses**" en vez de uno; (2) dice "de la **emision**" en vez de "de la recepcion". Combina los errores de B y C.

**Plazos del art. 12 RGPD:**

| Situacion | Plazo | Desde |
|----------|-------|-------|
| Respuesta al interesado (art. 12.3) | **1 mes** (prorrogable 2 mas) | **Recepcion** |
| **No dar curso** a la solicitud (art. 12.4) | **1 mes** | **Recepcion** |

**Clave:** Siempre **un mes** desde la **recepcion**. No confundir con "emision" ni con los dos meses de prorroga.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a9f1b465-096b-4f88-94fe-769412dfc7a7");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RGPD art.12.4 un mes recepcion (" + exp2.length + " chars)");

  // #3 - LGP art.35 programa de gasto conjunto créditos objetivos anuales
  const exp3 = `**Articulo 35 de la Ley 47/2003 (LGP) - Programa de gasto y creditos presupuestarios:**

> Art. 35.1: "Son **creditos presupuestarios** cada una de las asignaciones individualizadas de gasto, que figuran en los presupuestos [...], puestas a disposicion de los centros gestores para la cobertura de las necesidades para las que hayan sido aprobados."
>
> Art. 35.2: "Se entendera por **programa de gasto** el conjunto de creditos que, para el logro de los **objetivos anuales** que el mismo establezca, se ponen a disposicion del **gestor responsable** de su ejecucion."

**Por que C es correcta:**
Un programa de gasto (art. 35.2) es el **conjunto de creditos** destinados a lograr **objetivos anuales**, gestionados por un **responsable** de su ejecucion. La opcion C reproduce esta definicion.

**Por que las demas son incorrectas (confunden conceptos presupuestarios):**

- **A)** Define el **credito presupuestario** (art. 35.1), no el programa de gasto. El credito es una "asignacion individualizada de gasto". El programa es el "conjunto de creditos" para objetivos anuales. La trampa confunde la parte (credito individual) con el todo (programa = conjunto de creditos).

- **B)** Describe el concepto de **Presupuestos Generales del Estado** (art. 32): "expresion cifrada, conjunta y sistematica de los derechos y obligaciones a liquidar durante el ejercicio". Es la definicion general de presupuesto, no de un programa de gasto concreto.

- **D)** Describe algo cercano a un **programa plurianual o plan de gasto**, no un programa de gasto presupuestario. Habla de "gastos que se considera necesario realizar" y "actividades orientadas a objetivos preestablecidos", pero no menciona los **creditos** ni los **objetivos anuales** del art. 35.2.

**Conceptos del art. 35 LGP:**

| Concepto | Definicion |
|----------|-----------|
| **Credito presupuestario** | Asignacion **individualizada** de gasto |
| **Programa de gasto** | **Conjunto de creditos** para objetivos anuales |

**Clave:** Programa de gasto = conjunto de creditos + objetivos anuales + gestor responsable. No confundir con credito individual (art. 35.1) ni con la definicion general de presupuesto (art. 32).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "807bafa9-270a-406a-8b4e-20594a138ff7");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LGP art.35 programa gasto (" + exp3.length + " chars)");
})();
