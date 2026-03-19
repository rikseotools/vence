require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RDL 1/2013 art.55 Consejo Nacional Discapacidad
  const exp1 = `**Articulo 55 del RDL 1/2013:**

> "El **Consejo Nacional de la Discapacidad** es el organo colegiado interministerial, de caracter consultivo, en el que se institucionaliza la colaboracion del movimiento asociativo de las personas con discapacidad y sus familias y la Administracion General del Estado, para la definicion y coordinacion de las politicas publicas que garanticen los derechos de las personas con discapacidad."

**Por que D es correcta (Consejo Nacional de la Discapacidad):**
El art. 55 define este organo con cuatro caracteristicas clave: **colegiado** (formado por varios miembros), **interministerial** (participan varios ministerios), **consultivo** (asesora, no decide) y canaliza la **participacion** del movimiento asociativo.

**Por que las demas son incorrectas (nombres inventados o de otros organos):**

- **A)** "Centro Nacional de las Personas con Discapacidad". Falso: no existe un organo con ese nombre en el RDL 1/2013. Ademas, un "centro" sugiere un establecimiento fisico, no un organo colegiado consultivo.

- **B)** "Consejo Nacional de **Atencion** a la Discapacidad". Falso: cambia el nombre oficial. El organo se llama "Consejo Nacional de **la** Discapacidad", no "de Atencion a la Discapacidad". La trampa es anadir la palabra "Atencion" que suena plausible pero no aparece en el nombre oficial.

- **C)** "Oficina de Atencion a la Discapacidad". Falso: existe la **Oficina de Atencion a la Discapacidad** (OAD) como organo del Ministerio, pero no es lo que describe el art. 55. La OAD tiene funciones ejecutivas; el Consejo Nacional es consultivo. Son organos diferentes.

**Clave:** "Consejo Nacional de la Discapacidad" (sin "Atencion"). Es consultivo y colegiado, no un centro ni una oficina.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "62d5f90f-59a6-4eb9-bd96-d3568303e585");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RDL 1/2013 Consejo Discapacidad (" + exp1.length + " chars)");

  // #2 - Ley 40/2015 art.63 Subsecretarios jefatura personal
  const exp2 = `**Articulo 63.1.g) de la Ley 40/2015:**

> "Corresponde a los Subsecretarios: [...] g) Desempenar la **jefatura superior de todo el personal** del Departamento."

**Por que D es correcta (jefatura superior del personal):**
La jefatura de personal es una de las competencias mas caracteristicas del Subsecretario. Es el maximo responsable de los recursos humanos del ministerio: autorizaciones, regimen disciplinario, relaciones de puestos de trabajo, etc.

**Por que las demas son incorrectas (son competencias de otros cargos):**

- **A)** "Ejercicio de la potestad reglamentaria". Falso: la potestad reglamentaria corresponde al **Consejo de Ministros** (para Reales Decretos) o a los **Ministros** (para Ordenes Ministeriales). Los Subsecretarios no tienen potestad reglamentaria propia.

- **B)** "Proponer los proyectos de las Direcciones Generales bajo su dependencia para alcanzar los objetivos establecidos por el Ministro". Falso: esta es una competencia de los **Secretarios Generales** o **Secretarios Generales Tecnicos**, no del Subsecretario. El Subsecretario dirige los servicios comunes, no las Direcciones Generales sustantivas.

- **C)** "Ejercer las competencias atribuidas al Ministro en materia de ejecucion presupuestaria". Falso: la ejecucion presupuestaria con delegacion del Ministro es competencia de los **Secretarios de Estado** (art. 62 Ley 40/2015), no del Subsecretario.

**Competencias clave del Subsecretario (art. 63):**
- Representacion ordinaria del Ministerio
- Direccion de **servicios comunes**
- **Jefatura superior del personal**
- Asesoramiento tecnico y control de eficacia
- Inspeccion de servicios

**Clave:** Subsecretario = jefatura del personal + servicios comunes. No confundir con Ministro (reglamentos), Secretario de Estado (presupuestos) ni Secretario General (direcciones generales).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "625a8bfd-9928-48a5-bfc6-a9dde352c4e0");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 40/2015 Subsecretarios (" + exp2.length + " chars)");

  // #3 - Ley 40/2015 art.54 principios AGE incorrecta eficacia recursos
  const exp3 = `**Articulo 54.1 de la Ley 40/2015:**

> "La Administracion General del Estado actua y se organiza de acuerdo con los principios establecidos en el articulo 3, asi como los de **descentralizacion funcional** y **desconcentracion funcional y territorial**."

**Por que D es la incorrecta (y por tanto la respuesta):**
La opcion D dice "eficacia en la asignacion y utilizacion de los recursos publicos". Este principio pertenece al **art. 7.2 de la LO 2/2012** (Estabilidad Presupuestaria), no al art. 54 de la Ley 40/2015. Es un principio presupuestario, no un principio de organizacion de la AGE.

**Por que las demas SI son principios del art. 54:**

- **A)** "Descentralizacion funcional". **SI**: es uno de los dos principios especificos del art. 54.1, ademas de los generales del art. 3.

- **B)** "Desconcentracion funcional y territorial". **SI**: es el otro principio especifico del art. 54.1.

- **C)** "Responsabilidad por la gestion publica". **SI**: es uno de los principios generales del art. 3 Ley 40/2015, al que remite el art. 54.1.

**Principios organizativos de la AGE (art. 54.1):**
- Los del art. 3 (eficacia, eficiencia, jerarquia, descentralizacion, coordinacion, cooperacion, etc.)
- **Descentralizacion funcional**
- **Desconcentracion funcional y territorial**

**Clave:** "Eficacia en la asignacion de recursos" es de la LO 2/2012 (presupuestos), no de la Ley 40/2015 (organizacion). La trampa mezcla principios de leyes diferentes.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "641e8d5c-d8f5-4de6-b575-44222e7634ef");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 40/2015 principios AGE (" + exp3.length + " chars)");
})();
