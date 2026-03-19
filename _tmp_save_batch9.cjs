require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word comando Cuenta
  const exp1 = `**Comando "Cuenta" en Word 365 (Archivo > Cuenta):**

La pantalla de **Cuenta** muestra informacion sobre la licencia de Office y la cuenta de Microsoft. Tambien permite personalizar el entorno visual.

**Por que A es correcta:**
Desde Archivo > Cuenta, en la seccion "Opciones de personalizacion de Office", se puede cambiar el **tema visual** de Office entre:
- Blanco
- Colorido
- Gris oscuro
- Negro (modo oscuro)

Este cambio afecta a **todas las aplicaciones de Office** (Word, Excel, PowerPoint, etc.).

**Por que las demas son incorrectas:**

- **B)** "Aplicar una nueva plantilla predeterminada". Las plantillas se gestionan desde **Archivo > Nuevo** o **Archivo > Opciones > Guardar** (para cambiar la plantilla Normal.dotm). No desde Cuenta.

- **C)** "Activar o desactivar las macros". La configuracion de macros se encuentra en **Archivo > Opciones > Centro de confianza > Configuracion del Centro de confianza > Configuracion de macros**. Nada que ver con Cuenta.

- **D)** "Cambiar el modo de compatibilidad". El modo de compatibilidad se gestiona desde **Archivo > Informacion > Convertir** (para actualizar formatos antiguos .doc a .docx). No se accede desde Cuenta.

**Que se encuentra en Archivo > Cuenta:**
- Informacion de usuario y cuenta Microsoft
- Tema visual de Office
- Fondo de Office
- Informacion del producto y actualizaciones
- Acerca de Word (version exacta)`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "356b4569-3ad9-4b93-a9cd-9990f4db3af4");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word Cuenta (" + exp1.length + " chars)");

  // #2 - Agenda 2030 ODS 2 meta productividad agricola
  const exp2 = `**ODS 2 de la Agenda 2030: Hambre Cero**

> **Meta 2.3:** "De aqui a 2030, **duplicar la productividad agricola** y los ingresos de los productores de alimentos en pequena escala, en particular las mujeres, los pueblos indigenas, los agricultores familiares, los ganaderos y los pescadores."

**Por que C es correcta:**
La meta descrita (duplicar productividad agricola, productores en pequena escala, mujeres, pueblos indigenas, agricultores familiares, pescadores) pertenece al **ODS 2: Hambre Cero**, concretamente a la meta 2.3. El ODS 2 se centra en poner fin al hambre, lograr la seguridad alimentaria y promover la agricultura sostenible.

**Por que las demas son incorrectas:**

- **A)** "ODS 12: Produccion y consumo responsables". El ODS 12 trata sobre patrones de consumo y produccion sostenibles (reducir desperdicios, reciclaje, etc.), no sobre productividad agricola ni pequenos productores.

- **B)** "ODS 1: Fin de la pobreza". El ODS 1 se centra en erradicar la pobreza en todas sus formas. Aunque relacionado, la meta de duplicar productividad agricola es especifica del ODS 2 (Hambre).

- **D)** "ODS 11: Ciudades y comunidades sostenibles". El ODS 11 trata sobre urbanismo sostenible, transporte, patrimonio cultural y espacios verdes urbanos. No tiene relacion con la productividad agricola.

**Metas principales del ODS 2 (Hambre Cero):**
- 2.1: Fin del hambre, acceso a alimentacion sana
- 2.2: Fin de la malnutricion
- **2.3: Duplicar productividad agricola** (esta es la de la pregunta)
- 2.4: Practicas agricolas sostenibles y resilientes
- 2.5: Diversidad genetica de semillas y plantas`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "274e14a8-2a5e-40c2-945a-5a59368759da");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Agenda 2030 ODS 2 (" + exp2.length + " chars)");
})();
