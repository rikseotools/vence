require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.17.4 prision provisional - por ley
  const exp1 = `**Articulo 17.4 de la Constitucion Espanola:**

> "Por **ley** se determinara el plazo maximo de duracion de la **prision provisional**."

**Por que B es correcta (se determinara por Ley):**
La CE no fija un plazo concreto para la prision provisional, sino que lo remite a la **ley** (reserva de ley). Es el legislador ordinario quien debe establecer ese plazo maximo. Actualmente, la LECrim fija plazos variables segun la pena (1-2 anos, prorrogables).

**Por que las demas son incorrectas:**

- **A)** "1 ano". Falso: la CE no establece ningun plazo concreto (ni 1 ano ni otro). El plazo concreto lo fija la **ley** (actualmente la LECrim), pero la pregunta es sobre lo que dice el art. 17 CE, y este solo dice "por ley se determinara".

- **C)** "72 horas". Falso: las **72 horas** son el plazo maximo de la **detencion preventiva** (art. 17.2 CE), no de la prision provisional. No confundir:
  - **Detencion**: hasta 72h, policial/gubernativa
  - **Prision provisional**: duracion fijada por ley, judicial

- **D)** "Se determinara por Reglamento". Falso: la CE dice "por **ley**", no "por reglamento". La prision provisional afecta al derecho fundamental a la libertad (art. 17 CE, Seccion 1a), por lo que exige regulacion por **ley** (e incluso ley organica, por ser derecho fundamental del art. 81 CE).

**Detencion vs prision provisional (art. 17 CE):**

| Concepto | Plazo maximo | Quien lo establece |
|----------|-------------|-------------------|
| Detencion preventiva | **72 horas** | La propia CE (art. 17.2) |
| Prision provisional | Lo fija la **ley** | Reserva de ley (art. 17.4) |

**Clave:** Prision provisional = plazo fijado por **ley** (no por la CE ni por reglamento). 72h = detencion, no prision provisional.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "04f272c8-b944-453a-b441-117a3b564470");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.17.4 prision provisional (" + exp1.length + " chars)");

  // #2 - RD 203/2021 art.32.4 certificado representante
  const exp2 = `**Articulo 32.4 del RD 203/2021:**

> "En el caso de actuaciones en nombre de persona juridica, la capacidad de representacion podra acreditarse tambien mediante certificado electronico cualificado de representante, entendiendose en tal caso que el poder de representacion abarca **cualquier actuacion** ante **cualquier Administracion Publica**."

**Por que C es correcta (cualquier actuacion ante cualquier Administracion):**
El certificado electronico cualificado de representante otorga una representacion **universal**: sirve para **cualquier tipo de actuacion** y ante **cualquier Administracion**. No tiene limitaciones de tramite ni de ambito administrativo.

**Por que las demas son incorrectas (combinan restricciones inexistentes):**

| Opcion | Tipo de actuacion | Ante que Administracion | Error |
|--------|------------------|------------------------|-------|
| A | Cualquier | La que se presenta | Restringe la Administracion |
| B | Determinados tramites | Cualquier | Restringe la actuacion |
| **C** | **Cualquier** | **Cualquier** | **Correcta** |
| D | Determinados tramites | La que se presenta | Restringe ambas |

- **A)** Restringe el ambito a "la Administracion que se presenta", pero el certificado vale ante **cualquier** Administracion.
- **B)** Restringe a "determinados tramites", pero el certificado cubre **cualquier** actuacion.
- **D)** Combina ambas restricciones: ni limita tramites ni Administraciones.

**Clave:** Certificado cualificado de representante de persona juridica = representacion **total** (cualquier actuacion + cualquier Administracion). Sin restricciones.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "14c1c39d-5f06-450c-9cab-3263d92f8208");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RD 203/2021 certificado representante (" + exp2.length + " chars)");

  // #3 - RD 203/2021 art.6.1 informe favorable portal internet
  const exp3 = `**Articulo 6.1 del RD 203/2021** (Creacion de portales de internet):

> "La propuesta de creacion del nuevo portal se debera justificar en terminos de **eficiencia** en la asignacion y utilizacion de los recursos publicos e **interes prioritario** para la implantacion de una politica publica o la aplicacion de la normativa de la **Union Europea o nacional** y a tal efecto el organo promotor remitira una **memoria justificativa y economica**."

**Por que D es correcta:**
La opcion D reproduce los dos requisitos del art. 6.1:
1. Justificacion en terminos de **eficiencia** e **interes prioritario** (politica publica o normativa UE/nacional)
2. **Memoria justificativa y economica** remitida por el organo promotor

**Por que las demas son incorrectas:**

- **A)** "Previa motivacion tecnica por parte de la Comision Ministerial + marco legal europeo". Falso: la Comision Ministerial emite el **informe favorable**, pero no realiza una "motivacion tecnica previa". Ademas, no es solo "marco legal europeo" sino "normativa de la Union Europea **o nacional**".

- **B)** "Acreditacion de requisitos tecnicos y economicos + normativa europea en terminos de eficiencia". Falso: no se exige "acreditacion de requisitos tecnicos" como tal. Los terminos del articulo son "eficiencia en la asignacion de recursos publicos" e "interes prioritario", no "requisitos tecnicos y economicos".

- **C)** "Defensa de al menos tres miembros de la Comision Ministerial". Falso: inventado. No se requiere la "defensa de tres miembros" ante nadie. La Comision emite un informe favorable, no una "defensa" de miembros individuales.

**Clave:** Crear un portal = justificacion de **eficiencia** + **interes prioritario** (politica publica o normativa UE/nacional) + **memoria justificativa y economica**.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "b08b889b-f861-4e9d-ad14-66a202d4c62d");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RD 203/2021 portal informe (" + exp3.length + " chars)");
})();
