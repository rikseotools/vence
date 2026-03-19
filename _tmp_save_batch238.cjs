require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 19/2013 art.26 principios buen gobierno régimen sancionador
  const exp1 = `**Articulo 26.3 de la Ley 19/2013 - Principios de buen gobierno:**

> "Los principios establecidos en los apartados anteriores **informaran la interpretacion y aplicacion del regimen sancionador** regulado en este Titulo."

**Por que A es correcta (informan el regimen sancionador del Titulo II):**
El art. 26.3 de la Ley 19/2013 establece que los principios de buen gobierno (generales y de actuacion) sirven como **guia hermeneutica** para interpretar y aplicar el regimen sancionador del Titulo II de la ley. Es decir, las sanciones previstas en la ley deben entenderse a la luz de estos principios.

**Por que las demas son incorrectas:**

- **B)** "Informaran y seran de aplicacion a las relaciones con las **corporaciones locales**." Falso: el art. 26 no vincula los principios de buen gobierno especificamente a las corporaciones locales. El ambito de aplicacion del Titulo II (art. 25) se refiere a miembros del Gobierno, altos cargos de la AGE y CCAA, no a corporaciones locales de forma especifica.

- **C)** "Estaran supeditados a la aprobacion por la **Direccion General de Seguridad Juridica y Fe Publica**." Falso: los principios de buen gobierno no dependen de ningun organo registral. La Direccion General de Seguridad Juridica y Fe Publica gestiona registros (Registro Civil, Propiedad, Mercantil), no tiene competencia sobre principios de buen gobierno. Es una opcion inventada.

- **D)** "No seran de aplicacion a las actuaciones derivadas del **estado de sitio**." Falso: el art. 26 no establece ninguna excepcion relacionada con el estado de sitio. Los principios de buen gobierno se aplican al regimen sancionador del Titulo II sin excepciones de este tipo.

**Principios de buen gobierno (art. 26 Ley 19/2013):**

| Tipo | Contenido |
|------|-----------|
| Principios generales (26.2.a) | Transparencia, eficacia, economia, eficiencia |
| Principios de actuacion (26.2.b) | Imparcialidad, diligencia, responsabilidad |
| **Funcion (26.3)** | **Informan la interpretacion del regimen sancionador** |

**Clave:** Los principios del art. 26 informan la interpretacion y aplicacion del regimen sancionador del Titulo II. No tienen relacion con corporaciones locales, registros ni estados excepcionales.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "3900dafb-406b-44a1-b9c2-20d6ec5dd27e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 19/2013 art.26 buen gobierno (" + exp1.length + " chars)");

  // #2 - Informática SaaS Software como Servicio
  const exp2 = `**Computacion en la nube - Modelos de servicio:**

> Los tres modelos principales de servicio en la nube son: **IaaS** (Infraestructura como Servicio), **PaaS** (Plataforma como Servicio) y **SaaS** (Software como Servicio). En el modelo SaaS, el proveedor ofrece **software accesible a traves de Internet**, sin necesidad de instalacion local.

**Por que C es correcta (SaaS = Software as a Service):**
**SaaS** significa "Software as a Service" (Software como Servicio). Es el modelo en el que el proveedor aloja y gestiona la aplicacion completa, y el usuario accede a ella a traves del navegador web. Ejemplos: Google Workspace (Gmail, Docs), Microsoft 365 (Word, Excel online), Salesforce, Dropbox.

**Por que las demas son incorrectas (no son modelos de servicio en la nube):**

- **A)** "**SAI**." Falso: SAI significa "Sistema de Alimentacion Ininterrumpida" (en ingles, UPS). Es un dispositivo de **hardware** que proporciona energia electrica de respaldo cuando falla el suministro. No tiene relacion con modelos de servicio en la nube.

- **B)** "**ISO**." Falso: ISO son las siglas de la "International Organization for Standardization" (Organizacion Internacional de Normalizacion). Es un organismo que desarrolla estandares internacionales (ISO 9001, ISO 27001, etc.). No es un modelo de servicio en la nube.

- **D)** "**SSD**." Falso: SSD significa "Solid State Drive" (Unidad de Estado Solido). Es un dispositivo de **almacenamiento** que usa memoria flash, mas rapido que los discos duros tradicionales (HDD). No es un modelo de servicio en la nube.

**Los 3 modelos de servicio en la nube:**

| Modelo | Significado | Que ofrece | Ejemplo |
|--------|------------|------------|---------|
| **IaaS** | Infrastructure as a Service | Servidores, redes, almacenamiento | AWS EC2, Azure VM |
| **PaaS** | Platform as a Service | Entorno de desarrollo | Google App Engine, Heroku |
| **SaaS** | **Software as a Service** | **Aplicacion completa** | **Google Workspace, Microsoft 365** |

**Clave:** SaaS = Software como Servicio (acceso a software via Internet). SAI = alimentacion electrica, ISO = normalizacion, SSD = almacenamiento solido.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "94145407-8c24-4891-902b-78302f148c17");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Informatica SaaS nube (" + exp2.length + " chars)");

  // #3 - Ley 40/2015 art.58.4 Direcciones Generales en Subdirecciones
  const exp3 = `**Articulo 58.4 de la Ley 40/2015 - Organizacion interna de los Ministerios:**

> "Las Direcciones Generales se organizan en **Subdirecciones Generales** para la **distribucion de las competencias** encomendadas a aquellas, la **realizacion de las actividades** que les son propias y la **asignacion de objetivos y responsabilidades**."

**Por que A es correcta (Subdirecciones Generales, tres finalidades):**
El art. 58.4 Ley 40/2015 establece que las Direcciones Generales se organizan **solo en Subdirecciones Generales** (no en otros organos). Las tres finalidades son: (1) distribucion de competencias, (2) realizacion de actividades propias, y (3) asignacion de objetivos y responsabilidades. La opcion A reproduce fielmente estos tres elementos.

**Por que las demas son incorrectas:**

- **B)** "En Subdirecciones Generales para la gestion de los **servicios comunes** previstos en el Titulo I." Falso: la gestion de servicios comunes corresponde a la **Subsecretaria y Secretaria General Tecnica** (art. 58.2), no a las Subdirecciones Generales adscritas a Direcciones Generales. Las DG se organizan en Subdirecciones para distribuir competencias, no para gestionar servicios comunes.

- **C)** "En Subdirecciones Generales y **Secretarias Generales Tecnicas**." Falso: las DG se organizan **solo en Subdirecciones Generales**, no tambien en Secretarias Generales Tecnicas. La SGT es un organo directivo propio que depende de la Subsecretaria (art. 58.2), no es una subdivision de las DG.

- **D)** "En Subdirecciones Generales y **Secretarias Generales Tecnicas** para la distribucion de competencias..." Falso: mismo error que C (anade SGT como parte de la organizacion de las DG). Aunque las tres finalidades citadas son correctas, la inclusion de las SGT es erronea.

**Organizacion interna de los Ministerios (art. 58 Ley 40/2015):**

| Nivel | Organo | Se organiza en |
|-------|--------|---------------|
| Superior | Secretaria de Estado | Direcciones Generales |
| Directivo | Subsecretaria | Secretaria General Tecnica |
| Directivo | **Direccion General** | **Subdirecciones Generales** |
| Directivo | Subdireccion General | Unidades administrativas |

**Clave:** Las Direcciones Generales se organizan SOLO en Subdirecciones Generales (art. 58.4). No incluyen Secretarias Generales Tecnicas, que dependen de la Subsecretaria.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "4e198c2c-f3d4-44e8-b936-d52e8aba9e41");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 40/2015 art.58 DG Subdirecciones (" + exp3.length + " chars)");
})();
