require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LBRL art.43 areas metropolitanas leyes CCAA
  const exp1 = `**Articulo 43 de la Ley 7/1985 (LBRL):**

> "1. Las **Comunidades Autonomas**, previa audiencia de la Administracion del Estado y de los Ayuntamientos y Diputaciones afectados, podran crear, modificar y suprimir, mediante **Ley**, areas metropolitanas [...]
> 3. La legislacion de la Comunidad Autonoma determinara [...] el **regimen economico y de funcionamiento**, que garantizara la participacion de todos los Municipios en la toma de decisiones y una justa distribucion de las cargas entre ellos [...]"

**Por que C es correcta (leyes de la Comunidad Autonoma):**
Las areas metropolitanas son competencia de las **CCAA**. Son ellas las que, mediante ley autonomica, crean, regulan y determinan el regimen economico y de funcionamiento de estas entidades locales. Esto tiene logica porque las areas metropolitanas afectan al territorio de una Comunidad Autonoma concreta.

**Por que las demas son incorrectas:**

- **A)** "Ley Estatal". Falso: el Estado no crea ni regula areas metropolitanas. Solo tiene "audiencia" (se le consulta), pero la competencia es autonomica. La LBRL solo establece el marco basico.

- **B)** "Ley Organica". Falso: no se requiere ley organica para crear areas metropolitanas. Las leyes organicas se reservan para materias del art. 81 CE (derechos fundamentales, Estatutos de Autonomia, regimen electoral general, etc.), no para la organizacion territorial local.

- **D)** "Convenio". Falso: un convenio es un acuerdo entre partes, no un instrumento para crear entidades locales ni regular su regimen. Las areas metropolitanas requieren una **ley** (no un convenio).

**Clave:** Areas metropolitanas = competencia de las **CCAA** mediante **ley autonomica**. El Estado solo tiene audiencia (consulta), no decision.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "cb59e53b-e1c7-4849-990c-b34979d38a9c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LBRL areas metropolitanas (" + exp1.length + " chars)");

  // #2 - Orden HFP/134/2018 art.5 suplentes Subdirector General
  const exp2 = `**Articulo 5.2 de la Orden HFP/134/2018** (Regimen de sustituciones del Foro de Gobierno Abierto):

> "Los vocales designados en representacion de los departamentos ministeriales podran ser sustituidos, en caso de vacante, ausencia o enfermedad o cualquier otra causa justificada, por **suplentes con rango de Subdirector General** pertenecientes a los mismos ministerios que los vocales suplidos."

**Por que B es correcta (Subdirector General):**
Los vocales ministeriales del Foro de Gobierno Abierto son sustituidos por funcionarios con rango de **Subdirector General** del mismo ministerio. Es un rango inferior al del vocal titular (que tiene rango de Director General), lo que es logico: el suplente es un subordinado del titular.

**Por que las demas son incorrectas:**

- **A)** "Vicepresidente". Falso: el Vicepresidente (Primero) es quien sustituye al **Presidente** del Foro (art. 5.1), no a los vocales ministeriales. No confundir la sustitucion del Presidente con la de los vocales.

- **C)** "Director General". Falso: los vocales titulares ya tienen rango de Director General. Si los suplentes tambien fueran Directores Generales, no habria diferencia jerarquica entre titular y suplente. La norma establece un rango inferior: Subdirector General.

- **D)** "Secretario". Falso: no se menciona el cargo de Secretario como rango de los suplentes. Ademas, "Secretario" es ambiguo (podria ser Secretario de Estado, Secretario General...) y no corresponde al art. 5.2.

**Sustituciones en el Foro de Gobierno Abierto (art. 5):**

| Quien se sustituye | Quien sustituye |
|--------------------|-----------------|
| Presidente | **Vicepresidente Primero** |
| Vocales ministeriales | Suplentes con rango de **Subdirector General** |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "c0a67720-8785-43f4-b170-ae3091a79fa0");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Orden HFP suplentes (" + exp2.length + " chars)");

  // #3 - Ley 19/2013 art.24.5 comunicacion al Defensor del Pueblo
  const exp3 = `**Articulo 24.5 de la Ley 19/2013:**

> "El Presidente del Consejo de Transparencia y Buen Gobierno comunicara al **Defensor del Pueblo** las resoluciones que dicte en aplicacion de este articulo."

**Por que A es correcta (Defensor del Pueblo):**
Las resoluciones del Presidente del CTBG sobre reclamaciones de acceso a informacion publica (art. 24) se comunican al **Defensor del Pueblo**. Esto tiene logica: el Defensor del Pueblo es el alto comisionado de las Cortes para la defensa de los derechos fundamentales (art. 54 CE), y el derecho de acceso a la informacion publica esta vinculado a la transparencia y al control democratico.

**Por que las demas son incorrectas:**

- **B)** "Presidente del Gobierno". Falso: el CTBG es un organo **independiente** adscrito al Ministerio correspondiente. Comunicar sus resoluciones al Presidente del Gobierno comprometeria esa independencia. Ademas, el Gobierno puede ser sujeto obligado por la Ley de Transparencia.

- **C)** "Secretario de Estado correspondiente". Falso: aunque el CTBG esta adscrito a un Ministerio, sus resoluciones no se comunican a ningun Secretario de Estado. La comunicacion va al Defensor del Pueblo como garante de derechos.

- **D)** "Ministro de la Presidencia". Falso: por la misma razon. La comunicacion no es jerarquica (al ministerio de adscripcion) sino funcional (al organo garante de derechos).

**Clave:** Resoluciones del CTBG sobre acceso a informacion (art. 24) = se comunican al **Defensor del Pueblo**. El nexo es la garantia de derechos, no la dependencia organica.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "28f36869-09f8-4ecc-9c11-b29453cd7ccf");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 19/2013 comunicacion DP (" + exp3.length + " chars)");
})();
