require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 203/2021 art.24.4 registros personal
  const exp1 = `**Articulo 24.4 del RD 203/2021** (Registros de personal y datos electronicos):

> "Los registros de personal de la AGE podran recoger los datos para la **identificacion electronica** de los empleados publicos, asi como su **cesion a sistemas de identificacion de personal** basados en **repositorios de identidades** de empleados publicos."

**Por que A es correcta:**
La opcion A reproduce fielmente el contenido del art. 24.4: los registros de personal pueden recoger datos para cederlos a sistemas de identificacion basados en repositorios de identidades de empleados publicos. Esto permite centralizar la gestion de identidades electronicas del personal.

**Por que las demas son incorrectas:**

- **B)** Mezcla conceptos del Esquema Nacional de Seguridad y convenios entre Administraciones (mas propios de los arts. 55-56 sobre interoperabilidad). El art. 24.4 trata de registros de personal, no de convenios ni de entornos cerrados de comunicaciones.

- **C)** Habla de "autorizacion de relacion de emisores y receptores" y "naturaleza de los datos a intercambiar". Estos conceptos pertenecen al ambito de las transmisiones de datos entre Administraciones (art. 155 Ley 40/2015), no a los registros de personal del art. 24.4.

- **D)** Habla de "tramites e informes con firma electronica reconocida o cualificada". Esto se relaciona con el art. 24.2 (firma del personal) y art. 24.3 (sello de organo), pero no con el contenido del art. 24.4 sobre registros de personal.

**Clave:** El art. 24.4 permite que los registros de personal sirvan como fuente de datos para sistemas de identificacion electronica del personal publico.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f28abbf0-c78a-4e3d-9cc8-5d2677f522f8");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 203/2021 art.24.4 registros (" + exp1.length + " chars)");

  // #2 - CE art.97 Gobierno funcion ejecutiva
  const exp2 = `**Articulo 97 de la Constitucion Espanola:**

> "El Gobierno dirige la politica interior y exterior, la Administracion civil y militar y la defensa del Estado. **Ejerce la funcion ejecutiva y la potestad reglamentaria** de acuerdo con la Constitucion y las leyes."

**Por que C es correcta:**
La opcion C reproduce literalmente la segunda frase del art. 97: el Gobierno ejerce la funcion ejecutiva y la potestad reglamentaria. Son dos funciones clave del Gobierno como organo constitucional.

**Por que las demas son incorrectas:**

- **A)** "Responsabilidad criminal del Presidente ante el Tribunal Constitucional". Falso: segun el **art. 102.1 CE**, la responsabilidad criminal del Presidente se exige ante la **Sala de lo Penal del Tribunal Supremo**. El Tribunal Constitucional no juzga causas penales; es un organo de control de constitucionalidad.

- **B)** "Nombrado por el Rey, a propuesta del Consejo de Ministros". Falso: segun el **art. 99 CE**, el Presidente es nombrado por el Rey tras obtener la **confianza del Congreso de los Diputados**. El Consejo de Ministros no propone al Presidente (eso no tendria sentido, porque el Consejo lo preside el propio Presidente).

- **D)** "Compuesto por Presidente, Vicepresidentes, Ministros y Secretarios de Estado". Falso: segun el **art. 98.1 CE**, el Gobierno se compone del Presidente, Vicepresidentes **"en su caso"**, y Ministros. Los **Secretarios de Estado no forman parte del Gobierno** segun la CE (aunque son altos cargos regulados por la Ley 50/1997).

**Funciones del Gobierno (art. 97):** Direccion politica + Administracion + Defensa + Funcion ejecutiva + Potestad reglamentaria.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "0039f53b-334e-4b77-9420-7a68af7e790e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.97 Gobierno funcion ejecutiva (" + exp2.length + " chars)");

  // #3 - CE art.98 Presidente coordina
  const exp3 = `**Articulo 98.2 de la Constitucion Espanola:**

> "El Presidente **dirige la accion del Gobierno** y **coordina las funciones** de los demas miembros del mismo, sin perjuicio de la competencia y responsabilidad directa de estos en su gestion."

**Por que C es correcta:**
La opcion C reproduce literalmente el art. 98.2: el Presidente coordina las funciones de los demas miembros del Gobierno. Las dos funciones del Presidente son: dirigir y coordinar.

**Por que las demas son incorrectas:**

- **A)** "Sanciona y promulga las leyes [...] en nombre del Rey". Falso: sancionar y promulgar leyes es competencia exclusiva del **Rey** (art. 62.a CE). El Presidente no sanciona leyes; las refrendan (art. 64 CE), que es cosa distinta.

- **B)** "Nombra y separa a los demas miembros del Gobierno". Falso: quien nombra y separa formalmente es el **Rey** (art. 100 CE: "Los demas miembros del Gobierno seran nombrados y separados por el Rey, a propuesta de su Presidente"). El Presidente **propone**, pero el acto formal de nombramiento es del Rey.

- **D)** "Convoca a referendum". Falso: la convocatoria de referendum es competencia del **Rey** (art. 62.c CE: "Convocar a referendum en los casos previstos en la Constitucion"). El Presidente propone el referendum, pero la convocatoria formal es regia.

**Patron comun en estas opciones:** Las opciones A, B y D atribuyen al Presidente funciones que en realidad corresponden al **Rey** (arts. 62 y 100 CE). El Presidente propone o refrenda, pero el acto formal es del Rey.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "a07b1f3e-7b85-47b9-b76a-2b8a9a3388b1");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.98 Presidente coordina (" + exp3.length + " chars)");
})();
