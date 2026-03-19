require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word 365 personalizar métodos abreviados de teclado
  const exp1 = `**Microsoft Word 365 - Personalizacion de metodos abreviados de teclado:**

> En Word 365 es posible **personalizar los metodos abreviados** de teclado asignando atajos a comandos, macros, fuentes, estilos o simbolos. Se accede desde **Archivo > Opciones > Personalizar cinta de opciones > boton "Personalizar"** (en la parte inferior del panel).

**Por que A es correcta (Si, se pueden personalizar):**
Word 365 permite personalizar completamente los atajos de teclado como funcion integrada del programa. No se necesitan macros ni combinaciones especiales para acceder a esta funcionalidad. La ruta es: Archivo > Opciones > Personalizar cinta de opciones, y en la parte inferior se encuentra el boton "Personalizar" junto a "Metodos abreviados de teclado". Desde ahi se puede asignar cualquier combinacion de teclas a cualquier comando disponible.

**Por que las demas son incorrectas:**

- **B)** "**No**." Falso: Word 365 si permite personalizar los atajos de teclado. Es una funcionalidad que existe desde versiones antiguas de Word y sigue disponible en Word 365.

- **C)** "**Exclusivamente** utilizando macros." Falso: las macros son solo una de las muchas formas de automatizar tareas en Word, pero la personalizacion de atajos de teclado es una funcion **nativa** del programa que no requiere macros. Se accede directamente desde las opciones de configuracion.

- **D)** "Si, pero **exclusivamente** tecleando **Alt + Ctrl + Tab**." Falso: el atajo Alt + Ctrl + Tab no esta relacionado con la personalizacion de metodos abreviados. La personalizacion se realiza a traves del menu de opciones (Archivo > Opciones), no mediante un atajo de teclado especifico.

**Ruta para personalizar atajos en Word 365:**

| Paso | Accion |
|------|--------|
| 1 | Archivo > Opciones |
| 2 | Personalizar cinta de opciones |
| 3 | Boton "Personalizar" (parte inferior) |
| 4 | Seleccionar comando y asignar tecla |

**Clave:** Si se pueden personalizar, directamente desde Archivo > Opciones. No se necesitan macros ni atajos especiales.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e1a735b0-aee6-46de-9668-9a854059e287");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word 365 personalizar atajos (" + exp1.length + " chars)");

  // #2 - CE art.154 Delegado del Gobierno dirige Administración en CCAA
  const exp2 = `**Articulo 154 de la Constitucion Espanola - Delegado del Gobierno:**

> "Un **Delegado nombrado por el Gobierno** dirigira la **Administracion del Estado** en el territorio de la Comunidad Autonoma y la coordinara, cuando proceda, con la administracion propia de la Comunidad."

**Por que D es correcta (Delegado del Gobierno):**
El art. 154 CE establece que la Administracion del Estado en cada Comunidad Autonoma es dirigida por un **Delegado del Gobierno**. Este Delegado es nombrado por el Gobierno central (no por la CCAA) y tiene una doble funcion: (1) dirigir la Administracion estatal en ese territorio y (2) coordinarla con la administracion autonomica. Es un representante del Gobierno central en la CCAA.

**Por que las demas son incorrectas:**

- **A)** "El **Presidente de la Comunidad Autonoma**." Falso: el Presidente de la CCAA dirige el **Consejo de Gobierno autonomico** (art. 152.1 CE), es decir, la administracion propia de la Comunidad. No dirige la Administracion del Estado en la CCAA, que es competencia del Delegado del Gobierno.

- **B)** "El **Defensor del Pueblo**." Falso: el Defensor del Pueblo (art. 54 CE) es el alto comisionado de las Cortes Generales para la defensa de los derechos del Titulo I. No tiene funciones de direccion administrativa; su labor es supervisar y proteger derechos fundamentales.

- **C)** "Las **Cortes Generales**." Falso: las Cortes Generales (art. 66 CE) ejercen la potestad legislativa, aprueban los Presupuestos y controlan la accion del Gobierno. No dirigen la Administracion del Estado en las CCAA; esa es una funcion ejecutiva, no legislativa.

**Organo que dirige la Administracion del Estado en cada CCAA:**

| Organo | Funcion |
|--------|---------|
| **Delegado del Gobierno** (art. 154) | **Dirige la Administracion del Estado** en la CCAA |
| Presidente CCAA (art. 152.1) | Dirige el Gobierno autonomico |
| Cortes Generales (art. 66) | Potestad legislativa y control |
| Defensor del Pueblo (art. 54) | Defensa derechos fundamentales |

**Clave:** Art. 154 CE = Delegado del Gobierno = dirige la Administracion del Estado en la CCAA. No confundir con el Presidente de la CCAA, que dirige la administracion autonomica (no la estatal).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a6e27faa-9a0b-4984-bfa8-9068dece8688");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.154 Delegado Gobierno (" + exp2.length + " chars)");

  // #3 - RDL 5/2015 art.23 retribuciones básicas sueldo/trienios Subgrupo
  const exp3 = `**Articulo 23 del RDL 5/2015 (TREBEP) - Retribuciones basicas:**

> "Las retribuciones basicas [...] estaran integradas unica y exclusivamente por:
> a) El **sueldo** asignado a cada **Subgrupo o Grupo** de clasificacion profesional, en el supuesto de que este no tenga Subgrupo.
> b) Los **trienios**, que consisten en una cantidad, que sera igual para cada **Subgrupo o Grupo** de clasificacion profesional [...] por cada tres anos de servicio."

**Por que A es correcta (Subgrupo o Grupo de clasificacion profesional):**
El art. 23 TREBEP establece que tanto el sueldo como los trienios dependen del **Subgrupo o Grupo de clasificacion profesional** del funcionario. Ambos conceptos (sueldo y trienios) constituyen las retribuciones basicas, que se fijan en la Ley de Presupuestos Generales del Estado. Si el Grupo tiene Subgrupos, se atiende al Subgrupo; si no tiene Subgrupos, se atiende al Grupo directamente.

**Por que las demas son incorrectas:**

- **B)** "Se determina en funcion del **Cuerpo** al que pertenezca." Falso: el art. 23 no vincula el sueldo ni los trienios al Cuerpo del funcionario, sino al **Subgrupo o Grupo** de clasificacion. Varios Cuerpos diferentes pueden pertenecer al mismo Subgrupo (por ejemplo, A1) y por tanto tener el mismo sueldo base y trienios.

- **C)** "De la **titulacion** que ostenta el funcionario." Falso: el art. 23 vincula las retribuciones basicas al Subgrupo/Grupo, no a la titulacion personal. Aunque la titulacion determina a que Subgrupo puede acceder el funcionario (art. 76 TREBEP), una vez dentro, lo que fija el sueldo es el Subgrupo, no la titulacion concreta.

- **D)** "Ninguna de las respuestas anteriores es correcta." Falso: la opcion A es correcta, ya que reproduce fielmente el criterio del art. 23 TREBEP.

**Retribuciones basicas de los funcionarios (art. 23 TREBEP):**

| Concepto | Depende de | Periodicidad |
|----------|-----------|--------------|
| **Sueldo** | **Subgrupo/Grupo** | Mensual (14 pagas) |
| **Trienios** | **Subgrupo/Grupo** | Por cada 3 anos de servicio |

**Clasificacion profesional (art. 76 TREBEP):**

| Grupo | Subgrupo | Titulacion requerida |
|-------|----------|---------------------|
| A | A1 | Titulo universitario de Grado + Master |
| A | A2 | Titulo universitario de Grado |
| B | - | Titulo de Tecnico Superior |
| C | C1 | Titulo de Bachiller o Tecnico |
| C | C2 | Titulo de ESO |

**Clave:** Sueldo y trienios dependen del Subgrupo/Grupo (art. 23), no del Cuerpo ni de la titulacion personal del funcionario.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "2eb1e3df-24e8-4eff-9513-81ebf40d7a80");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - TREBEP art.23 retribuciones basicas (" + exp3.length + " chars)");
})();
