require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RDL 1/2013 art.2 tipos discriminacion
  const exp1 = `**Articulo 2 del RDL 1/2013** (Definiciones - Tipos de discriminacion):

Cada opcion corresponde a un **tipo distinto** de discriminacion definido en el art. 2:

| Opcion | Tipo | Letra art.2 |
|--------|------|-------------|
| A | Discriminacion **por asociacion** | art. 2.d |
| **B** | **Discriminacion directa** | **art. 2.c** |
| C | Discriminacion **indirecta** | art. 2.e |
| D | **Acoso** | art. 2.f |

**Por que B es correcta (discriminacion directa):**

> "**Discriminacion directa**: es la situacion en que se encuentra una persona con discapacidad cuando es tratada de manera **menos favorable** que otra en **situacion analoga** por motivo de o por razon de su discapacidad."

La clave es: trato menos favorable + situacion analoga + motivo de discapacidad.

**Por que las demas son incorrectas (son otros tipos):**

- **A)** Es la **discriminacion por asociacion** (art. 2.d): cuando discriminan a alguien por su **relacion con** una persona con discapacidad (ej: despedir a un trabajador porque su hijo tiene discapacidad). No es directa porque el discriminado no tiene discapacidad.

- **C)** Es la **discriminacion indirecta** (art. 2.e): una disposicion "**aparentemente neutra**" que en la practica causa desventaja a personas con discapacidad. No es directa porque la norma no discrimina expresamente.

- **D)** Es el **acoso** (art. 2.f): conducta no deseada que crea un entorno "**intimidatorio, hostil, degradante, humillante u ofensivo**". No es discriminacion directa sino una forma especifica de discriminacion.

**Clave:** Directa = trato menos favorable. Indirecta = norma neutra con efecto desproporcionado. Asociacion = por vinculo con persona con discapacidad. Acoso = entorno hostil.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "1621de09-17ad-4591-814c-9267dede91b4");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RDL 1/2013 discriminacion (" + exp1.length + " chars)");

  // #2 - RDL 1/2013 art.51 apoyo familiar
  const exp2 = `**Articulo 51.1 del RDL 1/2013** (Servicio de apoyo familiar):

> "El servicio de **apoyo familiar** tendra como objetivo la **orientacion e informacion a las familias**, el apoyo emocional, su capacitacion y formacion para atender a la estimulacion, maduracion y desarrollo fisico, psiquico e intelectual de los **ninos y ninas con discapacidad**."

**Por que A es correcta:**
La descripcion del enunciado coincide literalmente con el **servicio de apoyo familiar** del art. 51.1. Su enfoque es la familia: orientar, informar, apoyar emocionalmente y capacitar a las familias para atender a sus hijos con discapacidad.

**Por que las demas son incorrectas:**

- **B)** "Servicios de prevencion de deficiencias y de intensificacion de discapacidades". No se ajusta al enunciado. Estos servicios se orientan a **prevenir** deficiencias y evitar que las discapacidades se agraven, no a la orientacion y formacion de familias.

- **C)** "Servicios de orientacion e informacion" (art. 51.2). Aunque incluyen la palabra "orientacion", su objetivo es diferente: facilitar a las personas con discapacidad y sus familias el **conocimiento de las prestaciones y servicios** a los que pueden acceder. No se centran en la capacitacion y formacion para el desarrollo del nino.

- **D)** "Servicios de atencion domiciliaria". Se refieren a la prestacion de ayuda en el **hogar** de la persona con discapacidad (asistencia personal, limpieza, etc.). No se centran en la capacitacion de familias.

**Clave:** El enunciado describe un servicio centrado en las **familias** (orientacion, formacion, apoyo emocional) = apoyo familiar (art. 51.1).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "7f186dbe-5421-4ead-994a-83d7a9c248ab");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RDL 1/2013 apoyo familiar (" + exp2.length + " chars)");

  // #3 - Ley 39/2006 art.2 asistencia personal
  const exp3 = `**Articulo 2.7 de la Ley 39/2006:**

> "**Asistencia personal**: servicio prestado por un **asistente personal** que realiza o colabora en tareas de la vida cotidiana de una persona en situacion de dependencia, de cara a fomentar su **vida independiente**, promoviendo y potenciando su **autonomia personal**."

**Por que C es correcta:**
El termino legal especifico que usa la Ley 39/2006 para este servicio es "**asistencia personal**". Su objetivo central es fomentar la vida independiente y la autonomia, no sustituir a la persona sino ayudarla a hacer por si misma.

**Por que las demas son incorrectas:**

- **A)** "Asistencia a la dependencia". No es un termino definido en el art. 2 de la Ley 39/2006. Suena similar pero no corresponde a ninguna definicion legal de esta ley.

- **B)** "Cuidados profesionales" (art. 2.6). Concepto diferente: son los prestados por una **institucion publica o entidad**, con y sin animo de lucro, o profesional autonomo, entre cuyas finalidades se encuentre la prestacion de servicios a personas en dependencia. Se refiere al ambito institucional, no al asistente personal individual.

- **D)** "Cuidados no profesionales" (art. 2.5). Concepto opuesto: son la atencion prestada por personas del **entorno familiar** que no son profesionales. Se refiere a familiares cuidadores, no a un asistente personal contratado.

**Conceptos del art. 2 Ley 39/2006:**
| Termino | Quien lo presta | Objetivo |
|---------|----------------|----------|
| Cuidados no profesionales | Entorno familiar | Atencion basica |
| Cuidados profesionales | Instituciones/entidades | Servicios especializados |
| **Asistencia personal** | **Asistente personal** | **Vida independiente y autonomia** |`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "cc3f74a5-c3b3-452a-a976-19497579fcc5");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 39/2006 asistencia personal (" + exp3.length + " chars)");
})();
