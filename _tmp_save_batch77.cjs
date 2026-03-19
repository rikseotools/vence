require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 203/2021 portal internet - canal de asistencia
  const exp1 = `**Articulo 4 del RD 203/2021** (Canales de asistencia para el acceso a servicios electronicos):

> "Las Administraciones Publicas prestaran la asistencia necesaria [...] a traves de alguno o algunos de los siguientes canales:
> a) Presencial [...]
> b) **Portales de internet** y sedes electronicas.
> c) Redes sociales.
> d) Telefonico.
> e) Correo electronico."

**Por que A es correcta (canal de asistencia):**
El art. 4 del RD 203/2021 clasifica los portales de internet como uno de los **canales de asistencia** para facilitar el acceso de los ciudadanos a los servicios electronicos. Por tanto, es correcto afirmar que un portal de internet "es un canal de asistencia".

**Por que las demas son incorrectas:**

- **B)** "La titularidad corresponde a una Administracion Publica, organismo publico o entidad de derecho publico **o privado**". Falso: el art. 5.1 del mismo RD define el portal como aquel cuya titularidad corresponda a "una Administracion Publica, organismo publico o entidad de derecho **publico**". No incluye entidades de derecho **privado**. La trampa es anadir "o privado" al final.

- **C)** "Por **orden del Ministerio** para la Transformacion Digital se podran determinar los contenidos minimos...". Falso: el art. 5.2 dice que "**Cada Administracion** podra determinar los contenidos y canales minimos". No es el Ministerio quien lo determina para todas las Administraciones, sino cada una para si misma.

- **D)** "Permite el acceso a la informacion publicada **pero no a la sede electronica**". Falso: el art. 5.1 dice que el portal "permite el acceso a traves de internet a la informacion **y, en su caso, a la sede electronica o sede electronica asociada** correspondiente". SI da acceso a la sede.

**Clave:** Portal de internet = **canal de asistencia** (art. 4). Titularidad = derecho **publico** (no privado). SI da acceso a la sede electronica.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "383ed534-864b-46de-ab15-8f9ea8447466");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 203/2021 portal canal (" + exp1.length + " chars)");

  // #2 - RD 203/2021 Portales de Internet Publicos
  const exp2 = `**Portales de Internet Publicos** (PAGe - Punto de Acceso General electronico):

A traves de los **"Portales de Internet Publicos"** se da acceso a los portales y webs de los organismos publicos nacionales, europeos e internacionales. Estan estructurados en categorias:
- Portales de internet publicos (nacionales)
- Webs publicas europeas
- Webs de organismos internacionales

**Por que D es correcta:**
Los "Portales de Internet Publicos" son la seccion del PAGe que centraliza el acceso a webs de organismos publicos a todos los niveles (nacional, europeo e internacional). Es un directorio organizado que facilita la navegacion.

**Por que las demas son incorrectas:**

- **A)** "Red de telecomunicaciones de entidades de Derecho Publico". Falso: la "red de telecomunicaciones" es la infraestructura fisica (cables, servidores, etc.), no un mecanismo de acceso a portales web. El acceso se hace a traves de internet, no de una red privada especifica.

- **B)** "Sedes electronicas de la AGE". Falso: las sedes electronicas son plataformas para **tramites y procedimientos** administrativos, no para dar acceso a portales de otros organismos europeos o internacionales. Una sede electronica tiene validez juridica para notificaciones, registros, etc.

- **C)** "Perfiles oficiales de redes sociales". Falso: las redes sociales son un **canal de comunicacion e interaccion** (art. 4.c del RD 203/2021), pero no son el mecanismo para acceder a los portales y webs oficiales de organismos publicos. Son un complemento, no un punto de acceso.

**Clave:** Acceso a portales/webs de organismos nacionales, europeos e internacionales = **Portales de Internet Publicos** (dentro del PAGe). No confundir con sedes electronicas (tramites) ni redes sociales (comunicacion).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "27e7299c-d9e6-4955-852b-cb26968b68bd");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Portales Internet Publicos (" + exp2.length + " chars)");
})();
