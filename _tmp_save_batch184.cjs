require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.117.3 suspensión silencio positivo un mes
  const exp1 = `**Articulo 117.3 de la Ley 39/2015 (LPAC) - Suspension por silencio:**

> Art. 117.3: "Si transcurrido **un mes** desde que la solicitud de suspension haya tenido entrada en el registro electronico de la Administracion u Organo competente para decidir sobre la misma, el organo a quien competa resolver el recurso **no ha dictado y notificado resolucion expresa** al respecto, se entendera que la medida cautelar ha sido **concedida** [suspendida la ejecucion]."

**Por que B es correcta:**
El art. 117.3 establece un **silencio positivo** para la suspension: si el organo no resuelve la solicitud de suspension en **un mes**, se entiende que la ejecucion del acto queda **suspendida automaticamente**. Es una garantia para el recurrente frente a la inactividad administrativa.

**Por que las demas son incorrectas:**

- **A)** "Si el recurrente fundamenta su impugnacion en alguna de las causas de **nulidad de pleno derecho**." Falso: alegar nulidad de pleno derecho no produce automaticamente la suspension. El art. 117.2 permite al organo valorar la suspension cuando haya perjuicios de imposible reparacion, pero no la vincula a las causas de nulidad. El recurso y la suspension son cuestiones separadas.

- **C)** "Si el recurrente manifiesta que la ejecucion puede causar **perjuicios de imposible o dificil reparacion**." Falso: la existencia de perjuicios es un elemento que el organo puede **valorar** para conceder la suspension (art. 117.2), pero no produce la suspension automatica. El organo debe ponderar el interes publico frente al perjuicio del recurrente y dictar resolucion motivada.

- **D)** "Si el recurrente acompana caucion o **garantia suficiente**." Falso: la caucion o garantia es un medio que puede exigir el organo como condicion para conceder la suspension (art. 117.2), pero aportarla no genera automaticamente la suspension. Es el organo quien decide si suspende o no, teniendo en cuenta la garantia ofrecida.

**Regla del art. 117 sobre suspension:**
- Regla general: el recurso **no** suspende la ejecucion (art. 117.1)
- Excepcion: el organo **puede** suspender ponderando intereses (art. 117.2)
- Silencio positivo: si no resuelve en **1 mes**, la suspension se entiende **concedida** (art. 117.3)

**Clave:** Solo el silencio de 1 mes produce suspension automatica. Ni la nulidad, ni los perjuicios, ni la caucion la producen por si solos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "262fb7f5-56e6-4e96-9093-e6df0753a23f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.117 suspension silencio (" + exp1.length + " chars)");

  // #2 - CE art.63.2 Rey consentimiento del Estado tratados internacionales
  const exp2 = `**Articulo 63.2 de la Constitucion Espanola - El Rey y los tratados internacionales:**

> "Al **Rey** corresponde manifestar el **consentimiento del Estado** para obligarse internacionalmente por medio de **tratados**, de conformidad con la Constitucion y las leyes."

**Por que A es correcta (al Rey):**
El art. 63.2 CE atribuye al Rey la funcion de manifestar el consentimiento del Estado para obligarse mediante tratados internacionales. Es una funcion formal y representativa: el Rey actua como jefe del Estado en las relaciones internacionales.

**Por que las demas son incorrectas:**

- **B)** "Al **presidente del Gobierno**." Falso: el presidente del Gobierno dirige la politica exterior (art. 97 CE), pero la manifestacion formal del consentimiento del Estado para vincularse por tratados corresponde al Rey, no al presidente. El presidente negocia; el Rey formaliza.

- **C)** "Al **Congreso de los Diputados**." Falso: el Congreso por si solo no tiene esta funcion. Son las **Cortes Generales** (Congreso + Senado) las que autorizan determinados tratados (art. 94 CE), pero la manifestacion del consentimiento es del Rey.

- **D)** "A las **Cortes Generales**." Falso: las Cortes Generales **autorizan** ciertos tratados (art. 94.1 CE: los de caracter politico, militar, que afecten a la integridad territorial, etc.), pero no manifiestan el consentimiento. La autorizacion parlamentaria es previa; la manifestacion del consentimiento corresponde al Rey.

**Proceso de vinculacion por tratados internacionales:**

| Fase | Organo | Articulo CE |
|------|--------|-------------|
| Negociacion | **Gobierno** | Art. 97 |
| Autorizacion (si procede) | **Cortes Generales** | Art. 94 |
| **Consentimiento del Estado** | **Rey** | **Art. 63.2** |
| Informacion posterior | Cortes Generales | Art. 94.2 |

**Clave:** El Rey manifiesta el consentimiento. Las Cortes autorizan. El Gobierno negocia. No confundir estas tres funciones.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "f4b58c3f-8db7-4a84-b797-77b35ec0ebba");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.63 Rey tratados (" + exp2.length + " chars)");

  // #3 - RDL 8/2015 art.136.1 Régimen General SS solo cuenta ajena
  const exp3 = `**Articulo 136.1 del RDL 8/2015 (LGSS) - Campo de aplicacion del Regimen General:**

> "Estaran obligatoriamente incluidos en el campo de aplicacion del Regimen General de la Seguridad Social los trabajadores **por cuenta ajena** y los asimilados a los que se refiere el articulo 7.1.a) de esta ley, **salvo** que por razon de su actividad deban quedar comprendidos en el campo de aplicacion de algun **regimen especial** de la Seguridad Social."

**Por que D es correcta:**
La opcion D reproduce literalmente el art. 136.1: el Regimen General incluye a los trabajadores **por cuenta ajena** y asimilados, salvo que deban estar en un regimen especial. La clave es que solo menciona "cuenta ajena", no "cuenta propia".

**Por que las demas son incorrectas:**

- **A)** "Los socios trabajadores de las sociedades de capital si poseen su **control**." Falso: el art. 136.2 incluye a ciertos socios en el Regimen General, pero los que poseen el **control efectivo** de la sociedad quedan encuadrados en el **RETA** (Regimen Especial de Trabajadores Autonomos), no en el General. Poseer el control equivale a trabajador por cuenta propia.

- **B)** "El personal **funcionario**." Falso: los funcionarios publicos tienen sus propios regimenes (Clases Pasivas, mutualidades como MUFACE, ISFAS, MUGEJU). No estan incluidos en el Regimen General, salvo algunos colectivos especificos que se han ido integrando progresivamente.

- **C)** "Los trabajadores **por cuenta propia y por cuenta ajena**." Falso: la trampa anade "por cuenta propia". El art. 136.1 solo menciona trabajadores **por cuenta ajena**. Los trabajadores por cuenta propia (autonomos) tienen su propio regimen especial: el **RETA** (Titulo IV LGSS). Esta es la diferencia critica con la opcion D correcta.

**Estructura basica del sistema de SS:**

| Regimen | Trabajadores incluidos |
|---------|----------------------|
| **General** | Por **cuenta ajena** y asimilados |
| **RETA** | Por **cuenta propia** (autonomos) |
| Especial del Mar | Trabajadores del sector maritimo |
| Otros especiales | Mineria del carbon, etc. |

**Clave:** Regimen General = solo cuenta **ajena**. La opcion C falla porque anade "cuenta propia", que pertenece al RETA.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "7780e24b-9066-467d-918f-dc16e8c34b51");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RDL 8/2015 art.136 Regimen General (" + exp3.length + " chars)");
})();
