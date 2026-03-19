require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 1/2004 art.19 servicios asistencia social CCAA y CCLL
  const exp1 = `**Articulo 19.1 de la LO 1/2004** (Derecho a la asistencia social integral):

> "Las mujeres victimas de violencia de genero tienen derecho a servicios sociales de atencion, de emergencia, de apoyo y acogida y de recuperacion integral. La organizacion de estos servicios por parte de las **Comunidades Autonomas y las Corporaciones Locales** respondera a los principios de atencion permanente, actuacion urgente, especializacion de prestaciones y multidisciplinariedad profesional."

**Por que A es correcta:**
El art. 19.1 LO 1/2004 atribuye la organizacion de los servicios de asistencia social integral a las **CCAA y las Corporaciones Locales** (Ayuntamientos, Diputaciones). Son las administraciones mas cercanas a las victimas y las que gestionan los servicios sociales de forma directa.

**Por que las demas son incorrectas:**

- **B)** "Ministerio de Sanidad, Servicios Sociales e Igualdad". Falso: el Ministerio puede coordinar politicas a nivel estatal, pero la **organizacion concreta** de los servicios sociales es competencia de las CCAA y CCLL, no del Estado central.

- **C)** "El Gobierno del Estado". Falso: por la misma razon. Los servicios sociales son una competencia **autonomica**, no del Gobierno central.

- **D)** "La Delegacion Especial del Gobierno contra la Violencia sobre la Mujer". Falso: esta Delegacion tiene funciones de coordinacion, propuesta y seguimiento a nivel estatal, pero no de **organizacion directa** de servicios de asistencia social.

**Clave:** Servicios sociales de asistencia integral = competencia de **CCAA + Corporaciones Locales** (no del Estado ni de sus delegaciones).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a8ffedea-879c-4325-86a2-9aa47bdcb2a9");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 1/2004 asistencia social (" + exp1.length + " chars)");

  // #2 - LOPJ art.65 Fiscalia Europea Audiencia Nacional
  const exp2 = `**Articulo 65.1.f) de la LO 6/1985 (LOPJ):**

> "La Sala de lo Penal de la **Audiencia Nacional** conocera: [...] f) Delitos atribuidos a la **Fiscalia Europea** en los articulos 22 y 25 del Reglamento (UE) 2017/1939 [...], cuando aquella hubiera decidido ejercer su competencia."

**Por que A es correcta:**
Los delitos de la Fiscalia Europea, cuando esta decide ejercer su competencia, corresponden a la **Sala de lo Penal de la Audiencia Nacional** (art. 65.1.f LOPJ). Esto se debe a que son delitos con dimension supranacional que afectan a los intereses financieros de la UE, lo que justifica la competencia de la Audiencia Nacional como tribunal especializado.

**Por que las demas son incorrectas:**

- **B)** "Sala de lo Penal del Tribunal Supremo". Falso: el TS conoce en unica instancia de los delitos cometidos por personas aforadas (art. 57 LOPJ), no de los delitos de la Fiscalia Europea.

- **C)** "Salas de lo Penal de los TSJ". Falso: los TSJ conocen de los delitos cometidos por personas aforadas en el ambito de la CCAA. No tienen competencia sobre delitos de la Fiscalia Europea.

- **D)** "Salas del Tribunal Constitucional". Falso: el TC no es un organo jurisdiccional penal. No enjuicia delitos. Sus funciones son de control de constitucionalidad y proteccion de derechos fundamentales (recurso de amparo).

**Competencias penales de la Audiencia Nacional (art. 65 LOPJ):**
- Delitos contra la Corona y altos organismos
- Falsificacion de moneda (criminalidad organizada)
- Trafico de drogas (criminalidad organizada, varias Audiencias)
- Delitos cometidos fuera del territorio nacional
- **Delitos de la Fiscalia Europea**
- Contrabando de material de defensa`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "423a9989-8135-42f2-b46a-ad443773470c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOPJ Fiscalia Europea AN (" + exp2.length + " chars)");
})();
