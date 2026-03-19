require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 50/1997 art.26 justificacion prescindir consulta publica
  const exp1 = `**Articulo 26.2 de la Ley 50/1997** (Consulta publica en elaboracion de normas):

> "Podra prescindirse del tramite de consulta publica [...] cuando concurran razones graves de interes publico que lo justifiquen [...] La concurrencia de alguna o varias de estas razones, debidamente motivadas, se justificaran en la **Memoria del Analisis de Impacto Normativo**."

**Por que B es correcta (Memoria del Analisis de Impacto Normativo):**
Cuando se prescinde de la consulta publica, las razones deben justificarse en la **MAIN** (Memoria del Analisis de Impacto Normativo). Este documento acompana a todo proyecto normativo y recoge el analisis de impactos (economico, presupuestario, de genero, territorial, etc.) y las justificaciones procedimentales.

**Por que las demas son incorrectas:**

- **A)** "Portal web del departamento competente". Falso: el portal web es donde se **realiza** la consulta publica (art. 26.2: "a traves del portal web del departamento competente"), no donde se justifica prescindir de ella. La justificacion va en la MAIN, no en el portal web.

- **C)** "En el preambulo de la futura Ley o reglamento". Falso: el preambulo explica los motivos y objetivos de la norma, pero no es el documento donde se justifican las decisiones procedimentales como prescindir de la consulta publica. Esa justificacion va en la MAIN, que es un documento interno del procedimiento de elaboracion.

- **D)** "En la Ley de presupuestos generales del Estado". Falso: la Ley de Presupuestos no tiene ninguna relacion con el procedimiento de elaboracion de normas. Es un instrumento financiero, no un vehiculo de justificacion procedimental.

**Clave:** Justificacion de prescindir de la consulta publica = **MAIN** (Memoria del Analisis de Impacto Normativo). El portal web es donde se hace la consulta, no donde se justifica omitirla.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "494e586b-fdde-40ac-a596-d5a8556e047b");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 50/1997 MAIN consulta (" + exp1.length + " chars)");

  // #2 - Ley 40/2015 art.61 competencias Ministros
  const exp2 = `**Articulo 61 de la Ley 40/2015 (LRJSP)** - Funciones de los Ministros:

Entre las funciones que el art. 61 atribuye a los Ministros esta:

> "Autorizar las comisiones de servicio con derecho a indemnizacion por cuantia exacta para **altos cargos** dependientes del Ministro."

**Por que C es correcta:**
Los Ministros autorizan las comisiones de servicio (viajes oficiales, desplazamientos) con indemnizacion por cuantia exacta para los altos cargos que dependen de ellos (Secretarios de Estado, Secretarios Generales, etc.).

**Por que las demas son incorrectas:**

- **A)** "Nombrar y cesar Subdirectores dependientes de la Subsecretaria". Falso: el nombramiento y cese de los Subdirectores Generales dependientes de la Subsecretaria corresponde al **Subsecretario** (art. 63), no al Ministro. El Ministro nombra y cesa al personal de libre designacion de su entorno directo.

- **B)** "Desempenar la jefatura superior de todo el personal del Departamento". Falso: esta funcion corresponde al **Subsecretario** (art. 63: "desempenar la jefatura superior de todo el personal del Departamento"). Es una de las funciones clasicas del Subsecretario, no del Ministro.

- **D)** "Nombrar y separar Subdirectores Generales de la Secretaria de Estado". Falso: el nombramiento de los Subdirectores Generales adscritos a una Secretaria de Estado corresponde al **Secretario de Estado** correspondiente (art. 62), no al Ministro directamente.

**Distribucion de competencias de personal:**

| Funcion | Organo |
|---------|--------|
| Comisiones de servicio de altos cargos | **Ministro** |
| Jefatura superior del personal | **Subsecretario** |
| Nombrar Subdirectores de Subsecretaria | **Subsecretario** |
| Nombrar Subdirectores de Secretaria de Estado | **Secretario de Estado** |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "045f0f6a-0870-4f48-b54d-a48dd7f9a7b3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 40/2015 Ministros (" + exp2.length + " chars)");

  // #3 - RD 203/2021 DEH - senale incorrecta
  const exp3 = `**Direccion Electronica Habilitada unica (DEHu):**

**Por que A es la incorrecta (y por tanto la respuesta):**
La opcion A dice: "Este servicio esta unicamente habilitado para **personas fisicas**."

Esto es **falso**: la DEHu esta habilitada tanto para **personas fisicas como juridicas**. Cualquier persona (fisica o juridica) puede disponer de una direccion electronica para recibir notificaciones administrativas por via telematica. De hecho, las personas juridicas estan **obligadas** a relacionarse electronicamente con la Administracion (art. 14.2 Ley 39/2015), por lo que la DEHu es esencial para ellas.

**Por que las demas SI son correctas:**

- **B)** "Si la notificacion es obligatoria, se puede asignar de oficio una DEHu". **Correcto**: cuando la practica de la notificacion electronica es obligatoria (personas juridicas, empleados publicos, etc.), la Administracion puede asignar de oficio una direccion electronica habilitada sin necesidad de solicitud del interesado.

- **C)** "Este servicio tiene caracter gratuito". **Correcto**: la DEHu es un servicio publico gratuito. No se cobra al ciudadano ni a la empresa por disponer de ella.

- **D)** "Se necesita un Certificado Digital estandar X.509". **Correcto**: para acceder y utilizar la DEHu, el interesado debe disponer de un certificado digital X.509, que es el estandar utilizado para la identificacion electronica ante las Administraciones Publicas.

**Clave:** La DEHu NO es solo para personas fisicas. Es para **fisicas y juridicas**. Las personas juridicas estan obligadas a usarla.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "e79a6437-3165-4d2a-a2f1-d4599585924f");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - DEH senale incorrecta (" + exp3.length + " chars)");
})();
